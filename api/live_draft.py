from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from dataclasses import replace
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from typing import Any
from urllib.parse import parse_qs, urlparse

try:
    from customer_context import ConfigError, CustomerContext, authorize_customer_context, require_customer_config, resolve_customer_context
    from rate_limit import check_rate_limit, rate_limit_payload
except ModuleNotFoundError:
    from api.customer_context import ConfigError, CustomerContext, authorize_customer_context, require_customer_config, resolve_customer_context
    from api.rate_limit import check_rate_limit, rate_limit_payload


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

ESPN_LINEUP_SLOT_MAP = {
    0: "QB",
    2: "RB",
    3: "FLEX",
    4: "WR",
    5: "FLEX",
    6: "TE",
    7: "SUPERFLEX",
    16: "DST",
    17: "K",
    20: "BE",
    21: "IR",
    23: "FLEX",
}

DEFAULT_LINEUP_SLOTS = {
    "QB": 1,
    "RB": 2,
    "WR": 2,
    "TE": 1,
    "FLEX": 1,
    "SUPERFLEX": 0,
    "DST": 1,
    "K": 1,
    "BE": 7,
    "IR": 1,
}

_live_cache: dict[str, dict[str, Any]] = {}
_player_cache: dict[int, dict[int, dict[str, Any]]] = {}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def league_url(context: CustomerContext, cache_bust: bool = False) -> str:
    league_id, season = require_customer_config(context)
    url = (
        "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/"
        f"seasons/{season}/segments/0/leagues/{league_id}"
        "?view=mDraftDetail&view=mRoster&view=mSettings&view=mTeam"
    )
    if cache_bust:
        url = f"{url}&_={int(time.time() * 1000)}"
    return url


def override_customer_context(context: CustomerContext, request_path: str = "") -> CustomerContext:
    parsed = urlparse(request_path)
    params = parse_qs(parsed.query)
    raw_league_id = (
        params.get("draftLeagueId", [""])[0]
        or params.get("liveLeagueId", [""])[0]
        or params.get("leagueId", [""])[0]
    )
    if not raw_league_id:
        return context
    league_id = int_setting(raw_league_id, 0)
    if league_id <= 0:
        raise ConfigError("Live draft leagueId must be a number.")
    raw_team_id = (
        params.get("draftTeamId", [""])[0]
        or params.get("liveTeamId", [""])[0]
        or params.get("teamId", [""])[0]
    )
    raw_season = params.get("draftSeason", [""])[0] or params.get("season", [""])[0]
    return replace(
        context,
        league_id=league_id,
        season=int_setting(raw_season, context.season) or context.season,
        customer_team_id=int_setting(raw_team_id, 0) or context.customer_team_id,
        league_key=f"live-draft-{league_id}",
        league_name="Live Draft Override",
        demo_mode=False,
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
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
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
        "pos": POSITION_BY_ID.get(int_setting(player.get("defaultPositionId"), -1), ""),
        "proTeam": PRO_TEAM_BY_ID.get(int_setting(player.get("proTeamId"), -1), ""),
    }


def normalize_roster_entry(entry: dict[str, Any], players: dict[int, dict[str, Any]]) -> dict[str, Any]:
    pool_entry = entry.get("playerPoolEntry") or {}
    player = pool_entry.get("player") or {}
    player_id = int_setting(
        player.get("id")
        or pool_entry.get("id")
        or entry.get("playerId"),
        -1,
    )
    info = player_info(player_id, players) if player_id > 0 else {}
    default_position_id = int_setting(player.get("defaultPositionId"), -1)
    pro_team_id = int_setting(player.get("proTeamId"), -1)
    lineup_slot_id = int_setting(entry.get("lineupSlotId"), -1)
    return {
        "playerId": player_id,
        "player": player.get("fullName") or info.get("player"),
        "pos": POSITION_BY_ID.get(default_position_id, "") or info.get("pos", ""),
        "proTeam": PRO_TEAM_BY_ID.get(pro_team_id, "") or info.get("proTeam", ""),
        "lineupSlotId": lineup_slot_id,
        "lineupSlot": ESPN_LINEUP_SLOT_MAP.get(lineup_slot_id, ""),
        "injuryStatus": player.get("injuryStatus") or pool_entry.get("injuryStatus") or "",
        "acquisitionType": entry.get("acquisitionType") or "",
        "status": pool_entry.get("status") or "",
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


def int_setting(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def float_setting(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def normalized_player_key(name: Any) -> str:
    return "".join(char.lower() for char in str(name or "") if char.isalnum())


def player_identity_key(player: dict[str, Any]) -> str:
    player_id = int_setting(player.get("playerId"), -1)
    if player_id > 0:
        return f"id:{player_id}"
    return f"name:{normalized_player_key(player.get('player'))}"


def unique_roster_players(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for entry in entries:
        if not entry.get("player"):
            continue
        key = player_identity_key(entry)
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(entry)
    return unique


def roster_entry_priority(entry: dict[str, Any]) -> tuple[int]:
    acquisition = str(entry.get("acquisitionType") or "").upper()
    draft_priority = 0 if "DRAFT" in acquisition else 1
    return (draft_priority,)


def overlay_roster_draft_picks(picks: list[dict[str, Any]], teams: dict[int, dict[str, Any]]) -> int:
    """Fill missing draftDetail player data from ESPN roster entries when ESPN lags live picks."""
    used_player_keys = {
        player_identity_key(pick)
        for pick in picks
        if pick.get("status") == "drafted" and player_identity_key(pick) != "name:"
    }
    applied = 0
    for team_id, team in teams.items():
        team_picks = sorted(
            [pick for pick in picks if int_setting(pick.get("teamId"), -1) == team_id],
            key=lambda item: int_setting(item.get("overall"), 9999),
        )
        if not team_picks:
            continue
        roster_entries = sorted(
            unique_roster_players(team.get("roster") or []),
            key=roster_entry_priority,
        )
        if not roster_entries:
            continue

        roster_index = 0
        for pick in team_picks:
            if pick.get("status") == "drafted":
                continue
            while roster_index < len(roster_entries):
                entry = roster_entries[roster_index]
                roster_index += 1
                entry_key = player_identity_key(entry)
                if entry_key in used_player_keys:
                    continue
                pick.update(
                    {
                        "playerId": int_setting(entry.get("playerId"), -1),
                        "player": entry.get("player"),
                        "pos": entry.get("pos", ""),
                        "proTeam": entry.get("proTeam", ""),
                        "status": "drafted",
                        "syncSource": "rosterFallback",
                    }
                )
                used_player_keys.add(entry_key)
                applied += 1
                break
            if roster_index >= len(roster_entries):
                break
    return applied


def scoring_item_points(settings: dict[str, Any], stat_ids: set[int], labels: tuple[str, ...]) -> float | None:
    scoring_settings = settings.get("scoringSettings") or {}
    for item in scoring_settings.get("scoringItems") or []:
        stat_id = int_setting(item.get("statId"), -1)
        item_label = " ".join(
            str(item.get(name) or "") for name in ("abbr", "label", "displayName", "statName")
        ).lower()
        if stat_id in stat_ids or any(label in item_label for label in labels):
            return float_setting(item.get("points"), 0.0)
    return None


def scoring_items_from_settings(settings: dict[str, Any]) -> list[dict[str, float | int]]:
    scoring_settings = settings.get("scoringSettings") or {}
    items: list[dict[str, float | int]] = []
    for item in scoring_settings.get("scoringItems") or []:
        stat_id = int_setting(item.get("statId"), -1)
        if stat_id < 0:
            continue
        items.append({"statId": stat_id, "points": float_setting(item.get("points"), 0.0)})
    return items


def scoring_type_from_settings(settings: dict[str, Any]) -> tuple[str, str, float | None]:
    reception_points = scoring_item_points(settings, {53}, ("reception", "receptions"))
    if reception_points is None:
        return "ppr", "Full PPR", None
    if reception_points >= 0.95:
        return "ppr", "Full PPR", reception_points
    if reception_points >= 0.45:
        return "half-ppr", "Half PPR", reception_points
    if reception_points <= 0.05:
        return "standard", "Standard", reception_points
    return "custom", f"{reception_points:g} PPR", reception_points


def lineup_slots_from_settings(settings: dict[str, Any]) -> dict[str, int]:
    raw_counts = (settings.get("rosterSettings") or {}).get("lineupSlotCounts") or {}
    slots = {key: 0 for key in DEFAULT_LINEUP_SLOTS}
    if not raw_counts:
        return DEFAULT_LINEUP_SLOTS.copy()

    for raw_slot, raw_count in raw_counts.items():
        slot_name = ESPN_LINEUP_SLOT_MAP.get(int_setting(raw_slot, -1))
        if not slot_name:
            continue
        slots[slot_name] = slots.get(slot_name, 0) + int_setting(raw_count)
    return slots


def playoff_team_count(settings: dict[str, Any]) -> int:
    schedule_settings = settings.get("scheduleSettings") or {}
    return int_setting(
        schedule_settings.get("playoffTeamCount")
        or schedule_settings.get("numPlayoffTeams")
        or settings.get("playoffTeamCount"),
        6,
    )


def merge_league_settings(base: dict[str, Any], override: dict[str, Any] | None) -> dict[str, Any]:
    if not override:
        return base
    merged = {**base, **override}
    if isinstance(base.get("lineupSlots"), dict) or isinstance(override.get("lineupSlots"), dict):
        merged["lineupSlots"] = {
            **(base.get("lineupSlots") or {}),
            **(override.get("lineupSlots") or {}),
        }
    return merged


def extract_league_settings(
    settings: dict[str, Any],
    team_count: int,
    raw_picks: list[dict[str, Any]],
    context: CustomerContext,
) -> dict[str, Any]:
    scoring_type, scoring_label, reception_points = scoring_type_from_settings(settings)
    lineup_slots = lineup_slots_from_settings(settings)
    draft_rounds = max(
        [int_setting(pick.get("roundId"), 0) for pick in raw_picks] or
        [sum(count for key, count in lineup_slots.items() if key != "IR")],
    )
    extracted = {
        "teamCount": team_count or int_setting(settings.get("size"), 12) or 12,
        "scoringType": scoring_type,
        "scoringLabel": scoring_label,
        "receptionPoints": reception_points,
        "scoringItems": scoring_items_from_settings(settings),
        "lineupSlots": lineup_slots,
        "draftRounds": draft_rounds or 16,
        "playoffTeams": playoff_team_count(settings),
        "source": "ESPN league settings",
    }
    return merge_league_settings(extracted, context.league_settings)


def build_live_payload(request_path: str = "", headers: Any | None = None, force: bool = False) -> dict[str, Any]:
    authorized_context = authorize_customer_context(request_path, headers)
    context = override_customer_context(authorized_context, request_path)
    now = time.time()
    cached = _live_cache.get(context.cache_key)
    if not force and cached and cached.get("data") and now - float(cached.get("ts") or 0) < 5:
        return cached["data"]

    league_id, season = require_customer_config(context)
    league = fetch_json(league_url(context, cache_bust=force))
    players = load_players(context, force=force)
    members = {item.get("id"): item.get("displayName", "") for item in league.get("members", [])}
    teams: dict[int, dict[str, Any]] = {}
    for team in league.get("teams", []):
        team_id = int(team.get("id") or 0)
        owner = team.get("primaryOwner")
        roster_entries = [
            normalized
            for normalized in (
                normalize_roster_entry(entry, players)
                for entry in ((team.get("roster") or {}).get("entries") or [])
            )
            if normalized.get("player")
        ]
        teams[team_id] = {
            "teamId": team_id,
            "teamName": team_name(team, members),
            "manager": members.get(owner, ""),
            "abbrev": team.get("abbrev", ""),
            "roster": roster_entries,
        }

    draft_detail = league.get("draftDetail") or {}
    settings = league.get("settings") or {}
    raw_picks = sorted(
        draft_detail.get("picks", []),
        key=lambda item: int(item.get("overallPickNumber") or item.get("id") or 9999),
    )
    picks = [normalize_pick(pick, teams, players) for pick in raw_picks]
    draft_detail_completed = sum(1 for pick in picks if pick["status"] == "drafted")
    roster_overlay_count = overlay_roster_draft_picks(picks, teams)
    completed = [pick for pick in picks if pick["status"] == "drafted"]
    pending = [pick for pick in picks if pick["status"] != "drafted"]
    draft_order = [pick for pick in picks if pick.get("round") == 1]
    league_settings = extract_league_settings(settings, len(teams), raw_picks, context)
    rostered_players = [
        roster_player
        for team in teams.values()
        for roster_player in team.get("roster", [])
        if roster_player.get("player")
    ]
    fallback_states: list[str] = []
    draft_sync_mode = "draftDetail"
    if roster_overlay_count:
        draft_sync_mode = "rosterFallback"
        fallback_states.append(
            "ESPN draftDetail did not include every drafted player; roster entries were used to keep drafted-player filtering current."
        )
    elif not draft_detail_completed and not rostered_players and raw_picks:
        league_status = league.get("status") or {}
        joined = int_setting(league_status.get("teamsJoined"), 0)
        expected = len(teams) or int_setting(settings.get("size"), 0)
        joined_note = f" ESPN reports {joined}/{expected} teams joined." if joined and expected else ""
        fallback_states.append(
            f"ESPN is publishing draft order for league {league_id} but no completed picks yet.{joined_note} Confirm this is the same ESPN league that is currently drafting."
        )
    drafted = bool(draft_detail.get("drafted")) or (bool(picks) and len(completed) >= len(picks))
    in_progress = bool(draft_detail.get("inProgress")) or (0 < len(completed) < len(picks))

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
        "leagueSettings": league_settings,
        "syncedAt": utc_now(),
        "drafted": drafted,
        "inProgress": in_progress,
        "draftSyncMode": draft_sync_mode,
        "draftDetailCompletedPicks": draft_detail_completed,
        "rosterFallbackPicks": roster_overlay_count,
        "fallbackStates": fallback_states,
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
        "rosteredPlayerIds": [player["playerId"] for player in rostered_players if player.get("playerId")],
        "rosteredNames": [player["player"] for player in rostered_players if player.get("player")],
    }
    _live_cache[context.cache_key] = {"data": payload, "ts": now}
    return payload


def error_payload(message: str, request_path: str = "", include_fallback: bool = False) -> dict[str, Any]:
    try:
        context = resolve_customer_context(request_path)
    except ConfigError:
        context = None
    fallback = None
    if include_fallback and context:
        cached = _live_cache.get(context.cache_key) or {}
        fallback = cached.get("data")
    return {
        "ok": False,
        "source": "ESPN public league API",
        "leagueId": context.league_id if context else None,
        "season": context.season if context else None,
        "demoMode": context.demo_mode if context else False,
        "syncedAt": utc_now(),
        "error": message,
        "fallback": fallback,
    }


def log_live_sync_error(event_type: str, message: str, request_path: str = "") -> None:
    try:
        context = resolve_customer_context(request_path)
        customer_slug = context.slug
        league_key = getattr(context, "league_key", "") or ""
    except Exception:
        customer_slug = ""
        league_key = ""
    try:
        try:
            from database import record_ops_event
        except ImportError:
            from api.database import record_ops_event
        record_ops_event(
            event_type=event_type,
            severity="warning",
            source="live_draft",
            customer_slug=customer_slug,
            league_key=league_key,
            message=message[:500],
            payload={},
        )
    except Exception:
        return


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
        params = {key: values[0] if values else "" for key, values in parse_qs(parsed.query).items()}
        try:
            limit = check_rate_limit(
                "live_draft",
                headers=self.headers,
                raw=params,
                fields=("customer", "dashboard", "league"),
                limit=80,
                window_seconds=60,
            )
            if not limit.allowed:
                log_live_sync_error("live_draft.rate_limited", "Too many live draft sync requests.", self.path)
                payload = rate_limit_payload(limit, "Live sync is receiving too many requests. Wait a moment, then try again.")
                payload["syncedAt"] = utc_now()
                self.send_json(payload, HTTPStatus.TOO_MANY_REQUESTS)
                return
            self.send_json(build_live_payload(self.path, self.headers, force=force))
        except PermissionError as exc:
            log_live_sync_error("live_draft.unauthorized", str(exc), self.path)
            self.send_json(error_payload(str(exc), self.path), HTTPStatus.UNAUTHORIZED)
        except ConfigError as exc:
            log_live_sync_error("live_draft.config_error", str(exc), self.path)
            self.send_json(error_payload(str(exc), self.path), HTTPStatus.SERVICE_UNAVAILABLE)
        except EspnSyncError as exc:
            log_live_sync_error("live_draft.espn_error", str(exc), self.path)
            self.send_json(error_payload(str(exc), self.path, include_fallback=True), HTTPStatus.BAD_GATEWAY)
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
            log_live_sync_error("live_draft.sync_error", str(exc), self.path)
            self.send_json(error_payload(str(exc), self.path, include_fallback=True), HTTPStatus.BAD_GATEWAY)

    def do_HEAD(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
