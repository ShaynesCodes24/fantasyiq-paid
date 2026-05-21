from __future__ import annotations

import json
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from typing import Any
from urllib.parse import parse_qs, urlparse

try:
    from customer_context import ConfigError, all_customer_contexts, database_customer_context, slugify, verify_customer_access
except ModuleNotFoundError:
    from api.customer_context import ConfigError, all_customer_contexts, database_customer_context, slugify, verify_customer_access


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


def dashboard_url(customer_slug: str, league_key: str = "") -> str:
    query = {"customer": customer_slug}
    if league_key:
        query["league"] = league_key
    from urllib.parse import urlencode

    return f"/FantasyIQ/?{urlencode(query)}"


def login_payload(raw: dict[str, Any]) -> dict[str, Any]:
    identity = str(raw.get("customer") or raw.get("email") or raw.get("dashboard") or "").strip()
    access_code = str(raw.get("accessCode") or raw.get("access_code") or raw.get("code") or "").strip()
    selected_league = str(raw.get("league") or raw.get("leagueKey") or "").strip()
    if not identity:
        raise PermissionError("Enter the email from checkout or your dashboard slug.")
    if not access_code:
        raise PermissionError("Enter your FantasyIQ access code.")

    context = database_customer_context(identity, selected_league)
    if context is None:
        context = all_customer_contexts(selected_league).get(slugify(identity))
    if context is None:
        raise PermissionError("Customer account was not found.")
    if not context.access_code:
        raise PermissionError("This customer account does not have an access code yet.")
    verify_customer_access(context, "", {"x-fantasyiq-access-code": access_code})
    customer = context.public_dict()
    return {
        "ok": True,
        "authenticated": True,
        "customer": customer,
        "dashboardUrl": dashboard_url(context.slug, context.league_key),
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
            self.send_json(login_payload(parse_body(self)))
        except (PermissionError, ConfigError, json.JSONDecodeError) as exc:
            self.send_json({"ok": False, "message": str(exc), "syncedAt": utc_now()}, HTTPStatus.UNAUTHORIZED)
        except Exception:
            self.send_json({"ok": False, "message": "Could not verify that account right now.", "syncedAt": utc_now()}, HTTPStatus.BAD_GATEWAY)

    def do_GET(self) -> None:
        self.send_json({"ok": True, "message": "POST an email or customer slug with an access code to sign in."})

    def do_HEAD(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
