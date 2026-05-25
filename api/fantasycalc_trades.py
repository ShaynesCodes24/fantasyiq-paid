from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from typing import Any

try:
    from provider_cache import load_provider_payload, record_freshness, save_provider_payload
    from rate_limit import check_rate_limit, rate_limit_payload
except (ModuleNotFoundError, ImportError):
    from api.provider_cache import load_provider_payload, record_freshness, save_provider_payload
    from api.rate_limit import check_rate_limit, rate_limit_payload


FANTASYCALC_API_BASE = "https://api.fantasycalc.com"
HTTP_TIMEOUT_SECONDS = 10
MEMORY_TTL_SECONDS = 60 * 60 * 3
DURABLE_TTL_SECONDS = 60 * 60 * 27
_cache: dict[str, dict[str, Any]] = {}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def bool_param(value: str, default: bool = False) -> bool:
    if value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "dynasty"}


def int_param(value: str, default: int, low: int, high: int) -> int:
    try:
        number = int(float(str(value).strip()))
    except (TypeError, ValueError):
        return default
    return max(low, min(high, number))


def float_param(value: str, default: float, allowed: tuple[float, ...]) -> float:
    try:
        number = float(str(value).strip())
    except (TypeError, ValueError):
        return default
    return min(allowed, key=lambda item: abs(item - number))


def fantasycalc_json(path: str, params: dict[str, Any] | None = None) -> Any:
    query = urllib.parse.urlencode(params or {}, doseq=True)
    request = urllib.request.Request(
        f"{FANTASYCALC_API_BASE}{path}{'?' + query if query else ''}",
        headers={
            "Accept": "application/json",
            "User-Agent": "FantasyIQ/1.0 (daily trade database cache)",
        },
    )
    with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
        return json.loads(response.read().decode("utf-8"))


def compact_trade(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row.get("id") or row.get("tradeId") or "",
        "date": row.get("date") or row.get("createdAt") or row.get("acceptedAt") or "",
        "leagueSize": row.get("numTeams") or row.get("leagueSize"),
        "ppr": row.get("ppr"),
        "numQbs": row.get("numQbs"),
        "isDynasty": row.get("isDynasty"),
        "side1": row.get("side1") or row.get("team1") or row.get("assets1") or row.get("players1") or [],
        "side2": row.get("side2") or row.get("team2") or row.get("assets2") or row.get("players2") or [],
    }


def normalize_options(raw_query: str) -> tuple[str, dict[str, Any]]:
    params = urllib.parse.parse_qs(raw_query)
    options = {
        "isDynasty": bool_param(params.get("isDynasty", ["false"])[0]),
        "numQbs": int_param(params.get("numQbs", ["1"])[0], 1, 1, 2),
        "numTeams": int_param(params.get("numTeams", ["12"])[0], 12, 8, 16),
        "ppr": float_param(params.get("ppr", ["1"])[0], 1.0, (0.0, 0.5, 1.0)),
        "minPlayers": int_param(params.get("minPlayers", ["2"])[0], 2, 2, 8),
        "maxPlayers": int_param(params.get("maxPlayers", ["8"])[0], 8, 2, 8),
        "side1": [item for item in params.get("side1", []) if item][:8],
        "side2": [item for item in params.get("side2", []) if item][:8],
    }
    key = "fantasycalc:trade-database:v1:" + json.dumps(options, sort_keys=True)
    return key, options


def build_trade_database_payload(options: dict[str, Any]) -> dict[str, Any]:
    most_traded = fantasycalc_json("/trades/most-traded", {"isDynasty": str(options["isDynasty"]).lower()})
    trade_count = fantasycalc_json("/trades/count")
    searched_trades: list[dict[str, Any]] = []
    if options["side1"]:
        search_params = {
            "isDynasty": str(options["isDynasty"]).lower(),
            "numTeams": options["numTeams"],
            "ppr": options["ppr"],
            "numQbs": options["numQbs"],
            "side1": options["side1"],
            "side2": options["side2"],
            "minPlayers": options["minPlayers"],
            "maxPlayers": options["maxPlayers"],
        }
        trades = fantasycalc_json("/trades", search_params)
        if isinstance(trades, list):
            searched_trades = [compact_trade(row) for row in trades[:60] if isinstance(row, dict)]
    return {
        "ok": True,
        "source": "FantasyCalc real-trade database",
        "sourceUrl": "https://fantasycalc.com/database",
        "syncedAt": utc_now(),
        "settings": {
            "isDynasty": options["isDynasty"],
            "numQbs": options["numQbs"],
            "numTeams": options["numTeams"],
            "ppr": options["ppr"],
        },
        "tradeCount": trade_count if isinstance(trade_count, int) else None,
        "mostTraded": most_traded if isinstance(most_traded, list) else [],
        "trades": searched_trades,
    }


def trade_database_payload(raw_query: str, force: bool = False) -> dict[str, Any]:
    key, options = normalize_options(raw_query)
    now = time.time()
    cached = _cache.get(key)
    if not force and cached and now - float(cached.get("cachedAt") or 0) < MEMORY_TTL_SECONDS:
        payload = dict(cached["payload"])
        payload["cache"] = {"layer": "memory", "ageSeconds": round(now - float(cached.get("cachedAt") or 0))}
        return payload
    if not force:
        durable = load_provider_payload(key, DURABLE_TTL_SECONDS)
        if durable:
            _cache[key] = {"cachedAt": now, "payload": durable}
            return durable
    payload = build_trade_database_payload(options)
    payload["cache"] = {"layer": "origin", "ageSeconds": 0}
    _cache[key] = {"cachedAt": now, "payload": payload}
    saved = save_provider_payload(key, payload)
    record_freshness(
        source="fantasycalc",
        source_scope=key,
        ok=True,
        max_age_seconds=DURABLE_TTL_SECONDS,
        metadata={
            "saved": saved,
            "tradeCount": payload.get("tradeCount"),
            "mostTradedCount": len(payload.get("mostTraded") or []),
            "searchedTradeCount": len(payload.get("trades") or []),
        },
    )
    return payload


def refresh_daily_trade_database() -> list[dict[str, Any]]:
    refreshed = []
    for is_dynasty in (False, True):
        query = urllib.parse.urlencode({"isDynasty": str(is_dynasty).lower(), "numQbs": 1, "numTeams": 12, "ppr": 1})
        payload = trade_database_payload(query, force=True)
        refreshed.append(
            {
                "ok": bool(payload.get("ok")),
                "isDynasty": is_dynasty,
                "tradeCount": payload.get("tradeCount"),
                "mostTradedCount": len(payload.get("mostTraded") or []),
                "syncedAt": payload.get("syncedAt"),
            }
        )
    return refreshed


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
        limit = check_rate_limit("fantasycalc_trades", headers=self.headers, limit=90, window_seconds=900)
        if not limit.allowed:
            self.send_json(rate_limit_payload(limit, "FantasyCalc trade database is receiving too many requests. Try again shortly."), HTTPStatus.TOO_MANY_REQUESTS)
            return
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        try:
            self.send_json(trade_database_payload(parsed.query, force=params.get("force", ["0"])[0] == "1"))
        except Exception as exc:
            record_freshness(
                source="fantasycalc",
                source_scope="trade-database",
                ok=False,
                max_age_seconds=DURABLE_TTL_SECONDS,
                warning=str(exc),
            )
            self.send_json(
                {
                    "ok": False,
                    "source": "FantasyCalc real-trade database",
                    "syncedAt": utc_now(),
                    "error": str(exc),
                    "mostTraded": [],
                    "trades": [],
                },
                HTTPStatus.BAD_GATEWAY,
            )

    def do_HEAD(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
