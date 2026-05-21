from __future__ import annotations

import json
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler

try:
    from auth_service import clear_session_cookie, revoke_session, session_slug_from_headers
    from customer_context import ConfigError, database_customer_context, requested_league_slug, resolve_customer_context
except ModuleNotFoundError:
    from api.auth_service import clear_session_cookie, revoke_session, session_slug_from_headers
    from api.customer_context import ConfigError, database_customer_context, requested_league_slug, resolve_customer_context


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


class handler(BaseHTTPRequestHandler):
    def send_json(
        self,
        payload: dict,
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

    def do_GET(self) -> None:
        try:
            session_slug = session_slug_from_headers(self.headers)
            if not session_slug:
                self.send_json({"ok": True, "authenticated": False, "syncedAt": utc_now()})
                return
            selected_league = requested_league_slug(self.path)
            context = database_customer_context(session_slug, selected_league) or resolve_customer_context(self.path)
            if context.slug != session_slug:
                self.send_json({"ok": True, "authenticated": False, "syncedAt": utc_now()})
                return
            self.send_json(
                {
                    "ok": True,
                    "authenticated": True,
                    "customer": context.public_dict(),
                    "syncedAt": utc_now(),
                }
            )
        except ConfigError as exc:
            self.send_json({"ok": False, "message": str(exc), "syncedAt": utc_now()}, HTTPStatus.BAD_REQUEST)
        except Exception:
            self.send_json({"ok": False, "message": "Could not read customer session.", "syncedAt": utc_now()}, HTTPStatus.BAD_GATEWAY)

    def do_POST(self) -> None:
        self.do_DELETE()

    def do_DELETE(self) -> None:
        revoke_session(self.headers)
        self.send_json(
            {"ok": True, "authenticated": False, "syncedAt": utc_now()},
            extra_headers=[("Set-Cookie", clear_session_cookie(self.headers))],
        )

    def do_HEAD(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
