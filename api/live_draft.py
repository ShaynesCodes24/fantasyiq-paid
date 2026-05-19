from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from typing import Any
from urllib.parse import urlparse

try:
    from customer_context import ConfigError, CustomerContext, require_customer_config, resolve_customer_context
except ModuleNotFoundError:
    from api.customer_context import ConfigError, CustomerContext, require_customer_config, resolve_customer_context


class EspnSyncError(RuntimeError):
    pass


PLAYERS_FILTER = json.dumps(
    {
        "players": {
            "limit": 2500,
            "sortPercOwned": {"sortPriority": 1, "sortAsc": False},
        }
    }
)

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

_live_cache: dict[str, dict[str, Any]] = {}
_player_cache: dict[int, dict[int, dict[str, Any]]] = {}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def league_url(context: CustomerContext) -> str:
    league_id, season = require_customer_config(context)
    return (
        "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/"
        f"seasons/{season}/segments/0/leagues/{league_id}"
        "?view=mDraftDetail&view=mSettings&view=mTeam"
    )


def players_url(context: CustomerContext) -> str:
    _, season = require_customer_config(context)
    return (
        "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/"
        f"seasons/{season}/players?view=players_wl"
    )


def sync_error_from_http(exc: urllib.error.HTTPError) -> EspnSyncError:
    if exc.code in {401, 403}:
        return EspnSyncError(
            "ESPN rejected the league request. Confirm the league is public and the league ID/season are correct."
        )
    if exc.code == 404:
        return EspnSyncError("ESPN could not find this league. Confirm the league ID and season.")
    return EspnSyncError(f"ESPN returned HTTP {exc.code}. Try again shortly.")


def fetch_json(url: str, extra_headers: dict[str, str] | None = None) -> Any:
    headers = {
        "Accept": "application/json",
        "User-Agent": "Fantasy-IQ/1.0 (customer draft dashboard)",
    }
    if extra_headers:
        headers.update(extra_headers)
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            return json.loads(response.read().decode(charset))
    except urllib.error.HTTPError as exc:
        raise sync_error_from_http(exc) from exc


def load_players(context: CustomerContext, force: bool = False) -> dict[int, dict[str, Any]]:
    _, season = require_customer_config(context)
    if season in _player_cache and not force:
        return _player_cache[season]
    players = fetch_json(players_url(context), {"x-fantasy-filter": PLAYERS_FILTER})
    _player_cache[season] = {int(item["id"]): item for item in players if "id" in item}
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
        "player": player.get("fullName"),
        "pos": POSITION_BY_ID.get(player.get("defaultPositionId"), ""),
        "proTeam": PRO_TEAM_BY_ID.get(player.get("proTeamId"), ""),
    }


def normalize_pick(
    pick: dict[str, Any],
    teams: dict[int, dict[str, Any]],
    players: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    player_id = int(pick.get("playerId") or -1)
    info = player_info(player_id, players) if player_id > 0 else {}
    team_id = int(pick.get("teamId") or 0)
    fantasy_team = teams.get(team_id, {})
    return {
        "id": pick.get("id"),
        "overall": pick.get("overallPickNumber"),
        "round": pick.get("roundId"),
        "roundPick": pick.get("roundPickNumber"),
        "teamId": team_id,
        "fantasyTeam": fantasy_team.get("teamName") or f"Team {team_id}",
        "manager": fantasy_team.get("manager", ""),
        "playerId": player_id,
        "player": info.get("player"),
        "pos": info.get("pos", ""),
        "proTeam": info.get("proTeam", ""),
        "status": "drafted" if player_id > 0 else "pending",
    }


def build_live_payload(request_path: str = "", force: bool = False) -> dict[str, Any]:
    context = resolve_customer_context(request_path)
    now = time.time()
    cached = _live_cache.get(context.cache_key)
    if not force and cached and cached.get("data") and now - float(cached.get("ts") or 0) < 5:
        return cached["data"]

    league_id, season = require_customer_config(context)
    league = fetch_json(league_url(context))
    players = load_players(context, force=force)
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

    draft_detail = league.get("draftDetail") or {}
    settings = league.get("settings") or {}
    raw_picks = sorted(
        draft_detail.get("picks", []),
        key=lambda item: int(item.get("overallPickNumber") or item.get("id") or 9999),
    )
    picks = [normalize_pick(pick, teams, players) for pick in raw_picks]
    completed = [pick for pick in picks if pick["status"] == "drafted"]
    pending = [pick for pick in picks if pick["status"] != "drafted"]
    draft_order = [pick for pick in picks if pick.get("round") == 1]

    payload = {
        "ok": True,
        "source": "ESPN public league API",
        "customer": context.public_dict(),
        "customerSlug": context.slug,
        "customerTeamId": context.customer_team_id,
        "leagueId": league_id,
        "season": season,
        "demoMode": context.demo_mode,
        "leagueName": settings.get("name") or league.get("name") or context.league_name or "ESPN Fantasy League",
        "leagueLogo": settings.get("logoUrl") or settings.get("imageUrl") or league.get("logoUrl"),
        "syncedAt": utc_now(),
        "drafted": bool(draft_detail.get("drafted")),
        "inProgress": bool(draft_detail.get("inProgress")),
        "totalPicks": len(picks),
        "completedPicks": len(completed),
        "currentPick": pending[0] if pending else None,
        "nextPicks": pending[:12],
        "recentPicks": completed[-12:][::-1],
        "draftOrder": draft_order,
        "teams": list(teams.values()),
        "picks": picks,
        "draftedPlayerIds": [pick["playerId"] for pick in completed],
        "draftedNames": [pick["player"] for pick in completed if pick.get("player")],
    }
    _live_cache[context.cache_key] = {"data": payload, "ts": now}
    return payload


def error_payload(message: str, request_path: str = "") -> dict[str, Any]:
    try:
        context = resolve_customer_context(request_path)
    except ConfigError:
        context = None
    return {
        "ok": False,
        "source": "ESPN public league API",
        "leagueId": context.league_id if context else None,
        "season": context.season if context else None,
        "demoMode": context.demo_mode if context else False,
        "syncedAt": utc_now(),
        "error": message,
        "fallback": None,
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
        force = "force=1" in parsed.query
        try:
            self.send_json(build_live_payload(self.path, force=force))
        except ConfigError as exc:
            self.send_json(error_payload(str(exc), self.path), HTTPStatus.SERVICE_UNAVAILABLE)
        except EspnSyncError as exc:
            self.send_json(error_payload(str(exc), self.path), HTTPStatus.BAD_GATEWAY)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
            self.send_json(error_payload(str(exc), self.path), HTTPStatus.BAD_GATEWAY)

    def do_HEAD(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
