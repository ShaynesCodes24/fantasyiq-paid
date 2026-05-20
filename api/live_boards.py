from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request
from html import unescape
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

try:
    from customer_context import authorize_customer_context, resolve_customer_context
except ModuleNotFoundError:
    from api.customer_context import authorize_customer_context, resolve_customer_context


DEFAULT_SEASON = 2026
DEFAULT_LIMIT = 320
CACHE_TTL_SECONDS = 900
DEFAULT_DEMO_LEAGUE_ID = 584856941


DEFAULT_SCORING_WEIGHTS: dict[int, float] = {
    3: 0.04,   # passing yards
    4: 4.0,    # passing touchdowns
    19: 2.0,   # passing two-point conversions
    20: -2.0,  # passing interceptions
    24: 0.1,   # rushing yards
    25: 6.0,   # rushing touchdowns
    26: 2.0,   # rushing two-point conversions
    42: 0.1,   # receiving yards
    43: 6.0,   # receiving touchdowns
    44: 2.0,   # receiving two-point conversions
    53: 1.0,   # receptions
    72: -2.0,  # lost fumbles
    85: -1.0,  # missed PAT
}


POSITION_BY_ID = {
    1: "QB",
    2: "RB",
    3: "WR",
    4: "TE",
    5: "K",
    16: "DST",
}

PRO_TEAM_BY_ID = {
    0: "FA",
    1: "ATL",
    2: "BUF",
    3: "CHI",
    4: "CIN",
    5: "CLE",
    6: "DAL",
    7: "DEN",
    8: "DET",
    9: "GB",
    10: "TEN",
    11: "IND",
    12: "KC",
    13: "LV",
    14: "LAR",
    15: "MIA",
    16: "MIN",
    17: "NE",
    18: "NO",
    19: "NYG",
    20: "NYJ",
    21: "PHI",
    22: "ARI",
    23: "PIT",
    24: "LAC",
    25: "SF",
    26: "SEA",
    27: "TB",
    28: "WAS",
    29: "CAR",
    30: "JAX",
    33: "BAL",
    34: "HOU",
}

POSITION_COLORS = {
    "QB": "D9EAF7",
    "RB": "DDF2D8",
    "WR": "FDE2C8",
    "TE": "E9D8FD",
    "K": "FFF2CC",
    "DST": "D9E1F2",
}

_board_cache: dict[str, dict[str, Any]] = {}
_rookie_names: set[str] | None = None


def int_env(name: str, default: int) -> int:
    raw_value = os.environ.get(name)
    if raw_value is None or raw_value.strip() == "":
        return default
    return int(raw_value)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def normalize_name(name: str) -> str:
    return "".join(ch for ch in name.lower() if ch.isalnum())


def clean_text(value: Any) -> str:
    text = unescape(str(value or ""))
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def short_text(value: str, limit: int = 620) -> str:
    if len(value) <= limit:
        return value
    sentence_cut = value.rfind(". ", 0, limit)
    if sentence_cut >= int(limit * 0.55):
        return value[: sentence_cut + 1]
    trimmed = value[: limit - 1].rsplit(" ", 1)[0].rstrip(".,;:")
    return f"{trimmed}."


def date_from_epoch_millis(value: Any) -> str:
    try:
        timestamp = int(value) / 1000
    except (TypeError, ValueError):
        return ""
    return datetime.fromtimestamp(timestamp, timezone.utc).date().isoformat()


def rookie_names() -> set[str]:
    global _rookie_names
    if _rookie_names is not None:
        return _rookie_names
    data_path = Path(__file__).resolve().parents[1] / "FantasyIQ" / "data" / "boards.json"
    try:
        payload = json.loads(data_path.read_text(encoding="utf-8"))
        rows = payload.get("boards", {}).get("rookies", {}).get("rows", [])
        _rookie_names = {normalize_name(str(row.get("Player") or "")) for row in rows}
    except (OSError, json.JSONDecodeError):
        _rookie_names = set()
    return _rookie_names


def player_feed_url(season: int) -> str:
    return (
        "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/"
        f"seasons/{season}/segments/0/leaguedefaults/3?view=kona_player_info"
    )


def player_filter(limit: int) -> str:
    return json.dumps(
        {
            "players": {
                "limit": limit,
                "filterRanksForScoringPeriodIds": {"value": [0]},
                "sortDraftRanks": {
                    "sortPriority": 100,
                    "sortAsc": True,
                    "value": "PPR",
                },
            }
        }
    )


def fetch_json(url: str, extra_headers: dict[str, str] | None = None) -> Any:
    headers = {
        "Accept": "application/json",
        "User-Agent": "FantasyIQ/1.0 (live board builder)",
    }
    if extra_headers:
        headers.update(extra_headers)
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=25) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return json.loads(response.read().decode(charset))


def ppr_rank(player: dict[str, Any]) -> int:
    ranks = player.get("draftRanksByRankType") or {}
    ppr = ranks.get("PPR") or {}
    standard = ranks.get("STANDARD") or {}
    rank = int(ppr.get("rank") or standard.get("rank") or 9999)
    return rank if rank > 0 else 9999


def float_value(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def int_value(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def league_settings_url(league_id: int, season: int) -> str:
    return (
        "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/"
        f"seasons/{season}/segments/0/leagues/{league_id}?view=mSettings"
    )


def merge_dicts(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    merged = {**base, **override}
    if isinstance(base.get("lineupSlots"), dict) or isinstance(override.get("lineupSlots"), dict):
        merged["lineupSlots"] = {
            **(base.get("lineupSlots") or {}),
            **(override.get("lineupSlots") or {}),
        }
    return merged


def scoring_items_from_espn(settings: dict[str, Any]) -> list[dict[str, Any]]:
    scoring_settings = settings.get("scoringSettings") or {}
    items = []
    for item in scoring_settings.get("scoringItems") or []:
        stat_id = int_value(item.get("statId"), -1)
        if stat_id < 0:
            continue
        items.append({"statId": stat_id, "points": float_value(item.get("points"))})
    return items


def scoring_type_from_receptions(reception_points: float | None) -> tuple[str, str]:
    if reception_points is None:
        return "ppr", "Full PPR"
    if reception_points >= 0.95:
        return "ppr", "Full PPR"
    if reception_points >= 0.45:
        return "half-ppr", "Half PPR"
    if reception_points <= 0.05:
        return "standard", "Standard"
    return "custom", f"{reception_points:g} PPR"


def extract_scoring_settings(settings: dict[str, Any]) -> dict[str, Any]:
    scoring_items = scoring_items_from_espn(settings)
    reception_points = next(
        (float_value(item.get("points")) for item in scoring_items if int_value(item.get("statId"), -1) == 53),
        None,
    )
    scoring_type, scoring_label = scoring_type_from_receptions(reception_points)
    extracted: dict[str, Any] = {
        "scoringType": scoring_type,
        "scoringLabel": scoring_label,
        "receptionPoints": reception_points,
        "source": "ESPN league scoring settings",
    }
    if scoring_items:
        extracted["scoringItems"] = scoring_items
    return extracted


def context_scoring_settings(context: Any, season: int) -> dict[str, Any]:
    league_id = context.league_id or DEFAULT_DEMO_LEAGUE_ID
    extracted: dict[str, Any] = {}
    if league_id:
        try:
            league = fetch_json(league_settings_url(int(league_id), season))
            extracted = extract_scoring_settings(league.get("settings") or {})
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError, ValueError):
            extracted = {}
    overrides = context.league_settings or {}
    merged = merge_dicts(extracted, overrides)
    if overrides and not overrides.get("source"):
        merged["source"] = "FantasyIQ league profile + ESPN scoring settings"
    return merged


def reception_points_for(settings: dict[str, Any]) -> float:
    if settings.get("receptionPoints") not in (None, ""):
        return float_value(settings.get("receptionPoints"), 1.0)
    scoring_type = str(settings.get("scoringType") or "ppr").strip().lower()
    if scoring_type in {"standard", "std", "non-ppr", "nonppr"}:
        return 0.0
    if scoring_type in {"half", "half-ppr", "halfppr", "0.5-ppr", "0.5ppr"}:
        return 0.5
    return 1.0


def scoring_items_for(settings: dict[str, Any]) -> list[dict[str, float | int]]:
    reception_points = reception_points_for(settings)
    raw_items = settings.get("scoringItems")
    if isinstance(raw_items, list) and raw_items:
        items = []
        has_receptions = False
        for item in raw_items:
            if not isinstance(item, dict):
                continue
            stat_id = int_value(item.get("statId"), -1)
            if stat_id < 0:
                continue
            points = reception_points if stat_id == 53 else float_value(item.get("points"))
            if stat_id == 53:
                has_receptions = True
            items.append({"statId": stat_id, "points": points})
        if items:
            if not has_receptions:
                items.append({"statId": 53, "points": reception_points})
            return items

    weights = {**DEFAULT_SCORING_WEIGHTS, 53: reception_points}
    custom_weights = settings.get("scoringWeights") or settings.get("scoringWeightsByStatId") or {}
    if isinstance(custom_weights, dict):
        for key, value in custom_weights.items():
            weights[int_value(key, -1)] = float_value(value)
    return [{"statId": stat_id, "points": points} for stat_id, points in weights.items()]


def scoring_profile_for(settings: dict[str, Any]) -> dict[str, Any]:
    reception_points = reception_points_for(settings)
    scoring_type = str(settings.get("scoringType") or "").strip().lower()
    scoring_label = str(settings.get("scoringLabel") or "").strip()
    inferred_type, inferred_label = scoring_type_from_receptions(reception_points)
    scoring_type = scoring_type or inferred_type
    if scoring_type in {"half-ppr", "halfppr", "half"} and scoring_label in {"", "Full PPR"}:
        scoring_label = "Half PPR"
    elif scoring_type in {"standard", "std", "non-ppr", "nonppr"} and scoring_label in {"", "Full PPR", "Half PPR"}:
        scoring_label = "Standard"
    elif not scoring_label:
        scoring_label = inferred_label
    return {
        "settings": settings,
        "items": scoring_items_for({**settings, "receptionPoints": reception_points}),
        "receptionPoints": reception_points,
        "scoringType": scoring_type,
        "scoringLabel": scoring_label,
    }


def raw_stat_score(stats: dict[str, Any], scoring_items: list[dict[str, Any]], fallback: float = 0.0) -> tuple[float, bool]:
    total = 0.0
    used_raw = False
    for item in scoring_items:
        stat_id = str(int_value(item.get("statId"), -1))
        if stat_id not in stats:
            continue
        value = float_value(stats.get(stat_id))
        if value:
            used_raw = True
        total += value * float_value(item.get("points"))
    if not used_raw and fallback:
        return fallback, False
    return total, used_raw


def ppr_scoring_items(scoring_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    items = []
    seen_receptions = False
    for item in scoring_items:
        cloned = dict(item)
        if int_value(cloned.get("statId"), -1) == 53:
            cloned["points"] = 1.0
            seen_receptions = True
        items.append(cloned)
    if not seen_receptions:
        items.append({"statId": 53, "points": 1.0})
    return items


def stat_total(player: dict[str, Any], season: int, stat_source_id: int, stat_id: int) -> float:
    total = 0.0
    for stat in player.get("stats") or []:
        if stat.get("seasonId") != season:
            continue
        if stat.get("statSourceId") != stat_source_id or stat.get("statSplitTypeId") != 1:
            continue
        period = int_value(stat.get("scoringPeriodId"))
        if not 1 <= period <= 18:
            continue
        total += float_value((stat.get("stats") or {}).get(str(stat_id)))
    return round(total, 2)


def weekly_scored_points(
    player: dict[str, Any],
    season: int,
    stat_source_id: int,
    scoring_items: list[dict[str, Any]],
) -> dict[int, float]:
    weekly: dict[int, float] = {}
    for stat in player.get("stats") or []:
        if stat.get("seasonId") != season:
            continue
        if stat.get("statSourceId") != stat_source_id or stat.get("statSplitTypeId") != 1:
            continue
        period = int_value(stat.get("scoringPeriodId"))
        if not 1 <= period <= 18:
            continue
        score, _ = raw_stat_score(stat.get("stats") or {}, scoring_items, float_value(stat.get("appliedTotal")))
        weekly[period] = max(weekly.get(period, 0.0), score)
    return weekly


def season_scored_points(
    player: dict[str, Any],
    season: int,
    stat_source_id: int,
    scoring_items: list[dict[str, Any]],
) -> float:
    weekly = weekly_scored_points(player, season, stat_source_id, scoring_items)
    return round(sum(weekly.values()), 1)


def projected_scored_points(player: dict[str, Any], season: int, scoring_items: list[dict[str, Any]]) -> float:
    return season_scored_points(player, season, 1, scoring_items)


def last_year_scored_profile(player: dict[str, Any], season: int, scoring_items: list[dict[str, Any]]) -> dict[str, Any]:
    weekly = weekly_scored_points(player, season - 1, 0, scoring_items)
    values = list(weekly.values())
    total = round(sum(values), 1)
    scoring_weeks = sum(1 for value in values if value > 0.5)
    volatility = 0.0
    if len(values) > 1:
        average = sum(values) / len(values)
        variance = sum((value - average) ** 2 for value in values) / len(values)
        volatility = variance ** 0.5
    return {
        "points": total,
        "scoring_weeks": scoring_weeks,
        "weeks": len(values),
        "volatility": round(volatility, 1),
    }


def position_tier(pos: str, pos_rank: int) -> str:
    if pos == "QB":
        if pos_rank <= 6:
            return "QB1 Elite"
        if pos_rank <= 12:
            return "QB1 Starter"
        if pos_rank <= 24:
            return "QB2 Stream"
        return "QB Deep Watch"
    if pos == "RB":
        if pos_rank <= 12:
            return "RB1 Elite"
        if pos_rank <= 24:
            return "RB2 Core"
        if pos_rank <= 36:
            return "RB3 Flex"
        if pos_rank <= 50:
            return "RB4 Upside"
        return "RB5 Handcuff"
    if pos == "WR":
        if pos_rank <= 12:
            return "WR1 Elite"
        if pos_rank <= 24:
            return "WR2 Core"
        if pos_rank <= 36:
            return "WR3 Flex"
        if pos_rank <= 60:
            return "WR4 Upside"
        return "WR5 Deep"
    if pos == "TE":
        if pos_rank <= 6:
            return "TE1 Edge"
        if pos_rank <= 12:
            return "TE1 Starter"
        if pos_rank <= 24:
            return "TE2 Stream"
        return "TE Deep Watch"
    if pos == "DST":
        return "DST Stream"
    if pos == "K":
        return "K Stream"
    return "Watch"


def category_for(row_seed: dict[str, Any]) -> str:
    rank = row_seed["rank"]
    pos = row_seed["pos"]
    value_score = row_seed["value_score"]
    player_name = normalize_name(str(row_seed["player"].get("fullName") or ""))
    if pos in {"K", "DST"}:
        return "K/DST"
    if rank <= 36:
        return "Elite"
    if value_score >= 56 and rank > 55:
        return "Sleeper"
    if player_name in rookie_names():
        return "Rookie"
    return "Staple"


def risk_profile_for(
    player: dict[str, Any],
    rank: int,
    projected: float,
    last_year: float,
    last_year_weeks: int,
    volatility: float,
    ownership: dict[str, Any],
    pos: str,
) -> tuple[int, str]:
    risk = 2.6
    notes: list[str] = []
    player_name = normalize_name(str(player.get("fullName") or ""))
    rookie = player_name in rookie_names()
    injury_status = str(player.get("injuryStatus") or "ACTIVE").upper()
    if injury_status not in {"ACTIVE", "NORMAL", ""}:
        severe_statuses = {"OUT", "DOUBTFUL", "IR", "INJURED_RESERVE", "SUSPENDED", "PUP"}
        risk += 2.7 if injury_status in severe_statuses else 1.6
        notes.append(f"injury status is {injury_status.replace('_', ' ').title()}")
    if player.get("injured"):
        risk += 1.4
        notes.append("ESPN has the injured flag on")

    if last_year <= 0:
        if rookie:
            risk += 2.2 if rank <= 60 else 1.2
            notes.append("no prior NFL scoring sample")
        elif projected >= 120 or rank <= 120:
            risk += 1.8
            notes.append("projected role without prior-year PPR production")
        else:
            risk += 0.7
    else:
        if last_year >= 220 and last_year_weeks >= 12:
            risk -= 0.5
        elif last_year >= 150 and last_year_weeks >= 10:
            risk -= 0.2

        if last_year_weeks <= 4 and projected >= 90:
            risk += 2.0
            notes.append("tiny prior-year scoring sample")
        elif last_year_weeks <= 8 and projected >= 120:
            risk += 1.4
            notes.append("limited prior-year scoring sample")
        elif last_year_weeks <= 11 and rank <= 80:
            risk += 0.7
            notes.append("missed meaningful prior-year scoring weeks")

        projection_jump = (projected - last_year) / last_year if last_year > 0 else 0.0
        if projected >= 100 and projection_jump >= 1.0:
            risk += 1.6
            notes.append("projection requires a major rebound")
        elif projected >= 100 and projection_jump >= 0.45:
            risk += 1.1
            notes.append("projection is well above last year")
        elif projected >= 100 and projection_jump >= 0.25:
            risk += 0.5
            notes.append("projection needs growth from last year")

        average_week = last_year / last_year_weeks if last_year_weeks else 0.0
        volatility_ratio = volatility / average_week if average_week else 0.0
        if volatility >= 14 and volatility_ratio >= 0.85 and last_year_weeks >= 8:
            risk += 1.0
            notes.append("weekly scoring was very volatile")
        elif volatility >= 11 and volatility_ratio >= 0.65 and last_year_weeks >= 8:
            risk += 0.6
            notes.append("weekly scoring had volatility")

    if rank > 120:
        risk += 0.8
    if rank > 200:
        risk += 0.7
    if projected <= 0:
        risk += 2.0
        notes.append("no current projection")

    started = float(ownership.get("percentStarted") or 0.0)
    owned = float(ownership.get("percentOwned") or 0.0)
    if started < 30 and rank <= 80:
        risk += 1.0
        notes.append("low ESPN start rate for the rank")
    elif started < 15 and rank <= 120:
        risk += 0.8
        notes.append("low ESPN start rate for the tier")
    if owned < 80 and rank <= 100:
        risk += 0.6
        notes.append("ownership is light for a ranked starter")

    adp = ownership.get("averageDraftPosition")
    if adp is not None:
        market_delta = float(adp) - rank
        if market_delta <= -15:
            risk += 0.6
            notes.append("market price is ahead of board rank")
        elif market_delta >= 20 and rank <= 120:
            risk -= 0.3

    if abs(float(ownership.get("averageDraftPositionPercentChange") or 0.0)) >= 10:
        risk += 0.5
        notes.append("ADP is moving quickly")
    if float(ownership.get("auctionValueAverageChange") or 0.0) <= -3:
        risk += 0.4
        notes.append("auction value is sliding")
    if pos in {"K", "DST"}:
        risk += 0.5
        notes.append("position is more matchup dependent")

    risk_score = int(round(clamp(risk, 1, 10)))
    if not notes:
        notes.append("healthy profile with projection, ADP, and prior-year production in range")
    return risk_score, "; ".join(notes[:4])


def risk_for(player: dict[str, Any], rank: int, projected: float, ownership: dict[str, Any]) -> int:
    profile = last_year_scored_profile(player, DEFAULT_SEASON, scoring_items_for({}))
    return risk_profile_for(
        player,
        rank,
        projected,
        float(profile["points"]),
        int(profile["scoring_weeks"]),
        float(profile["volatility"]),
        ownership,
        POSITION_BY_ID.get(player.get("defaultPositionId"), ""),
    )[0]


def points_display(value: float) -> float | str:
    return round(value, 1) if value > 0 else "N/A"


def year_label(season: int) -> str:
    return str(season - 1)


def action_for(row_seed: dict[str, Any]) -> str:
    pos = row_seed["pos"]
    rank = row_seed["rank"]
    risk = row_seed["risk"]
    value_score = row_seed["value_score"]
    if pos in {"K", "DST"}:
        return "Stream only if schedule fits"
    if risk >= 7:
        return "Draft only at discount"
    if rank <= 24:
        return "Anchor if price matches tier"
    if value_score >= 70:
        return "Draft-room value target"
    if value_score >= 56 and rank > 55:
        return "Under-ADP target"
    return "Take at fair price"


def analysis_for(row: dict[str, Any], ownership: dict[str, Any]) -> str:
    adp = ownership.get("averageDraftPosition")
    adp_text = f"{float(adp):.1f}" if adp is not None else "unlisted"
    owned = float(ownership.get("percentOwned") or 0.0)
    started = float(ownership.get("percentStarted") or 0.0)
    scoring_label = row.get("Scoring Label") or "league"
    return (
        f"Live ESPN feed ranks {row['Player']} #{row['Rank']} overall and {row['Pos']}{row['Pos Rank']}. "
        f"Current ADP is {adp_text}, native {scoring_label} projection is {row['Proj PPR Pts']}, "
        f"last-year {scoring_label} scoring is {row['Last Year PPR']}, ownership is {owned:.1f}%, "
        f"and start rate is {started:.1f}%. FantasyIQ value is recalculated from ESPN rank, ADP, raw-stat projection, "
        f"prior-year raw-stat production, volatility, ownership, and injury flags whenever the live board refreshes. "
        f"Risk read: {row['Risk Notes']}."
    )


def daily_synopsis_for(row: dict[str, Any], seed: dict[str, Any], season: int) -> dict[str, str]:
    player = seed["player"]
    outlook = clean_text(seed.get("outlook"))
    news_date = date_from_epoch_millis(player.get("lastNewsDate"))
    today = datetime.now(timezone.utc).date().isoformat()
    last_year = row["Last Year PPR"]
    scoring_label = row.get("Scoring Label") or "league"
    last_year_text = (
        f"{year_label(season)} {scoring_label}: {last_year}"
        if last_year != "N/A"
        else f"No {year_label(season)} NFL {scoring_label} sample"
    )
    status_parts = [
        f"{row['Pos']}{row['Pos Rank']} / rank #{row['Rank']}",
        f"projected {row['Proj PPR Pts']} {scoring_label}",
        last_year_text,
        f"risk {row['Risk']}/10",
    ]
    fallback = (
        f"{row['Player']} is a {row['Pos']} for {row['Team']} with {', '.join(status_parts)}. "
        f"FantasyIQ's current action is: {row['Action']}. Risk read: {row['Risk Notes']}."
    )
    body = outlook or fallback
    headline = f"Daily FantasyIQ read: {', '.join(status_parts)}."
    news_status = (
        f"Latest ESPN player note is dated {news_date}; synopsis refreshed from the live board on {today}."
        if news_date
        else f"No dated ESPN player note is available; synopsis refreshed from the live board on {today}."
    )
    return {
        "Daily Synopsis": short_text(f"{headline} {body}"),
        "Synopsis Updated": today,
        "Latest News Date": news_date or "No dated update",
        "News Status": news_status,
        "Player Outlook": short_text(body),
        "Synopsis Source": "ESPN live player outlook, ESPN public fantasy board data, and FantasyIQ daily board model",
    }


def build_row_seed(player: dict[str, Any], season: int, scoring_profile: dict[str, Any]) -> dict[str, Any] | None:
    pos = POSITION_BY_ID.get(player.get("defaultPositionId"))
    if not pos:
        return None
    if player.get("active") is False and ppr_rank(player) >= 500:
        return None

    rank = ppr_rank(player)
    if rank >= 9000:
        return None
    ownership = player.get("ownership") or {}
    scoring_items = scoring_profile["items"]
    ppr_items = ppr_scoring_items(scoring_items)
    projected = projected_scored_points(player, season, scoring_items)
    ppr_projected = projected_scored_points(player, season, ppr_items)
    last_year_profile = last_year_scored_profile(player, season, scoring_items)
    last_year_ppr_profile = last_year_scored_profile(player, season, ppr_items)
    last_year = float(last_year_profile["points"])
    adp = float(ownership.get("averageDraftPosition") or rank + 30)
    market_delta = adp - rank
    percent_change = float(ownership.get("percentChange") or 0.0)
    auction_change = float(ownership.get("auctionValueAverageChange") or 0.0)
    adp_value = clamp(50 + market_delta * 1.15 + percent_change * 6 + auction_change * 2, 10, 95)
    risk, risk_notes = risk_profile_for(
        player,
        rank,
        projected,
        last_year,
        int(last_year_profile["scoring_weeks"]),
        float(last_year_profile["volatility"]),
        ownership,
        pos,
    )
    overall = clamp(100 - (rank - 1) * 0.28, 40, 99)
    volume = clamp(45 + float(ownership.get("percentStarted") or 0.0) * 0.45, 35, 96)
    upside = clamp(overall + float(ownership.get("auctionValueAverage") or 0.0) * 0.22 + max(market_delta, 0) * 0.1, 45, 99)
    stability = clamp(96 - risk * 5 + float(ownership.get("percentStarted") or 0.0) * 0.08, 30, 94)
    floor = clamp((overall + stability) / 2 - risk * 0.8, 28, 95)
    ceiling = clamp(max(upside, overall + 4), 45, 99)
    projection_edge = projected - ppr_projected
    projection_adjustment = clamp(projection_edge / 8, -8, 8)
    league_sort_rank = rank - projection_edge * 0.18
    value_score = clamp(
        (overall * 0.38) + (adp_value * 0.34) + (upside * 0.18) + ((10 - risk) * 1.0) + projection_adjustment,
        20,
        96,
    )

    return {
        "player": player,
        "rank": rank,
        "league_sort_rank": league_sort_rank,
        "pos": pos,
        "projected": projected,
        "ppr_projected": ppr_projected,
        "projection_edge": projection_edge,
        "last_year": last_year,
        "last_year_profile": last_year_profile,
        "last_year_ppr": float(last_year_ppr_profile["points"]),
        "ownership": ownership,
        "outlook": str(player.get("seasonOutlook") or ""),
        "market_delta": market_delta,
        "percent_change": percent_change,
        "auction_change": auction_change,
        "adp_change": float(ownership.get("averageDraftPositionPercentChange") or 0.0),
        "adp_value": round(adp_value, 1),
        "risk": risk,
        "risk_notes": risk_notes,
        "overall": round(overall),
        "floor": round(floor),
        "volume": round(volume),
        "upside": round(upside),
        "stability": round(stability),
        "ceiling": round(ceiling),
        "value_score": round(value_score, 1),
        "projected_receptions": stat_total(player, season, 1, 53),
        "projected_rush_yards": stat_total(player, season, 1, 24),
        "projected_receiving_yards": stat_total(player, season, 1, 42),
        "projected_passing_yards": stat_total(player, season, 1, 3),
    }


def build_rows(players: list[dict[str, Any]], season: int, limit: int, scoring_profile: dict[str, Any]) -> list[dict[str, Any]]:
    seeds = [seed for player in players if (seed := build_row_seed(player, season, scoring_profile))]
    seeds.sort(key=lambda item: (item["league_sort_rank"], item["rank"], -item["projected"], item["player"].get("fullName", "")))
    rows: list[dict[str, Any]] = []
    pos_counts: dict[str, int] = {}

    for overall_rank, seed in enumerate(seeds[:limit], start=1):
        player = seed["player"]
        pos = seed["pos"]
        pos_counts[pos] = pos_counts.get(pos, 0) + 1
        pos_rank = pos_counts[pos]
        seed["rank"] = overall_rank
        category = category_for(seed)
        tier = position_tier(pos, pos_rank)
        row = {
            "Rank": overall_rank,
            "Player": player.get("fullName"),
            "Pos": pos,
            "Team": PRO_TEAM_BY_ID.get(player.get("proTeamId"), "FA"),
            "Bye": "",
            "Category": category,
            "Proj PPR Pts": seed["projected"],
            "Native Projection": seed["projected"],
            "PPR Baseline Projection": round(seed["ppr_projected"], 1),
            "Projection Edge": round(seed["projection_edge"], 1),
            "Projected Receptions": seed["projected_receptions"],
            "Projected Rush Yards": seed["projected_rush_yards"],
            "Projected Receiving Yards": seed["projected_receiving_yards"],
            "Projected Passing Yards": seed["projected_passing_yards"],
            "Last Year PPR": points_display(seed["last_year"]),
            "Last Year Native": points_display(seed["last_year"]),
            "Last Year PPR Baseline": points_display(seed["last_year_ppr"]),
            "Last Year Weeks": seed["last_year_profile"]["scoring_weeks"],
            "Last Year Volatility": seed["last_year_profile"]["volatility"],
            "Projection Source": f"ESPN raw-stat projections scored natively for {scoring_profile['scoringLabel']}",
            "Prior Year Source": f"ESPN {year_label(season)} raw stats scored natively for {scoring_profile['scoringLabel']}",
            "Scoring Type": scoring_profile["scoringType"],
            "Scoring Label": scoring_profile["scoringLabel"],
            "Reception Points": scoring_profile["receptionPoints"],
            "Native Scoring": True,
            "Overall": seed["overall"],
            "Floor": seed["floor"],
            "Volume": seed["volume"],
            "Upside": seed["upside"],
            "Stability": seed["stability"],
            "Ceiling": seed["ceiling"],
            "ADP Value": seed["adp_value"],
            "Risk": seed["risk"],
            "Risk Notes": seed["risk_notes"],
            "Value Score": seed["value_score"],
            "Action": action_for(seed),
            "Analysis": "",
            "Pos Rank": pos_rank,
            "Pos Tier": tier,
            "Tier": tier,
            "Tier Sort": pos_rank,
            "ESPN Player ID": player.get("id"),
            "ESPN PPR Rank": ppr_rank(player),
            "ESPN ADP": seed["ownership"].get("averageDraftPosition"),
            "ESPN Percent Owned": seed["ownership"].get("percentOwned"),
            "ESPN Percent Started": seed["ownership"].get("percentStarted"),
            "ESPN Ownership Change": seed["percent_change"],
            "ESPN ADP Change": seed["adp_change"],
        }
        row["Analysis"] = analysis_for(row, seed["ownership"])
        row.update(daily_synopsis_for(row, seed, season))
        rows.append(row)

    return rows


def trend_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    trends = []
    for row in rows:
        ownership_change = float(row.get("ESPN Ownership Change") or 0.0)
        adp_change = float(row.get("ESPN ADP Change") or 0.0)
        adp = row.get("ESPN ADP")
        rank = float(row.get("Rank") or 999)
        adp_gap = float(adp) - rank if adp is not None else 0.0
        trend_score = abs(ownership_change) * 8 + abs(adp_change) * 2 + max(adp_gap, 0) * 0.25
        if trend_score < 3 and row["Rank"] > 120:
            continue
        direction = "Rising" if ownership_change > 0 or adp_change < 0 else "Value Gap" if adp_gap > 12 else "Falling"
        trend = {
            **row,
            "Trend": direction,
            "Board Rank": row["Rank"],
            "Trend Score": round(trend_score, 1),
            "Confidence": "High" if trend_score >= 18 else "Medium" if trend_score >= 8 else "Watch",
            "Draft Action": "Move up the queue" if direction == "Rising" else "Compare price to rank" if direction == "Value Gap" else "Discount only",
            "Source Signal": "ESPN live ownership, ADP, and projection movement",
            "Catalyst": "Market movement in ESPN public fantasy data",
            "Why Rising/Falling": (
                f"Ownership change {ownership_change:+.2f}, ADP change {adp_change:+.2f}, "
                f"rank/ADP gap {adp_gap:+.1f}."
            ),
        }
        trends.append(trend)
    trends.sort(key=lambda item: (-float(item["Trend Score"]), int(item["Rank"])))
    return trends[:80]


def build_live_board_payload(
    request_path: str = "",
    headers: Any | None = None,
    force: bool = False,
    limit: int | None = None,
) -> dict[str, Any]:
    context = authorize_customer_context(request_path, headers)
    now = time.time()
    cache_key = f"{context.cache_key}:boards:{limit or 'default'}"
    cached = _board_cache.get(cache_key)
    if not force and cached and cached.get("data") and now - float(cached.get("ts") or 0) < CACHE_TTL_SECONDS:
        return cached["data"]

    season = context.season or int_env("FANTASY_IQ_SEASON", DEFAULT_SEASON)
    league_settings = context_scoring_settings(context, season)
    scoring_profile = scoring_profile_for(league_settings)
    row_limit = limit or int_env("FANTASY_IQ_BOARD_LIMIT", DEFAULT_LIMIT)
    fetch_limit = max(row_limit + 80, 420)
    data = fetch_json(player_feed_url(season), {"x-fantasy-filter": player_filter(fetch_limit)})
    players = [entry.get("player") or {} for entry in data.get("players", [])]
    rows = build_rows(players, season, row_limit, scoring_profile)
    customer = context.public_dict()
    customer["leagueSettings"] = merge_dicts(customer.get("leagueSettings") or {}, league_settings)

    payload = {
        "updated": datetime.now(timezone.utc).date().isoformat(),
        "syncedAt": utc_now(),
        "live": True,
        "source": "ESPN public fantasy player feed",
        "customer": customer,
        "customerSlug": context.slug,
        "season": season,
        "scoringProfile": {
            "scoringType": scoring_profile["scoringType"],
            "scoringLabel": scoring_profile["scoringLabel"],
            "receptionPoints": scoring_profile["receptionPoints"],
            "source": league_settings.get("source") or "FantasyIQ default scoring",
        },
        "method": (
            "Live FantasyIQ board built from ESPN raw projected stats, league-native scoring items, "
            "prior-year raw stat scoring, ADP, ownership, start rate, market movement, volatility, "
            "and injury flags. PPR ranks remain as one market signal, but projections and values are "
            "scored for the active league format."
        ),
        "positionColors": POSITION_COLORS,
        "boards": {
            "combined": {"title": "Live Combined Big Board", "rows": rows},
            "elite": {"title": "Live Elite Board", "rows": [row for row in rows if row["Rank"] <= 36]},
            "staples": {
                "title": "Live Staple Board",
                "rows": [row for row in rows if 37 <= row["Rank"] <= 156 and row["Pos"] not in {"K", "DST"}],
            },
            "rookies": {
                "title": "Live Rookie Board",
                "rows": [row for row in rows if normalize_name(str(row.get("Player") or "")) in rookie_names()],
            },
            "sleepers": {
                "title": "Live Sleeper Board",
                "rows": [
                    row
                    for row in rows
                    if row["Category"] == "Sleeper" or (row["Value Score"] >= 56 and row["Rank"] > 55)
                ],
            },
            "kdst": {"title": "Live K/DST Board", "rows": [row for row in rows if row["Pos"] in {"K", "DST"}]},
            "trends": {"title": "Live Risers/Fallers", "rows": trend_rows(rows)},
        },
    }
    _board_cache[cache_key] = {"data": payload, "ts": now}
    return payload


def error_payload(message: str) -> dict[str, Any]:
    return {
        "ok": False,
        "source": "ESPN public fantasy player feed",
        "syncedAt": utc_now(),
        "error": message,
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
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        force = query.get("force", ["0"])[0] == "1"
        limit = None
        if query.get("limit"):
            try:
                limit = int(query["limit"][0])
            except ValueError:
                limit = None
        try:
            self.send_json(build_live_board_payload(self.path, self.headers, force=force, limit=limit))
        except PermissionError as exc:
            self.send_json(error_payload(str(exc)), HTTPStatus.UNAUTHORIZED)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError, ValueError) as exc:
            self.send_json(error_payload(str(exc)), HTTPStatus.BAD_GATEWAY)

    def do_HEAD(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
