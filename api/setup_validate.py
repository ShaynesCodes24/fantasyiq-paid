from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from types import SimpleNamespace
from typing import Any
from urllib.parse import parse_qs, urlparse

try:
    from customer_context import (
        DEFAULT_SEASON,
        ConfigError,
        all_customer_contexts,
        database_customer_context,
        env,
        int_value,
        slugify,
        verify_customer_access,
    )
except ModuleNotFoundError:
    from api.customer_context import (
        DEFAULT_SEASON,
        ConfigError,
        all_customer_contexts,
        database_customer_context,
        env,
        int_value,
        slugify,
        verify_customer_access,
    )


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
    team_id = int_value(clean_digits(raw.get("teamId") or raw.get("team_id")), "teamId", 0) or 0
    season = int_value(clean_digits(raw.get("season")), "season", DEFAULT_SEASON) or DEFAULT_SEASON

    if not league_id:
        raise ConfigError("Enter the ESPN league ID.")
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

    match = next((team for team in teams if team_id and int(team["teamId"]) == int(team_id)), None)
    draft_detail = league.get("draftDetail") or {}
    league_settings = detected_league_settings(settings, len(teams), draft_detail)
    if team_id:
        status = "ready" if match else "team_not_found"
        message = "League and team are ready for FantasyIQ." if match else "League found, but that team ID was not in this league."
    else:
        status = "league_settings_ready"
        message = "League settings were found. Enter the ESPN team ID to finish validation."
    payload = {
        "ok": bool(match),
        "status": status,
        "message": message,
        "leagueId": league_id,
        "teamId": team_id or "",
        "season": season,
        "leagueName": settings.get("name") or league.get("name") or "ESPN Fantasy League",
        "teamName": match.get("teamName") if match else "",
        "manager": match.get("manager") if match else "",
        "teamCount": league_settings.get("teamCount") or len(teams),
        "leagueSettings": league_settings,
        "teams": teams,
        "drafted": bool(draft_detail.get("drafted")),
        "inProgress": bool(draft_detail.get("inProgress")),
        "syncedAt": utc_now(),
    }
    return payload, HTTPStatus.OK


def bool_value(value: Any) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "y", "on"}


def scoring_label(scoring_type: str) -> str:
    if scoring_type == "half-ppr":
        return "Half PPR"
    if scoring_type == "standard":
        return "Standard"
    if scoring_type == "custom":
        return "Custom"
    return "Full PPR"


def detected_league_settings(settings: dict[str, Any], team_count: int, draft_detail: dict[str, Any]) -> dict[str, Any]:
    try:
        try:
            from live_draft import extract_league_settings
        except ImportError:
            from api.live_draft import extract_league_settings

        context = SimpleNamespace(league_settings={})
        raw_picks = draft_detail.get("picks") or []
        extracted = extract_league_settings(settings, team_count, raw_picks, context)
        return extracted if isinstance(extracted, dict) else {}
    except Exception:
        return {
            "teamCount": team_count or int_value(settings.get("size"), "teamCount", 12) or 12,
            "scoringType": "ppr",
            "scoringLabel": "Full PPR",
            "lineupSlots": {
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
            },
            "draftRounds": 16,
            "playoffTeams": 6,
            "source": "Customer setup validator fallback",
        }


def setup_league_settings(raw: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    detected = payload.get("leagueSettings") if isinstance(payload.get("leagueSettings"), dict) else {}
    detected_slots = detected.get("lineupSlots") if isinstance(detected.get("lineupSlots"), dict) else {}
    use_form_settings = bool_value(raw.get("settingsOverride"))

    def parsed_int(value: Any, name: str, default: int) -> int:
        parsed = int_value(value, name, default)
        return default if parsed is None else parsed

    def raw_or_detected(raw_key: str, detected_key: str, default: int) -> int:
        if use_form_settings and raw.get(raw_key) not in (None, ""):
            return parsed_int(raw.get(raw_key), raw_key, default)
        return parsed_int(detected.get(detected_key), detected_key, default)

    def raw_or_detected_slot(raw_key: str, slot_key: str, default: int) -> int:
        if use_form_settings and raw.get(raw_key) not in (None, ""):
            return parsed_int(raw.get(raw_key), raw_key, default)
        return parsed_int(detected_slots.get(slot_key), slot_key, default)

    scoring_type = str(
        raw.get("scoringType") if use_form_settings else detected.get("scoringType") or raw.get("scoringType") or "ppr"
    ).strip().lower() or "ppr"
    if scoring_type in {"half", "halfppr", "0.5-ppr", "0.5ppr"}:
        scoring_type = "half-ppr"
    if scoring_type in {"std", "non-ppr", "nonppr"}:
        scoring_type = "standard"
    return {
        "teamCount": raw_or_detected("teamCount", "teamCount", payload.get("teamCount") or 12),
        "scoringType": scoring_type,
        "scoringLabel": detected.get("scoringLabel") if not use_form_settings and detected.get("scoringLabel") else scoring_label(scoring_type),
        "receptionPoints": detected.get("receptionPoints"),
        "scoringItems": detected.get("scoringItems") or [],
        "lineupSlots": {
            "QB": raw_or_detected_slot("qbCount", "QB", 1),
            "RB": raw_or_detected_slot("rbCount", "RB", 2),
            "WR": raw_or_detected_slot("wrCount", "WR", 2),
            "TE": raw_or_detected_slot("teCount", "TE", 1),
            "FLEX": raw_or_detected_slot("flexCount", "FLEX", 1),
            "SUPERFLEX": raw_or_detected_slot("superflexCount", "SUPERFLEX", 0),
            "DST": raw_or_detected_slot("dstCount", "DST", 1),
            "K": raw_or_detected_slot("kCount", "K", 1),
            "BE": raw_or_detected_slot("benchCount", "BE", 7),
            "IR": raw_or_detected_slot("irCount", "IR", 1),
        },
        "draftRounds": raw_or_detected("draftRounds", "draftRounds", 16),
        "playoffTeams": raw_or_detected("playoffTeams", "playoffTeams", 6),
        "source": "Customer setup override" if use_form_settings else detected.get("source") or "ESPN league settings",
    }


def known_customer_context(customer_slug: str) -> Any | None:
    if not customer_slug:
        return None
    database_context = database_customer_context(customer_slug)
    if database_context:
        return database_context
    return all_customer_contexts().get(customer_slug)


def authorized_setup_customer(raw: dict[str, Any], headers: Any | None) -> Any | None:
    customer_slug = slugify(str(raw.get("customer") or raw.get("customerSlug") or raw.get("dashboard") or ""))
    if not customer_slug:
        if bool_value(env("FANTASYIQ_ALLOW_PUBLIC_SETUP_SAVE")):
            return None
        return None

    context = known_customer_context(customer_slug)
    if not context:
        if bool_value(env("FANTASYIQ_ALLOW_PUBLIC_SETUP_SAVE")):
            return None
        raise PermissionError("Customer account was not found. Complete checkout before saving setup details.")

    verify_customer_access(context, "", headers)
    return context


def save_setup_if_requested(raw: dict[str, Any], payload: dict[str, Any], headers: Any | None) -> dict[str, Any]:
    if not bool_value(raw.get("save") or raw.get("persist")):
        return payload
    payload = dict(payload)
    try:
        try:
            from database import (
                DatabaseUnavailable,
                customer_slug_from_email,
                database_status,
                upsert_customer,
                upsert_league,
            )
        except ImportError:
            from api.database import (
                DatabaseUnavailable,
                customer_slug_from_email,
                database_status,
                upsert_customer,
                upsert_league,
            )

        status = database_status()
        payload["database"] = status
        if not payload.get("ok"):
            payload["saved"] = False
            payload["saveMessage"] = "League was not saved because ESPN validation did not pass."
            return payload
        if not status["enabled"]:
            payload["saved"] = False
            payload["saveMessage"] = "Database is not connected yet; setup packet is available for manual fulfillment."
            return payload

        context = authorized_setup_customer(raw, headers)
        email = str(raw.get("email") or getattr(context, "email", "") or "").strip().lower()
        if context is None and not bool_value(env("FANTASYIQ_ALLOW_PUBLIC_SETUP_SAVE")):
            payload["saved"] = False
            payload["saveMessage"] = "Validated only. Sign in from a customer dashboard to save this league profile."
            return payload
        customer_slug = slugify(
            str(
                raw.get("customer")
                or raw.get("customerSlug")
                or raw.get("dashboard")
                or getattr(context, "slug", "")
                or customer_slug_from_email(email)
                or payload.get("manager")
                or payload.get("teamName")
            )
        )
        customer_name = str(raw.get("customerName") or raw.get("name") or getattr(context, "customer_name", "") or payload.get("manager") or "").strip()
        existing_access_code = str(raw.get("accessCode") or getattr(context, "access_code", "") or "").strip()
        saved_customer = upsert_customer(
            slug=customer_slug,
            customer_name=customer_name,
            email=email,
            access_code=existing_access_code,
            status="configured",
            included_league_limit=int_value(raw.get("includedLeagueLimit"), "includedLeagueLimit", 3) or 3,
        )

        label = str(raw.get("leagueLabel") or payload.get("leagueName") or "ESPN league").strip()
        league_key = slugify(str(raw.get("leagueKey") or label))
        saved_league = upsert_league(
            customer_slug=saved_customer.get("slug") or customer_slug,
            league_key=league_key,
            label=label,
            league_name=str(payload.get("leagueName") or label),
            league_id=payload.get("leagueId"),
            team_id=payload.get("teamId"),
            team_name=str(payload.get("teamName") or ""),
            season=payload.get("season"),
            league_settings=setup_league_settings(raw, payload),
            status="configured",
            source="setup_validator",
        )
        payload["saved"] = True
        payload["saveMessage"] = "League profile saved to the customer account."
        payload["customerSlug"] = saved_customer.get("slug") or customer_slug
        payload["leagueKey"] = saved_league.get("league_key") or league_key
        try:
            from database import record_ops_event
        except ImportError:
            from api.database import record_ops_event
        record_ops_event(
            event_type="setup.saved",
            severity="info",
            source="setup_validate",
            customer_slug=payload["customerSlug"],
            league_key=payload["leagueKey"],
            message="Customer league profile saved.",
            payload={"leagueId": payload.get("leagueId"), "teamId": payload.get("teamId"), "season": payload.get("season")},
        )
    except DatabaseUnavailable as exc:
        payload["saved"] = False
        payload["saveMessage"] = str(exc)
        log_setup_error("setup.save_unavailable", str(exc), "")
    except Exception:
        payload["saved"] = False
        payload["saveMessage"] = "Database save failed. Ask support to confirm the database schema is installed."
        log_setup_error("setup.save_failed", "Database save failed.", "")
    return payload


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


def log_setup_error(event_type: str, message: str, request_path: str = "") -> None:
    try:
        params = parse_qs(urlparse(request_path).query)
        customer = slugify(str((params.get("customer") or params.get("dashboard") or [""])[0] or ""))
        try:
            from database import record_ops_event
        except ImportError:
            from api.database import record_ops_event
        record_ops_event(
            event_type=event_type,
            severity="warning",
            source="setup_validate",
            customer_slug=customer,
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
            raw = parse_body(self)
            payload, status = validate_setup(raw)
            payload = save_setup_if_requested(raw, payload, self.headers)
            self.send_json(payload, status)
        except (ConfigError, json.JSONDecodeError) as exc:
            log_setup_error("setup.invalid_input", str(exc), self.path)
            self.send_json({"ok": False, "status": "invalid_input", "message": str(exc), "syncedAt": utc_now()}, HTTPStatus.BAD_REQUEST)
        except PermissionError as exc:
            log_setup_error("setup.unauthorized", str(exc), self.path)
            self.send_json({"ok": False, "status": "unauthorized", "message": str(exc), "syncedAt": utc_now()}, HTTPStatus.UNAUTHORIZED)
        except Exception as exc:
            log_setup_error("setup.validation_error", str(exc), self.path)
            self.send_json({"ok": False, "status": "validation_error", "message": str(exc), "syncedAt": utc_now()}, HTTPStatus.BAD_GATEWAY)

    def do_HEAD(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
