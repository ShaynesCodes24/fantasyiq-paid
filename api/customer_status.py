from __future__ import annotations

import json
import base64
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from typing import Any
from urllib.parse import parse_qs, urlparse

try:
    from customer_context import ConfigError, access_code_from, env, resolve_customer_context, verify_customer_access
    from auth_service import session_slug_from_headers
    from database import customer_billing_record, record_ops_event
    from rate_limit import check_rate_limit, rate_limit_payload
except ModuleNotFoundError:
    from api.customer_context import ConfigError, access_code_from, env, resolve_customer_context, verify_customer_access
    from api.auth_service import session_slug_from_headers
    from api.database import customer_billing_record, record_ops_event
    from api.rate_limit import check_rate_limit, rate_limit_payload


STRIPE_API_VERSION = "2026-02-25.clover"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


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


def is_customer_portal_request(handler: BaseHTTPRequestHandler) -> bool:
    return "route=customer_portal" in str(handler.path or "")


def return_url() -> str:
    configured = env("FANTASYIQ_STRIPE_PORTAL_RETURN_URL")
    if configured:
        return configured
    return f"{env('FANTASYIQ_SITE_URL', 'https://myfantasyiq.com').rstrip('/')}/FantasyIQ/?login=1"


def stripe_secret_key() -> str:
    return os.environ.get("STRIPE_SECRET_KEY", "").strip()


def basic_auth_header(secret_key: str) -> str:
    token = base64.b64encode(f"{secret_key}:".encode("utf-8")).decode("ascii")
    return f"Basic {token}"


def create_stripe_portal_session(stripe_customer_id: str) -> dict[str, Any]:
    secret_key = stripe_secret_key()
    if not secret_key:
        raise RuntimeError("STRIPE_SECRET_KEY is not configured.")
    if not stripe_customer_id or not stripe_customer_id.startswith("cus_"):
        raise PermissionError("This account is missing a Stripe customer ID. Contact support to manage billing.")

    body = urllib.parse.urlencode({"customer": stripe_customer_id, "return_url": return_url()}).encode("utf-8")
    request = urllib.request.Request(
        "https://api.stripe.com/v1/billing_portal/sessions",
        data=body,
        headers={
            "Authorization": basic_auth_header(secret_key),
            "Content-Type": "application/x-www-form-urlencoded",
            "Stripe-Version": env("STRIPE_API_VERSION", STRIPE_API_VERSION),
            "User-Agent": "MyFantasyIQ/1.0 (+https://myfantasyiq.com)",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {"error": {"message": raw[:500]}}
        message = str((payload.get("error") or {}).get("message") or "Stripe could not create a portal session.")
        raise RuntimeError(message) from exc


def log_portal_event(event_type: str, customer_slug: str, message: str, severity: str = "info") -> None:
    try:
        record_ops_event(
            event_type=event_type,
            severity=severity,
            source="customer_portal",
            customer_slug=customer_slug,
            message=message[:500],
            payload={},
        )
    except Exception:
        return


def redacted_customer_status(context: Any) -> dict[str, Any]:
    return {
        "customerSlug": context.slug,
        "accessRequired": bool(context.access_code or context.password_configured),
        "passwordConfigured": bool(context.password_configured),
    }


class handler(BaseHTTPRequestHandler):
    def send_json(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if is_customer_portal_request(self):
            self.send_json({"ok": True, "message": "POST while signed in to create a Stripe customer portal session."})
            return
        try:
            params = {key: values[0] if values else "" for key, values in parse_qs(urlparse(self.path).query).items()}
            if access_code_from(self.path, self.headers):
                limit = check_rate_limit(
                    "customer_status_access",
                    headers=self.headers,
                    raw=params,
                    fields=("customer", "dashboard", "league"),
                    limit=20,
                    window_seconds=600,
                )
                if not limit.allowed:
                    self.send_json(
                        rate_limit_payload(limit, "Too many access checks. Wait a few minutes, then try again."),
                        HTTPStatus.TOO_MANY_REQUESTS,
                    )
                    return
            context = resolve_customer_context(self.path)
            authenticated = not bool(context.access_code or context.password_configured)
            if session_slug_from_headers(self.headers) == context.slug:
                authenticated = True
            if access_code_from(self.path, self.headers):
                verify_customer_access(context, self.path, self.headers)
                authenticated = True
            customer_payload = context.public_dict() if authenticated else redacted_customer_status(context)
            self.send_json(
                {
                    "ok": True,
                    "customer": customer_payload,
                    "accessRequired": bool(context.access_code or context.password_configured),
                    "authenticated": authenticated,
                    "syncedAt": utc_now(),
                }
            )
        except PermissionError as exc:
            self.send_json({"ok": False, "message": str(exc), "syncedAt": utc_now()}, HTTPStatus.UNAUTHORIZED)
        except ConfigError as exc:
            self.send_json({"ok": False, "message": str(exc), "syncedAt": utc_now()}, HTTPStatus.BAD_REQUEST)

    def do_POST(self) -> None:
        customer_slug = ""
        try:
            if not is_customer_portal_request(self):
                self.send_json({"ok": False, "message": "Unsupported customer status action.", "syncedAt": utc_now()}, HTTPStatus.NOT_FOUND)
                return
            parse_body(self)
            customer_slug = session_slug_from_headers(self.headers)
            if not customer_slug:
                raise PermissionError("Sign in before managing billing.")
            limit = check_rate_limit(
                "customer_portal",
                headers=self.headers,
                raw={"customer": customer_slug},
                fields=("customer",),
                limit=10,
                window_seconds=600,
            )
            if not limit.allowed:
                self.send_json(
                    rate_limit_payload(limit, "Too many billing portal requests. Wait a few minutes, then try again."),
                    HTTPStatus.TOO_MANY_REQUESTS,
                )
                return

            record = customer_billing_record(customer_slug)
            if not record:
                raise PermissionError("Customer account was not found. Sign in again or contact support.")
            session = create_stripe_portal_session(str(record.get("stripe_customer_id") or ""))
            url = str(session.get("url") or "")
            if not url:
                raise RuntimeError("Stripe did not return a billing portal URL.")
            log_portal_event("billing.portal_session_created", customer_slug, "Customer opened Stripe billing portal.")
            self.send_json({"ok": True, "url": url, "syncedAt": utc_now()})
        except PermissionError as exc:
            log_portal_event("billing.portal_session_denied", customer_slug, str(exc), "warning")
            self.send_json({"ok": False, "message": str(exc), "syncedAt": utc_now()}, HTTPStatus.UNAUTHORIZED)
        except Exception as exc:
            log_portal_event("billing.portal_session_failed", customer_slug, str(exc), "warning")
            self.send_json({"ok": False, "message": str(exc), "syncedAt": utc_now()}, HTTPStatus.BAD_GATEWAY)

    def do_HEAD(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
