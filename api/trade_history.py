from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from typing import Any
from urllib.parse import parse_qs, urlparse


DEFAULT_SEASON = 2026
DEFAULT_DEMO_LEAGUE_ID = 584856941
DEFAULT_LOOKBACK_YEARS = 5
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

_history_cache: dict[str, Any] = {"key": None, "data": None, "ts": 0.0}
_player_cache: dict[int, dict[int, dict[str, Any]]] = {}


class ConfigError(RuntimeError):
    pass


def int_env(name: str, default: int | None = None) -> int | None:
    raw_value = os.environ.get(name)
    if raw_value is None or raw_value.strip() == "":
        return default
    try:
        return int(raw_value)
    except ValueError as exc:
        raise ConfigError(f"{name} must be a number.") from exc


CONFIG_ERROR: str | None = None
try:
    DEMO_LEAGUE_ID = int_env("FANTASY_IQ_DEMO_LEAGUE_ID", DEFAULT_DEMO_LEAGUE_ID)
    DEMO_MODE = os.environ.get("FANTASY_IQ_LEAGUE_ID") is None
    LEAGUE_ID = int_env("FANTASY_IQ_LEAGUE_ID", DEMO_LEAGUE_ID)
    SEASON = int_env("FANTASY_IQ_SEASON", DEFAULT_SEASON)
except ConfigError as exc:
    CONFIG_ERROR = str(exc)
    DEMO_MODE = False
    LEAGUE_ID = None
    SEASON = DEFAULT_SEASON


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def require_config() -> tuple[int, int]:
    if CONFIG_ERROR:
        raise ConfigError(CONFIG_ERROR)
    if SEASON is None:
        raise ConfigError("FANTASY_IQ_SEASON is not configured for this customer dashboard.")
    if LEAGUE_ID is None:
        raise ConfigError("FANTASY_IQ_LEAGUE_ID is not configured for this customer dashboard.")
    return LEAGUE_ID, SEASON


def league_url(league_id: int, season: int) -> str:
    return (
        "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/"
        f"seasons/{season}/segments/0/leagues/{league_id}"
        "?view=mTransactions2&view=mTeam&view=mSettings"
    )


def players_url(season: int) -> str:
    return (
        "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/"
        f"seasons/{season}/players?view=players_wl"
    )


def player_filter() -> str:
    return json.dumps({"players": {"limit": 3000}})


def fetch_json(url: str, extra_headers: dict[str, str] | None = None) -> Any:
    headers = {
        "Accept": "application/json",
        "User-Agent": "FantasyIQ/1.0 (trade history)",
    }
    if extra_headers:
        headers.update(extra_headers)
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=25) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return json.loads(response.read().decode(charset))


def load_players(season: int) -> dict[int, dict[str, Any]]:
    if season in _player_cache:
        return _player_cache[season]
    try:
        payload = fetch_json(players_url(season), {"x-fantasy-filter": player_filter()})
        _player_cache[season] = {int(item["id"]): item for item in payload if "id" in item}
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, json.JSONDecodeError, OSError):
        _player_cache[season] = {}
    return _player_cache[season]


def team_name(team: dict[str, Any], members: dict[str, str]) -> str:
    name = team.get("name")
    if name:
        return str(name)
    location = team.get("location") or ""
    nickname = team.get("nickname") or ""
    combined = f"{location} {nickname}".strip()
    if combined:
        return combined
    owner = team.get("primaryOwner")
    if owner and owner in members:
        return members[owner]
    return f"Team {team.get('id', '?')}"


def player_info(player_id: int, players: dict[int, dict[str, Any]]) -> dict[str, Any]:
    player = players.get(player_id) or {}
    return {
        "playerId": player_id,
        "name": player.get("fullName") or f"Player {player_id}",
        "pos": POSITION_BY_ID.get(player.get("defaultPositionId"), ""),
        "proTeam": PRO_TEAM_BY_ID.get(player.get("proTeamId"), ""),
    }


def date_from_ms(value: Any) -> str | None:
    try:
        timestamp = int(value)
    except (TypeError, ValueError):
        return None
    if timestamp <= 0:
        return None
    return datetime.fromtimestamp(timestamp / 1000, timezone.utc).date().isoformat()


def transaction_date(transaction: dict[str, Any]) -> str | None:
    for key in ("processedDate", "proposedDate", "executionDate", "date"):
        date_value = date_from_ms(transaction.get(key))
        if date_value:
            return date_value
    return None


def is_completed_trade(transaction: dict[str, Any]) -> bool:
    tx_type = str(transaction.get("type") or transaction.get("transactionType") or "").upper()
    status = str(transaction.get("status") or transaction.get("executionType") or "").upper()
    if "TRADE" not in tx_type:
        return False
    if any(blocked in status for blocked in ("CANCEL", "VETO", "FAILED", "PENDING")):
        return False
    return True


def normalize_item(item: dict[str, Any], players: dict[int, dict[str, Any]]) -> dict[str, Any] | None:
    def clean_team_id(value: Any) -> int | None:
        try:
            team_id = int(value)
        except (TypeError, ValueError):
            return None
        return team_id if team_id > 0 else None

    player_id = item.get("playerId") or item.get("assetId")
    try:
        player_id = int(player_id)
    except (TypeError, ValueError):
        player_id = 0
    if player_id <= 0:
        label = item.get("draftPick") or item.get("type") or "Trade asset"
        return {
            "playerId": None,
            "name": str(label),
            "pos": "",
            "proTeam": "",
            "fromTeamId": clean_team_id(item.get("fromTeamId")),
            "toTeamId": clean_team_id(item.get("toTeamId")),
        }
    info = player_info(player_id, players)
    info["fromTeamId"] = clean_team_id(item.get("fromTeamId"))
    info["toTeamId"] = clean_team_id(item.get("toTeamId"))
    return info


def normalize_trade(
    transaction: dict[str, Any],
    season: int,
    teams: dict[int, dict[str, Any]],
    players: dict[int, dict[str, Any]],
) -> dict[str, Any] | None:
    items = [item for item in (normalize_item(raw, players) for raw in transaction.get("items") or []) if item]
    involved_ids = sorted(
        {
            int(team_id)
            for item in items
            for team_id in (item.get("fromTeamId"), item.get("toTeamId"))
            if team_id not in (None, 0, "")
        }
    )
    if len(involved_ids) < 2:
        return None

    team_sides = []
    for team_id in involved_ids:
        sent = [{key: item.get(key) for key in ("playerId", "name", "pos", "proTeam")} for item in items if item.get("fromTeamId") == team_id]
        received = [{key: item.get(key) for key in ("playerId", "name", "pos", "proTeam")} for item in items if item.get("toTeamId") == team_id]
        partners = sorted(
            {
                int(other_id)
                for item in items
                for other_id in (item.get("fromTeamId"), item.get("toTeamId"))
                if other_id not in (None, 0, "", team_id)
            }
        )
        team_sides.append(
            {
                "teamId": team_id,
                "teamName": teams.get(team_id, {}).get("teamName") or f"Team {team_id}",
                "sent": sent,
                "received": received,
                "partners": [
                    {
                        "teamId": partner_id,
                        "teamName": teams.get(partner_id, {}).get("teamName") or f"Team {partner_id}",
                    }
                    for partner_id in partners
                ],
            }
        )

    return {
        "id": str(transaction.get("id") or transaction.get("transactionId") or f"{season}-{len(items)}"),
        "season": season,
        "date": transaction_date(transaction),
        "status": transaction.get("status") or transaction.get("executionType") or "EXECUTED",
        "teams": team_sides,
    }


def season_payload(league_id: int, season: int) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    try:
        league = fetch_json(league_url(league_id, season))
    except urllib.error.HTTPError as exc:
        if exc.code in {401, 403}:
            return None, {"season": season, "reason": "ESPN blocked historical transactions for this season."}
        if exc.code == 404:
            return None, {"season": season, "reason": "No ESPN league history found for this season."}
        return None, {"season": season, "reason": f"ESPN returned HTTP {exc.code}."}
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        return None, {"season": season, "reason": str(exc)}

    members = {item.get("id"): item.get("displayName", "") for item in league.get("members", [])}
    teams: dict[int, dict[str, Any]] = {}
    for team in league.get("teams", []):
        team_id = int(team.get("id") or 0)
        owner = team.get("primaryOwner")
        teams[team_id] = {
            "teamId": team_id,
            "teamName": team_name(team, members),
            "manager": members.get(owner, ""),
            "abbrev": team.get("abbrev", ""),
        }

    players = load_players(season)
    trades = [
        trade
        for trade in (
            normalize_trade(transaction, season, teams, players)
            for transaction in league.get("transactions") or []
            if is_completed_trade(transaction)
        )
        if trade
    ]
    settings = league.get("settings") or {}
    return (
        {
            "season": season,
            "leagueName": settings.get("name") or league.get("name") or "ESPN Fantasy League",
            "teams": list(teams.values()),
            "trades": trades,
            "transactionCount": len(league.get("transactions") or []),
        },
        None,
    )


def most_common_label(counter: Counter[str], fallback: str = "None yet") -> str:
    return counter.most_common(1)[0][0] if counter else fallback


def pattern_for_team(team: dict[str, Any], trades: list[dict[str, Any]]) -> dict[str, Any]:
    team_id = int(team["teamId"])
    team_trades = []
    sent_positions: Counter[str] = Counter()
    received_positions: Counter[str] = Counter()
    partners: Counter[str] = Counter()
    sent_count = 0
    received_count = 0
    largest_trade = 0
    multi_player_trades = 0

    for trade in trades:
        side = next((item for item in trade["teams"] if int(item["teamId"]) == team_id), None)
        if not side:
            continue
        sent = side.get("sent") or []
        received = side.get("received") or []
        sent_count += len(sent)
        received_count += len(received)
        largest_trade = max(largest_trade, len(sent), len(received))
        if len(sent) + len(received) >= 4:
            multi_player_trades += 1
        for player in sent:
            if player.get("pos"):
                sent_positions[player["pos"]] += 1
        for player in received:
            if player.get("pos"):
                received_positions[player["pos"]] += 1
        for partner in side.get("partners") or []:
            partners[partner.get("teamName") or f"Team {partner.get('teamId')}"] += 1
        team_trades.append(
            {
                "id": trade["id"],
                "season": trade["season"],
                "date": trade.get("date"),
                "sent": sent,
                "received": received,
                "partners": side.get("partners") or [],
            }
        )

    trade_count = len(team_trades)
    if sent_count >= received_count + 3:
        style = "Consolidator"
        style_detail = "This team tends to send more pieces than it receives, usually trying to turn depth into stronger starters."
    elif received_count >= sent_count + 3:
        style = "Depth collector"
        style_detail = "This team tends to receive more pieces than it sends, usually adding depth or spreading risk."
    elif trade_count:
        style = "Balanced swapper"
        style_detail = "This team usually keeps player counts balanced, making cleaner need-for-need trades."
    else:
        style = "No exposed trade history"
        style_detail = "ESPN has not exposed completed trades for this team in the checked seasons."

    if trade_count >= 6:
        frequency = "Aggressive trader"
    elif trade_count >= 3:
        frequency = "Active trader"
    elif trade_count >= 1:
        frequency = "Selective trader"
    else:
        frequency = "No trade sample"

    buys = most_common_label(received_positions)
    sells = most_common_label(sent_positions)
    partner = most_common_label(partners, "No repeated partner")
    insights = []
    recommendations = []
    if trade_count:
        insights.append(f"{frequency}: {trade_count} completed trade(s) found in exposed ESPN history.")
        insights.append(f"Style read: {style}. {style_detail}")
        insights.append(f"Position tendency: most often receives {buys} and sends {sells}.")
        insights.append(f"Common counterparty: {partner}.")
        if multi_player_trades:
            insights.append(f"Bundle tendency: {multi_player_trades} multi-player trade(s), largest side had {largest_trade} asset(s).")
        if style == "Consolidator":
            recommendations.append("When negotiating with this team, offer quality upgrades for their bench depth.")
            recommendations.append("For this team, double-check that 2-for-1 deals do not create a weak starter slot.")
        elif style == "Depth collector":
            recommendations.append("When negotiating with this team, use depth and injury coverage as the hook.")
            recommendations.append("For this team, avoid watering down elite starters just to add bodies.")
        else:
            recommendations.append("Need-for-need offers should land better than oversized bundles.")
            recommendations.append("Use the Trade Calculator to check value before accepting balanced swaps.")
    else:
        insights.append("No completed trades were exposed by ESPN for this team in the checked seasons.")
        recommendations.append("Once trades appear, FantasyIQ will build position, partner, and bundle tendencies automatically.")

    return {
        "teamId": team_id,
        "teamName": team["teamName"],
        "tradeCount": trade_count,
        "sentCount": sent_count,
        "receivedCount": received_count,
        "style": style,
        "frequency": frequency,
        "mostReceivedPosition": buys,
        "mostSentPosition": sells,
        "mostCommonPartner": partner,
        "insights": insights,
        "recommendations": recommendations,
        "trades": sorted(team_trades, key=lambda item: (item.get("season") or 0, item.get("date") or ""), reverse=True),
    }


def build_payload(seasons: list[int], force: bool = False) -> dict[str, Any]:
    league_id, current_season = require_config()
    cache_key = f"{league_id}:{','.join(str(season) for season in seasons)}"
    now = time.time()
    if not force and _history_cache["key"] == cache_key and _history_cache["data"] and now - _history_cache["ts"] < CACHE_TTL_SECONDS:
        return _history_cache["data"]

    checked = []
    unavailable = []
    trades = []
    teams_by_id: dict[int, dict[str, Any]] = {}
    league_name = "ESPN Fantasy League"

    for season in seasons:
        payload, error = season_payload(league_id, season)
        checked.append(season)
        if error:
            unavailable.append(error)
            continue
        if not payload:
            continue
        league_name = payload.get("leagueName") or league_name
        for team in payload.get("teams") or []:
            teams_by_id[int(team["teamId"])] = team
        trades.extend(payload.get("trades") or [])

    teams = sorted(teams_by_id.values(), key=lambda item: int(item["teamId"]))
    team_patterns = {str(team["teamId"]): pattern_for_team(team, trades) for team in teams}
    response = {
        "ok": True,
        "source": "ESPN public league API",
        "leagueId": league_id,
        "season": current_season,
        "demoMode": DEMO_MODE,
        "leagueName": league_name,
        "syncedAt": utc_now(),
        "seasonsChecked": checked,
        "unavailableSeasons": unavailable,
        "teams": teams,
        "trades": sorted(trades, key=lambda item: (item.get("season") or 0, item.get("date") or ""), reverse=True),
        "teamPatterns": team_patterns,
    }
    _history_cache["key"] = cache_key
    _history_cache["data"] = response
    _history_cache["ts"] = now
    return response


def requested_seasons(query: str) -> tuple[list[int], bool]:
    _, current_season = require_config()
    params = parse_qs(query)
    force = "force" in params or "force=1" in query
    seasons_param = params.get("seasons", [""])[0]
    if seasons_param:
        seasons = []
        for raw in seasons_param.split(","):
            try:
                seasons.append(int(raw.strip()))
            except ValueError:
                continue
        if seasons:
            return sorted(set(seasons), reverse=True), force
    lookback = DEFAULT_LOOKBACK_YEARS
    try:
        lookback = max(1, min(10, int(params.get("lookback", [DEFAULT_LOOKBACK_YEARS])[0])))
    except (TypeError, ValueError):
        lookback = DEFAULT_LOOKBACK_YEARS
    return list(range(current_season, current_season - lookback, -1)), force


def error_payload(message: str) -> dict[str, Any]:
    return {
        "ok": False,
        "source": "ESPN public league API",
        "leagueId": LEAGUE_ID,
        "season": SEASON,
        "demoMode": DEMO_MODE,
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
        try:
            seasons, force = requested_seasons(parsed.query)
            self.send_json(build_payload(seasons, force=force))
        except ConfigError as exc:
            self.send_json(error_payload(str(exc)), HTTPStatus.SERVICE_UNAVAILABLE)
        except Exception as exc:
            self.send_json(error_payload(str(exc)), HTTPStatus.BAD_GATEWAY)

    def do_HEAD(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
