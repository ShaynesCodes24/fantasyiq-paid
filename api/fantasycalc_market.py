from __future__ import annotations

import json
import time
import urllib.error
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
CACHE_TTL_SECONDS = 60 * 60 * 3
DURABLE_CACHE_TTL_SECONDS = 60 * 60 * 27
HTTP_TIMEOUT_SECONDS = 8
MAX_PLAYERS = 900
_cache: dict[str, dict[str, Any]] = {}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def bool_param(value: str, default: bool = False) -> bool:
    if value == "":
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "dynasty"}


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


def normalize_query(raw_query: str) -> tuple[str, dict[str, Any]]:
    params = urllib.parse.parse_qs(raw_query)
    is_dynasty = bool_param(params.get("isDynasty", ["false"])[0])
    num_qbs = int_param(params.get("numQbs", ["1"])[0], 1, 1, 2)
    num_teams = int_param(params.get("numTeams", ["12"])[0], 12, 8, 16)
    ppr = float_param(params.get("ppr", ["1"])[0], 1.0, (0.0, 0.5, 1.0))
    limit = int_param(params.get("limit", [str(MAX_PLAYERS)])[0], MAX_PLAYERS, 80, MAX_PLAYERS)
    key = json.dumps(
        {
            "isDynasty": is_dynasty,
            "numQbs": num_qbs,
            "numTeams": num_teams,
            "ppr": ppr,
            "limit": limit,
        },
        sort_keys=True,
    )
    return key, {
        "isDynasty": is_dynasty,
        "numQbs": num_qbs,
        "numTeams": num_teams,
        "ppr": ppr,
        "limit": limit,
    }


def market_cache_key(options: dict[str, Any]) -> str:
    return (
        "fantasycalc:market:v2:"
        f"dynasty={int(bool(options['isDynasty']))}:"
        f"qbs={int(options['numQbs'])}:"
        f"teams={int(options['numTeams'])}:"
        f"ppr={options['ppr']}:"
        f"limit={int(options['limit'])}"
    )


def fantasycalc_json(path: str, params: dict[str, Any] | None = None) -> Any:
    query = urllib.parse.urlencode(params or {})
    url = f"{FANTASYCALC_API_BASE}{path}{'?' + query if query else ''}"
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "FantasyIQ/1.0 (trade market calibration)",
        },
    )
    with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
        return json.loads(response.read().decode("utf-8"))


def compact_value(row: dict[str, Any]) -> dict[str, Any]:
    player = row.get("player") if isinstance(row.get("player"), dict) else {}
    value = float(row.get("value") or 0)
    return {
        "id": player.get("id") or row.get("id"),
        "name": player.get("name") or row.get("name") or "",
        "position": player.get("position") or row.get("position") or "",
        "team": player.get("maybeTeam") or row.get("team") or "",
        "espnId": player.get("espnId") or "",
        "sleeperId": player.get("sleeperId") or "",
        "value": round(value, 2),
        "overallRank": row.get("overallRank"),
        "positionRank": row.get("positionRank"),
        "trend30Day": row.get("trend30Day"),
        "redraftValue": row.get("redraftValue"),
        "dynastyDiff": row.get("redraftDynastyValueDifference"),
        "volatility": row.get("maybeMovingStandardDeviationAdjusted")
        if row.get("maybeMovingStandardDeviationAdjusted") is not None
        else row.get("maybeMovingStandardDeviation"),
        "tradeFrequency": row.get("maybeTradeFrequency"),
        "tier": row.get("maybeTier"),
        "age": player.get("maybeAge"),
    }


def build_market_payload(options: dict[str, Any]) -> dict[str, Any]:
    values = fantasycalc_json(
        "/values/current",
        {
            "isDynasty": str(options["isDynasty"]).lower(),
            "numQbs": options["numQbs"],
            "numTeams": options["numTeams"],
            "ppr": options["ppr"],
            "includeAdp": "false",
        },
    )
    if not isinstance(values, list):
        values = []
    players = [compact_value(row) for row in values[: options["limit"]] if isinstance(row, dict)]
    trade_count = None
    try:
        trade_count = fantasycalc_json("/trades/count")
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        trade_count = None
    max_value = max((float(player.get("value") or 0) for player in players), default=0)
    return {
        "ok": True,
        "source": "FantasyCalc trade-value market",
        "sourceUrl": "https://fantasycalc.com/trade-value-chart",
        "databaseUrl": "https://fantasycalc.com/database",
        "syncedAt": utc_now(),
        "settings": {
            "isDynasty": options["isDynasty"],
            "numQbs": options["numQbs"],
            "numTeams": options["numTeams"],
            "ppr": options["ppr"],
        },
        "tradeCount": trade_count if isinstance(trade_count, int) else None,
        "playerCount": len(players),
        "maxValue": max_value,
        "players": players,
    }


def market_payload(raw_query: str, force: bool = False) -> dict[str, Any]:
    key, options = normalize_query(raw_query)
    durable_key = market_cache_key(options)
    cached = _cache.get(key)
    now = time.time()
    if not force and cached and now - float(cached.get("cachedAt", 0)) < CACHE_TTL_SECONDS:
        payload = dict(cached["payload"])
        payload.setdefault("playerCount", len(payload.get("players") or []))
        payload["cache"] = {"layer": "memory", "ageSeconds": round(now - float(cached.get("cachedAt", 0)))}
        return payload
    if not force:
        durable = load_provider_payload(durable_key, DURABLE_CACHE_TTL_SECONDS)
        if durable:
            durable.setdefault("playerCount", len(durable.get("players") or []))
            _cache[key] = {"cachedAt": now, "payload": durable}
            return durable
    payload = build_market_payload(options)
    payload["cache"] = {"layer": "origin", "ageSeconds": 0}
    _cache[key] = {"cachedAt": now, "payload": payload}
    saved = save_provider_payload(durable_key, payload)
    record_freshness(
        source="fantasycalc",
        source_scope=durable_key,
        ok=True,
        max_age_seconds=DURABLE_CACHE_TTL_SECONDS,
        metadata={
            "saved": saved,
            "playerCount": len(payload.get("players") or []),
            "settings": payload.get("settings") or {},
        },
    )
    return payload


def common_market_options() -> list[dict[str, Any]]:
    options: list[dict[str, Any]] = []
    for is_dynasty in (False, True):
        for num_qbs in (1, 2):
            options.append({"isDynasty": is_dynasty, "numQbs": num_qbs, "numTeams": 12, "ppr": 1.0, "limit": MAX_PLAYERS})
    return options


def refresh_common_markets() -> list[dict[str, Any]]:
    refreshed = []
    for options in common_market_options():
        query = urllib.parse.urlencode(
            {
                "isDynasty": str(options["isDynasty"]).lower(),
                "numQbs": options["numQbs"],
                "numTeams": options["numTeams"],
                "ppr": options["ppr"],
                "limit": options["limit"],
            }
        )
        payload = market_payload(query, force=True)
        refreshed.append(
            {
                "cacheKey": market_cache_key(options),
                "ok": bool(payload.get("ok")),
                "playerCount": len(payload.get("players") or []),
                "tradeCount": payload.get("tradeCount"),
                "syncedAt": payload.get("syncedAt"),
            }
        )
    return refreshed


class handler(BaseHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Type", "application/json; charset=utf-8")
        super().end_headers()

    def do_GET(self) -> None:
        try:
            limit = check_rate_limit("fantasycalc_market", headers=self.headers, limit=120, window_seconds=900)
            if not limit.allowed:
                self.send_response(HTTPStatus.TOO_MANY_REQUESTS)
                payload = rate_limit_payload(limit, "FantasyCalc market data is receiving too many requests. Try again shortly.")
                self.end_headers()
                self.wfile.write(json.dumps(payload).encode("utf-8"))
                return
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
            payload = market_payload(query, force=params.get("force", ["0"])[0] == "1")
            self.send_response(HTTPStatus.OK)
        except Exception as exc:
            payload = {
                "ok": False,
                "source": "FantasyCalc trade-value market",
                "syncedAt": utc_now(),
                "error": str(exc),
                "players": [],
            }
            self.send_response(HTTPStatus.BAD_GATEWAY)
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode("utf-8"))
