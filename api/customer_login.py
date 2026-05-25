from __future__ import annotations

import json
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from typing import Any
from urllib.parse import parse_qs, urlparse

try:
    from customer_context import ConfigError, all_customer_contexts, database_customer_context, slugify, verify_customer_access
    from auth_service import make_session, session_cookie, verify_password
    from database import customer_auth_record
    from rate_limit import check_rate_limit, rate_limit_payload
except ModuleNotFoundError:
    from api.customer_context import ConfigError, all_customer_contexts, database_customer_context, slugify, verify_customer_access
    from api.auth_service import make_session, session_cookie, verify_password
    from api.database import customer_auth_record
    from api.rate_limit import check_rate_limit, rate_limit_payload


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


GENERIC_LOGIN_FAILURE = "Email, password, or access code did not match."


def is_email(value: str) -> bool:
    clean = str(value or "").strip()
    return "@" in clean and "." in clean.rsplit("@", 1)[-1] and " " not in clean


def parse_body(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    length = int(handler.headers.get("Content-Length") or 0)
    if length <= 0:
        return {}
    raw = handler.rfile.read(length)
    content_type = handler.headers.get("Content-Type", "")
    if "application/json" in content_type:
        return json.loads(raw.decode("utf-8") or "{}")
    parsed = parse_qs(raw.decode("utf-8"))
    return {key: values[0] if values else "" for key, values in parsed.items()}


def dashboard_url(customer_slug: str, league_key: str = "") -> str:
    query = {"customer": customer_slug}
    if league_key:
        query["league"] = league_key
    from urllib.parse import urlencode

    return f"/?{urlencode(query)}"


def log_login_event(event_type: str, message: str, raw: dict[str, Any], severity: str = "info") -> None:
    try:
        customer_slug = slugify(str(raw.get("customer") or raw.get("dashboard") or raw.get("email") or ""))
        league_key = slugify(str(raw.get("league") or raw.get("leagueKey") or ""))
        try:
            from database import record_ops_event
        except ImportError:
            from api.database import record_ops_event
        record_ops_event(
            event_type=event_type,
            severity=severity,
            source="customer_login",
            customer_slug=customer_slug,
            league_key=league_key,
            message=message[:500],
            payload={"authMode": "password" if raw.get("password") else "accessCode"},
        )
    except Exception:
        return


def login_payload(raw: dict[str, Any], headers: Any | None = None) -> tuple[dict[str, Any], list[tuple[str, str]]]:
    identity = str(raw.get("email") or raw.get("customer") or raw.get("dashboard") or "").strip()
    access_code = str(raw.get("accessCode") or raw.get("access_code") or raw.get("code") or "").strip()
    password = str(raw.get("password") or "").strip()
    selected_league = str(raw.get("league") or raw.get("leagueKey") or "").strip()
    if not identity:
        raise PermissionError("Enter the email from checkout.")
    if not is_email(identity):
        raise PermissionError("Enter a valid checkout email address.")

    if password:
        if len(password) > 128:
            raise PermissionError("Password must be 128 characters or fewer.")
        record = customer_auth_record(identity)
        if not record:
            raise PermissionError("We could not find that checkout email. Use the exact email from Stripe checkout or open the setup link from your email.")
        if not record.get("password_hash"):
            raise PermissionError("Create a password with your access code first.")
        if not verify_password(password, str(record.get("password_hash") or "")):
            raise PermissionError("Email or password did not match.")
        context = database_customer_context(str(record.get("slug") or identity), selected_league)
        if context is None:
            raise PermissionError("We could not find that customer dashboard. Open the setup link from your email or contact support.")
        token, expires_at = make_session(context.slug, headers)
        customer = context.public_dict()
        customer["passwordConfigured"] = True
        return (
            {
                "ok": True,
                "authenticated": True,
                "authMode": "password",
                "customer": customer,
                "dashboardUrl": dashboard_url(context.slug, context.league_key),
                "expiresAt": expires_at.isoformat(timespec="seconds").replace("+00:00", "Z"),
                "syncedAt": utc_now(),
            },
            [("Set-Cookie", session_cookie(token, headers, max_age=30 * 24 * 60 * 60))],
        )

    if not access_code:
        raise PermissionError("Enter your FantasyIQ access code or password.")

    context = database_customer_context(identity, selected_league)
    if context is None:
        context = all_customer_contexts(selected_league).get(slugify(identity))
    if context is None:
        raise PermissionError("We could not find that checkout email. Use the exact email from Stripe checkout or open the setup link from your email.")
    if not context.access_code:
        raise PermissionError("This customer account is missing a setup access code. Contact support so we can fix it.")
    if access_code != context.access_code:
        raise PermissionError("That access code does not match this checkout email. Check your setup email or contact support.")
    verify_customer_access(context, "", {"x-fantasyiq-access-code": access_code})
    customer = context.public_dict()
    extra_headers: list[tuple[str, str]] = []
    try:
        token, expires_at = make_session(context.slug, headers)
        extra_headers.append(("Set-Cookie", session_cookie(token, headers, max_age=30 * 24 * 60 * 60)))
        customer["passwordConfigured"] = bool((customer_auth_record(context.slug) or {}).get("password_hash"))
    except Exception:
        expires_at = None
        customer["passwordConfigured"] = False
    payload = {
        "ok": True,
        "authenticated": True,
        "authMode": "accessCode",
        "customer": customer,
        "dashboardUrl": dashboard_url(context.slug, context.league_key),
        "syncedAt": utc_now(),
    }
    if expires_at:
        payload["expiresAt"] = expires_at.isoformat(timespec="seconds").replace("+00:00", "Z")
    return payload, extra_headers


class handler(BaseHTTPRequestHandler):
    def send_json(
        self,
        payload: dict[str, Any],
        status: HTTPStatus = HTTPStatus.OK,
        extra_headers: list[tuple[str, str]] | None = None,
    ) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for name, value in extra_headers or []:
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        raw: dict[str, Any] = {}
        try:
            raw = parse_body(self)
            limit = check_rate_limit(
                "customer_login",
                headers=self.headers,
                raw=raw,
                fields=("customer", "email", "dashboard"),
                limit=10,
                window_seconds=600,
            )
            if not limit.allowed:
                log_login_event("login.rate_limited", "Too many login attempts.", raw, "warning")
                self.send_json(
                    rate_limit_payload(limit, "Too many login attempts. Wait a few minutes, then try again."),
                    HTTPStatus.TOO_MANY_REQUESTS,
                )
                return
            payload, extra_headers = login_payload(raw, self.headers)
            log_login_event("login.succeeded", "Customer dashboard login succeeded.", raw)
            self.send_json(payload, extra_headers=extra_headers)
        except (PermissionError, ConfigError, json.JSONDecodeError) as exc:
            log_login_event("login.failed", str(exc), raw, "warning")
            self.send_json({"ok": False, "message": GENERIC_LOGIN_FAILURE, "syncedAt": utc_now()}, HTTPStatus.UNAUTHORIZED)
        except Exception:
            log_login_event("login.error", "Could not verify that account right now.", raw, "warning")
            self.send_json({"ok": False, "message": "Could not verify that account right now.", "syncedAt": utc_now()}, HTTPStatus.BAD_GATEWAY)

    def do_GET(self) -> None:
        self.send_json({"ok": True, "message": "POST an email or customer slug with a password or access code to sign in."})

    def do_HEAD(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
