from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from typing import Any, Callable

try:
    from fantasycalc_market import refresh_common_markets
    from fantasycalc_trades import refresh_daily_trade_database
    from provider_cache import record_freshness
except (ModuleNotFoundError, ImportError):
    from api.fantasycalc_market import refresh_common_markets
    from api.fantasycalc_trades import refresh_daily_trade_database
    from api.provider_cache import record_freshness


MAX_AGE_SECONDS = 60 * 60 * 27


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def authorized(headers: Any) -> bool:
    secret = env("CRON_SECRET")
    if not secret:
        return env("VERCEL_ENV") not in {"production", "preview"}
    return str(headers.get("Authorization") or headers.get("authorization") or "") == f"Bearer {secret}"


def result_ok(result: Any) -> bool:
    if isinstance(result, dict) and result.get("ok") is False:
        return False
    if isinstance(result, list) and any(isinstance(item, dict) and item.get("ok") is False for item in result):
        return False
    return True


def result_warning(result: Any) -> str:
    if isinstance(result, dict):
        return str(result.get("warning") or result.get("error") or result.get("message") or "")[:1000]
    if isinstance(result, list):
        warnings = [
            str(item.get("warning") or item.get("error") or item.get("message") or "")
            for item in result
            if isinstance(item, dict) and item.get("ok") is False
        ]
        return "; ".join(warning for warning in warnings if warning)[:1000]
    return ""


def run_step(name: str, fn: Callable[[], Any]) -> dict[str, Any]:
    started = utc_now()
    try:
        result = fn()
        ok = result_ok(result)
        warning = result_warning(result)
        record_freshness(
            source="fantasyiq-cron",
            source_scope=name,
            ok=ok,
            max_age_seconds=MAX_AGE_SECONDS,
            warning=warning,
            metadata={"result": result},
        )
        return {"name": name, "ok": ok, "startedAt": started, "finishedAt": utc_now(), "result": result, "warning": warning}
    except Exception as exc:
        record_freshness(
            source="fantasyiq-cron",
            source_scope=name,
            ok=False,
            max_age_seconds=MAX_AGE_SECONDS,
            warning=str(exc),
        )
        return {"name": name, "ok": False, "startedAt": started, "finishedAt": utc_now(), "error": str(exc)}


def refresh_live_board_snapshot() -> dict[str, Any]:
    try:
        try:
            from live_boards import build_live_board_payload
        except ImportError:
            from api.live_boards import build_live_board_payload

        payload = build_live_board_payload("/api/live-boards?limit=180&demoMode=1", headers=None, force=True, limit=180)
        return {
            "ok": bool(payload.get("live")),
            "rowCount": len(((payload.get("boards") or {}).get("combined") or {}).get("rows") or []),
            "syncedAt": payload.get("syncedAt"),
        }
    except Exception as exc:
        return {"ok": False, "warning": str(exc)}


def daily_refresh_payload() -> dict[str, Any]:
    steps = [
        run_step("fantasycalc-market", refresh_common_markets),
        run_step("fantasycalc-trade-database", refresh_daily_trade_database),
        run_step("live-board-demo-snapshot", refresh_live_board_snapshot),
    ]
    return {
        "ok": all(step.get("ok") for step in steps),
        "source": "FantasyIQ daily refresh",
        "syncedAt": utc_now(),
        "steps": steps,
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
        payload = daily_refresh_payload()
        self.send_json(payload, HTTPStatus.OK if payload.get("ok") else HTTPStatus.BAD_GATEWAY)

    def do_HEAD(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
