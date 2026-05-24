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
FOOTBALLDB_FPA = "https://www.footballdb.com/fantasy-football/points-allowed.html"
ODDS_API = "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds"
HISTORICAL_ODDS_API = "https://api.the-odds-api.com/v4/historical/sports/americanfootball_nfl/odds"
CACHE_TTL_SECONDS = 7 * 24 * 60 * 60
PROVIDER_WORKERS = 8
ODDS_MARKETS = "h2h,spreads,totals"
DEFAULT_ODDS_BOOKMAKERS = "draftkings,fanduel,betmgm"

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
    return f"sos_heatmap:v6-market-percentiles:{season}"


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


def schedule(season: int) -> tuple[dict[str, dict[int, str]], dict[int, datetime]]:
    games_by_team: dict[str, dict[int, str]] = {team: {} for team in TEAM_ABBR_TO_ESPN_ID}
    week_starts: dict[int, datetime] = {}
    with ThreadPoolExecutor(max_workers=PROVIDER_WORKERS) as executor:
        futures = [executor.submit(fetch_schedule_week, season, week) for week in range(1, 19)]
        for future in as_completed(futures):
            week, events = future.result()
            for event in events:
                starts_at = parse_utc(str(event.get("date") or ""))
                if starts_at and (week not in week_starts or starts_at < week_starts[week]):
                    week_starts[week] = starts_at
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
    return games_by_team, week_starts


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


def historical_odds_context(api_key: str, week_starts: dict[int, datetime]) -> tuple[dict[str, dict[str, Any]], dict[str, Any]]:
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
    if errors:
        meta["historicalErrors"] = len(errors)
        meta["historicalErrorSample"] = errors[0]
    meta["historicalTeams"] = len(context)
    return context, meta


def odds_context(season: int, week_starts: dict[int, datetime]) -> tuple[dict[str, dict[str, Any]], dict[str, Any]]:
    api_key = os.environ.get("THE_ODDS_API_KEY") or os.environ.get("ODDS_API_KEY")
    if not api_key:
        return {}, {"configured": False}
    live, live_meta = live_odds_context(api_key)
    prior_season = max(2024, season - 1)
    prior_week_starts = schedule(prior_season)[1] if season >= datetime.now(timezone.utc).year else week_starts
    historical, historical_meta = historical_odds_context(api_key, prior_week_starts)
    combined = dict(historical)
    for abbr, values in live.items():
        combined[abbr] = values
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
    started_at = time.time()
    stats = team_stats(season)
    games, week_starts = schedule(season)
    fpa, fpa_meta = fantasy_points_allowed(season)
    injuries = sleeper_injuries()
    odds, odds_meta = odds_context(season, week_starts)
    has_odds_key = odds_key_configured()
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
                cells.append({
                    "week": week,
                    "opponent": opponent,
                    "score": round(score, 2),
                    "tier": tier,
                    "fpa": fpa.get(opponent, {}).get(position),
                    "fpaScore": round(fpa_score, 2) if fpa_score is not None else None,
                    "impliedTotal": implied_total,
                    "opponentImpliedTotal": opponent_implied,
                    "heatValue": heat_value,
                    "gameTotal": team_market.get("total") or opponent_market.get("total"),
                    "spread": team_market.get("spread"),
                    "moneyline": team_market.get("moneyline"),
                    "noVigWinProbability": team_market.get("noVigWinProbability"),
                    "oddsSource": team_market.get("sourceType") or projection_source,
                    "opponentOddsSource": opponent_market.get("sourceType") or opponent_projection_source,
                    "bookmakers": team_market.get("bookmakers"),
                    "oddsSamples": team_market.get("samples"),
                })
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
                "oddsImplied": odds.get(team, {}).get("implied"),
                "oddsSpread": odds.get(team, {}).get("spread"),
                "oddsMoneyline": odds.get(team, {}).get("moneyline"),
                "oddsWinProbability": odds.get(team, {}).get("noVigWinProbability"),
                "oddsSource": odds.get(team, {}).get("sourceType") or ("team-stat-fallback" if not odds.get(team) else "market"),
                "source": "espn_schedule_team_stats_sleeper_injuries" + ("_odds" if odds else ""),
            })
    payload = {
        "ok": True,
        "season": season,
        "updatedAt": utc_now(),
        "refreshCadence": "Shared database cache refreshes weekly to protect odds credits; page loads use cached SoS data between refreshes.",
        "cache": {"layer": "forced" if force else "fresh", "ageSeconds": 0},
        "providerMeta": {
            "buildMs": round((time.time() - started_at) * 1000),
            "fpa": fpa_meta,
            "odds": odds_meta,
            "teamsWithOdds": len(odds),
            "weeksWithSchedule": len(week_starts),
        },
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
            "Implied team totals are total / 2 - spread / 2, with team-stat fallbacks when market data is missing.",
            "Heat intensity is driven by projected scoring environment; D/ST uses the inverse opponent scoring environment.",
            "QB/WR/TE grades add small pressure and injury adjustments.",
            "D/ST grades use points allowed to opposing fantasy defenses plus opponent implied points and sack environment.",
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
