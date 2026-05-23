from __future__ import annotations

import json
import os
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from typing import Any

try:
    from database import DatabaseUnavailable, connect, database_enabled, json_value
except (ModuleNotFoundError, ImportError):
    try:
        from api.database import DatabaseUnavailable, connect, database_enabled, json_value
    except (ModuleNotFoundError, ImportError):
        DatabaseUnavailable = RuntimeError
        connect = None

        def database_enabled() -> bool:
            return False

        def json_value(value: Any) -> Any:
            if isinstance(value, str):
                try:
                    return json.loads(value)
                except json.JSONDecodeError:
                    return {}
            return value


DEFAULT_SEASON = 2026
ESPN_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
ESPN_TEAM_STATS = "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/teams/{team_id}/statistics"
SLEEPER_PLAYERS = "https://api.sleeper.app/v1/players/nfl"
ODDS_API = "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds"
CACHE_TTL_SECONDS = 7 * 24 * 60 * 60

TEAM_ABBR_TO_ESPN_ID = {
    "ATL": 1, "BUF": 2, "CHI": 3, "CIN": 4, "CLE": 5, "DAL": 6, "DEN": 7, "DET": 8,
    "GB": 9, "TEN": 10, "IND": 11, "KC": 12, "LV": 13, "LAR": 14, "MIA": 15, "MIN": 16,
    "NE": 17, "NO": 18, "NYG": 19, "NYJ": 20, "PHI": 21, "ARI": 22, "PIT": 23, "LAC": 24,
    "SF": 25, "SEA": 26, "TB": 27, "WAS": 28, "CAR": 29, "JAX": 30, "BAL": 33, "HOU": 34,
}
ESPN_ABBR_MAP = {"WSH": "WAS", "JAC": "JAX", "LA": "LAR"}
ODDS_TEAM_NAME_TO_ABBR = {
    "Arizona Cardinals": "ARI",
    "Atlanta Falcons": "ATL",
    "Baltimore Ravens": "BAL",
    "Buffalo Bills": "BUF",
    "Carolina Panthers": "CAR",
    "Chicago Bears": "CHI",
    "Cincinnati Bengals": "CIN",
    "Cleveland Browns": "CLE",
    "Dallas Cowboys": "DAL",
    "Denver Broncos": "DEN",
    "Detroit Lions": "DET",
    "Green Bay Packers": "GB",
    "Houston Texans": "HOU",
    "Indianapolis Colts": "IND",
    "Jacksonville Jaguars": "JAX",
    "Kansas City Chiefs": "KC",
    "Las Vegas Raiders": "LV",
    "Los Angeles Chargers": "LAC",
    "Los Angeles Rams": "LAR",
    "Miami Dolphins": "MIA",
    "Minnesota Vikings": "MIN",
    "New England Patriots": "NE",
    "New Orleans Saints": "NO",
    "New York Giants": "NYG",
    "New York Jets": "NYJ",
    "Philadelphia Eagles": "PHI",
    "Pittsburgh Steelers": "PIT",
    "San Francisco 49ers": "SF",
    "Seattle Seahawks": "SEA",
    "Tampa Bay Buccaneers": "TB",
    "Tennessee Titans": "TEN",
    "Washington Commanders": "WAS",
}
POSITIONS = ["QB", "RB", "WR", "TE", "DST", "K"]
_cache: dict[str, dict[str, Any]] = {}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def fetch_json(url: str, headers: dict[str, str] | None = None, timeout: int = 20) -> Any:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "FantasyIQ/1.0 (sos heatmap)",
            **(headers or {}),
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode(response.headers.get_content_charset() or "utf-8"))


def sos_cache_key(season: int) -> str:
    return f"sos_heatmap:v4-weekly:{season}"


def ensure_sos_cache_table(cursor: Any) -> None:
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS fantasyiq_provider_cache (
            cache_key TEXT PRIMARY KEY,
            payload JSONB NOT NULL DEFAULT '{}'::jsonb,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )


def load_durable_payload(season: int) -> dict[str, Any] | None:
    if not database_enabled() or connect is None:
        return None
    try:
        with connect() as connection:
            with connection.cursor() as cursor:
                ensure_sos_cache_table(cursor)
                cursor.execute(
                    """
                    SELECT payload, EXTRACT(EPOCH FROM (NOW() - updated_at)) AS age_seconds
                    FROM fantasyiq_provider_cache
                    WHERE cache_key = %s
                    """,
                    (sos_cache_key(season),),
                )
                row = cursor.fetchone()
                if not row:
                    return None
                payload = json_value(row[0])
                age_seconds = float(row[1] or 0)
                if isinstance(payload, dict) and payload.get("ok") and age_seconds < CACHE_TTL_SECONDS:
                    payload["cache"] = {"layer": "postgres", "ageSeconds": round(age_seconds)}
                    return payload
    except Exception:
        return None
    return None


def save_durable_payload(season: int, payload: dict[str, Any]) -> None:
    if not database_enabled() or connect is None:
        return
    try:
        with connect() as connection:
            with connection.cursor() as cursor:
                ensure_sos_cache_table(cursor)
                cursor.execute(
                    """
                    INSERT INTO fantasyiq_provider_cache (cache_key, payload, updated_at)
                    VALUES (%s, %s::jsonb, NOW())
                    ON CONFLICT (cache_key)
                    DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
                    """,
                    (sos_cache_key(season), json.dumps(payload)),
                )
    except Exception:
        return


def stat_value(categories: list[dict[str, Any]], name: str, default: float = 0.0) -> float:
    for category in categories:
        for stat in category.get("stats") or []:
            if stat.get("name") == name:
                try:
                    return float(stat.get("perGameValue") if stat.get("perGameValue") is not None else stat.get("value"))
                except (TypeError, ValueError):
                    return default
    return default


def category_stat_value(categories: list[dict[str, Any]], category_name: str, name: str, default: float = 0.0) -> float:
    for category in categories:
        if category.get("name") != category_name:
            continue
        for stat in category.get("stats") or []:
            if stat.get("name") == name:
                try:
                    return float(stat.get("perGameValue") if stat.get("perGameValue") is not None else stat.get("value"))
                except (TypeError, ValueError):
                    return default
    return default


def team_stats(season: int) -> dict[str, dict[str, float]]:
    stats: dict[str, dict[str, float]] = {}
    prior_year = max(2024, season - 1)
    for abbr, espn_id in TEAM_ABBR_TO_ESPN_ID.items():
        try:
            url = ESPN_TEAM_STATS.format(team_id=espn_id) + f"?season={prior_year}"
            payload = fetch_json(url)
            categories = payload.get("results", {}).get("stats", {}).get("categories", [])
            stats[abbr] = {
                "points_pg": stat_value(categories, "totalPointsPerGame", 21.5),
                "pass_yards_pg": category_stat_value(categories, "passing", "netPassingYardsPerGame", 220.0),
                "rush_yards_pg": category_stat_value(categories, "rushing", "rushingYardsPerGame", 110.0),
                "sacks_for": category_stat_value(categories, "defensive", "sacks", 2.2),
                "sacks_taken": category_stat_value(categories, "passing", "sacks", 2.2),
                "interceptions_for": category_stat_value(categories, "defensiveInterceptions", "interceptions", 0.75) / 17,
                "fg_attempts": category_stat_value(categories, "kicking", "fieldGoalAttempts", 1.8) / 17,
            }
        except Exception:
            stats[abbr] = {
                "points_pg": 21.5,
                "pass_yards_pg": 220.0,
                "rush_yards_pg": 110.0,
                "sacks_for": 2.2,
                "sacks_taken": 2.2,
                "interceptions_for": 0.75,
                "fg_attempts": 1.8,
            }
    return stats


def schedule(season: int) -> dict[str, dict[int, str]]:
    games_by_team: dict[str, dict[int, str]] = {team: {} for team in TEAM_ABBR_TO_ESPN_ID}
    for week in range(1, 19):
        url = ESPN_SCOREBOARD + "?" + urllib.parse.urlencode({"seasontype": 2, "week": week, "dates": season})
        try:
            payload = fetch_json(url)
        except Exception:
            continue
        for event in payload.get("events") or []:
            competitors = (event.get("competitions") or [{}])[0].get("competitors") or []
            if len(competitors) < 2:
                continue
            teams = []
            for competitor in competitors[:2]:
                abbr = (competitor.get("team") or {}).get("abbreviation") or ""
                teams.append(ESPN_ABBR_MAP.get(abbr, abbr))
            if len(teams) == 2 and teams[0] in games_by_team and teams[1] in games_by_team:
                games_by_team[teams[0]][week] = teams[1]
                games_by_team[teams[1]][week] = teams[0]
    return games_by_team


def sleeper_injuries() -> dict[str, int]:
    pressure = {team: 0 for team in TEAM_ABBR_TO_ESPN_ID}
    try:
        players = fetch_json(SLEEPER_PLAYERS, timeout=30)
    except Exception:
        return pressure
    severe = {"Out", "Doubtful", "IR", "PUP", "Suspended"}
    for player in players.values() if isinstance(players, dict) else []:
        team = player.get("team")
        if team in pressure and player.get("injury_status") in severe:
            pressure[team] += 1
    return pressure


def odds_context() -> dict[str, dict[str, float]]:
    api_key = os.environ.get("THE_ODDS_API_KEY") or os.environ.get("ODDS_API_KEY")
    if not api_key:
        return {}
    params = urllib.parse.urlencode({"apiKey": api_key, "regions": "us", "markets": "spreads,totals", "oddsFormat": "american"})
    try:
        events = fetch_json(f"{ODDS_API}?{params}")
    except Exception:
        return {}
    context: dict[str, dict[str, float]] = {}
    for event in events if isinstance(events, list) else []:
        bookmakers = event.get("bookmakers") or []
        markets = (bookmakers[0].get("markets") if bookmakers else []) or []
        total = 43.0
        spread_by_team: dict[str, float] = {}
        for market in markets:
            if market.get("key") == "totals":
                outcomes = market.get("outcomes") or []
                if outcomes:
                    total = float(outcomes[0].get("point") or total)
            if market.get("key") == "spreads":
                for outcome in market.get("outcomes") or []:
                    name = str(outcome.get("name") or "")
                    abbr = ODDS_TEAM_NAME_TO_ABBR.get(name) or next((team for team in TEAM_ABBR_TO_ESPN_ID if team in name.upper()), "")
                    if abbr:
                        spread_by_team[abbr] = float(outcome.get("point") or 0)
        for abbr, spread in spread_by_team.items():
            context[abbr] = {"total": total, "spread": spread, "implied": total / 2 - spread / 2}
    return context


def odds_key_configured() -> bool:
    return bool(os.environ.get("THE_ODDS_API_KEY") or os.environ.get("ODDS_API_KEY"))


def matchup_score(position: str, offense: str, opponent: str, stats: dict[str, dict[str, float]], injuries: dict[str, int], odds: dict[str, dict[str, float]]) -> float:
    defense = stats.get(opponent, {})
    offense_stats = stats.get(offense, {})
    pressure = defense.get("sacks_for", 2.2) + defense.get("interceptions_for", 0.75) * 1.7
    injury_penalty = min(0.55, injuries.get(offense, 0) * 0.035)
    injury_relief = min(0.35, injuries.get(opponent, 0) * 0.025)
    implied = odds.get(offense, {}).get("implied", offense_stats.get("points_pg", 21.5))
    if position in {"QB", "WR", "TE"}:
        raw = 2.5 + (pressure - 3.2) * 0.55 - (implied - 22.0) * 0.04 + injury_penalty - injury_relief
    elif position == "RB":
        raw = 2.45 + (defense.get("rush_yards_pg", 110.0) - 110.0) * -0.009 - (implied - 22.0) * 0.035 + injury_penalty - injury_relief
    elif position == "DST":
        raw = 2.5 + (offense_stats.get("points_pg", 21.5) - 21.5) * 0.05 - (offense_stats.get("sacks_taken", 2.2) - 2.2) * 0.25
    else:  # K
        raw = 2.5 - (implied - 22.0) * 0.05 - (offense_stats.get("fg_attempts", 1.8) - 1.8) * 0.22 + injury_penalty * 0.5
    return clamp(raw, 1.0, 4.0)


def build_payload(season: int, force: bool = False) -> dict[str, Any]:
    now = time.time()
    cache_key = str(season)
    cached = _cache.get(cache_key)
    if not force and cached and now - float(cached.get("ts") or 0) < CACHE_TTL_SECONDS:
        payload = dict(cached["payload"])
        payload["cache"] = {"layer": "memory", "ageSeconds": round(now - float(cached.get("ts") or 0))}
        return payload
    durable = None if force else load_durable_payload(season)
    if durable:
        _cache[cache_key] = {"ts": now, "payload": durable}
        return durable
    stats = team_stats(season)
    games = schedule(season)
    injuries = sleeper_injuries()
    odds = odds_context()
    has_odds_key = odds_key_configured()
    rows = []
    for team in TEAM_ABBR_TO_ESPN_ID:
        for position in POSITIONS:
            cells = []
            for week in range(1, 19):
                opponent = games.get(team, {}).get(week, "BYE")
                if opponent == "BYE":
                    cells.append({"week": week, "opponent": "BYE", "score": None, "tier": "bye"})
                    continue
                score = matchup_score(position, team, opponent, stats, injuries, odds)
                tier = "easy" if score <= 1.75 else "good" if score <= 2.5 else "hard" if score <= 3.25 else "brutal"
                cells.append({"week": week, "opponent": opponent, "score": round(score, 2), "tier": tier})
            valid_scores = [cell["score"] for cell in cells if isinstance(cell.get("score"), (int, float))]
            avg = sum(valid_scores) / len(valid_scores) if valid_scores else 2.5
            rows.append({
                "team": team,
                "position": position,
                "cells": cells,
                "avgDifficulty": round(avg, 2),
                "ease": round((5 - avg) * 25),
                "brutalWeeks": sum(1 for score in valid_scores if score >= 3.25),
                "injuryPressure": injuries.get(team, 0),
                "source": "espn_schedule_team_stats_sleeper_injuries" + ("_odds" if odds else ""),
            })
    payload = {
        "ok": True,
        "season": season,
        "updatedAt": utc_now(),
        "refreshCadence": "Shared database cache refreshes weekly to protect odds credits; page loads use cached SoS data between refreshes.",
        "cache": {"layer": "forced" if force else "fresh", "ageSeconds": 0},
        "sources": {
            "schedule": "ESPN public NFL scoreboard API",
            "teamStats": f"ESPN public NFL team statistics, season {max(2024, season - 1)}",
            "injuries": "Sleeper public NFL players endpoint",
            "odds": (
                "The Odds API spreads/totals"
                if odds
                else "Configured, but provider returned no current NFL spreads/totals"
                if has_odds_key
                else "Not configured; set THE_ODDS_API_KEY"
            ),
            "fpa": "Provider slot ready; configure Tank01/Sportradar FPA feed for true points-allowed-by-position.",
        },
        "methodology": [
            "QB/WR/TE grades use opponent sack and interception disruption, team implied points when odds are configured, and injury pressure.",
            "RB grades use opponent front disruption proxy plus team scoring environment and injury pressure.",
            "D/ST grades use opponent scoring and sack environment.",
            "K grades use implied team total, field-goal attempt tendency, and injury pressure.",
        ],
        "rows": rows,
    }
    _cache[cache_key] = {"ts": now, "payload": payload}
    save_durable_payload(season, payload)
    return payload


def force_refresh_payload(season: int = DEFAULT_SEASON) -> dict[str, Any]:
    return build_payload(season, force=True)


def json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        try:
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            season = int((query.get("season") or [DEFAULT_SEASON])[0] or DEFAULT_SEASON)
            json_response(self, HTTPStatus.OK, build_payload(season))
        except Exception as exc:
            json_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "error": str(exc), "updatedAt": utc_now()})
