from __future__ import annotations

import json
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from typing import Any
import urllib.parse

try:
    from provider_cache import freshness_health_report
    from rate_limit import check_rate_limit, rate_limit_payload
except (ModuleNotFoundError, ImportError):
    from api.provider_cache import freshness_health_report
    from api.rate_limit import check_rate_limit, rate_limit_payload


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def int_param(value: str, default: int, low: int, high: int) -> int:
    try:
        number = int(float(str(value).strip()))
    except (TypeError, ValueError):
        return default
    return max(low, min(high, number))


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
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        row_limit = int_param(params.get("limit", ["240"])[0], 240, 20, 500)
        report = freshness_health_report(row_limit)
        summary = report.get("summary") or {}
        self.send_json(
            {
                "ok": True,
                "syncedAt": utc_now(),
                "status": report.get("status"),
                "freshness": report.get("freshness") or [],
                "summary": summary,
                "staleCount": summary["staleCount"],
                "overdueCount": summary.get("overdueCount", 0),
                "missingRequiredScopes": report.get("missingRequiredScopes") or [],
                "requiredDataScopes": report.get("requiredDataScopes") or [],
                "requiredProblemRows": report.get("requiredProblemRows") or [],
                "nonRequiredProblemRows": report.get("nonRequiredProblemRows") or [],
                "latestSuccessAt": summary["latestSuccessAt"],
                "databaseBacked": bool(report.get("freshness")),
                "message": "Daily refresh status is recorded after the first production cron run.",
            }
        )

    def do_HEAD(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
