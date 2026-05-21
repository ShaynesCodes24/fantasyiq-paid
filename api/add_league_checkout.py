from __future__ import annotations

import json
import urllib.parse
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from typing import Any

try:
    from customer_context import authorize_customer_context, env
except ModuleNotFoundError:
    from api.customer_context import authorize_customer_context, env


DEFAULT_ADD_ON_LINK = "https://buy.stripe.com/dRmcN5aAV1GX0Cc7X3efC02"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def setup_url(customer_slug: str) -> str:
    return f"/setup.html?{urllib.parse.urlencode({'customer': customer_slug})}"


def add_on_payment_url(customer_slug: str, email: str = "") -> str:
    base = env("FANTASYIQ_ADDITIONAL_LEAGUE_PAYMENT_LINK_URL", DEFAULT_ADD_ON_LINK)
    separator = "&" if "?" in base else "?"
    params = {
        "client_reference_id": customer_slug,
        "utm_source": "fantasyiq_dashboard",
        "utm_medium": "account_hub",
        "utm_campaign": "additional_league",
    }
    if email:
        params["prefilled_email"] = email
    return f"{base}{separator}{urllib.parse.urlencode(params)}"


def checkout_payload(path: str, headers: Any) -> dict[str, Any]:
    context = authorize_customer_context(path, headers)
    configured = len(context.available_leagues)
    if configured <= 0 and context.league_id:
        configured = 1
    included_limit = int(context.included_league_limit or 3)
    allowed = included_limit + int(context.additional_league_count or 0)
    needs_payment = configured >= allowed
    url = add_on_payment_url(context.slug, context.email) if needs_payment else setup_url(context.slug)
    return {
        "ok": True,
        "needsPayment": needs_payment,
        "url": url,
        "customerSlug": context.slug,
        "configuredLeagueCount": configured,
        "includedLeagueLimit": included_limit,
        "additionalLeagueCount": int(context.additional_league_count or 0),
        "allowedLeagueCount": allowed,
        "message": (
            "Extra league checkout is ready."
            if needs_payment
            else "You still have an included league slot. Continue to setup."
        ),
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

    def do_GET(self) -> None:
        try:
            self.send_json(checkout_payload(self.path, self.headers))
        except PermissionError as exc:
            self.send_json({"ok": False, "message": str(exc), "syncedAt": utc_now()}, HTTPStatus.UNAUTHORIZED)
        except Exception:
            self.send_json({"ok": False, "message": "Could not prepare add-league checkout.", "syncedAt": utc_now()}, HTTPStatus.BAD_GATEWAY)

    def do_POST(self) -> None:
        self.do_GET()

    def do_HEAD(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
