from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from typing import Any
from urllib.parse import parse_qs, urlparse

try:
    from customer_context import DEFAULT_SEASON, ConfigError, int_value
except ModuleNotFoundError:
    from api.customer_context import DEFAULT_SEASON, ConfigError, int_value


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def clean_digits(value: Any) -> str:
    return "".join(char for char in str(value or "") if char.isdigit())


def league_url(league_id: int, season: int) -> str:
    return (
        "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/"
        f"seasons/{season}/segments/0/leagues/{league_id}"
        "?view=mSettings&view=mTeam&view=mDraftDetail"
    )


def fetch_json(url: str) -> Any:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "FantasyIQ/1.0 (customer setup validation)",
        },
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return json.loads(response.read().decode(charset))


def team_name(team: dict[str, Any], members: dict[str, str]) -> str:
    if team.get("name"):
        return str(team["name"])
    combined = f"{team.get('location') or ''} {team.get('nickname') or ''}".strip()
    if combined:
        return combined
    owner = team.get("primaryOwner")
    if owner and owner in members:
        return members[owner]
    return f"Team {team.get('id', '?')}"


def validate_setup(raw: dict[str, Any]) -> tuple[dict[str, Any], HTTPStatus]:
    league_id = int_value(clean_digits(raw.get("leagueId") or raw.get("league_id")), "leagueId")
    team_id = int_value(clean_digits(raw.get("teamId") or raw.get("team_id")), "teamId")
    season = int_value(clean_digits(raw.get("season")), "season", DEFAULT_SEASON) or DEFAULT_SEASON

    if not league_id:
        raise ConfigError("Enter the ESPN league ID.")
    if not team_id:
        raise ConfigError("Enter the ESPN team ID.")
    if season < 2018 or season > 2035:
        raise ConfigError("Enter a valid ESPN season.")

    try:
        league = fetch_json(league_url(league_id, season))
    except urllib.error.HTTPError as exc:
        if exc.code in {401, 403}:
            return (
                {
                    "ok": False,
                    "status": "private_or_blocked",
                    "message": "ESPN blocked this league. Confirm the league is public or send setup details for concierge help.",
                    "leagueId": league_id,
                    "teamId": team_id,
                    "season": season,
                    "syncedAt": utc_now(),
                },
                HTTPStatus.OK,
            )
        if exc.code == 404:
            return (
                {
                    "ok": False,
                    "status": "league_not_found",
                    "message": "ESPN could not find that league for the selected season.",
                    "leagueId": league_id,
                    "teamId": team_id,
                    "season": season,
                    "syncedAt": utc_now(),
                },
                HTTPStatus.OK,
            )
        raise

    settings = league.get("settings") or {}
    members = {item.get("id"): item.get("displayName", "") for item in league.get("members", [])}
    teams = []
    for team in league.get("teams") or []:
        current_team_id = int(team.get("id") or 0)
        owner = team.get("primaryOwner")
        teams.append(
            {
                "teamId": current_team_id,
                "teamName": team_name(team, members),
                "manager": members.get(owner, ""),
                "abbrev": team.get("abbrev", ""),
            }
        )

    match = next((team for team in teams if int(team["teamId"]) == int(team_id)), None)
    draft_detail = league.get("draftDetail") or {}
    payload = {
        "ok": bool(match),
        "status": "ready" if match else "team_not_found",
        "message": "League and team are ready for FantasyIQ." if match else "League found, but that team ID was not in this league.",
        "leagueId": league_id,
        "teamId": team_id,
        "season": season,
        "leagueName": settings.get("name") or league.get("name") or "ESPN Fantasy League",
        "teamName": match.get("teamName") if match else "",
        "manager": match.get("manager") if match else "",
        "teamCount": len(teams),
        "teams": teams,
        "drafted": bool(draft_detail.get("drafted")),
        "inProgress": bool(draft_detail.get("inProgress")),
        "syncedAt": utc_now(),
    }
    return payload, HTTPStatus.OK


def parse_body(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    length = int(handler.headers.get("Content-Length") or 0)
    if length <= 0:
        return {}
    raw = handler.rfile.read(length)
    content_type = handler.headers.get("Content-Type", "")
    if "application/json" in content_type:
        return json.loads(raw.decode("utf-8") or "{}")
    parsed = urllib.parse.parse_qs(raw.decode("utf-8"))
    return {key: values[0] if values else "" for key, values in parsed.items()}


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
        params = parse_qs(urlparse(self.path).query)
        raw = {key: values[0] if values else "" for key, values in params.items()}
        try:
            payload, status = validate_setup(raw)
            self.send_json(payload, status)
        except ConfigError as exc:
            self.send_json({"ok": False, "status": "invalid_input", "message": str(exc), "syncedAt": utc_now()}, HTTPStatus.BAD_REQUEST)
        except Exception as exc:
            self.send_json({"ok": False, "status": "validation_error", "message": str(exc), "syncedAt": utc_now()}, HTTPStatus.BAD_GATEWAY)

    def do_POST(self) -> None:
        try:
            payload, status = validate_setup(parse_body(self))
            self.send_json(payload, status)
        except (ConfigError, json.JSONDecodeError) as exc:
            self.send_json({"ok": False, "status": "invalid_input", "message": str(exc), "syncedAt": utc_now()}, HTTPStatus.BAD_REQUEST)
        except Exception as exc:
            self.send_json({"ok": False, "status": "validation_error", "message": str(exc), "syncedAt": utc_now()}, HTTPStatus.BAD_GATEWAY)

    def do_HEAD(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
