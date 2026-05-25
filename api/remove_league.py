from __future__ import annotations

import json
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from typing import Any

try:
    from auth_service import session_slug_from_headers
    from customer_context import authorize_customer_context, requested_league_slug
    from database import archive_customer_league, customer_entry, record_ops_event
    from rate_limit import check_rate_limit, rate_limit_payload
except ModuleNotFoundError:
    from api.auth_service import session_slug_from_headers
    from api.customer_context import authorize_customer_context, requested_league_slug
    from api.database import archive_customer_league, customer_entry, record_ops_event
    from api.rate_limit import check_rate_limit, rate_limit_payload


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def parse_body(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    length = int(handler.headers.get("Content-Length") or 0)
    if length <= 0:
        return {}
    raw = handler.rfile.read(length)
    if "application/json" in handler.headers.get("Content-Type", ""):
        return json.loads(raw.decode("utf-8") or "{}")
    return {}


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
            context = authorize_customer_context(self.path, self.headers)
            if session_slug_from_headers(self.headers) != context.slug:
                raise PermissionError("Sign in before removing a league profile.")
            body = parse_body(self)
            league_key = str(body.get("leagueKey") or body.get("league") or requested_league_slug(self.path) or context.league_key or "").strip()
            limit = check_rate_limit(
                "remove_league",
                headers=self.headers,
                raw={"customer": context.slug, "league": league_key},
                fields=("customer", "league"),
                limit=10,
                window_seconds=600,
            )
            if not limit.allowed:
                self.send_json(rate_limit_payload(limit, "Too many league removal attempts. Wait a few minutes, then try again."), HTTPStatus.TOO_MANY_REQUESTS)
                return
            result = archive_customer_league(context.slug, league_key)
            record_ops_event(
                event_type="league.removed",
                severity="info",
                source="remove_league",
                customer_slug=context.slug,
                league_key=league_key,
                message="Customer archived a league profile from the dashboard.",
                payload=result,
            )
            customer = customer_entry(context.slug, str(result.get("nextLeagueKey") or ""))
            self.send_json(
                {
                    "ok": True,
                    "customer": customer,
                    "removedLeagueKey": league_key,
                    "nextLeagueKey": result.get("nextLeagueKey") or "",
                    "syncedAt": utc_now(),
                }
            )
        except PermissionError as exc:
            self.send_json({"ok": False, "message": str(exc), "syncedAt": utc_now()}, HTTPStatus.UNAUTHORIZED)
        except (KeyError, ValueError) as exc:
            self.send_json({"ok": False, "message": str(exc), "syncedAt": utc_now()}, HTTPStatus.BAD_REQUEST)
        except Exception:
            self.send_json({"ok": False, "message": "Could not remove this league profile.", "syncedAt": utc_now()}, HTTPStatus.BAD_GATEWAY)

    def do_GET(self) -> None:
        self.send_json({"ok": True, "message": "POST while signed in to remove a league profile."})

    def do_HEAD(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
