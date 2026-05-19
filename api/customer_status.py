from __future__ import annotations

import json
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler

try:
    from customer_context import ConfigError, access_code_from, resolve_customer_context, verify_customer_access
except ModuleNotFoundError:
    from api.customer_context import ConfigError, access_code_from, resolve_customer_context, verify_customer_access


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


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
        try:
            context = resolve_customer_context(self.path)
            authenticated = not bool(context.access_code)
            if access_code_from(self.path, self.headers):
                verify_customer_access(context, self.path, self.headers)
                authenticated = True
            self.send_json(
                {
                    "ok": True,
                    "customer": context.public_dict(),
                    "accessRequired": bool(context.access_code),
                    "authenticated": authenticated,
                    "syncedAt": utc_now(),
                }
            )
        except PermissionError as exc:
            self.send_json({"ok": False, "message": str(exc), "syncedAt": utc_now()}, HTTPStatus.UNAUTHORIZED)
        except ConfigError as exc:
            self.send_json({"ok": False, "message": str(exc), "syncedAt": utc_now()}, HTTPStatus.BAD_REQUEST)

    def do_HEAD(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
