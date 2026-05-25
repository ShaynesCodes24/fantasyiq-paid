from __future__ import annotations

import json
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from typing import Any
import urllib.parse

try:
    from provider_cache import freshness_snapshot
    from rate_limit import check_rate_limit, rate_limit_payload
except (ModuleNotFoundError, ImportError):
    from api.provider_cache import freshness_snapshot
    from api.rate_limit import check_rate_limit, rate_limit_payload


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def int_param(value: str, default: int, low: int, high: int) -> int:
    try:
        number = int(float(str(value).strip()))
    except (TypeError, ValueError):
        return default
    return max(low, min(high, number))


def summarize(rows: list[dict[str, Any]]) -> dict[str, Any]:
    stale_rows = [row for row in rows if row.get("is_stale")]
    source_counts: dict[str, int] = {}
    latest_success = ""
    for row in rows:
        source = str(row.get("source") or "unknown")
        source_counts[source] = source_counts.get(source, 0) + 1
        success_at = str(row.get("last_success_at") or "")
        if success_at and success_at > latest_success:
            latest_success = success_at
    cron_rows = [row for row in rows if row.get("source") == "fantasyiq-cron"]
    return {
        "rowCount": len(rows),
        "staleCount": len(stale_rows),
        "sourceCounts": source_counts,
        "latestSuccessAt": latest_success,
        "cronStepCount": len(cron_rows),
        "cronSteps": sorted({str(row.get("source_scope") or "") for row in cron_rows if row.get("source_scope")}),
    }


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
        rows = freshness_snapshot(row_limit)
        summary = summarize(rows)
        self.send_json(
            {
                "ok": True,
                "syncedAt": utc_now(),
                "freshness": rows,
                "summary": summary,
                "staleCount": summary["staleCount"],
                "latestSuccessAt": summary["latestSuccessAt"],
                "databaseBacked": bool(rows),
                "message": "Daily refresh status is recorded after the first production cron run.",
            }
        )

    def do_HEAD(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
