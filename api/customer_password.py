from __future__ import annotations

import json
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from typing import Any
from urllib.parse import parse_qs

try:
    from auth_service import make_session, password_hash, password_policy_error, session_cookie
    from customer_context import ConfigError, CustomerContext, all_customer_contexts, database_customer_context, slugify
    from database import consume_customer_access_code, customer_auth_record, record_ops_event, revoke_customer_sessions, set_customer_password, upsert_customer, upsert_league
    from rate_limit import check_rate_limit, rate_limit_payload
except ModuleNotFoundError:
    from api.auth_service import make_session, password_hash, password_policy_error, session_cookie
    from api.customer_context import ConfigError, CustomerContext, all_customer_contexts, database_customer_context, slugify
    from api.database import consume_customer_access_code, customer_auth_record, record_ops_event, revoke_customer_sessions, set_customer_password, upsert_customer, upsert_league
    from api.rate_limit import check_rate_limit, rate_limit_payload


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


def is_email(value: str) -> bool:
    clean = str(value or "").strip()
    return "@" in clean and "." in clean.rsplit("@", 1)[-1] and " " not in clean


def dashboard_url(customer_slug: str, league_key: str = "") -> str:
    from urllib.parse import urlencode

    query = {"customer": customer_slug}
    if league_key:
        query["league"] = league_key
    return f"/?{urlencode(query)}"


def log_password_event(event_type: str, raw: dict[str, Any], message: str, severity: str = "info") -> None:
    try:
        identity = str(raw.get("customer") or raw.get("email") or raw.get("dashboard") or "")
        record_ops_event(
            event_type=event_type,
            severity=severity,
            source="customer_password",
            customer_slug=slugify(identity) if identity else "",
            league_key=slugify(str(raw.get("league") or raw.get("leagueKey") or "")) if raw.get("league") or raw.get("leagueKey") else "",
            message=message[:500],
            payload={},
        )
    except Exception:
        return


def ensure_database_customer(context: CustomerContext) -> None:
    if customer_auth_record(context.slug):
        return

    upsert_customer(
        slug=context.slug,
        customer_name=context.customer_name,
        email=context.email,
        access_code=context.access_code,
        status=context.status or "configured",
        subscription_status=context.subscription_status,
        included_league_limit=context.included_league_limit,
        additional_league_count=context.additional_league_count,
        default_league_key=context.league_key,
    )
    leagues = context.available_leagues or []
    if not leagues and context.league_id:
        leagues = [
            {
                "key": context.league_key or "primary",
                "label": context.league_name or "Primary League",
                "leagueName": context.league_name,
                "leagueId": context.league_id,
                "teamId": context.customer_team_id,
                "teamName": context.customer_team_name,
                "season": context.season,
                "leagueSettings": context.league_settings,
            }
        ]
    for league in leagues:
        upsert_league(
            customer_slug=context.slug,
            league_key=str(league.get("key") or league.get("leagueKey") or context.league_key or "primary"),
            label=str(league.get("label") or league.get("leagueName") or context.league_name or ""),
            league_name=str(league.get("leagueName") or league.get("league_name") or context.league_name or ""),
            league_id=league.get("leagueId") or league.get("league_id"),
            team_id=league.get("teamId") or league.get("team_id") or league.get("customerTeamId"),
            team_name=str(league.get("teamName") or league.get("team_name") or league.get("customerTeamName") or ""),
            season=league.get("season") or context.season,
            league_settings=league.get("leagueSettings") or league.get("league_settings") or context.league_settings,
            status=str(league.get("status") or "configured"),
            source="password_migration",
        )


def create_password_payload(raw: dict[str, Any], headers: Any | None = None) -> tuple[dict[str, Any], list[tuple[str, str]]]:
    identity = str(raw.get("email") or raw.get("customer") or raw.get("dashboard") or "").strip()
    access_code = str(raw.get("accessCode") or raw.get("access_code") or raw.get("code") or "").strip()
    password = str(raw.get("password") or "").strip()
    selected_league = str(raw.get("league") or raw.get("leagueKey") or "").strip()
    if not identity:
        raise PermissionError("Enter the email from checkout.")
    if not is_email(identity):
        raise PermissionError("Enter a valid checkout email address.")
    if not access_code:
        raise PermissionError("Enter your FantasyIQ access code to create a password.")
    policy_error = password_policy_error(password)
    if policy_error:
        raise PermissionError(policy_error)

    context = database_customer_context(identity, selected_league)
    if context is None:
        context = all_customer_contexts(selected_league).get(slugify(identity))
    if context is None:
        raise PermissionError("We could not find that checkout email. Use the exact email from Stripe checkout or open the setup link from your email.")
    if not context.access_code:
        raise PermissionError("This customer account is missing a setup access code. Contact support so we can fix it.")
    if access_code != context.access_code:
        raise PermissionError("That access code does not match this checkout email. Check your setup email or contact support.")

    ensure_database_customer(context)
    saved = set_customer_password(context.slug, password_hash(password))
    if not saved:
        raise PermissionError("We could not update that password. Contact support if this keeps happening.")
    revoke_customer_sessions(context.slug)
    consume_customer_access_code(context.slug)
    token, expires_at = make_session(context.slug, headers)
    customer = context.public_dict()
    customer["passwordConfigured"] = True
    customer["accessRequired"] = True
    return (
        {
            "ok": True,
            "authenticated": True,
            "customer": customer,
            "dashboardUrl": dashboard_url(context.slug, context.league_key),
            "expiresAt": expires_at.isoformat(timespec="seconds").replace("+00:00", "Z"),
            "syncedAt": utc_now(),
        },
        [("Set-Cookie", session_cookie(token, headers, max_age=30 * 24 * 60 * 60))],
    )


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
                "customer_password",
                headers=self.headers,
                raw=raw,
                fields=("customer", "email", "dashboard"),
                limit=8,
                window_seconds=900,
            )
            if not limit.allowed:
                log_password_event("password.rate_limited", raw, "Too many password setup attempts.", "warning")
                self.send_json(
                    rate_limit_payload(limit, "Too many password setup attempts. Wait a few minutes, then try again."),
                    HTTPStatus.TOO_MANY_REQUESTS,
                )
                return
            payload, extra_headers = create_password_payload(raw, self.headers)
            log_password_event("password.created", raw, "Customer password was created or reset.")
            self.send_json(payload, extra_headers=extra_headers)
        except (PermissionError, ConfigError, json.JSONDecodeError) as exc:
            log_password_event("password.create_failed", raw, str(exc), "warning")
            self.send_json({"ok": False, "message": str(exc), "syncedAt": utc_now()}, HTTPStatus.UNAUTHORIZED)
        except Exception:
            log_password_event("password.create_failed", raw, "Could not create that password right now.", "warning")
            self.send_json({"ok": False, "message": "Could not create that password right now.", "syncedAt": utc_now()}, HTTPStatus.BAD_GATEWAY)

    def do_GET(self) -> None:
        self.send_json({"ok": True, "message": "POST an access code and new password to create customer password login."})

    def do_HEAD(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
