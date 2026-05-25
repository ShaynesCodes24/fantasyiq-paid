from __future__ import annotations

import json
import os
import re
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from typing import Any

try:
    from database import DatabaseUnavailable, connect, database_enabled, json_value
    from provider_cache import record_freshness
except (ModuleNotFoundError, ImportError):
    try:
        from api.database import DatabaseUnavailable, connect, database_enabled, json_value
        from api.provider_cache import record_freshness
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

        def record_freshness(**_kwargs: Any) -> bool:
            return False


DEFAULT_SEASON = 2026
ESPN_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
ESPN_TEAM_STATS = "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/teams/{team_id}/statistics"
SLEEPER_PLAYERS = "https://api.sleeper.app/v1/players/nfl"
FOOTBALLDB_FPA = "https://www.footballdb.com/fantasy-football/points-allowed.html"
ODDS_API = "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds"
HISTORICAL_ODDS_API = "https://api.the-odds-api.com/v4/historical/sports/americanfootball_nfl/odds"
CACHE_TTL_SECONDS = 7 * 24 * 60 * 60
REFRESH_MAX_AGE_SECONDS = 8 * 24 * 60 * 60
CACHE_VERSION = "v9-schedule-validation"
LEGACY_CACHE_VERSIONS = ("v8-schedule-intelligence", "v7-schedule-rank")
PROVIDER_WORKERS = 8
ODDS_MARKETS = "h2h,spreads,totals"
DEFAULT_ODDS_BOOKMAKERS = "draftkings,fanduel,betmgm"
PLAYOFF_WEEKS = (15, 16, 17)
DOME_HOME_TEAMS = {"ARI", "ATL", "DAL", "DET", "HOU", "IND", "LV", "LAR", "LAC", "MIN", "NO"}
COLD_WEATHER_HOME_TEAMS = {"BUF", "CHI", "CLE", "DEN", "GB", "KC", "NE", "NYG", "NYJ", "PHI", "PIT", "BAL", "WAS"}

TEAM_ABBR_TO_ESPN_ID = {
    "ATL": 1, "BUF": 2, "CHI": 3, "CIN": 4, "CLE": 5, "DAL": 6, "DEN": 7, "DET": 8,
    "GB": 9, "TEN": 10, "IND": 11, "KC": 12, "LV": 13, "LAR": 14, "MIA": 15, "MIN": 16,
    "NE": 17, "NO": 18, "NYG": 19, "NYJ": 20, "PHI": 21, "ARI": 22, "PIT": 23, "LAC": 24,
    "SF": 25, "SEA": 26, "TB": 27, "WAS": 28, "CAR": 29, "JAX": 30, "BAL": 33, "HOU": 34,
}
ESPN_ABBR_MAP = {"WSH": "WAS", "JAC": "JAX", "LA": "LAR"}
FOOTBALLDB_ABBR_MAP = {"ARZ": "ARI", "JAC": "JAX", "LA": "LAR", "WSH": "WAS"}
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


class TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_cell = False
        self.current_cell = ""
        self.current_row: list[str] = []
        self.rows: list[list[str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"td", "th"}:
            self.in_cell = True
            self.current_cell = ""

    def handle_data(self, data: str) -> None:
        if self.in_cell:
            self.current_cell += data

    def handle_endtag(self, tag: str) -> None:
        if tag in {"td", "th"} and self.in_cell:
            self.current_row.append(" ".join(self.current_cell.split()))
            self.in_cell = False
        elif tag == "tr" and self.current_row:
            self.rows.append(self.current_row)
            self.current_row = []


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def int_env(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, "").strip() or default)
    except (TypeError, ValueError):
        return default


def parse_utc(value: str) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        return None


def odds_query_params(api_key: str, date_value: str = "") -> dict[str, str]:
    bookmakers = os.environ.get("THE_ODDS_API_BOOKMAKERS", DEFAULT_ODDS_BOOKMAKERS).strip()
    params = {"apiKey": api_key, "markets": ODDS_MARKETS, "oddsFormat": "american"}
    if bookmakers:
        params["bookmakers"] = bookmakers
    else:
        params["regions"] = os.environ.get("THE_ODDS_API_REGIONS", "us").strip() or "us"
    if date_value:
        params["date"] = date_value
    return params


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


def fetch_text(url: str, timeout: int = 20) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "text/html,application/xhtml+xml",
            "User-Agent": "FantasyIQ/1.0 (sos heatmap)",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode(response.headers.get_content_charset() or "utf-8", errors="replace")


def fetch_json_with_headers(url: str, timeout: int = 20) -> tuple[Any, dict[str, str]]:
    request = urllib.request.Request(
        url,
        headers={"Accept": "application/json", "User-Agent": "FantasyIQ/1.0 (sos heatmap)"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        body = json.loads(response.read().decode(response.headers.get_content_charset() or "utf-8"))
        return body, {key.lower(): value for key, value in response.headers.items()}


def sos_cache_key(season: int) -> str:
    return f"sos_heatmap:{CACHE_VERSION}:{season}"


def legacy_sos_cache_keys(season: int) -> list[str]:
    return [f"sos_heatmap:{version}:{season}" for version in LEGACY_CACHE_VERSIONS]


def sos_snapshot_key(season: int, stamp: str) -> str:
    return f"sos_heatmap:snapshot:{season}:{stamp}"


def sos_refresh_log_key(season: int, stamp: str) -> str:
    return f"sos_heatmap:refresh-log:{season}:{stamp}"


def sos_validation_key(season: int, stamp: str) -> str:
    return f"sos_heatmap:validation:{season}:{stamp}"


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


def load_any_existing_payload(season: int) -> dict[str, Any] | None:
    if not database_enabled() or connect is None:
        return None
    keys = [sos_cache_key(season), *legacy_sos_cache_keys(season)]
    try:
        with connect() as connection:
            with connection.cursor() as cursor:
                ensure_sos_cache_table(cursor)
                cursor.execute(
                    """
                    SELECT cache_key, payload, updated_at
                    FROM fantasyiq_provider_cache
                    WHERE cache_key = ANY(%s)
                    ORDER BY updated_at DESC
                    LIMIT 1
                    """,
                    (keys,),
                )
                row = cursor.fetchone()
                if not row:
                    return None
                payload = json_value(row[1])
                if isinstance(payload, dict) and payload.get("ok"):
                    payload["_snapshotSourceKey"] = row[0]
                    payload["_snapshotUpdatedAt"] = row[2].isoformat().replace("+00:00", "Z") if row[2] else ""
                    return payload
    except Exception:
        return None
    return None


def save_payload_with_key(cache_key: str, payload: dict[str, Any]) -> bool:
    if not database_enabled() or connect is None:
        return False
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
                    (cache_key, json.dumps(payload)),
                )
        return True
    except Exception:
        return False


def save_historical_snapshot(season: int, previous_payload: dict[str, Any] | None, reason: str) -> dict[str, Any]:
    if not isinstance(previous_payload, dict) or not previous_payload.get("ok"):
        return {"saved": False, "reason": "No prior schedule heatmap payload found."}
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    snapshot = {
        "ok": True,
        "type": "sos-heatmap-snapshot",
        "season": season,
        "snapshotAt": utc_now(),
        "reason": reason,
        "sourceCacheKey": previous_payload.get("_snapshotSourceKey") or sos_cache_key(season),
        "sourceUpdatedAt": previous_payload.get("_snapshotUpdatedAt") or previous_payload.get("updatedAt") or "",
        "payload": {key: value for key, value in previous_payload.items() if not str(key).startswith("_snapshot")},
    }
    saved = save_payload_with_key(sos_snapshot_key(season, stamp), snapshot)
    return {
        "saved": saved,
        "snapshotKey": sos_snapshot_key(season, stamp) if saved else "",
        "sourceUpdatedAt": snapshot["sourceUpdatedAt"],
    }


def save_durable_payload(season: int, payload: dict[str, Any]) -> bool:
    return save_payload_with_key(sos_cache_key(season), payload)


def save_refresh_log(season: int, payload: dict[str, Any]) -> dict[str, Any]:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    saved = save_payload_with_key(sos_refresh_log_key(season, stamp), payload)
    return {"saved": saved, "logKey": sos_refresh_log_key(season, stamp) if saved else ""}


def save_validation_result(season: int, validation: dict[str, Any]) -> dict[str, Any]:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    cache_key = sos_validation_key(season, stamp)
    saved = save_payload_with_key(cache_key, {
        "ok": bool(validation.get("ok")),
        "type": "sos-heatmap-validation",
        "season": season,
        "createdAt": utc_now(),
        "validation": validation,
    })
    return {"saved": saved, "validationKey": cache_key if saved else ""}


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


def default_team_stat() -> dict[str, float]:
    return {
        "points_pg": 21.5,
        "pass_yards_pg": 220.0,
        "rush_yards_pg": 110.0,
        "sacks_for": 2.2,
        "sacks_taken": 2.2,
        "interceptions_for": 0.75,
        "fg_attempts": 1.8,
    }


def fetch_team_stat(abbr: str, espn_id: int, season: int) -> tuple[str, dict[str, float]]:
    try:
        url = ESPN_TEAM_STATS.format(team_id=espn_id) + f"?season={season}"
        payload = fetch_json(url, timeout=12)
        categories = payload.get("results", {}).get("stats", {}).get("categories", [])
        return abbr, {
            "points_pg": stat_value(categories, "totalPointsPerGame", 21.5),
            "pass_yards_pg": category_stat_value(categories, "passing", "netPassingYardsPerGame", 220.0),
            "rush_yards_pg": category_stat_value(categories, "rushing", "rushingYardsPerGame", 110.0),
            "sacks_for": category_stat_value(categories, "defensive", "sacks", 2.2),
            "sacks_taken": category_stat_value(categories, "passing", "sacks", 2.2),
            "interceptions_for": category_stat_value(categories, "defensiveInterceptions", "interceptions", 0.75) / 17,
            "fg_attempts": category_stat_value(categories, "kicking", "fieldGoalAttempts", 1.8) / 17,
        }
    except Exception:
        return abbr, default_team_stat()


def team_stats(season: int) -> dict[str, dict[str, float]]:
    prior_year = max(2024, season - 1)
    stats: dict[str, dict[str, float]] = {team: default_team_stat() for team in TEAM_ABBR_TO_ESPN_ID}
    with ThreadPoolExecutor(max_workers=PROVIDER_WORKERS) as executor:
        futures = [executor.submit(fetch_team_stat, abbr, espn_id, prior_year) for abbr, espn_id in TEAM_ABBR_TO_ESPN_ID.items()]
        for future in as_completed(futures):
            abbr, values = future.result()
            stats[abbr] = values
    return stats


def fetch_schedule_week(season: int, week: int) -> tuple[int, list[dict[str, Any]]]:
    url = ESPN_SCOREBOARD + "?" + urllib.parse.urlencode({"seasontype": 2, "week": week, "dates": season})
    try:
        payload = fetch_json(url, timeout=12)
        return week, payload.get("events") or []
    except Exception:
        return week, []


def numeric_score(value: Any) -> int | None:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def schedule_event_record(week: int, event: dict[str, Any]) -> dict[str, Any] | None:
    competition = (event.get("competitions") or [{}])[0]
    competitors = competition.get("competitors") or []
    if len(competitors) < 2:
        return None
    status_type = ((event.get("status") or {}).get("type") or {})
    teams: list[str] = []
    sites: dict[str, str] = {}
    scores: dict[str, int] = {}
    home_team = ""
    away_team = ""
    for competitor in competitors[:2]:
        raw_abbr = (competitor.get("team") or {}).get("abbreviation") or ""
        abbr = ESPN_ABBR_MAP.get(raw_abbr, raw_abbr)
        if abbr not in TEAM_ABBR_TO_ESPN_ID:
            continue
        home_away = str(competitor.get("homeAway") or "").lower()
        teams.append(abbr)
        sites[abbr] = "away" if home_away == "away" else "home"
        if home_away == "home":
            home_team = abbr
        elif home_away == "away":
            away_team = abbr
        score = numeric_score(competitor.get("score"))
        if score is not None:
            scores[abbr] = score
    if len(teams) != 2:
        return None
    completed = bool(status_type.get("completed")) or str(status_type.get("state") or "").lower() == "post"
    actual_total = sum(scores.values()) if len(scores) == 2 else None
    return {
        "week": week,
        "eventId": event.get("id") or "",
        "startsAt": str(event.get("date") or ""),
        "teams": teams,
        "homeTeam": home_team,
        "awayTeam": away_team,
        "sites": sites,
        "scores": scores,
        "actualTotal": actual_total,
        "completed": completed,
        "status": status_type.get("name") or status_type.get("description") or "",
        "statusState": status_type.get("state") or "",
    }


def schedule(season: int) -> tuple[dict[str, dict[int, str]], dict[int, datetime], dict[str, dict[int, str]], dict[int, list[dict[str, Any]]]]:
    games_by_team: dict[str, dict[int, str]] = {team: {} for team in TEAM_ABBR_TO_ESPN_ID}
    site_by_team: dict[str, dict[int, str]] = {team: {} for team in TEAM_ABBR_TO_ESPN_ID}
    week_starts: dict[int, datetime] = {}
    events_by_week: dict[int, list[dict[str, Any]]] = {week: [] for week in range(1, 19)}
    with ThreadPoolExecutor(max_workers=PROVIDER_WORKERS) as executor:
        futures = [executor.submit(fetch_schedule_week, season, week) for week in range(1, 19)]
        for future in as_completed(futures):
            week, events = future.result()
            for event in events:
                starts_at = parse_utc(str(event.get("date") or ""))
                if starts_at and (week not in week_starts or starts_at < week_starts[week]):
                    week_starts[week] = starts_at
                event_record = schedule_event_record(week, event)
                if not event_record:
                    continue
                teams = event_record["teams"]
                sites = event_record["sites"]
                if len(teams) == 2 and teams[0] in games_by_team and teams[1] in games_by_team:
                    games_by_team[teams[0]][week] = teams[1]
                    games_by_team[teams[1]][week] = teams[0]
                    site_by_team[teams[0]][week] = sites.get(teams[0], "home")
                    site_by_team[teams[1]][week] = sites.get(teams[1], "home")
                    events_by_week.setdefault(week, []).append(event_record)
    return games_by_team, week_starts, site_by_team, events_by_week


def completed_results_index(events_by_week: dict[int, list[dict[str, Any]]] | None) -> dict[tuple[str, str], dict[str, Any]]:
    results: dict[tuple[str, str], dict[str, Any]] = {}
    for events in (events_by_week or {}).values():
        for event in events:
            teams = [team for team in event.get("teams") or [] if team in TEAM_ABBR_TO_ESPN_ID]
            if len(teams) != 2 or not event.get("completed") or not isinstance(event.get("actualTotal"), (int, float)):
                continue
            results[tuple(sorted(teams))] = event
    return results


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


def fpa_source_year(season: int) -> int:
    current = datetime.now(timezone.utc).year
    if season >= current:
        return max(2024, season - 1)
    return season


def football_db_team_abbr(value: str, position: str) -> str:
    clean = str(value or "").strip()
    match = re.search(r"([A-Z]{2,3})\s+vs\.\s+" + re.escape(position) + r"$", clean)
    if not match:
        match = re.search(r"([A-Z]{2,3})vs\.\s+" + re.escape(position) + r"$", clean)
    if not match:
        return ""
    raw = match.group(1)
    return FOOTBALLDB_ABBR_MAP.get(raw, raw)


def fetch_position_fpa(position: str, year: int) -> tuple[str, dict[str, float]]:
    params = urllib.parse.urlencode({"pos": position, "yr": year})
    url = f"{FOOTBALLDB_FPA}?{params}"
    html = fetch_text(url, timeout=20)
    parser = TableParser()
    parser.feed(html)
    rows = [row for row in parser.rows if row and " vs. " in row[0]]
    values: dict[str, float] = {}
    for row in rows:
        abbr = football_db_team_abbr(row[0], position)
        if abbr not in TEAM_ABBR_TO_ESPN_ID:
            continue
        try:
            # FootballDB places the game-average fantasy points in the final column.
            values[abbr] = float(row[-1])
        except (TypeError, ValueError):
            continue
    return position, values


def fantasy_points_allowed(season: int) -> tuple[dict[str, dict[str, float]], dict[str, Any]]:
    year = fpa_source_year(season)
    fpa: dict[str, dict[str, float]] = {team: {} for team in TEAM_ABBR_TO_ESPN_ID}
    meta: dict[str, Any] = {"provider": "footballdb", "season": year, "positions": {}, "teams": 0}
    with ThreadPoolExecutor(max_workers=min(PROVIDER_WORKERS, len(POSITIONS))) as executor:
        futures = [executor.submit(fetch_position_fpa, position, year) for position in POSITIONS]
        for future in as_completed(futures):
            try:
                position, values = future.result()
            except Exception as exc:
                meta.setdefault("errors", []).append(str(exc))
                continue
            meta["positions"][position] = len(values)
            for team, points in values.items():
                fpa.setdefault(team, {})[position] = points
    meta["teams"] = sum(1 for team_values in fpa.values() if team_values)
    return fpa, meta


def normalized_fpa_score(position: str, opponent: str, fpa: dict[str, dict[str, float]]) -> float | None:
    position_values = [
        team_values[position]
        for team_values in fpa.values()
        if isinstance(team_values.get(position), (int, float))
    ]
    allowed = fpa.get(opponent, {}).get(position)
    if not position_values or not isinstance(allowed, (int, float)):
        return None
    avg = sum(position_values) / len(position_values)
    variance = sum((value - avg) ** 2 for value in position_values) / len(position_values)
    stdev = max(0.01, variance ** 0.5)
    z_score = clamp((allowed - avg) / stdev, -2.0, 2.0)
    return clamp(2.5 - z_score * 0.62, 1.0, 4.0)


def mean(values: list[float]) -> float | None:
    clean = [value for value in values if isinstance(value, (int, float))]
    return sum(clean) / len(clean) if clean else None


def median(values: list[float]) -> float | None:
    clean = sorted(value for value in values if isinstance(value, (int, float)))
    if not clean:
        return None
    middle = len(clean) // 2
    if len(clean) % 2:
        return clean[middle]
    return (clean[middle - 1] + clean[middle]) / 2


def american_to_probability(price: Any) -> float | None:
    try:
        odds = float(price)
    except (TypeError, ValueError):
        return None
    if odds == 0:
        return None
    if odds < 0:
        return abs(odds) / (abs(odds) + 100)
    return 100 / (odds + 100)


def no_vig_probabilities(outcomes: list[dict[str, Any]]) -> dict[str, float]:
    raw: dict[str, float] = {}
    for outcome in outcomes:
        name = str(outcome.get("name") or "").strip()
        probability = american_to_probability(outcome.get("price"))
        if name and probability is not None:
            raw[name] = probability
    total = sum(raw.values())
    if total <= 0:
        return {}
    return {name: probability / total for name, probability in raw.items()}


def market_point_with_price(edge: dict[str, Any], probability: float | None, kind: str) -> float | None:
    try:
        point = float(edge.get("point"))
    except (TypeError, ValueError):
        return None
    if probability is None:
        return point
    if kind == "total":
        return point + clamp((probability - 0.5) * 2.0, -1.5, 1.5)
    if kind == "spread":
        return point - clamp((probability - 0.5) * 2.0, -1.5, 1.5)
    return point


def derived_spread_from_moneyline(win_probability: float | None) -> float | None:
    if win_probability is None:
        return None
    return round(clamp(-(win_probability - 0.5) / 0.035, -17.0, 17.0), 2)


def team_abbr_from_name(name: str) -> str:
    clean = str(name or "").strip()
    if clean in ODDS_TEAM_NAME_TO_ABBR:
        return ODDS_TEAM_NAME_TO_ABBR[clean]
    upper = clean.upper()
    if upper in TEAM_ABBR_TO_ESPN_ID:
        return upper
    return next((team for team in TEAM_ABBR_TO_ESPN_ID if team in upper), "")


def extract_event_odds(event: dict[str, Any], source: str) -> dict[str, dict[str, Any]]:
    totals: list[float] = []
    spreads: dict[str, list[float]] = {}
    moneyline_prices: dict[str, list[float]] = {}
    moneyline_probs: dict[str, list[float]] = {}
    bookmaker_count = 0
    for bookmaker in event.get("bookmakers") or []:
        contributed = False
        for market in bookmaker.get("markets") or []:
            key = market.get("key")
            outcomes = market.get("outcomes") or []
            if key == "totals":
                probabilities = no_vig_probabilities(outcomes)
                for outcome in outcomes:
                    name = str(outcome.get("name") or "").strip().lower()
                    if name != "over":
                        continue
                    point = market_point_with_price(outcome, probabilities.get(str(outcome.get("name") or "").strip()), "total")
                    if point is not None:
                        totals.append(point)
                        contributed = True
            elif key == "spreads":
                probabilities = no_vig_probabilities(outcomes)
                for outcome in outcomes:
                    abbr = team_abbr_from_name(str(outcome.get("name") or ""))
                    if not abbr:
                        continue
                    point = market_point_with_price(outcome, probabilities.get(str(outcome.get("name") or "").strip()), "spread")
                    if point is not None:
                        spreads.setdefault(abbr, []).append(point)
                        contributed = True
            elif key == "h2h":
                probabilities = no_vig_probabilities(outcomes)
                for outcome in outcomes:
                    abbr = team_abbr_from_name(str(outcome.get("name") or ""))
                    probability = probabilities.get(str(outcome.get("name") or "").strip())
                    if not abbr or probability is None:
                        continue
                    moneyline_probs.setdefault(abbr, []).append(probability)
                    try:
                        moneyline_prices.setdefault(abbr, []).append(float(outcome.get("price")))
                    except (TypeError, ValueError):
                        pass
                    contributed = True
        if contributed:
            bookmaker_count += 1
    total = median(totals)
    if total is None and not spreads and not moneyline_probs:
        return {}
    context: dict[str, dict[str, Any]] = {}
    teams = set(spreads) | set(moneyline_probs)
    for abbr in teams:
        spread = median(spreads.get(abbr, []))
        win_probability = mean(moneyline_probs.get(abbr, []))
        moneyline = median(moneyline_prices.get(abbr, []))
        if spread is None:
            spread = derived_spread_from_moneyline(win_probability)
        if spread is None:
            continue
        market_total = total if total is not None else 43.0
        context[abbr] = {
            "total": round(market_total, 2),
            "spread": round(spread, 2),
            "implied": round(market_total / 2 - spread / 2, 2),
            "moneyline": round(moneyline) if moneyline is not None else None,
            "noVigWinProbability": round(win_probability, 4) if win_probability is not None else None,
            "bookmakers": float(bookmaker_count),
            "sourceWeight": 1.0 if source == "live" else 0.65,
            "sourceType": source,
        }
    return context


def merge_team_odds(target: dict[str, dict[str, Any]], event_context: dict[str, dict[str, Any]], source: str) -> None:
    for abbr, values in event_context.items():
        if source == "live" or abbr not in target:
            target[abbr] = {**values, "sourceType": source, "samples": values.get("sourceWeight", 1.0)}
            continue
        current = target[abbr]
        historical_weight = values.get("sourceWeight", 0.65)
        existing_weight = current.get("samples", 1.0)
        total_weight = existing_weight + historical_weight
        current["total"] = round((current.get("total", 43.0) * existing_weight + values["total"] * historical_weight) / total_weight, 2)
        current["spread"] = round((current.get("spread", 0.0) * existing_weight + values["spread"] * historical_weight) / total_weight, 2)
        current["implied"] = round((current.get("implied", 21.5) * existing_weight + values["implied"] * historical_weight) / total_weight, 2)
        if isinstance(values.get("noVigWinProbability"), (int, float)):
            current_probability = current.get("noVigWinProbability", values["noVigWinProbability"])
            current["noVigWinProbability"] = round((current_probability * existing_weight + values["noVigWinProbability"] * historical_weight) / total_weight, 4)
        if values.get("moneyline") is not None:
            current["moneyline"] = values.get("moneyline")
        current["bookmakers"] = max(float(current.get("bookmakers") or 0), float(values.get("bookmakers") or 0))
        current["samples"] = round(total_weight, 2)


def live_odds_context(api_key: str) -> tuple[dict[str, dict[str, Any]], dict[str, Any]]:
    query = odds_query_params(api_key)
    params = urllib.parse.urlencode(query)
    meta: dict[str, Any] = {"liveEvents": 0, "liveTeams": 0}
    meta["bookmakers"] = query.get("bookmakers", "")
    meta["regions"] = query.get("regions", "")
    context: dict[str, dict[str, Any]] = {}
    try:
        events, headers = fetch_json_with_headers(f"{ODDS_API}?{params}", timeout=15)
        meta["requestsRemaining"] = headers.get("x-requests-remaining", "")
        meta["requestsUsed"] = headers.get("x-requests-used", "")
    except Exception as exc:
        meta["liveError"] = str(exc)
        return context, meta
    for event in events if isinstance(events, list) else []:
        event_context = extract_event_odds(event, "live")
        if event_context:
            meta["liveEvents"] += 1
            merge_team_odds(context, event_context, "live")
    meta["liveTeams"] = len(context)
    return context, meta


def historical_snapshot_dates(week_starts: dict[int, datetime]) -> list[str]:
    limit = clamp(float(int_env("FANTASYIQ_SOS_HISTORICAL_WEEKS", 4)), 0, 18)
    dates = []
    for week in sorted(week_starts)[: int(limit)]:
        snapshot = week_starts[week] - timedelta(days=1)
        snapshot = snapshot.replace(hour=16, minute=0, second=0, microsecond=0)
        dates.append(snapshot.isoformat(timespec="seconds").replace("+00:00", "Z"))
    return dates


def market_actual_reports(event_context: dict[str, dict[str, Any]], result: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not result:
        return []
    scores = result.get("scores") if isinstance(result.get("scores"), dict) else {}
    teams = [team for team in result.get("teams") or [] if team in event_context and team in scores]
    if len(teams) != 2:
        return []
    actual_total = result.get("actualTotal")
    reports: list[dict[str, Any]] = []
    for team in teams:
        opponent = teams[1] if teams[0] == team else teams[0]
        market = event_context.get(team) or {}
        implied = market.get("implied")
        spread = market.get("spread")
        total = market.get("total")
        actual_points = scores.get(team)
        opponent_points = scores.get(opponent)
        if not isinstance(actual_points, (int, float)) or not isinstance(opponent_points, (int, float)):
            continue
        actual_margin = actual_points - opponent_points
        report = {
            "week": result.get("week"),
            "team": team,
            "opponent": opponent,
            "actualPoints": actual_points,
            "opponentPoints": opponent_points,
            "actualTotal": actual_total,
            "closingSpread": round(float(spread), 2) if isinstance(spread, (int, float)) else None,
            "closingTotal": round(float(total), 2) if isinstance(total, (int, float)) else None,
            "teamImpliedTotal": round(float(implied), 2) if isinstance(implied, (int, float)) else None,
            "actualMargin": actual_margin,
        }
        if isinstance(implied, (int, float)):
            report["impliedDelta"] = round(actual_points - float(implied), 2)
        if isinstance(total, (int, float)) and isinstance(actual_total, (int, float)):
            report["totalDelta"] = round(float(actual_total) - float(total), 2)
        if isinstance(spread, (int, float)):
            report["spreadCoverMargin"] = round(actual_margin + float(spread), 2)
        reports.append(report)
    return reports


def attach_market_actual_trends(context: dict[str, dict[str, Any]], reports: list[dict[str, Any]]) -> None:
    by_team: dict[str, list[dict[str, Any]]] = {}
    for report in reports:
        team = str(report.get("team") or "")
        if team in context:
            by_team.setdefault(team, []).append(report)
    for team, items in by_team.items():
        implied_deltas = [float(item["impliedDelta"]) for item in items if isinstance(item.get("impliedDelta"), (int, float))]
        total_deltas = [float(item["totalDelta"]) for item in items if isinstance(item.get("totalDelta"), (int, float))]
        cover_margins = [float(item["spreadCoverMargin"]) for item in items if isinstance(item.get("spreadCoverMargin"), (int, float))]
        context[team]["marketVsActualSamples"] = len(items)
        context[team]["avgImpliedDelta"] = round(sum(implied_deltas) / len(implied_deltas), 2) if implied_deltas else None
        context[team]["avgTotalDelta"] = round(sum(total_deltas) / len(total_deltas), 2) if total_deltas else None
        context[team]["coverRate"] = round(sum(1 for margin in cover_margins if margin > 0) / len(cover_margins), 3) if cover_margins else None
        trend = "near market"
        if implied_deltas and context[team]["avgImpliedDelta"] >= 3:
            trend = "outscoring market expectation"
        elif implied_deltas and context[team]["avgImpliedDelta"] <= -3:
            trend = "under market expectation"
        context[team]["marketVsActualTrend"] = trend


def historical_odds_context(
    api_key: str,
    week_starts: dict[int, datetime],
    completed_results: dict[tuple[str, str], dict[str, Any]] | None = None,
) -> tuple[dict[str, dict[str, Any]], dict[str, Any]]:
    context: dict[str, dict[str, Any]] = {}
    meta: dict[str, Any] = {"historicalSnapshots": 0, "historicalEvents": 0, "historicalTeams": 0}
    dates = historical_snapshot_dates(week_starts)
    if not dates:
        return context, meta

    def fetch_snapshot(date_value: str) -> tuple[str, Any, dict[str, str], str]:
        params = urllib.parse.urlencode(odds_query_params(api_key, date_value))
        try:
            payload, headers = fetch_json_with_headers(f"{HISTORICAL_ODDS_API}?{params}", timeout=20)
            return date_value, payload, headers, ""
        except Exception as exc:
            return date_value, [], {}, str(exc)

    errors = []
    market_reports: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=min(4, max(1, len(dates)))) as executor:
        futures = [executor.submit(fetch_snapshot, date_value) for date_value in dates]
        for future in as_completed(futures):
            _date_value, payload, headers, error = future.result()
            if headers:
                meta["requestsRemaining"] = headers.get("x-requests-remaining", meta.get("requestsRemaining", ""))
                meta["requestsUsed"] = headers.get("x-requests-used", meta.get("requestsUsed", ""))
            if error:
                errors.append(error)
                continue
            events = payload.get("data") if isinstance(payload, dict) else payload
            if not isinstance(events, list):
                continue
            meta["historicalSnapshots"] += 1
            for event in events:
                event_context = extract_event_odds(event, "historical")
                if event_context:
                    meta["historicalEvents"] += 1
                    merge_team_odds(context, event_context, "historical")
                    teams_key = tuple(sorted(event_context.keys()))
                    if len(teams_key) == 2:
                        market_reports.extend(market_actual_reports(event_context, (completed_results or {}).get(teams_key)))
    if errors:
        meta["historicalErrors"] = len(errors)
        meta["historicalErrorSample"] = errors[0]
    meta["historicalTeams"] = len(context)
    attach_market_actual_trends(context, market_reports)
    meta["completedGameMarkets"] = len(market_reports)
    meta["marketExpectationVsActual"] = sorted(
        market_reports,
        key=lambda item: abs(float(item.get("impliedDelta") or 0)) + abs(float(item.get("totalDelta") or 0)) * 0.25,
        reverse=True,
    )[:12]
    return context, meta


def odds_context(
    season: int,
    week_starts: dict[int, datetime],
    schedule_events: dict[int, list[dict[str, Any]]] | None = None,
) -> tuple[dict[str, dict[str, Any]], dict[str, Any]]:
    api_key = os.environ.get("THE_ODDS_API_KEY") or os.environ.get("ODDS_API_KEY")
    if not api_key:
        return {}, {"configured": False, "reason": "Set THE_ODDS_API_KEY or ODDS_API_KEY to enable live and historical market context."}
    live, live_meta = live_odds_context(api_key)
    prior_season = max(2024, season - 1)
    prior_week_starts = week_starts
    completed_results = completed_results_index(schedule_events)
    if season >= datetime.now(timezone.utc).year:
        _prior_games, prior_week_starts, _prior_sites, prior_events = schedule(prior_season)
        if not completed_results:
            completed_results = completed_results_index(prior_events)
    historical, historical_meta = historical_odds_context(api_key, prior_week_starts, completed_results)
    combined = dict(historical)
    for abbr, values in live.items():
        previous = historical.get(abbr, {})
        combined[abbr] = values
        for key in ("marketVsActualSamples", "avgImpliedDelta", "avgTotalDelta", "coverRate", "marketVsActualTrend"):
            if key in previous:
                combined[abbr][key] = previous.get(key)
        if isinstance(previous.get("spread"), (int, float)) and isinstance(values.get("spread"), (int, float)):
            combined[abbr]["openingSpread"] = previous.get("spread")
            combined[abbr]["closingSpread"] = values.get("spread")
            combined[abbr]["lineMovement"] = round(float(values["spread"]) - float(previous["spread"]), 2)
        if isinstance(previous.get("total"), (int, float)) and isinstance(values.get("total"), (int, float)):
            combined[abbr]["openingTotal"] = previous.get("total")
            combined[abbr]["closingTotal"] = values.get("total")
            combined[abbr]["totalMovement"] = round(float(values["total"]) - float(previous["total"]), 2)
    meta = {
        "configured": True,
        "provider": "the-odds-api",
        "markets": ODDS_MARKETS,
        **historical_meta,
        **live_meta,
        "combinedTeams": len(combined),
    }
    return combined, meta


def odds_key_configured() -> bool:
    return bool(os.environ.get("THE_ODDS_API_KEY") or os.environ.get("ODDS_API_KEY"))


def completed_week(week: int, week_starts: dict[int, datetime], week_events: dict[int, list[dict[str, Any]]] | None = None) -> bool:
    events = (week_events or {}).get(week) or []
    if events:
        return all(bool(event.get("completed")) for event in events)
    starts_at = week_starts.get(week)
    if not starts_at:
        return False
    return datetime.now(timezone.utc) >= starts_at + timedelta(days=6)


def latest_completed_week(week_starts: dict[int, datetime], week_events: dict[int, list[dict[str, Any]]] | None = None) -> int:
    completed = [week for week in sorted(week_starts) if completed_week(week, week_starts, week_events)]
    return max(completed) if completed else 0


def game_environment_score(team_market: dict[str, Any]) -> float:
    total = team_market.get("total")
    implied = team_market.get("implied")
    total_score = clamp(((float(total) if isinstance(total, (int, float)) else 43.0) - 37.0) / 17.0, 0.0, 1.0)
    implied_score = clamp(((float(implied) if isinstance(implied, (int, float)) else 21.5) - 16.0) / 18.0, 0.0, 1.0)
    return round(total_score * 0.45 + implied_score * 0.55, 3)


def venue_context(team: str, site: str) -> tuple[str, float, float]:
    if site == "home" and team in DOME_HOME_TEAMS:
        return "dome/controlled venue", 0.0, 0.0
    if site == "home" and team in COLD_WEATHER_HOME_TEAMS:
        return "outdoor cold-weather risk", 0.18, 0.05
    if site == "away":
        return "road travel spot", 0.08, 0.12
    return "outdoor/standard venue", 0.08, 0.02


def color_grade(score: float | None, tier: str = "") -> str:
    if tier == "bye" or score is None:
        return "gray"
    if score <= 1.55:
        return "dark green"
    if score <= 2.3:
        return "light green"
    if score <= 2.8:
        return "yellow"
    if score <= 3.35:
        return "orange"
    return "red"


def position_streaming_score(position: str, score: float, implied_total: float, opponent_implied: float) -> float:
    if position not in {"QB", "TE", "K", "DST"}:
        return 0.0
    base = clamp((2.6 - score) / 1.6, 0.0, 1.0)
    if position == "DST":
        return round(clamp(base * 72 + (22.5 - opponent_implied) * 2.2, 0, 100), 1)
    if position == "K":
        return round(clamp(base * 54 + implied_total * 1.45, 0, 100), 1)
    return round(clamp(base * 88 + (implied_total - 20.5) * 1.4, 0, 100), 1)


def schedule_week_complete_summary(week_starts: dict[int, datetime], week_events: dict[int, list[dict[str, Any]]] | None = None) -> dict[str, Any]:
    latest = latest_completed_week(week_starts, week_events)
    week_rows = []
    for week in sorted((week_events or {}).keys()):
        events = (week_events or {}).get(week) or []
        if not events:
            continue
        completed_count = sum(1 for event in events if event.get("completed"))
        week_rows.append({
            "week": week,
            "games": len(events),
            "completedGames": completed_count,
            "complete": completed_count == len(events),
        })
    total_completed_games = sum(row["completedGames"] for row in week_rows)
    total_games = sum(row["games"] for row in week_rows)
    return {
        "latestCompletedWeek": latest,
        "weekComplete": latest > 0,
        "validationSource": "ESPN event final statuses" if week_rows else "schedule date fallback",
        "completedGames": total_completed_games,
        "scheduledGames": total_games,
        "weeks": week_rows[:18],
        "validation": "No completed 2026 fantasy week yet; refresh can still update upcoming schedule intelligence."
        if latest == 0
        else f"Week {latest} is complete based on ESPN final game statuses.",
    }


def offensive_environment(offense: str, opponent: str, stats: dict[str, dict[str, float]], odds: dict[str, dict[str, Any]], fpa_score: float | None) -> tuple[float, str]:
    offense_stats = stats.get(offense, {})
    market = odds.get(offense, {})
    baseline = market.get("implied")
    source = "market" if isinstance(baseline, (int, float)) else "team-stat-fallback"
    if not isinstance(baseline, (int, float)):
        baseline = offense_stats.get("points_pg", 21.5)
    matchup_adjustment = 0.0 if fpa_score is None else clamp((2.5 - fpa_score) * 0.85, -1.4, 1.4)
    return round(clamp(float(baseline) + matchup_adjustment, 12.0, 36.0), 2), source


def matchup_score(position: str, offense: str, opponent: str, stats: dict[str, dict[str, float]], injuries: dict[str, int], odds: dict[str, dict[str, Any]], fpa: dict[str, dict[str, float]]) -> float:
    defense = stats.get(opponent, {})
    offense_stats = stats.get(offense, {})
    opponent_stats = stats.get(opponent, {})
    fpa_score = normalized_fpa_score(position, opponent, fpa)
    pressure = defense.get("sacks_for", 2.2) + defense.get("interceptions_for", 0.75) * 1.7
    injury_penalty = min(0.55, injuries.get(offense, 0) * 0.035)
    injury_relief = min(0.35, injuries.get(opponent, 0) * 0.025)
    implied = odds.get(offense, {}).get("implied", offense_stats.get("points_pg", 21.5))
    opponent_implied = odds.get(opponent, {}).get("implied", opponent_stats.get("points_pg", 21.5))
    market_confidence = min(1.0, max(0.35, odds.get(offense, {}).get("bookmakers", 1.0) / 8))
    if fpa_score is not None:
        raw = fpa_score
        if position in {"QB", "WR", "TE"}:
            raw += (pressure - 3.2) * 0.08 - (implied - 22.0) * 0.025 * market_confidence
        elif position == "RB":
            raw -= (implied - 22.0) * 0.022 * market_confidence
        elif position == "DST":
            raw += (opponent_implied - 21.5) * 0.035 - (opponent_stats.get("sacks_taken", 2.2) - 2.2) * 0.08
        else:
            raw -= (implied - 22.0) * 0.03 * market_confidence
        if position != "DST":
            raw += injury_penalty * 0.45 - injury_relief * 0.35
    else:
        if position in {"QB", "WR", "TE"}:
            raw = 2.5 + (pressure - 3.2) * 0.55 - (implied - 22.0) * 0.05 * market_confidence + injury_penalty - injury_relief
        elif position == "RB":
            raw = 2.45 - (implied - 22.0) * 0.04 * market_confidence + injury_penalty - injury_relief
        elif position == "DST":
            raw = 2.5 + (opponent_implied - 21.5) * 0.06 - (opponent_stats.get("sacks_taken", 2.2) - 2.2) * 0.25
        else:
            raw = 2.5 - (implied - 22.0) * 0.055 * market_confidence - (offense_stats.get("fg_attempts", 1.8) - 1.8) * 0.22 + injury_penalty * 0.5
    return clamp(raw, 1.0, 4.0)


def row_window_average(row: dict[str, Any], weeks: tuple[int, ...] | None = None) -> float:
    cells = row.get("cells") or []
    values = [
        float(cell["score"])
        for cell in cells
        if isinstance(cell.get("score"), (int, float)) and (weeks is None or int(cell.get("week") or 0) in weeks)
    ]
    return sum(values) / len(values) if values else 2.5


def movement_report(previous: dict[str, Any] | None, rows: list[dict[str, Any]]) -> dict[str, Any]:
    previous_rows = {
        f"{row.get('team')}:{row.get('position')}": row
        for row in (previous or {}).get("rows", [])
        if isinstance(row, dict)
    }
    movements = []
    for row in rows:
        key = f"{row.get('team')}:{row.get('position')}"
        old = previous_rows.get(key)
        if not old:
            continue
        old_avg = row_window_average(old)
        new_avg = row_window_average(row)
        delta = round(old_avg - new_avg, 2)
        if abs(delta) >= 0.15:
            movements.append({
                "team": row.get("team"),
                "position": row.get("position"),
                "delta": delta,
                "direction": "upgrade" if delta > 0 else "downgrade",
                "previousAvg": round(old_avg, 2),
                "newAvg": round(new_avg, 2),
            })
    upgrades = sorted([item for item in movements if item["delta"] > 0], key=lambda item: item["delta"], reverse=True)[:10]
    downgrades = sorted([item for item in movements if item["delta"] < 0], key=lambda item: item["delta"])[:10]
    return {
        "compared": bool(previous_rows),
        "majorUpgrades": upgrades,
        "majorDowngrades": downgrades,
        "risers": upgrades[:5],
        "fallers": downgrades[:5],
    }


def schedule_edge_report(rows: list[dict[str, Any]], previous: dict[str, Any] | None, odds_meta: dict[str, Any]) -> dict[str, Any]:
    playable = sorted(rows, key=lambda row: row.get("avgDifficulty", 2.5))
    tough = sorted(rows, key=lambda row: row.get("avgDifficulty", 2.5), reverse=True)
    streamers = sorted(
        [row for row in rows if row.get("position") in {"QB", "TE", "K", "DST"}],
        key=lambda row: row.get("streamingScore", 0),
        reverse=True,
    )
    playoff_best = sorted(rows, key=lambda row: row.get("playoffDifficulty", 2.5))[:10]
    playoff_worst = sorted(rows, key=lambda row: row.get("playoffDifficulty", 2.5), reverse=True)[:10]
    movement = movement_report(previous, rows)
    return {
        "generatedAt": utc_now(),
        "summary": "Schedule IQ grades future fantasy matchups by team, week, opponent, position, scoring environment, defensive matchup, playoff value, streaming opportunity, injuries, venue/weather risk, and betting-market context.",
        "biggestScheduleUpgrades": movement["majorUpgrades"],
        "biggestScheduleDowngrades": movement["majorDowngrades"],
        "risers": movement["risers"],
        "fallers": movement["fallers"],
        "bestStreamingSpots": [
            {"team": row.get("team"), "position": row.get("position"), "streamingScore": row.get("streamingScore"), "bestWeek": row.get("bestStreamingWeek")}
            for row in streamers[:12]
        ],
        "worstUpcomingMatchups": [
            {"team": row.get("team"), "position": row.get("position"), "avgDifficulty": row.get("avgDifficulty"), "worstWeek": row.get("worstWeek")}
            for row in tough[:12]
        ],
        "bestPlayoffSchedules": [
            {"team": row.get("team"), "position": row.get("position"), "playoffDifficulty": row.get("playoffDifficulty")}
            for row in playoff_best
        ],
        "worstPlayoffSchedules": [
            {"team": row.get("team"), "position": row.get("position"), "playoffDifficulty": row.get("playoffDifficulty")}
            for row in playoff_worst
        ],
        "marketBasedScoringEnvironmentNotes": {
            "oddsConfigured": bool(odds_meta.get("configured")),
            "teamsWithMarketContext": odds_meta.get("combinedTeams", 0),
            "historicalSnapshots": odds_meta.get("historicalSnapshots", 0),
            "completedGameMarkets": odds_meta.get("completedGameMarkets", 0),
            "marketExpectationVsActual": odds_meta.get("marketExpectationVsActual", []),
            "confidenceNote": "Market confidence is lowered where Odds API data is missing or delayed.",
        },
        "oneClearRecommendation": (
            f"Prioritize {playable[0].get('team')} {playable[0].get('position')} schedule edges first, while checking playoff-week risk before overpaying."
            if playable else
            "Use Schedule IQ after the next refresh; no schedule rows were available."
        ),
    }


def agent_output(name: str, findings: list[str], sources: list[str], adjustment: float, confidence: float, risk: str, change: str) -> dict[str, Any]:
    return {
        "agent": name,
        "keyFindings": findings,
        "dataSourcesUsed": sources,
        "matchupAdjustment": round(adjustment, 3),
        "confidenceScore": round(clamp(confidence, 0.0, 1.0), 3),
        "riskWarning": risk,
        "recommendedHeatmapChange": change,
    }


def schedule_agent_outputs(rows: list[dict[str, Any]], provider_meta: dict[str, Any], week_summary: dict[str, Any]) -> dict[str, Any]:
    odds_meta = provider_meta.get("odds") or {}
    fpa_meta = provider_meta.get("fpa") or {}
    market_coverage = len([row for row in rows if row.get("oddsSource") not in {"team-stat-fallback", "market"}])
    avg_confidence = mean([float(row.get("confidence") or 0) for row in rows]) or 0.6
    agents = [
        agent_output("NFL Schedule Sync Agent", [f"{provider_meta.get('weeksWithSchedule', 0)} weeks with schedule dates loaded.", week_summary.get("validation", "")], ["ESPN public NFL scoreboard API"], 0.0, 0.88, "Future kickoff changes can move venue/rest context.", "Refresh teams, opponents, byes, kickoff windows, and home/away labels."),
        agent_output("Odds API Historical Market Agent", [f"{odds_meta.get('historicalSnapshots', 0)} historical snapshots, {odds_meta.get('completedGameMarkets', 0)} market-vs-actual game reads, and {odds_meta.get('combinedTeams', 0)} teams with market context."], ["The Odds API historical h2h/spreads/totals", "The Odds API live odds", "ESPN final scores"], 0.08 if odds_meta.get("combinedTeams") else 0.0, 0.76 if odds_meta.get("combinedTeams") else 0.42, "Continue with lower confidence when Odds API data is delayed.", "Blend implied totals, spreads, totals, line movement, and market-vs-actual trends into scoring environment."),
        agent_output("Fantasy Points Allowed Agent", [f"{fpa_meta.get('teams', 0)} defenses loaded with position-level fantasy points allowed."], ["FootballDB fantasy points allowed"], 0.18, 0.78, "Prior-season or partial-season FPA can lag current defensive quality.", "Normalize FPA by position before assigning matchup difficulty."),
        agent_output("Positional Matchup Agent", ["QB, RB, WR, TE, K, and DST are graded separately."], ["Position-level heatmap cells"], 0.14, 0.82, "Generic defense reads are not used for player-position grades.", "Keep position-specific colors and scores."),
        agent_output("Recent Defensive Trend Agent", ["Recent trend proxy uses market movement, injury pressure, and defensive team stats until full current-season samples mature."], ["ESPN team stats", "Odds movement", "Sleeper injuries"], 0.06, 0.62, "Early-season trend reads have limited sample size.", "Lower confidence for trend-heavy changes."),
        agent_output("Offensive Environment Agent", ["Team implied totals, game totals, spread context, and fallback scoring stats shape scoring environment."], ["The Odds API", "ESPN team stats"], 0.12, 0.74 if market_coverage else 0.55, "Team-stat fallback is weaker than market totals.", "Raise easy-matchup confidence in high-implied-total games."),
        agent_output("Injury Context Agent", ["Sleeper injury pressure is included for offensive drag and defensive relief."], ["Sleeper public NFL players endpoint"], 0.05, 0.58, "Public injury tags can lag beat reports and official game statuses.", "Apply modest injury pressure, not manual overrides."),
        agent_output("Strength of Schedule Agent", ["Rows include full-season, selected-window, and position schedule ranks."], ["Blended schedule scores"], 0.2, avg_confidence, "Schedules can shift after flex scheduling and injury news.", "Rank teams by average blended difficulty."),
        agent_output("Playoff Schedule Agent", [f"Playoff weeks {', '.join(str(week) for week in PLAYOFF_WEEKS)} are separately scored."], ["Weeks 15-17 heatmap cells"], 0.18, avg_confidence, "Custom league playoff weeks can differ from default.", "Flag playoff advantage and playoff risk separately."),
        agent_output("Streaming Opportunity Agent", ["QB, TE, K, and DST get dedicated streaming opportunity scores."], ["FPA", "Implied totals", "Opponent implied totals"], 0.16, avg_confidence, "Availability still depends on each user's league waiver pool.", "Surface best weekly stream spots."),
        agent_output("Weather & Venue Agent", ["Dome, outdoor, cold-weather, and road-travel context are tagged per cell."], ["Venue/home-away schedule context"], 0.05, 0.5, "Forecast-specific wind/rain data is lower confidence until game week.", "Reduce confidence for outdoor cold-weather and road spots."),
        agent_output("User Roster Fit Agent", ["Frontend maps team-position heatmap rows to rostered players and streamer positions."], ["Customer roster/team context", "Schedule IQ row mapping"], 0.1, avg_confidence, "Roster-specific alerts improve after ESPN roster sync.", "Attach schedule upgrades/downgrades to rostered teams and positions."),
    ]
    return {
        "leadAgent": agent_output(
            "Lead Schedule Intelligence Agent",
            ["Reviewed 12 agent outputs and approved blended schedule grades.", f"Average row confidence {avg_confidence:.2f}."],
            ["All schedule intelligence providers"],
            0.0,
            avg_confidence,
            "Conflicts are resolved by recency, sample size, market availability, injury pressure, venue risk, and position relevance.",
            "Publish final heatmap colors, movement report, and user-facing schedule edge recommendation.",
        ),
        "agents": agents,
    }


def roster_position_key(position: str) -> str:
    clean = str(position or "").upper().replace("/", "")
    if clean in {"D", "DEF", "DST", "D/ST"}:
        return "DST"
    if clean in POSITIONS:
        return clean
    return clean


def schedule_alert_for_player(player: dict[str, Any], row: dict[str, Any]) -> dict[str, Any]:
    avg = float(row.get("avgDifficulty") or 2.5)
    playoff = float(row.get("playoffDifficulty") or avg)
    direction = "edge" if avg <= 2.3 or playoff <= 2.3 else "risk" if avg >= 3.1 or playoff >= 3.1 else "watch"
    confidence = float(row.get("confidence") or 0.5)
    return {
        "player": player.get("player") or "",
        "position": roster_position_key(player.get("pos") or ""),
        "team": player.get("proTeam") or "",
        "lineupSlot": player.get("lineupSlot") or "",
        "scheduleSignal": direction,
        "avgDifficulty": round(avg, 2),
        "playoffDifficulty": round(playoff, 2),
        "bestWeek": row.get("bestWeek"),
        "worstWeek": row.get("worstWeek"),
        "bestStreamingWeek": row.get("bestStreamingWeek"),
        "confidence": round(confidence, 3),
        "recommendation": (
            "Lean into this rostered player where the upcoming schedule gives a real edge."
            if direction == "edge"
            else "Plan around this rostered player because the upcoming schedule carries elevated risk."
            if direction == "risk"
            else "Hold as a matchup-based watch item."
        ),
    }


def request_roster_schedule_alerts(rows: list[dict[str, Any]], request_path: str = "", headers: Any | None = None) -> dict[str, Any]:
    if not request_path:
        return {"status": "requires_customer_context", "alerts": [], "message": "Roster-specific alerts are added per signed-in dashboard request."}
    query = urllib.parse.parse_qs(urllib.parse.urlparse(request_path).query)
    if not (query.get("customer") or query.get("dashboard")):
        return {"status": "requires_customer_context", "alerts": [], "message": "Roster-specific alerts are added per signed-in dashboard request."}
    try:
        try:
            from live_draft import build_live_payload
        except (ModuleNotFoundError, ImportError):
            from api.live_draft import build_live_payload
        live_payload = build_live_payload(request_path, headers, force=False)
    except Exception as exc:
        return {"status": "unavailable", "alerts": [], "message": f"Roster sync unavailable for this request: {exc}"}
    if not isinstance(live_payload, dict) or live_payload.get("ok") is not True:
        return {"status": "unavailable", "alerts": [], "message": "Roster sync did not return a usable customer payload."}
    customer_team_id = live_payload.get("customerTeamId")
    teams = live_payload.get("teams") if isinstance(live_payload.get("teams"), list) else []
    customer_team = next((team for team in teams if team.get("teamId") == customer_team_id), None)
    if not customer_team and teams:
        customer_team = teams[0]
    roster = customer_team.get("roster") if isinstance(customer_team, dict) else []
    if not isinstance(roster, list) or not roster:
        return {"status": "empty_roster", "alerts": [], "message": "No rostered players were available for schedule alerts."}
    rows_by_team_position = {
        f"{row.get('team')}:{row.get('position')}": row
        for row in rows
        if isinstance(row, dict)
    }
    alerts = []
    for player in roster:
        if not isinstance(player, dict):
            continue
        pro_team = str(player.get("proTeam") or "")
        position = roster_position_key(str(player.get("pos") or ""))
        row = rows_by_team_position.get(f"{pro_team}:{position}")
        if not row:
            continue
        alerts.append(schedule_alert_for_player(player, row))
    alerts.sort(key=lambda item: ({"edge": 0, "risk": 1, "watch": 2}.get(item.get("scheduleSignal"), 3), item.get("avgDifficulty", 2.5)))
    return {
        "status": "ok",
        "customerTeamId": customer_team_id,
        "customerTeamName": customer_team.get("teamName") if isinstance(customer_team, dict) else "",
        "leagueName": live_payload.get("leagueName") or "",
        "alerts": alerts[:16],
        "message": f"{len(alerts)} rostered player schedule alert(s) matched to Schedule IQ.",
    }


def payload_with_request_roster_fit(payload: dict[str, Any], request_path: str = "", headers: Any | None = None) -> dict[str, Any]:
    alerts = request_roster_schedule_alerts(payload.get("rows") or [], request_path, headers)
    personalized = dict(payload)
    personalized["rosterSpecificScheduleAlerts"] = alerts
    workflow = dict(payload.get("agentWorkflow") or {})
    workflow["requestRosterFit"] = {
        "agent": "User Roster Fit Agent",
        "status": alerts.get("status"),
        "matchedAlerts": len(alerts.get("alerts") or []),
        "message": alerts.get("message", ""),
    }
    personalized["agentWorkflow"] = workflow
    return personalized


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
    previous_payload = load_any_existing_payload(season)
    snapshot = save_historical_snapshot(season, previous_payload, "before schedule heatmap refresh")
    started_at = time.time()
    stats = team_stats(season)
    games, week_starts, sites, schedule_events = schedule(season)
    fpa, fpa_meta = fantasy_points_allowed(season)
    injuries = sleeper_injuries()
    odds, odds_meta = odds_context(season, week_starts, schedule_events)
    has_odds_key = odds_key_configured()
    week_summary = schedule_week_complete_summary(week_starts, schedule_events)
    rows = []
    for team in TEAM_ABBR_TO_ESPN_ID:
        for position in POSITIONS:
            cells = []
            for week in range(1, 19):
                opponent = games.get(team, {}).get(week, "BYE")
                if opponent == "BYE":
                    cells.append({"week": week, "opponent": "BYE", "score": None, "tier": "bye", "heatValue": None})
                    continue
                score = matchup_score(position, team, opponent, stats, injuries, odds, fpa)
                tier = "easy" if score <= 1.75 else "good" if score <= 2.5 else "hard" if score <= 3.25 else "brutal"
                fpa_score = normalized_fpa_score(position, opponent, fpa)
                implied_total, projection_source = offensive_environment(team, opponent, stats, odds, fpa_score)
                opponent_implied, opponent_projection_source = offensive_environment(opponent, team, stats, odds, normalized_fpa_score(position, team, fpa))
                team_market = odds.get(team, {})
                opponent_market = odds.get(opponent, {})
                heat_value = round(36 - opponent_implied, 2) if position == "DST" else implied_total
                site = sites.get(team, {}).get(week)
                venue_note, weather_risk, rest_travel_risk = venue_context(team, site or "")
                environment = game_environment_score(team_market)
                confidence = clamp(
                    0.42
                    + (0.2 if fpa_score is not None else 0.0)
                    + (0.22 if team_market else 0.0)
                    + min(0.1, float(team_market.get("bookmakers") or 0) / 80)
                    - weather_risk * 0.18
                    - rest_travel_risk * 0.14,
                    0.25,
                    0.96,
                )
                blended_score = round(clamp((4.0 - score) / 3.0 * 100, 0, 100), 1)
                cells.append({
                    "week": week,
                    "opponent": opponent,
                    "site": site,
                    "isAway": site == "away",
                    "score": round(score, 2),
                    "blendedScore": blended_score,
                    "tier": tier,
                    "colorGrade": color_grade(score, tier),
                    "fpa": fpa.get(opponent, {}).get(position),
                    "fpaScore": round(fpa_score, 2) if fpa_score is not None else None,
                    "impliedTotal": implied_total,
                    "opponentImpliedTotal": opponent_implied,
                    "heatValue": heat_value,
                    "gameTotal": team_market.get("total") or opponent_market.get("total"),
                    "spread": team_market.get("spread"),
                    "moneyline": team_market.get("moneyline"),
                    "noVigWinProbability": team_market.get("noVigWinProbability"),
                    "openingSpread": team_market.get("openingSpread"),
                    "closingSpread": team_market.get("closingSpread") or team_market.get("spread"),
                    "lineMovement": team_market.get("lineMovement"),
                    "openingTotal": team_market.get("openingTotal"),
                    "closingTotal": team_market.get("closingTotal") or team_market.get("total"),
                    "totalMovement": team_market.get("totalMovement"),
                    "marketVsActualTrend": team_market.get("marketVsActualTrend"),
                    "avgImpliedDelta": team_market.get("avgImpliedDelta"),
                    "avgTotalDelta": team_market.get("avgTotalDelta"),
                    "coverRate": team_market.get("coverRate"),
                    "scoringEnvironmentScore": environment,
                    "streamingOpportunity": position_streaming_score(position, score, implied_total, opponent_implied),
                    "playoffWeight": 1.35 if week in PLAYOFF_WEEKS else 1.0,
                    "weatherRisk": round(weather_risk, 3),
                    "venueContext": venue_note,
                    "restTravelRisk": round(rest_travel_risk, 3),
                    "injuryContext": {
                        "offensePressure": injuries.get(team, 0),
                        "opponentDefenseRelief": injuries.get(opponent, 0),
                    },
                    "confidence": round(confidence, 3),
                    "sampleSizeConfidence": round(confidence, 3),
                    "oddsSource": team_market.get("sourceType") or projection_source,
                    "opponentOddsSource": opponent_market.get("sourceType") or opponent_projection_source,
                    "bookmakers": team_market.get("bookmakers"),
                    "oddsSamples": team_market.get("samples"),
                })
            valid_scores = [cell["score"] for cell in cells if isinstance(cell.get("score"), (int, float))]
            avg = sum(valid_scores) / len(valid_scores) if valid_scores else 2.5
            playoff_scores = [cell["score"] for cell in cells if isinstance(cell.get("score"), (int, float)) and int(cell.get("week") or 0) in PLAYOFF_WEEKS]
            streaming_scores = [cell.get("streamingOpportunity") for cell in cells if isinstance(cell.get("streamingOpportunity"), (int, float))]
            best_cell = min((cell for cell in cells if isinstance(cell.get("score"), (int, float))), key=lambda cell: cell["score"], default={})
            worst_cell = max((cell for cell in cells if isinstance(cell.get("score"), (int, float))), key=lambda cell: cell["score"], default={})
            best_streaming_cell = max((cell for cell in cells if isinstance(cell.get("streamingOpportunity"), (int, float))), key=lambda cell: cell["streamingOpportunity"], default={})
            rows.append({
                "team": team,
                "position": position,
                "cells": cells,
                "avgDifficulty": round(avg, 2),
                "playoffDifficulty": round(sum(playoff_scores) / len(playoff_scores), 2) if playoff_scores else round(avg, 2),
                "streamingScore": round(max(streaming_scores), 1) if streaming_scores else 0,
                "bestWeek": best_cell.get("week"),
                "worstWeek": worst_cell.get("week"),
                "bestStreamingWeek": best_streaming_cell.get("week"),
                "confidence": round(mean([cell.get("confidence") for cell in cells if isinstance(cell.get("confidence"), (int, float))]) or 0.5, 3),
                "ease": round((5 - avg) * 25),
                "brutalWeeks": sum(1 for score in valid_scores if score >= 3.25),
                "injuryPressure": injuries.get(team, 0),
                "oddsImplied": odds.get(team, {}).get("implied"),
                "oddsSpread": odds.get(team, {}).get("spread"),
                "oddsMoneyline": odds.get(team, {}).get("moneyline"),
                "oddsWinProbability": odds.get(team, {}).get("noVigWinProbability"),
                "oddsSource": odds.get(team, {}).get("sourceType") or ("team-stat-fallback" if not odds.get(team) else "market"),
                "source": "espn_schedule_team_stats_sleeper_injuries" + ("_odds" if odds else ""),
            })
    provider_meta = {
        "buildMs": round((time.time() - started_at) * 1000),
        "fpa": fpa_meta,
        "odds": odds_meta,
        "teamsWithOdds": len(odds),
        "weeksWithSchedule": len(week_starts),
        "scheduledGames": sum(len(events) for events in schedule_events.values()),
        "completedGames": sum(1 for events in schedule_events.values() for event in events if event.get("completed")),
        "weekCompletion": week_summary,
        "snapshot": snapshot,
    }
    report = schedule_edge_report(rows, previous_payload, odds_meta)
    agents = schedule_agent_outputs(rows, provider_meta, week_summary)
    payload = {
        "ok": True,
        "season": season,
        "updatedAt": utc_now(),
        "refreshCadence": "Shared database cache refreshes weekly after the fantasy week is complete; page loads use cached Schedule IQ data between refreshes.",
        "cache": {"layer": "forced" if force else "fresh", "ageSeconds": 0},
        "historicalSnapshot": snapshot,
        "providerMeta": provider_meta,
        "sources": {
            "schedule": "ESPN public NFL scoreboard API",
            "teamStats": f"ESPN public NFL team statistics, season {max(2024, season - 1)}",
            "fpa": f"FootballDB fantasy points allowed by position, season {fpa_meta.get('season')}",
            "injuries": "Sleeper public NFL players endpoint",
            "odds": (
                "The Odds API live and historical h2h/spreads/totals with no-vig moneyline probabilities"
                if odds
                else "Configured, but provider returned no current NFL h2h/spreads/totals"
                if has_odds_key
                else "Not configured; set THE_ODDS_API_KEY"
            ),
        },
        "methodology": [
            "All positions start from opponent fantasy points allowed to that position, normalized across the league.",
            "American moneyline prices are converted to implied probabilities, normalized to remove vig, and stored with the market context.",
            "Spreads and totals use bookmaker consensus points with price-aware no-vig adjustments where both sides are available.",
            "Completed-game odds snapshots are compared with ESPN final scores when available to track market expectation versus actual result.",
            "Implied team totals are total / 2 - spread / 2, with team-stat fallbacks when market data is missing.",
            "Heat intensity is driven by projected scoring environment; D/ST uses the inverse opponent scoring environment.",
            "QB/WR/TE grades add small pressure and injury adjustments.",
            "D/ST grades use points allowed to opposing fantasy defenses plus opponent implied points and sack environment.",
            "Final heatmap colors use blended score thresholds: dark green, light green, yellow, orange, red, and gray for bye/unavailable data.",
        ],
        "agentWorkflow": agents,
        "scheduleMovementReport": report,
        "weeklyRefreshLog": {
            "status": "ok",
            "weekComplete": week_summary,
            "missingData": {
                "odds": not bool(odds),
                "oddsKeyConfigured": has_odds_key,
                "fpaTeams": fpa_meta.get("teams", 0),
            },
        },
        "rosterSpecificScheduleAlerts": {
            "status": "requires_customer_context",
            "alerts": [],
            "message": "Roster-specific alerts are added per signed-in dashboard request.",
        },
        "rows": rows,
    }
    try:
        try:
            from sos_validation import validate_schedule_iq_payload
        except ImportError:
            from api.sos_validation import validate_schedule_iq_payload
        validation = validate_schedule_iq_payload(payload)
    except Exception as exc:
        validation = {
            "ok": False,
            "status": "critical",
            "modelVersion": "schedule-iq-validation-v1",
            "validatedAt": utc_now(),
            "errors": [f"Schedule IQ validation failed to run: {exc}"],
            "warnings": [],
            "summary": {},
        }
    validation_info = save_validation_result(season, validation)
    validation = {**validation, **validation_info}
    payload["validation"] = validation
    payload["providerMeta"]["validation"] = validation
    payload["weeklyRefreshLog"]["validation"] = validation
    log_payload = {
        "ok": True,
        "type": "sos-heatmap-refresh-log",
        "season": season,
        "createdAt": utc_now(),
        "cacheSaved": False,
        "snapshot": snapshot,
        "providerMeta": provider_meta,
        "scheduleMovementReport": report,
        "agentWorkflow": agents,
        "validation": validation,
    }
    log_info = save_refresh_log(season, log_payload)
    payload["weeklyRefreshLog"]["saved"] = log_info.get("saved", False)
    payload["weeklyRefreshLog"]["logKey"] = log_info.get("logKey", "")
    saved = save_durable_payload(season, payload)
    if log_info.get("logKey"):
        log_payload["cacheSaved"] = saved
        log_payload["weeklyRefreshLog"] = payload["weeklyRefreshLog"]
        save_payload_with_key(str(log_info["logKey"]), log_payload)
    _cache[cache_key] = {"ts": now, "payload": payload}
    record_freshness(
        source="fantasyiq-cron",
        source_scope="sos-heatmap",
        ok=True,
        max_age_seconds=REFRESH_MAX_AGE_SECONDS,
        metadata={
            "season": season,
            "rows": len(rows),
            "snapshot": snapshot,
            "log": log_info,
            "validation": validation,
            "odds": odds_meta,
            "weekCompletion": week_summary,
        },
    )
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
            payload = build_payload(season)
            json_response(self, HTTPStatus.OK, payload_with_request_roster_fit(payload, self.path, self.headers))
        except Exception as exc:
            json_response(self, HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "error": str(exc), "updatedAt": utc_now()})
