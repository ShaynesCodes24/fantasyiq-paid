from __future__ import annotations

import json
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from typing import Any
from urllib.parse import parse_qs

try:
    from customer_context import database_customer_context
    from database import customer_auth_record, record_ops_event, reset_customer_access_code
    from email_service import send_customer_password_reset_email
    from rate_limit import check_rate_limit, rate_limit_payload
except ModuleNotFoundError:
    from api.customer_context import database_customer_context
    from api.database import customer_auth_record, record_ops_event, reset_customer_access_code
    from api.email_service import send_customer_password_reset_email
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


def password_reset_payload(raw: dict[str, Any]) -> dict[str, Any]:
    identity = str(raw.get("customer") or raw.get("email") or raw.get("dashboard") or "").strip()
    if not identity:
        return {
            "ok": False,
            "message": "Enter the email from checkout or your dashboard slug.",
            "syncedAt": utc_now(),
        }

    result = {"sent": False, "reason": "account_not_found"}
    try:
        record = customer_auth_record(identity)
        if record:
            refreshed = reset_customer_access_code(str(record.get("slug") or identity)) or record
            context = database_customer_context(str(record.get("slug") or identity))
            league_key = getattr(context, "league_key", "") if context else ""
            result = send_customer_password_reset_email(
                {**record, **refreshed},
                league_key=league_key,
                idempotency_key=f"fantasyiq-password-reset-{record.get('slug')}-{int(datetime.now(timezone.utc).timestamp())}",
            )
            record_ops_event(
                event_type="login.password_reset_requested",
                severity="info" if result.get("sent") else "warning",
                source="customer_password_reset",
                customer_slug=str(record.get("slug") or ""),
                league_key=league_key,
                message="Password reset email requested.",
                payload={"sent": bool(result.get("sent")), "reason": result.get("reason") or ""},
            )
    except Exception as exc:
        record_ops_event(
            event_type="login.password_reset_failed",
            severity="warning",
            source="customer_password_reset",
            message=str(exc)[:500],
            payload={},
        )

    return {
        "ok": True,
        "message": "If that account exists, a password reset email is on the way.",
        "email": {"sent": bool(result.get("sent"))},
        "syncedAt": utc_now(),
    }


class handler(BaseHTTPRequestHandler):
    def send_json(self, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        try:
            raw = parse_body(self)
            limit = check_rate_limit(
                "customer_password_reset",
                headers=self.headers,
                raw=raw,
                fields=("customer", "email", "dashboard"),
                limit=5,
                window_seconds=3600,
            )
            if not limit.allowed:
                self.send_json(
                    rate_limit_payload(limit, "Too many password reset requests. Wait a while, then try again."),
                    HTTPStatus.TOO_MANY_REQUESTS,
                )
                return
            payload = password_reset_payload(raw)
            self.send_json(payload, HTTPStatus.OK if payload.get("ok") else HTTPStatus.BAD_REQUEST)
        except json.JSONDecodeError as exc:
            self.send_json({"ok": False, "message": str(exc), "syncedAt": utc_now()}, HTTPStatus.BAD_REQUEST)
        except Exception:
            self.send_json(
                {
                    "ok": True,
                    "message": "If that account exists, a password reset email is on the way.",
                    "syncedAt": utc_now(),
                }
            )

    def do_GET(self) -> None:
        self.send_json({"ok": True, "message": "POST an account email to request a FantasyIQ password reset email."})

    def do_HEAD(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
