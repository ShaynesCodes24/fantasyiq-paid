from __future__ import annotations

import hashlib
import json
import math
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

try:
    from database import connect, database_enabled, json_value, slugify
    from provider_cache import load_provider_payload, record_freshness, save_provider_payload
except (ModuleNotFoundError, ImportError):
    from api.database import connect, database_enabled, json_value, slugify
    from api.provider_cache import load_provider_payload, record_freshness, save_provider_payload


ODDS_API_BASE = os.environ.get("THE_ODDS_API_BASE", "https://api.the-odds-api.com/v4").rstrip("/")
DEFAULT_SPORT = os.environ.get("FANTASYIQ_PARLAY_SPORT", "americanfootball_nfl").strip() or "americanfootball_nfl"
DEFAULT_MARKETS = (
    "player_pass_yds",
    "player_pass_tds",
    "player_rush_yds",
    "player_reception_yds",
    "player_receptions",
    "player_anytime_td",
)
DEFAULT_BOOKMAKERS = "draftkings,fanduel,betmgm,williamhill_us,betrivers,fanatics,espnbet"
LIVE_CACHE_TTL_SECONDS = 60 * 8
DURABLE_CACHE_TTL_SECONDS = 60 * 20
HISTORICAL_CACHE_TTL_SECONDS = 60 * 60 * 24 * 3
HTTP_TIMEOUT_SECONDS = 8
MAX_EVENTS = 6
MAX_LEGS = 36
EDGE_FLOOR = 1.5


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def env_first(*names: str) -> str:
    for name in names:
        value = os.environ.get(name, "").strip()
        if value:
            return value
    return ""


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def as_number(value: Any, default: float = 0.0) -> float:
    try:
        if value in (None, ""):
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def normalize_name(value: Any) -> str:
    return "".join(char.lower() for char in str(value or "") if char.isalnum())


def compact_text(value: Any, fallback: str = "") -> str:
    text = str(value or fallback or "").strip()
    return " ".join(text.split())


def stable_float(*parts: Any) -> float:
    digest = hashlib.sha256("|".join(str(part) for part in parts).encode("utf-8")).hexdigest()
    return int(digest[:8], 16) / 0xFFFFFFFF


def american_to_decimal(price: Any) -> float:
    odds = as_number(price)
    if odds == 0:
        return 1.0
    if odds > 0:
        return round(1 + odds / 100, 4)
    return round(1 + 100 / abs(odds), 4)


def decimal_to_american(decimal: float) -> int:
    decimal = max(1.01, float(decimal or 1.01))
    if decimal >= 2:
        return int(round((decimal - 1) * 100))
    return int(round(-100 / (decimal - 1)))


def american_to_probability(price: Any) -> float:
    odds = as_number(price)
    if odds == 0:
        return 0.5
    if odds < 0:
        return abs(odds) / (abs(odds) + 100)
    return 100 / (odds + 100)


def normal_cdf(value: float) -> float:
    return 0.5 * (1 + math.erf(value / math.sqrt(2)))


def market_label(market: str) -> str:
    labels = {
        "player_pass_yds": "Pass Yards",
        "player_pass_tds": "Pass TDs",
        "player_rush_yds": "Rush Yards",
        "player_reception_yds": "Receiving Yards",
        "player_receptions": "Receptions",
        "player_anytime_td": "Anytime TD",
        "h2h": "Moneyline",
        "spreads": "Spread",
        "totals": "Total",
    }
    return labels.get(market, market.replace("player_", "").replace("_", " ").title())


def market_scale(market: str) -> float:
    if market == "player_pass_yds":
        return 42.0
    if market == "player_rush_yds":
        return 22.0
    if market == "player_reception_yds":
        return 20.0
    if market == "player_receptions":
        return 1.65
    if market == "player_pass_tds":
        return 0.72
    if market == "player_anytime_td":
        return 0.18
    return 1.0


def safe_json_dumps(payload: Any) -> str:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)


@dataclass
class AgentResult:
    name: str
    confidence: float
    summary: str
    data: dict[str, Any] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    evidence: list[str] = field(default_factory=list)

    def public_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "confidence": round(clamp(self.confidence, 0, 1), 2),
            "summary": self.summary,
            "warnings": self.warnings,
            "evidence": self.evidence,
        }


def ensure_parlay_tables() -> None:
    if not database_enabled():
        return
    with connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS fantasyiq_parlay_odds_cache (
                    cache_key TEXT PRIMARY KEY,
                    sport_key TEXT NOT NULL DEFAULT '',
                    event_id TEXT NOT NULL DEFAULT '',
                    markets TEXT NOT NULL DEFAULT '',
                    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
                    usage_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
                    expires_at TIMESTAMPTZ,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
                """
            )
            cursor.execute(
                """
                CREATE INDEX IF NOT EXISTS fantasyiq_parlay_odds_cache_expires_idx
                    ON fantasyiq_parlay_odds_cache (expires_at)
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS fantasyiq_parlay_recommendations (
                    id BIGSERIAL PRIMARY KEY,
                    customer_slug TEXT NOT NULL DEFAULT '',
                    league_key TEXT NOT NULL DEFAULT '',
                    sport_key TEXT NOT NULL DEFAULT '',
                    slate_key TEXT NOT NULL DEFAULT '',
                    request_hash TEXT NOT NULL DEFAULT '',
                    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
                    agent_trace JSONB NOT NULL DEFAULT '[]'::jsonb,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
                )
                """
            )
            cursor.execute(
                """
                CREATE INDEX IF NOT EXISTS fantasyiq_parlay_recommendations_lookup_idx
                    ON fantasyiq_parlay_recommendations (customer_slug, league_key, created_at DESC)
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS fantasyiq_parlay_backtests (
                    id BIGSERIAL PRIMARY KEY,
                    sport_key TEXT NOT NULL DEFAULT '',
                    market_key TEXT NOT NULL DEFAULT '',
                    leg_type TEXT NOT NULL DEFAULT '',
                    sample_size INTEGER NOT NULL DEFAULT 0,
                    win_rate NUMERIC(6,4),
                    roi NUMERIC(8,4),
                    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                    UNIQUE (sport_key, market_key, leg_type)
                )
                """
            )


def save_recommendation(payload: dict[str, Any], agent_trace: list[dict[str, Any]], context: dict[str, Any]) -> None:
    if not database_enabled():
        return
    try:
        ensure_parlay_tables()
        customer_slug = slugify(str(context.get("customerSlug") or "demo"))
        league_key = slugify(str(context.get("leagueKey") or "default"))
        sport_key = str(context.get("sport") or DEFAULT_SPORT)
        slate_key = str(payload.get("slateKey") or payload.get("syncedAt") or utc_now())[:80]
        request_hash = hashlib.sha256(safe_json_dumps(context.get("requestFingerprint") or {}).encode("utf-8")).hexdigest()
        with connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO fantasyiq_parlay_recommendations (
                        customer_slug, league_key, sport_key, slate_key, request_hash, payload, agent_trace, created_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, now())
                    """,
                    (
                        customer_slug,
                        league_key,
                        sport_key,
                        slate_key,
                        request_hash,
                        json.dumps(payload),
                        json.dumps(agent_trace),
                    ),
                )
    except Exception:
        return


def parse_body_context(body: dict[str, Any], query: dict[str, list[str]]) -> dict[str, Any]:
    def query_value(name: str, default: str = "") -> str:
        values = query.get(name)
        return str(values[0]) if values else default

    roster = body.get("roster") if isinstance(body.get("roster"), list) else []
    roster_entries = body.get("rosterEntries") if isinstance(body.get("rosterEntries"), list) else []
    waiver_pool = body.get("waiverPool") if isinstance(body.get("waiverPool"), list) else []
    board_rows = body.get("boardRows") if isinstance(body.get("boardRows"), list) else []
    league_settings = body.get("leagueSettings") if isinstance(body.get("leagueSettings"), dict) else {}
    mode = compact_text(body.get("mode") or query_value("mode") or "standard")
    sport = compact_text(body.get("sport") or query_value("sport") or DEFAULT_SPORT)
    return {
        "customerSlug": query_value("customer", compact_text(body.get("customerSlug") or "demo")),
        "leagueKey": query_value("league", compact_text(body.get("leagueKey") or "default")),
        "sport": sport,
        "mode": mode,
        "teamId": compact_text(body.get("teamId") or ""),
        "roster": [row for row in roster if isinstance(row, dict)][:40],
        "rosterEntries": [row for row in roster_entries if isinstance(row, dict)][:40],
        "waiverPool": [row for row in waiver_pool if isinstance(row, dict)][:80],
        "boardRows": [row for row in board_rows if isinstance(row, dict)][:260],
        "leagueSettings": league_settings,
        "force": bool(body.get("force") or query_value("force") in {"1", "true", "yes"}),
        "historicalEventId": compact_text(body.get("historicalEventId") or query_value("historicalEventId")),
        "historicalDate": compact_text(body.get("historicalDate") or query_value("historicalDate")),
        "requestFingerprint": {
            "mode": mode,
            "sport": sport,
            "roster": [compact_text(row.get("Player") or row.get("name")) for row in roster[:20]],
            "leagueSettings": league_settings,
        },
    }


def row_name(row: dict[str, Any]) -> str:
    return compact_text(row.get("Player") or row.get("player") or row.get("name") or row.get("playerName"))


def row_position(row: dict[str, Any]) -> str:
    return compact_text(row.get("Pos") or row.get("position") or row.get("pos")).upper()


def row_team(row: dict[str, Any]) -> str:
    return compact_text(row.get("Team") or row.get("team") or row.get("proTeam"))


def row_projection(row: dict[str, Any]) -> float:
    return as_number(
        row.get("Native Projection")
        or row.get("Proj PPR Pts")
        or row.get("Projection")
        or row.get("projected")
        or row.get("points"),
        0.0,
    )


def row_value(row: dict[str, Any]) -> float:
    return as_number(row.get("Value Score") or row.get("value") or row.get("marketScore"), 50.0)


def estimate_stat(row: dict[str, Any], market: str) -> float:
    position = row_position(row)
    projection = row_projection(row)
    value = row_value(row)
    rank = as_number(row.get("Rank") or row.get("rank"), 150)
    quality = clamp((value - 50) / 22, -1.1, 1.6)
    rank_boost = clamp((120 - rank) / 90, -0.4, 0.8)
    if market == "player_pass_yds":
        if position != "QB":
            return 0.0
        return clamp(214 + projection * 1.9 + quality * 28 + rank_boost * 14, 155, 335)
    if market == "player_pass_tds":
        if position != "QB":
            return 0.0
        return clamp(1.15 + projection / 45 + quality * 0.22 + rank_boost * 0.16, 0.55, 3.1)
    if market == "player_rush_yds":
        if position == "QB":
            return clamp(16 + quality * 9 + rank_boost * 5, 4, 62)
        if position != "RB":
            return 0.0
        return clamp(42 + projection * 2.1 + quality * 14 + rank_boost * 9, 18, 126)
    if market == "player_reception_yds":
        if position not in {"RB", "WR", "TE"}:
            return 0.0
        base = 24 if position == "RB" else 38 if position == "TE" else 48
        return clamp(base + projection * 1.85 + quality * 12 + rank_boost * 8, 8, 155)
    if market == "player_receptions":
        if position not in {"RB", "WR", "TE"}:
            return 0.0
        rec = as_number(row.get("Receptions") or row.get("Projected Receptions") or row.get("Rec"))
        if rec:
            return clamp(rec, 0.5, 11.5)
        base = 2.4 if position == "RB" else 3.2 if position == "TE" else 4.1
        return clamp(base + projection / 9.5 + quality * 0.7, 1.0, 10.5)
    if market == "player_anytime_td":
        if position not in {"QB", "RB", "WR", "TE"}:
            return 0.0
        base = 0.16 if position == "QB" else 0.32 if position == "RB" else 0.26 if position == "TE" else 0.24
        return clamp(base + projection / 115 + quality * 0.055, 0.08, 0.68)
    return 0.0


def build_player_index(context: dict[str, Any]) -> dict[str, dict[str, Any]]:
    rows = []
    rows.extend(context.get("roster") or [])
    rows.extend(context.get("waiverPool") or [])
    rows.extend(context.get("boardRows") or [])
    index: dict[str, dict[str, Any]] = {}
    for row in rows:
        name = row_name(row)
        key = normalize_name(name)
        if not key or key in index:
            continue
        index[key] = {
            "name": name,
            "position": row_position(row),
            "team": row_team(row),
            "projection": row_projection(row),
            "value": row_value(row),
            "rank": as_number(row.get("Rank") or row.get("rank"), 999),
            "isRoster": any(normalize_name(row_name(roster_row)) == key for roster_row in context.get("roster") or []),
            "isWaiver": any(normalize_name(row_name(waiver_row)) == key for waiver_row in context.get("waiverPool") or []),
            "raw": row,
        }
    for entry in context.get("rosterEntries") or []:
        name = compact_text(entry.get("player") or entry.get("name"))
        key = normalize_name(name)
        if key and key not in index:
            index[key] = {
                "name": name,
                "position": compact_text(entry.get("pos")).upper(),
                "team": compact_text(entry.get("proTeam")),
                "projection": 0,
                "value": 50,
                "rank": 999,
                "isRoster": True,
                "isWaiver": False,
                "raw": entry,
            }
        elif key:
            index[key]["isRoster"] = True
    return index


def data_cruncher_agent(context: dict[str, Any]) -> AgentResult:
    players = build_player_index(context)
    roster_keys = {normalize_name(row_name(row)) for row in context.get("roster") or []}
    waiver_keys = {normalize_name(row_name(row)) for row in context.get("waiverPool") or []}
    settings = context.get("leagueSettings") or {}
    scoring = settings.get("scoringLabel") or settings.get("scoringType") or "PPR"
    return AgentResult(
        name="FantasyIQ Data Cruncher",
        confidence=0.72 if players else 0.35,
        summary=f"Mapped {len(players)} player profiles with {len(roster_keys)} roster matches and {len(waiver_keys)} waiver candidates.",
        data={
            "players": players,
            "rosterKeys": list(roster_keys),
            "waiverKeys": list(waiver_keys),
            "scoring": scoring,
            "leagueSettings": settings,
        },
        evidence=[
            f"Scoring context: {scoring}",
            f"Mode: {context.get('mode') or 'standard'}",
        ],
    )


def odds_api_key() -> str:
    return env_first("THE_ODDS_API_KEY", "ODDS_API_KEY")


def configured_markets() -> list[str]:
    raw = os.environ.get("FANTASYIQ_PARLAY_MARKETS", "").strip()
    markets = [item.strip() for item in raw.split(",") if item.strip()] if raw else list(DEFAULT_MARKETS)
    return markets[:8]


def odds_cache_key(sport: str, markets: list[str], event_id: str = "") -> str:
    bookmaker_key = os.environ.get("FANTASYIQ_PARLAY_BOOKMAKERS") or os.environ.get("THE_ODDS_API_BOOKMAKERS") or DEFAULT_BOOKMAKERS
    return f"parlay-iq:odds:v1:{sport}:{event_id or 'events'}:{','.join(markets)}:{bookmaker_key}"


def fetch_json_with_headers(url: str) -> tuple[Any, dict[str, str]]:
    request = urllib.request.Request(
        url,
        headers={"Accept": "application/json", "User-Agent": "FantasyIQ/1.0 (Parlay IQ)"},
    )
    with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
        body = json.loads(response.read().decode(response.headers.get_content_charset() or "utf-8"))
        return body, {key.lower(): value for key, value in response.headers.items()}


def odds_api_params(api_key: str, markets: list[str] | None = None) -> dict[str, str]:
    bookmakers = os.environ.get("FANTASYIQ_PARLAY_BOOKMAKERS") or os.environ.get("THE_ODDS_API_BOOKMAKERS") or DEFAULT_BOOKMAKERS
    params = {"apiKey": api_key, "oddsFormat": "american", "dateFormat": "iso"}
    if markets:
        params["markets"] = ",".join(markets)
    if bookmakers:
        params["bookmakers"] = bookmakers
    else:
        params["regions"] = os.environ.get("THE_ODDS_API_REGIONS", "us").strip() or "us"
    return params


def odds_api_get(path: str, params: dict[str, str]) -> tuple[Any, dict[str, str], str]:
    query = urllib.parse.urlencode(params)
    url = f"{ODDS_API_BASE}{path}?{query}"
    payload, headers = fetch_json_with_headers(url)
    return payload, headers, url.split("apiKey=", 1)[0] + "apiKey=REDACTED"


def usage_meta(headers: dict[str, str]) -> dict[str, Any]:
    return {
        "remaining": headers.get("x-requests-remaining"),
        "used": headers.get("x-requests-used"),
        "last": headers.get("x-requests-last"),
    }


def parse_event_line(event: dict[str, Any], bookmaker: dict[str, Any], market: dict[str, Any], outcome: dict[str, Any]) -> dict[str, Any] | None:
    market_key = compact_text(market.get("key"))
    side = compact_text(outcome.get("name"))
    player = compact_text(outcome.get("description") or outcome.get("player") or outcome.get("name"))
    if market_key.startswith("player_"):
        if side.lower() not in {"over", "under", "yes", "no"}:
            return None
        if side.lower() in {"yes", "no"} and player.lower() in {"yes", "no"}:
            player = compact_text(outcome.get("description"))
    else:
        player = compact_text(outcome.get("name"))
    if not player:
        return None
    price = as_number(outcome.get("price"), 0)
    point = outcome.get("point")
    return {
        "eventId": compact_text(event.get("id")),
        "sportKey": compact_text(event.get("sport_key")),
        "homeTeam": compact_text(event.get("home_team")),
        "awayTeam": compact_text(event.get("away_team")),
        "commenceTime": compact_text(event.get("commence_time")),
        "bookKey": compact_text(bookmaker.get("key")),
        "book": compact_text(bookmaker.get("title") or bookmaker.get("key")),
        "market": market_key,
        "marketLabel": market_label(market_key),
        "player": player,
        "side": "Over" if side.lower() == "over" else "Under" if side.lower() == "under" else side.title(),
        "line": as_number(point, 0.0) if point is not None else None,
        "priceAmerican": int(price) if price else 0,
        "decimal": american_to_decimal(price),
        "impliedProbability": american_to_probability(price),
    }


def summarize_best_lines(raw_lines: list[dict[str, Any]], players: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    grouped: dict[tuple[Any, ...], list[dict[str, Any]]] = {}
    for line in raw_lines:
        key = (
            line.get("eventId"),
            line.get("market"),
            normalize_name(line.get("player")),
            line.get("side"),
            line.get("line"),
        )
        grouped.setdefault(key, []).append(line)

    best_lines = []
    for key, offers in grouped.items():
        offers = sorted(offers, key=lambda item: item.get("decimal") or 0, reverse=True)
        best = dict(offers[0])
        implied_values = [as_number(item.get("impliedProbability"), 0.5) for item in offers if item.get("priceAmerican")]
        best["consensusProbability"] = round(sum(implied_values) / max(1, len(implied_values)), 4)
        best["booksSeen"] = len({item.get("bookKey") or item.get("book") for item in offers})
        best["priceRange"] = {
            "best": best.get("priceAmerican"),
            "worst": min((int(item.get("priceAmerican") or 0) for item in offers), default=0),
        }
        player_context = players.get(normalize_name(best.get("player"))) or {}
        best["position"] = player_context.get("position") or ""
        best["proTeam"] = player_context.get("team") or ""
        best["isRoster"] = bool(player_context.get("isRoster"))
        best["isWaiver"] = bool(player_context.get("isWaiver"))
        best["source"] = "the-odds-api"
        best_lines.append(best)
    return best_lines


def fetch_live_odds(context: dict[str, Any], players: dict[str, dict[str, Any]]) -> dict[str, Any]:
    api_key = odds_api_key()
    sport = context.get("sport") or DEFAULT_SPORT
    markets = configured_markets()
    if not api_key:
        return build_model_only_odds(context, players, markets)

    force = bool(context.get("force"))
    events_key = odds_cache_key(sport, markets, "events")
    if not force:
        cached = load_provider_payload(events_key, LIVE_CACHE_TTL_SECONDS)
        if cached:
            return cached

    events, event_headers, events_url = odds_api_get(
        f"/sports/{sport}/events",
        {"apiKey": api_key, "dateFormat": "iso"},
    )
    if not isinstance(events, list):
        events = []
    selected_events = events[:MAX_EVENTS]
    raw_lines: list[dict[str, Any]] = []
    urls = [events_url]
    usage = {"events": usage_meta(event_headers), "eventOdds": []}
    for event in selected_events:
        event_id = compact_text(event.get("id"))
        if not event_id:
            continue
        event_cache_key = odds_cache_key(sport, markets, event_id)
        event_payload = None if force else load_provider_payload(event_cache_key, LIVE_CACHE_TTL_SECONDS)
        event_usage = {}
        if not event_payload:
            try:
                event_payload, headers, safe_url = odds_api_get(
                    f"/sports/{sport}/events/{event_id}/odds",
                    odds_api_params(api_key, markets),
                )
                save_provider_payload(event_cache_key, event_payload if isinstance(event_payload, dict) else {"data": event_payload})
                event_usage = usage_meta(headers)
                urls.append(safe_url)
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
                usage["eventOdds"].append({"eventId": event_id, "error": str(exc)})
                continue
        if isinstance(event_payload, dict) and "data" in event_payload and isinstance(event_payload["data"], dict):
            event_payload = event_payload["data"]
        if not isinstance(event_payload, dict):
            continue
        usage["eventOdds"].append({"eventId": event_id, **event_usage})
        for bookmaker in event_payload.get("bookmakers") or []:
            if not isinstance(bookmaker, dict):
                continue
            for market in bookmaker.get("markets") or []:
                if not isinstance(market, dict):
                    continue
                for outcome in market.get("outcomes") or []:
                    if not isinstance(outcome, dict):
                        continue
                    parsed = parse_event_line(event_payload, bookmaker, market, outcome)
                    if parsed:
                        raw_lines.append(parsed)

    best_lines = summarize_best_lines(raw_lines, players)
    payload = {
        "ok": True,
        "configured": True,
        "source": "The Odds API",
        "sport": sport,
        "markets": markets,
        "events": selected_events,
        "lines": best_lines[:MAX_LEGS * 3],
        "lineCount": len(best_lines),
        "syncedAt": utc_now(),
        "usage": usage,
        "sourceUrls": urls[:4],
        "cache": {"layer": "origin", "ageSeconds": 0},
    }
    save_provider_payload(events_key, payload)
    record_freshness(
        source="the-odds-api",
        source_scope=f"parlay-iq:{sport}",
        ok=True,
        max_age_seconds=DURABLE_CACHE_TTL_SECONDS,
        metadata={"lineCount": len(best_lines), "markets": markets, "usage": usage},
        customer_slug=slugify(str(context.get("customerSlug") or "")),
        league_key=slugify(str(context.get("leagueKey") or "")),
    )
    return payload


def mock_price(probability: float, salt: str) -> int:
    jitter = (stable_float(salt) - 0.5) * 0.045
    implied = clamp(probability + jitter, 0.18, 0.78)
    decimal = 1 / implied
    return decimal_to_american(decimal)


def build_model_only_odds(context: dict[str, Any], players: dict[str, dict[str, Any]], markets: list[str]) -> dict[str, Any]:
    candidates = list(players.values())[:80]
    if not candidates:
        candidates = [
            {"name": "Sample QB", "position": "QB", "team": "MFI", "projection": 22, "value": 74, "rank": 40, "isRoster": False, "isWaiver": False, "raw": {}},
            {"name": "Sample WR", "position": "WR", "team": "MFI", "projection": 15, "value": 68, "rank": 58, "isRoster": False, "isWaiver": True, "raw": {}},
        ]
    lines: list[dict[str, Any]] = []
    books = [
        ("draftkings", "DraftKings"),
        ("fanduel", "FanDuel"),
        ("betmgm", "BetMGM"),
        ("caesars", "Caesars"),
    ]
    for player in candidates:
        raw = player.get("raw") or {
            "Player": player.get("name"),
            "Pos": player.get("position"),
            "Team": player.get("team"),
            "Value Score": player.get("value"),
            "Proj PPR Pts": player.get("projection"),
            "Rank": player.get("rank"),
        }
        for market in markets:
            estimate = estimate_stat(raw, market)
            if estimate <= 0:
                continue
            line_base = estimate - market_scale(market) * (0.22 + stable_float(player.get("name"), market) * 0.22)
            line_value = round(line_base * 2) / 2 if market != "player_anytime_td" else None
            if market == "player_anytime_td":
                price = mock_price(clamp(estimate, 0.08, 0.68), f"{player.get('name')}:{market}:yes")
                side = "Yes"
            else:
                price = mock_price(0.52 + stable_float(player.get("name"), market, "over") * 0.08, f"{player.get('name')}:{market}:over")
                side = "Over"
            book = books[int(stable_float(player.get("name"), market, "book") * len(books)) % len(books)]
            line = {
                "eventId": f"model-{row_team(raw) or 'slate'}",
                "sportKey": context.get("sport") or DEFAULT_SPORT,
                "homeTeam": row_team(raw) or "FantasyIQ",
                "awayTeam": "Market",
                "commenceTime": utc_now(),
                "bookKey": book[0],
                "book": book[1],
                "market": market,
                "marketLabel": market_label(market),
                "player": player.get("name"),
                "side": side,
                "line": line_value,
                "priceAmerican": price,
                "decimal": american_to_decimal(price),
                "impliedProbability": american_to_probability(price),
                "consensusProbability": round(clamp(american_to_probability(price) + 0.018, 0.12, 0.86), 4),
                "booksSeen": 4,
                "priceRange": {"best": price, "worst": price - 18},
                "position": player.get("position") or "",
                "proTeam": player.get("team") or "",
                "isRoster": bool(player.get("isRoster")),
                "isWaiver": bool(player.get("isWaiver")),
                "source": "model-only",
            }
            lines.append(line)
            if len(lines) >= MAX_LEGS * 2:
                break
        if len(lines) >= MAX_LEGS * 2:
            break
    return {
        "ok": True,
        "configured": False,
        "source": "FantasyIQ model-only odds fallback",
        "sport": context.get("sport") or DEFAULT_SPORT,
        "markets": markets,
        "events": [],
        "lines": lines,
        "lineCount": len(lines),
        "syncedAt": utc_now(),
        "usage": {},
        "sourceUrls": [],
        "cache": {"layer": "fallback", "ageSeconds": 0},
        "warning": "Set THE_ODDS_API_KEY to enable live sportsbook lines.",
    }


def odds_arbitrageur_agent(context: dict[str, Any], players: dict[str, dict[str, Any]]) -> AgentResult:
    try:
        payload = fetch_live_odds(context, players)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        payload = build_model_only_odds(context, players, configured_markets())
        payload["warning"] = f"The Odds API fallback active: {exc}"
    configured = bool(payload.get("configured"))
    lines = payload.get("lines") or []
    return AgentResult(
        name="The Odds Arbitrageur",
        confidence=0.84 if configured and lines else 0.48 if lines else 0.22,
        summary=f"Scanned {len(lines)} player prop prices across configured books.",
        data=payload,
        warnings=[payload.get("warning")] if payload.get("warning") else [],
        evidence=[
            payload.get("source") or "odds source",
            f"Markets: {', '.join(payload.get('markets') or [])}",
        ],
    )


def alpha_probability(line: dict[str, Any], player: dict[str, Any] | None) -> tuple[float, float, list[str]]:
    market = str(line.get("market") or "")
    if not player:
        implied = as_number(line.get("consensusProbability") or line.get("impliedProbability"), 0.5)
        return clamp(implied + 0.012, 0.08, 0.88), 0.0, ["No FantasyIQ player match; consensus anchored."]
    estimate = estimate_stat(player.get("raw") or {}, market)
    side = str(line.get("side") or "").lower()
    notes = []
    if market == "player_anytime_td":
        yes_prob = clamp(estimate, 0.08, 0.72)
        probability = yes_prob if side in {"yes", "over"} else 1 - yes_prob
        notes.append(f"TD model {round(yes_prob * 100)}% from projection/value blend.")
        return probability, yes_prob, notes
    point = as_number(line.get("line"), 0)
    if point <= 0 or estimate <= 0:
        implied = as_number(line.get("consensusProbability") or line.get("impliedProbability"), 0.5)
        return clamp(implied + 0.01, 0.08, 0.88), estimate, ["Missing comparable line; consensus anchored."]
    z_score = (estimate - point) / market_scale(market)
    over = clamp(normal_cdf(z_score), 0.08, 0.9)
    probability = over if side == "over" else 1 - over
    notes.append(f"Projection {round(estimate, 1)} vs line {point:g}.")
    return clamp(probability, 0.08, 0.9), estimate, notes


def alpha_generator_agent(lines: list[dict[str, Any]], players: dict[str, dict[str, Any]]) -> AgentResult:
    modeled = []
    for line in lines:
        player = players.get(normalize_name(line.get("player")))
        probability, estimate, notes = alpha_probability(line, player)
        modeled.append(
            {
                **line,
                "modelProbability": round(probability, 4),
                "modelStat": round(estimate, 2),
                "alphaNotes": notes,
                "matchConfidence": 0.82 if player else 0.38,
            }
        )
    return AgentResult(
        name="The Alpha-Generator",
        confidence=0.76 if modeled else 0.3,
        summary=f"Modeled {len(modeled)} legs with FantasyIQ projection, matchup, and market baselines.",
        data={"lines": modeled},
        evidence=["Volume proxy", "line-vs-projection delta", "book consensus"],
    )


def ev_for_leg(line: dict[str, Any]) -> dict[str, Any]:
    probability = as_number(line.get("modelProbability"), 0.5)
    decimal = as_number(line.get("decimal"), american_to_decimal(line.get("priceAmerican")))
    profit = max(0.01, decimal - 1)
    ev = probability * profit - (1 - probability)
    kelly = ev / profit if profit > 0 else 0
    fractional_kelly = clamp(kelly * 0.25, 0, 0.035)
    units = round(clamp(fractional_kelly * 20, 0, 0.75), 2)
    implied = as_number(line.get("impliedProbability"), 0.5)
    edge_pct = (probability - implied) * 100
    return {
        **line,
        "edgePct": round(edge_pct, 1),
        "ev": round(ev, 4),
        "unitSize": units,
        "kellyFraction": round(fractional_kelly, 4),
        "positiveEv": ev > 0 and edge_pct >= EDGE_FLOOR,
    }


def ev_maximizer_agent(lines: list[dict[str, Any]]) -> AgentResult:
    ev_lines = [ev_for_leg(line) for line in lines]
    ev_lines = sorted(ev_lines, key=lambda item: (item.get("positiveEv"), item.get("ev", 0), item.get("edgePct", 0)), reverse=True)
    positives = [line for line in ev_lines if line.get("positiveEv")]
    return AgentResult(
        name="The EV Maximizer",
        confidence=0.78 if positives else 0.42,
        summary=f"Filtered to {len(positives)} +EV legs after probability, price, and Kelly checks.",
        data={"lines": ev_lines[:MAX_LEGS], "positiveCount": len(positives)},
        warnings=[] if positives else ["No strong positive-EV sportsbook lines found; showing conservative model candidates."],
        evidence=["Expected value", "fractional Kelly", "sportsbook best price"],
    )


def pair_correlation(a: dict[str, Any], b: dict[str, Any]) -> tuple[float, str]:
    if a.get("id") == b.get("id"):
        return 0.0, ""
    same_event = a.get("eventId") and a.get("eventId") == b.get("eventId")
    same_player = normalize_name(a.get("player")) and normalize_name(a.get("player")) == normalize_name(b.get("player"))
    if same_player and a.get("market") == b.get("market") and a.get("side") != b.get("side"):
        return -0.82, "Contradictory sides on the same player market."
    if same_player and a.get("side") == b.get("side") and {a.get("market"), b.get("market")} <= {"player_receptions", "player_reception_yds"}:
        return 0.42, "Same-player reception volume stack."
    if same_event and a.get("side") in {"Over", "Yes"} and b.get("side") in {"Over", "Yes"}:
        markets = {a.get("market"), b.get("market")}
        positions = {a.get("position"), b.get("position")}
        if "player_pass_yds" in markets and ("WR" in positions or "TE" in positions):
            return 0.34, "QB passing over pairs with pass-catcher volume."
        if "player_anytime_td" in markets and ("player_rush_yds" in markets or "player_reception_yds" in markets):
            return 0.24, "Yardage pressure supports touchdown equity."
        return 0.1, "Same game overs share scoring-environment upside."
    if same_event and a.get("side") != b.get("side"):
        return -0.12, "Mixed same-game direction lowers parlay efficiency."
    return 0.0, ""


def correlation_specialist_agent(lines: list[dict[str, Any]]) -> AgentResult:
    enriched = []
    for index, line in enumerate(lines):
        line = {**line, "id": line.get("id") or f"leg-{index + 1}"}
        positives = []
        negatives = []
        for other_index, other in enumerate(lines):
            if index == other_index:
                continue
            other = {**other, "id": other.get("id") or f"leg-{other_index + 1}"}
            score, reason = pair_correlation(line, other)
            if score > 0.15:
                positives.append({"legId": other["id"], "score": round(score, 2), "reason": reason})
            elif score < -0.15:
                negatives.append({"legId": other["id"], "score": round(score, 2), "reason": reason})
        enriched.append({**line, "positiveCorrelations": positives[:4], "negativeCorrelations": negatives[:4]})
    positive_pairs = sum(len(line.get("positiveCorrelations") or []) for line in enriched)
    return AgentResult(
        name="The Correlation Specialist",
        confidence=0.74 if enriched else 0.3,
        summary=f"Tagged {positive_pairs} positive correlation links and removed hard conflicts.",
        data={"lines": enriched},
        evidence=["same game relationship", "same-player volume overlap", "directional conflict checks"],
    )


def parlay_probability(legs: list[dict[str, Any]]) -> tuple[float, float, list[str]]:
    if not legs:
        return 0.0, 0.0, []
    base = 1.0
    for leg in legs:
        base *= clamp(as_number(leg.get("modelProbability"), 0.5), 0.03, 0.97)
    corr_sum = 0.0
    notes = []
    for index, leg in enumerate(legs):
        for other in legs[index + 1 :]:
            score, reason = pair_correlation(leg, other)
            corr_sum += score
            if reason and abs(score) >= 0.15:
                notes.append(reason)
    multiplier = clamp(1 + corr_sum * 0.16, 0.72, 1.22)
    return clamp(base * multiplier, 0.005, 0.92), round(corr_sum, 2), list(dict.fromkeys(notes))[:4]


def parlay_decimal(legs: list[dict[str, Any]]) -> float:
    decimal = 1.0
    for leg in legs:
        decimal *= max(1.01, as_number(leg.get("decimal"), american_to_decimal(leg.get("priceAmerican"))))
    return round(decimal, 4)


def build_parlay(tier: str, label: str, legs: list[dict[str, Any]], reason: str) -> dict[str, Any] | None:
    clean_legs = []
    for leg in legs:
        if any(pair_correlation(leg, existing)[0] < -0.5 for existing in clean_legs):
            continue
        clean_legs.append(leg)
    if len(clean_legs) < 2:
        return None
    decimal = parlay_decimal(clean_legs)
    probability, correlation_score, notes = parlay_probability(clean_legs)
    ev = probability * (decimal - 1) - (1 - probability)
    if ev <= 0:
        return None
    kelly = ev / max(0.01, decimal - 1)
    units = round(clamp(kelly * 0.25 * 20, 0.05, 1.0), 2)
    return {
        "id": slugify(f"{tier}-{label}"),
        "tier": tier,
        "label": label,
        "legs": clean_legs,
        "decimalOdds": decimal,
        "americanOdds": decimal_to_american(decimal),
        "modelProbability": round(probability, 4),
        "ev": round(ev, 4),
        "edgePct": round((probability - (1 / decimal)) * 100, 1),
        "correlationScore": correlation_score,
        "unitSize": units,
        "reason": reason,
        "correlationNotes": notes,
    }


def historical_event_config(context: dict[str, Any]) -> tuple[str, str]:
    event_id = compact_text(context.get("historicalEventId") or os.environ.get("FANTASYIQ_PARLAY_HISTORY_EVENT_ID"))
    date_value = compact_text(context.get("historicalDate") or os.environ.get("FANTASYIQ_PARLAY_HISTORY_DATE"))
    return event_id, date_value


def fetch_historical_event_odds(context: dict[str, Any], markets: list[str]) -> dict[str, Any] | None:
    api_key = odds_api_key()
    event_id, date_value = historical_event_config(context)
    if not api_key or not event_id or not date_value:
        return None
    sport = context.get("sport") or DEFAULT_SPORT
    cache_key = f"parlay-iq:historical:v1:{sport}:{event_id}:{date_value}:{','.join(markets)}"
    if not context.get("force"):
        cached = load_provider_payload(cache_key, HISTORICAL_CACHE_TTL_SECONDS)
        if cached:
            return cached
    params = odds_api_params(api_key, markets)
    params["date"] = date_value
    try:
        payload, headers, safe_url = odds_api_get(f"/historical/sports/{sport}/events/{event_id}/odds", params)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return None
    if not isinstance(payload, dict):
        return None
    wrapped = {
        "ok": True,
        "source": "The Odds API historical event odds",
        "eventId": event_id,
        "date": date_value,
        "snapshotTimestamp": payload.get("timestamp"),
        "previousTimestamp": payload.get("previous_timestamp"),
        "nextTimestamp": payload.get("next_timestamp"),
        "data": payload.get("data") if isinstance(payload.get("data"), dict) else {},
        "usage": usage_meta(headers),
        "sourceUrl": safe_url,
        "syncedAt": utc_now(),
    }
    save_provider_payload(cache_key, wrapped)
    record_freshness(
        source="the-odds-api",
        source_scope=f"parlay-iq:historical:{sport}",
        ok=True,
        max_age_seconds=HISTORICAL_CACHE_TTL_SECONDS,
        metadata={"eventId": event_id, "date": date_value, "usage": wrapped["usage"]},
        customer_slug=slugify(str(context.get("customerSlug") or "")),
        league_key=slugify(str(context.get("leagueKey") or "")),
    )
    return wrapped


def historical_market_coverage(snapshot: dict[str, Any] | None) -> dict[str, int]:
    if not snapshot:
        return {}
    data = snapshot.get("data") if isinstance(snapshot.get("data"), dict) else {}
    coverage: dict[str, int] = {}
    for bookmaker in data.get("bookmakers") or []:
        if not isinstance(bookmaker, dict):
            continue
        for market in bookmaker.get("markets") or []:
            if not isinstance(market, dict):
                continue
            key = compact_text(market.get("key"))
            if key:
                coverage[key] = coverage.get(key, 0) + len(market.get("outcomes") or [])
    return coverage


def historical_matrix(sport: str, context: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    context = context or {}
    historical_snapshot = fetch_historical_event_odds(context, configured_markets())
    coverage = historical_market_coverage(historical_snapshot)
    defaults = [
        ("player_pass_yds", "Projection edge 4%+", 128, 0.574, 0.061),
        ("player_reception_yds", "Roster/waiver volume edge", 164, 0.591, 0.073),
        ("player_receptions", "Same-player volume stack", 112, 0.607, 0.084),
        ("player_rush_yds", "Favorite script support", 119, 0.563, 0.044),
        ("player_anytime_td", "TD equity plus yardage", 86, 0.541, 0.058),
    ]
    rows = [
        {
            "sport": sport,
            "market": market,
            "marketLabel": market_label(market),
            "legType": leg_type,
            "sampleSize": samples,
            "winRate": win_rate,
            "roi": roi,
            "historicalLineSamples": coverage.get(market, 0),
            "historicalSnapshot": historical_snapshot.get("snapshotTimestamp") if historical_snapshot else "",
            "source": "FantasyIQ seeded calibration + historical line coverage" if historical_snapshot else "FantasyIQ seeded calibration",
        }
        for market, leg_type, samples, win_rate, roi in defaults
    ]
    if not database_enabled():
        return rows
    try:
        ensure_parlay_tables()
        with connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT sport_key, market_key, leg_type, sample_size, win_rate, roi, payload, updated_at
                      FROM fantasyiq_parlay_backtests
                     WHERE sport_key = %s OR sport_key = ''
                     ORDER BY sample_size DESC, updated_at DESC
                     LIMIT 12
                    """,
                    (sport,),
                )
                fetched = cursor.fetchall()
                if not fetched:
                    return rows
                matrix = []
                for row in fetched:
                    matrix.append(
                        {
                            "sport": row[0] or sport,
                            "market": row[1],
                            "marketLabel": market_label(row[1]),
                            "legType": row[2],
                            "sampleSize": row[3],
                            "winRate": float(row[4] or 0),
                            "roi": float(row[5] or 0),
                            "payload": json_value(row[6]),
                            "source": "FantasyIQ historical matrix",
                        }
                    )
                return matrix
    except Exception:
        return rows


def coordinator_agent(
    context: dict[str, Any],
    cruncher: AgentResult,
    odds: AgentResult,
    alpha: AgentResult,
    ev: AgentResult,
    correlation: AgentResult,
) -> dict[str, Any]:
    lines = correlation.data.get("lines") or ev.data.get("lines") or []
    positive = [line for line in lines if line.get("positiveEv")]
    fallback_pool = lines[:12]
    pool = positive or fallback_pool
    roster_pool = [line for line in pool if line.get("isRoster")]
    waiver_pool = [line for line in pool if line.get("isWaiver")]
    same_event_groups: dict[str, list[dict[str, Any]]] = {}
    for line in pool:
        same_event_groups.setdefault(str(line.get("eventId") or "slate"), []).append(line)

    parlays = []
    safe = build_parlay(
        "Safe Stack (+EV)",
        "Safe Stack",
        sorted(pool, key=lambda item: (item.get("modelProbability", 0), item.get("ev", 0)), reverse=True)[:3],
        "Highest blend of model probability, best price, and positive expected value.",
    )
    if safe:
        parlays.append(safe)
    best_same_game = max(same_event_groups.values(), key=len, default=[])
    sgp = build_parlay(
        "SGP Core",
        "Same Game Core",
        sorted(best_same_game, key=lambda item: (len(item.get("positiveCorrelations") or []), item.get("edgePct", 0)), reverse=True)[:3],
        "Built from same-game legs with positive correlation tags.",
    )
    if sgp:
        parlays.append(sgp)
    lotto = build_parlay(
        "The High-Yield Lotto",
        "High-Yield Lotto",
        sorted(pool, key=lambda item: (item.get("edgePct", 0), item.get("decimal", 0)), reverse=True)[:4],
        "Higher payout mix that still clears the +EV filter.",
    )
    if lotto:
        parlays.append(lotto)
    my_team = build_parlay(
        "Bet My Team",
        "Roster Edge",
        sorted(roster_pool or waiver_pool or pool, key=lambda item: (item.get("isRoster"), item.get("edgePct", 0)), reverse=True)[:3],
        "Prioritizes current roster and waiver-context players from MyFantasyIQ.",
    )
    if my_team:
        parlays.append(my_team)

    agents = [odds, cruncher, alpha, ev, correlation]
    warnings = []
    for agent in agents:
        warnings.extend(agent.warnings)
    if not positive:
        warnings.append("Strict sportsbook +EV filter found no live positives; model-only candidates are shown with lower confidence.")
    if not odds.data.get("configured"):
        warnings.append("Live sportsbook pricing is disabled until THE_ODDS_API_KEY is configured.")

    payload = {
        "ok": True,
        "source": "Parlay IQ Multi-Agent Coordinator",
        "syncedAt": utc_now(),
        "slateKey": hashlib.sha1(safe_json_dumps([line.get("eventId") for line in lines[:20]]).encode("utf-8")).hexdigest()[:12],
        "oddsConfigured": bool(odds.data.get("configured")),
        "sport": context.get("sport") or DEFAULT_SPORT,
        "status": "live" if odds.data.get("configured") else "model-only",
        "smartParlays": parlays,
        "legs": pool[:MAX_LEGS],
        "allLegs": lines[:MAX_LEGS],
        "rosterLegs": roster_pool[:12],
        "historicalMatrix": historical_matrix(context.get("sport") or DEFAULT_SPORT, context),
        "agents": [agent.public_dict() for agent in agents],
        "warnings": list(dict.fromkeys(warnings)),
        "usage": odds.data.get("usage") or {},
        "cache": odds.data.get("cache") or {},
        "responsibleGaming": "Informational analytics only. Verify lines, rules, eligibility, and local laws before placing any wager.",
    }
    save_recommendation(payload, payload["agents"], context)
    return payload


def parlay_iq_recommendation(body: dict[str, Any] | None = None, query: dict[str, list[str]] | None = None) -> dict[str, Any]:
    started = time.time()
    context = parse_body_context(body or {}, query or {})
    with ThreadPoolExecutor(max_workers=2) as executor:
        crunch_future = executor.submit(data_cruncher_agent, context)
        cruncher = crunch_future.result(timeout=10)
        odds_future = executor.submit(odds_arbitrageur_agent, context, cruncher.data.get("players") or {})
        odds = odds_future.result(timeout=30)

    with ThreadPoolExecutor(max_workers=3) as executor:
        alpha_future = executor.submit(alpha_generator_agent, odds.data.get("lines") or [], cruncher.data.get("players") or {})
        alpha = alpha_future.result(timeout=10)
        ev_future = executor.submit(ev_maximizer_agent, alpha.data.get("lines") or [])
        ev = ev_future.result(timeout=10)
        correlation_future = executor.submit(correlation_specialist_agent, ev.data.get("lines") or [])
        correlation = correlation_future.result(timeout=10)

    payload = coordinator_agent(context, cruncher, odds, alpha, ev, correlation)
    payload["latencyMs"] = int((time.time() - started) * 1000)
    return payload
