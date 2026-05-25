from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from typing import Any


DEFAULT_SEASON = 2026


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def authorized(headers: Any) -> bool:
    secret = env("CRON_SECRET")
    if not secret:
        return env("VERCEL_ENV") not in {"production", "preview"}
    return str(headers.get("Authorization") or headers.get("authorization") or "") == f"Bearer {secret}"


def schedule_heatmap_refresh_payload(season: int = DEFAULT_SEASON) -> dict[str, Any]:
    try:
        try:
            from sos_heatmap import force_refresh_payload
        except ImportError:
            from api.sos_heatmap import force_refresh_payload

        payload = force_refresh_payload(season)
        weekly_log = payload.get("weeklyRefreshLog") or {}
        provider_meta = payload.get("providerMeta") or {}
        report = payload.get("scheduleMovementReport") or {}
        return {
            "ok": bool(payload.get("ok")),
            "source": "FantasyIQ weekly schedule heatmap refresh",
            "season": season,
            "syncedAt": utc_now(),
            "rows": len(payload.get("rows") or []),
            "historicalSnapshot": payload.get("historicalSnapshot") or {},
            "weeklyRefreshLog": weekly_log,
            "validation": payload.get("validation") or weekly_log.get("validation") or {},
            "weekCompletion": provider_meta.get("weekCompletion") or {},
            "odds": (provider_meta.get("odds") or {}),
            "scheduleMovementReport": {
                "upgrades": len(report.get("biggestScheduleUpgrades") or []),
                "downgrades": len(report.get("biggestScheduleDowngrades") or []),
                "bestStreamingSpots": len(report.get("bestStreamingSpots") or []),
                "oneClearRecommendation": report.get("oneClearRecommendation") or "",
            },
            "agentWorkflow": {
                "leadAgent": (payload.get("agentWorkflow") or {}).get("leadAgent") or {},
                "agentCount": len((payload.get("agentWorkflow") or {}).get("agents") or []),
            },
        }
    except Exception as exc:
        try:
            try:
                from provider_cache import record_freshness
            except ImportError:
                from api.provider_cache import record_freshness
            record_freshness(
                source="fantasyiq-cron",
                source_scope="sos-heatmap",
                ok=False,
                max_age_seconds=8 * 24 * 60 * 60,
                warning=str(exc),
                metadata={"season": season},
            )
        except Exception:
            pass
        return {
            "ok": False,
            "source": "FantasyIQ weekly schedule heatmap refresh",
            "season": season,
            "syncedAt": utc_now(),
            "error": str(exc),
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
        if not authorized(self.headers):
            self.send_json({"ok": False, "message": "Unauthorized cron request.", "syncedAt": utc_now()}, HTTPStatus.UNAUTHORIZED)
            return
        payload = schedule_heatmap_refresh_payload()
        self.send_json(payload, HTTPStatus.OK if payload.get("ok") else HTTPStatus.BAD_GATEWAY)

    def do_HEAD(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
