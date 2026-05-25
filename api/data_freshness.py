from __future__ import annotations

import json
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler

try:
    from provider_cache import freshness_snapshot
    from rate_limit import check_rate_limit, rate_limit_payload
except (ModuleNotFoundError, ImportError):
    from api.provider_cache import freshness_snapshot
    from api.rate_limit import check_rate_limit, rate_limit_payload


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
        limit = check_rate_limit("data_freshness", headers=self.headers, limit=120, window_seconds=900)
        if not limit.allowed:
            self.send_json(rate_limit_payload(limit, "Data freshness status is receiving too many requests."), HTTPStatus.TOO_MANY_REQUESTS)
            return
        rows = freshness_snapshot()
        self.send_json(
            {
                "ok": True,
                "syncedAt": utc_now(),
                "freshness": rows,
                "databaseBacked": bool(rows),
                "message": "Daily refresh status is recorded after the first production cron run.",
            }
        )

    def do_HEAD(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
