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


DEFAULT_SEASON = 2026
DEFAULT_LIMIT = 320
CACHE_TTL_SECONDS = 900


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

_board_cache: dict[str, Any] = {"data": None, "ts": 0.0}
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


def weekly_ppr_points(player: dict[str, Any], season: int, stat_source_id: int) -> dict[int, float]:
    weekly: dict[int, float] = {}
    for stat in player.get("stats") or []:
        if stat.get("seasonId") != season:
            continue
        if stat.get("statSourceId") != stat_source_id or stat.get("statSplitTypeId") != 1:
            continue
        period = int(stat.get("scoringPeriodId") or 0)
        if not 1 <= period <= 18:
            continue
        weekly[period] = max(weekly.get(period, 0.0), float(stat.get("appliedTotal") or 0.0))
    return weekly


def season_ppr_points(player: dict[str, Any], season: int, stat_source_id: int) -> float:
    weekly = weekly_ppr_points(player, season, stat_source_id)
    return round(sum(weekly.values()), 1)


def projected_ppr_points(player: dict[str, Any], season: int) -> float:
    return season_ppr_points(player, season, 1)


def last_year_ppr_profile(player: dict[str, Any], season: int) -> dict[str, Any]:
    weekly = weekly_ppr_points(player, season - 1, 0)
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
    profile = last_year_ppr_profile(player, DEFAULT_SEASON)
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
    return (
        f"Live ESPN feed ranks {row['Player']} #{row['Rank']} overall and {row['Pos']}{row['Pos Rank']}. "
        f"Current ADP is {adp_text}, projected PPR is {row['Proj PPR Pts']}, last-year PPR is "
        f"{row['Last Year PPR']}, ownership is {owned:.1f}%, "
        f"and start rate is {started:.1f}%. FantasyIQ value is recalculated from ESPN rank, ADP, projection, "
        f"prior-year production, volatility, ownership, and injury flags whenever the live board refreshes. "
        f"Risk read: {row['Risk Notes']}."
    )


def daily_synopsis_for(row: dict[str, Any], seed: dict[str, Any], season: int) -> dict[str, str]:
    player = seed["player"]
    outlook = clean_text(seed.get("outlook"))
    news_date = date_from_epoch_millis(player.get("lastNewsDate"))
    today = datetime.now(timezone.utc).date().isoformat()
    last_year = row["Last Year PPR"]
    last_year_text = f"{year_label(season)} PPR: {last_year}" if last_year != "N/A" else f"No {year_label(season)} NFL PPR sample"
    status_parts = [
        f"{row['Pos']}{row['Pos Rank']} / rank #{row['Rank']}",
        f"projected {row['Proj PPR Pts']} PPR",
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


def build_row_seed(player: dict[str, Any], season: int) -> dict[str, Any] | None:
    pos = POSITION_BY_ID.get(player.get("defaultPositionId"))
    if not pos:
        return None
    if player.get("active") is False and ppr_rank(player) >= 500:
        return None

    rank = ppr_rank(player)
    if rank >= 9000:
        return None
    ownership = player.get("ownership") or {}
    projected = projected_ppr_points(player, season)
    last_year_profile = last_year_ppr_profile(player, season)
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
    value_score = clamp((overall * 0.38) + (adp_value * 0.34) + (upside * 0.18) + ((10 - risk) * 1.0), 20, 96)

    return {
        "player": player,
        "rank": rank,
        "pos": pos,
        "projected": projected,
        "last_year": last_year,
        "last_year_profile": last_year_profile,
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
    }


def build_rows(players: list[dict[str, Any]], season: int, limit: int) -> list[dict[str, Any]]:
    seeds = [seed for player in players if (seed := build_row_seed(player, season))]
    seeds.sort(key=lambda item: (item["rank"], -item["projected"], item["player"].get("fullName", "")))
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
            "Last Year PPR": points_display(seed["last_year"]),
            "Last Year Weeks": seed["last_year_profile"]["scoring_weeks"],
            "Last Year Volatility": seed["last_year_profile"]["volatility"],
            "Projection Source": "ESPN live PPR projections",
            "Prior Year Source": f"ESPN {year_label(season)} actual PPR scoring",
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


def build_live_board_payload(force: bool = False, limit: int | None = None) -> dict[str, Any]:
    now = time.time()
    if not force and _board_cache["data"] and now - _board_cache["ts"] < CACHE_TTL_SECONDS:
        return _board_cache["data"]

    season = int_env("FANTASY_IQ_SEASON", DEFAULT_SEASON)
    row_limit = limit or int_env("FANTASY_IQ_BOARD_LIMIT", DEFAULT_LIMIT)
    fetch_limit = max(row_limit + 80, 420)
    data = fetch_json(player_feed_url(season), {"x-fantasy-filter": player_filter(fetch_limit)})
    players = [entry.get("player") or {} for entry in data.get("players", [])]
    rows = build_rows(players, season, row_limit)

    payload = {
        "updated": datetime.now(timezone.utc).date().isoformat(),
        "syncedAt": utc_now(),
        "live": True,
        "source": "ESPN public fantasy player feed",
        "season": season,
        "method": (
            "Live FantasyIQ board built from ESPN PPR ranks, ESPN projected fantasy points, "
            "prior-year actual PPR points, ADP, ownership, start rate, market movement, volatility, "
            "and injury flags."
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
    _board_cache["data"] = payload
    _board_cache["ts"] = now
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
            self.send_json(build_live_board_payload(force=force, limit=limit))
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError, ValueError) as exc:
            self.send_json(error_payload(str(exc)), HTTPStatus.BAD_GATEWAY)

    def do_HEAD(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
