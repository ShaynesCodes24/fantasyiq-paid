from __future__ import annotations

import json
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from typing import Any
from urllib.parse import parse_qs, urlparse

try:
    from parlay_iq_engine import parlay_iq_recommendation
except (ModuleNotFoundError, ImportError):
    from api.parlay_iq_engine import parlay_iq_recommendation


def read_json_body(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    length = int(handler.headers.get("Content-Length") or 0)
    if length <= 0:
        return {}
    raw = handler.rfile.read(length).decode("utf-8")
    if not raw.strip():
        return {}
    parsed = json.loads(raw)
    return parsed if isinstance(parsed, dict) else {}


class handler(BaseHTTPRequestHandler):
    def send_json(self, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        raw = json.dumps(payload, default=str).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self) -> None:
        query = parse_qs(urlparse(self.path).query)
        try:
            self.send_json(parlay_iq_recommendation({}, query))
        except Exception as exc:
            self.send_json(
                {
                    "ok": False,
                    "message": "Parlay IQ could not build recommendations.",
                    "error": str(exc),
                },
                HTTPStatus.INTERNAL_SERVER_ERROR,
            )

    def do_POST(self) -> None:
        query = parse_qs(urlparse(self.path).query)
        try:
            body = read_json_body(self)
        except json.JSONDecodeError:
            self.send_json({"ok": False, "message": "Request body must be valid JSON."}, HTTPStatus.BAD_REQUEST)
            return
        try:
            self.send_json(parlay_iq_recommendation(body, query))
        except Exception as exc:
            self.send_json(
                {
                    "ok": False,
                    "message": "Parlay IQ could not build recommendations.",
                    "error": str(exc),
                },
                HTTPStatus.INTERNAL_SERVER_ERROR,
            )
