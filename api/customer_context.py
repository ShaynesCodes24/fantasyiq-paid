from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import parse_qs, urlparse


DEFAULT_SEASON = 2026
DEFAULT_DEMO_LEAGUE_ID = 584856941


class ConfigError(RuntimeError):
    pass


@dataclass(frozen=True)
class CustomerContext:
    slug: str
    league_id: int | None
    season: int
    customer_name: str = ""
    email: str = ""
    league_key: str = ""
    customer_team_id: int | None = None
    customer_team_name: str = ""
    league_name: str = ""
    league_settings: dict[str, Any] = field(default_factory=dict)
    available_leagues: list[dict[str, Any]] = field(default_factory=list)
    status: str = "configured"
    subscription_status: str = ""
    included_league_limit: int = 3
    additional_league_count: int = 0
    access_code: str = ""
    password_configured: bool = False
    demo_mode: bool = False
    source: str = "env"

    @property
    def cache_key(self) -> str:
        return f"{self.slug}:{self.league_key or 'primary'}:{self.league_id or 'demo'}:{self.season}"

    def public_dict(self) -> dict[str, Any]:
        return {
            "customerSlug": self.slug,
            "customerName": self.customer_name,
            "leagueKey": self.league_key,
            "customerTeamId": self.customer_team_id,
            "customerTeamName": self.customer_team_name,
            "leagueId": self.league_id,
            "leagueName": self.league_name,
            "leagueSettings": self.league_settings,
            "leagues": self.available_leagues,
            "season": self.season,
            "status": self.status,
            "subscriptionStatus": self.subscription_status,
            "includedLeagueLimit": self.included_league_limit,
            "additionalLeagueCount": self.additional_league_count,
            "accessRequired": bool(self.access_code or self.password_configured),
            "passwordConfigured": self.password_configured,
            "demoMode": self.demo_mode,
            "source": self.source,
        }


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def slugify(value: str) -> str:
    cleaned = "".join(char.lower() if char.isalnum() else "-" for char in value.strip())
    while "--" in cleaned:
        cleaned = cleaned.replace("--", "-")
    return cleaned.strip("-") or "default"


def int_value(value: Any, name: str, default: int | None = None) -> int | None:
    if value is None or str(value).strip() == "":
        return default
    try:
        return int(str(value).strip())
    except ValueError as exc:
        raise ConfigError(f"{name} must be a number.") from exc


def entry_value(entry: dict[str, Any], *names: str, default: Any = "") -> Any:
    for name in names:
        if name in entry and entry[name] not in (None, ""):
            return entry[name]
    return default


def dict_value(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def merge_dicts(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    merged = {**base, **override}
    if isinstance(base.get("lineupSlots"), dict) or isinstance(override.get("lineupSlots"), dict):
        merged["lineupSlots"] = {
            **(base.get("lineupSlots") or {}),
            **(override.get("lineupSlots") or {}),
        }
    return merged


def league_settings_from_entry(entry: dict[str, Any]) -> dict[str, Any]:
    settings = dict_value(entry_value(entry, "league_settings", "leagueSettings", default={}))
    direct_keys = (
        "teamCount",
        "teams",
        "scoringType",
        "scoring",
        "scoringLabel",
        "receptionPoints",
        "draftRounds",
        "rounds",
        "playoffTeams",
        "source",
        "scoringItems",
        "scoringWeights",
        "scoringWeightsByStatId",
    )
    for key in direct_keys:
        if entry.get(key) not in (None, ""):
            settings[key] = entry[key]
    lineup_slots = merge_dicts(
        dict_value(entry_value(entry, "roster", default={})),
        dict_value(entry_value(entry, "lineupSlots", default={})),
    )
    if lineup_slots:
        existing_slots = settings.get("lineupSlots") if isinstance(settings.get("lineupSlots"), dict) else {}
        settings["lineupSlots"] = merge_dicts(existing_slots, lineup_slots)
    return settings


def parsed_mapping(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, list):
        mapped: dict[str, Any] = {}
        for index, item in enumerate(value):
            if not isinstance(item, dict):
                continue
            key = item.get("key") or item.get("slug") or item.get("leagueKey") or item.get("leagueName") or index
            mapped[slugify(str(key))] = item
        return mapped
    if isinstance(value, str) and value.strip():
        try:
            return parsed_mapping(json.loads(value))
        except json.JSONDecodeError:
            return {}
    return {}


def league_entries(entry: dict[str, Any]) -> dict[str, dict[str, Any]]:
    raw = entry_value(entry, "leagues", "leagueProfiles", "league_profiles", default={})
    return {
        slugify(str(key)): value
        for key, value in parsed_mapping(raw).items()
        if isinstance(value, dict)
    }


def active_league_key(entry: dict[str, Any], leagues: dict[str, dict[str, Any]], requested: str = "") -> str:
    if not leagues:
        return ""
    requested = slugify(requested) if requested else ""
    default_key = slugify(str(entry_value(entry, "defaultLeague", "defaultLeagueKey", "leagueKey", default="")))
    if requested and requested in leagues:
        return requested
    if default_key and default_key in leagues:
        return default_key
    return next(iter(leagues.keys()))


def league_display_name(key: str, entry: dict[str, Any]) -> str:
    return str(entry_value(entry, "label", "displayName", "league_name", "leagueName", default=key.replace("-", " ").title())).strip()


def public_league_list(parent: dict[str, Any], leagues: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for key, entry in leagues.items():
        settings = merge_dicts(
            league_settings_from_entry(parent),
            league_settings_from_entry(entry),
        )
        team_id = int_value(entry_value(entry, "team_id", "teamId", "customerTeamId"), "teamId")
        team_name = str(entry_value(entry, "team_name", "teamName", "customerTeamName", default="")).strip()
        league_name = str(entry_value(entry, "league_name", "leagueName", default=league_display_name(key, entry))).strip()
        items.append(
            {
                "key": key,
                "label": league_display_name(key, entry),
                "leagueId": int_value(entry_value(entry, "league_id", "leagueId", "espnLeagueId"), "leagueId"),
                "leagueName": league_name,
                "teamId": team_id,
                "teamName": team_name,
                "customerTeamId": team_id,
                "customerTeamName": team_name,
                "season": int_value(entry_value(entry, "season", "espnSeason", default=entry_value(parent, "season", "espnSeason", default=DEFAULT_SEASON)), "season", DEFAULT_SEASON),
                "leagueSettings": settings,
            }
        )
    return items


def normalize_customer_entry(slug: str, entry: dict[str, Any], selected_league: str = "", source: str = "FANTASY_IQ_CUSTOMERS_JSON") -> CustomerContext:
    leagues = league_entries(entry)
    league_key = active_league_key(entry, leagues, selected_league)
    active_league = leagues.get(league_key, {})

    def active_value(*names: str, default: Any = "") -> Any:
        return entry_value(active_league, *names, default=entry_value(entry, *names, default=default))

    season = int_value(active_value("season", "espnSeason", default=DEFAULT_SEASON), "season", DEFAULT_SEASON)
    league_id = int_value(active_value("league_id", "leagueId", "espnLeagueId"), "leagueId")
    team_id = int_value(active_value("team_id", "teamId", "customerTeamId"), "teamId")
    league_settings = merge_dicts(
        league_settings_from_entry(entry),
        league_settings_from_entry(active_league),
    )
    return CustomerContext(
        slug=slugify(str(entry_value(entry, "slug", default=slug))),
        league_id=league_id,
        season=season or DEFAULT_SEASON,
        customer_name=str(entry_value(entry, "customer_name", "customerName", "name", default="")).strip(),
        email=str(entry_value(entry, "email", default="")).strip(),
        league_key=league_key,
        customer_team_id=team_id,
        customer_team_name=str(active_value("team_name", "teamName", "customerTeamName", default="")).strip(),
        league_name=str(active_value("league_name", "leagueName", default=league_display_name(league_key, active_league) if active_league else "")).strip(),
        league_settings=league_settings,
        available_leagues=public_league_list(entry, leagues),
        status=str(entry_value(entry, "status", default="configured")).strip() or "configured",
        subscription_status=str(entry_value(entry, "subscription_status", "subscriptionStatus", default="")).strip(),
        included_league_limit=int_value(entry_value(entry, "included_league_limit", "includedLeagueLimit", default=3), "includedLeagueLimit", 3) or 3,
        additional_league_count=int_value(entry_value(entry, "additional_league_count", "additionalLeagueCount", default=0), "additionalLeagueCount", 0) or 0,
        access_code=str(entry_value(entry, "access_code", "accessCode", "customerAccessCode", "code", default="")).strip(),
        password_configured=bool(entry_value(entry, "password_configured", "passwordConfigured", default=False)),
        demo_mode=False,
        source=source,
    )


def customers_from_json(selected_league: str = "") -> dict[str, CustomerContext]:
    raw = env("FANTASY_IQ_CUSTOMERS_JSON")
    if not raw:
        return {}
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ConfigError("FANTASY_IQ_CUSTOMERS_JSON must be valid JSON.") from exc

    customers: dict[str, CustomerContext] = {}
    if isinstance(payload, dict):
        iterable = payload.items()
    elif isinstance(payload, list):
        iterable = ((str(item.get("slug") or item.get("customerSlug") or index), item) for index, item in enumerate(payload))
    else:
        raise ConfigError("FANTASY_IQ_CUSTOMERS_JSON must be an object or list.")

    for slug, entry in iterable:
        if not isinstance(entry, dict):
            continue
        context = normalize_customer_entry(slug, entry, selected_league)
        customers[context.slug] = context
    return customers


def database_customer_context(slug: str, selected_league: str = "") -> CustomerContext | None:
    if not slug:
        return None
    try:
        try:
            from database import customer_entry
        except ImportError:
            from api.database import customer_entry
        entry = customer_entry(slug, selected_league)
    except Exception as exc:
        if env("FANTASYIQ_DATABASE_STRICT") == "1":
            raise ConfigError(f"Database customer lookup failed: {exc}") from exc
        return None
    if not entry:
        return None
    return normalize_customer_entry(slug, entry, selected_league, source="database")


def fallback_context(slug: str = "default", selected_league: str = "") -> CustomerContext:
    leagues = parsed_mapping(env("FANTASY_IQ_LEAGUES_JSON"))
    configured_league = env("FANTASY_IQ_LEAGUE_ID")
    if leagues:
        entry = {
            "slug": env("FANTASY_IQ_CUSTOMER_SLUG", slug),
            "customerName": env("FANTASY_IQ_CUSTOMER_NAME"),
            "email": env("FANTASY_IQ_CUSTOMER_EMAIL"),
            "status": env("FANTASY_IQ_CUSTOMER_STATUS", "configured"),
            "accessCode": env("FANTASY_IQ_CUSTOMER_ACCESS_CODE"),
            "defaultLeague": env("FANTASY_IQ_DEFAULT_LEAGUE"),
            "leagueSettings": dict_value(env("FANTASY_IQ_LEAGUE_SETTINGS")),
            "leagues": leagues,
        }
        context = normalize_customer_entry(slug, entry, selected_league, source="env")
        return CustomerContext(
            slug=context.slug,
            league_id=context.league_id,
            season=context.season,
            customer_name=context.customer_name,
            email=context.email,
            league_key=context.league_key,
            customer_team_id=context.customer_team_id,
            customer_team_name=context.customer_team_name,
            league_name=context.league_name,
            league_settings=context.league_settings,
            available_leagues=context.available_leagues,
            status=context.status,
            subscription_status=context.subscription_status,
            included_league_limit=context.included_league_limit,
            additional_league_count=context.additional_league_count,
            access_code=context.access_code,
            password_configured=context.password_configured,
            demo_mode=not bool(context.league_id),
            source=context.source,
        )

    league_id = int_value(configured_league, "FANTASY_IQ_LEAGUE_ID", DEFAULT_DEMO_LEAGUE_ID)
    season = int_value(env("FANTASY_IQ_SEASON"), "FANTASY_IQ_SEASON", DEFAULT_SEASON) or DEFAULT_SEASON
    team_id = int_value(env("FANTASY_IQ_CUSTOMER_TEAM_ID"), "FANTASY_IQ_CUSTOMER_TEAM_ID")
    return CustomerContext(
        slug=slugify(env("FANTASY_IQ_CUSTOMER_SLUG", slug)),
        league_id=league_id,
        season=season,
        customer_name=env("FANTASY_IQ_CUSTOMER_NAME"),
        email=env("FANTASY_IQ_CUSTOMER_EMAIL"),
        league_key=slugify(env("FANTASY_IQ_DEFAULT_LEAGUE")) if env("FANTASY_IQ_DEFAULT_LEAGUE") else "",
        customer_team_id=team_id,
        customer_team_name=env("FANTASY_IQ_CUSTOMER_TEAM_NAME"),
        league_name=env("FANTASY_IQ_LEAGUE_NAME"),
        league_settings=dict_value(env("FANTASY_IQ_LEAGUE_SETTINGS")),
        available_leagues=[],
        status=env("FANTASY_IQ_CUSTOMER_STATUS", "configured"),
        access_code=env("FANTASY_IQ_CUSTOMER_ACCESS_CODE"),
        password_configured=bool(env("FANTASY_IQ_CUSTOMER_PASSWORD_CONFIGURED")),
        demo_mode=not bool(configured_league),
        source="env",
    )


def requested_customer_slug(path: str) -> str:
    parsed = urlparse(path)
    params = parse_qs(parsed.query)
    requested = params.get("customer", [""])[0] or params.get("loadout", [""])[0] or params.get("dashboard", [""])[0]
    return slugify(requested) if requested else ""


def requested_league_slug(path: str) -> str:
    parsed = urlparse(path)
    params = parse_qs(parsed.query)
    requested = params.get("league", [""])[0] or params.get("leagueKey", [""])[0]
    return slugify(requested) if requested else ""


def all_customer_contexts(selected_league: str = "") -> dict[str, CustomerContext]:
    customers = customers_from_json(selected_league)
    fallback = fallback_context(env("FANTASY_IQ_DEFAULT_CUSTOMER", "default"), selected_league)
    if fallback.slug not in customers:
        customers[fallback.slug] = fallback
    if "default" not in customers:
        customers["default"] = fallback
    return customers


def resolve_customer_context(path: str = "") -> CustomerContext:
    selected_league = requested_league_slug(path)
    requested = requested_customer_slug(path)
    if requested:
        database_context = database_customer_context(requested, selected_league)
        if database_context:
            return database_context
        configured_customers = customers_from_json(selected_league)
        if requested in configured_customers:
            return configured_customers[requested]
        raise ConfigError("Customer dashboard was not found. Sign in with the checkout email or use the setup link from your email.")

    default_slug = slugify(env("FANTASY_IQ_DEFAULT_CUSTOMER", "default"))
    database_default = database_customer_context(default_slug, selected_league)
    if database_default:
        return database_default

    customers = all_customer_contexts(selected_league)
    if default_slug in customers:
        context = customers[default_slug]
    else:
        context = next(iter(customers.values()))

    return context


def access_code_from(path: str, headers: Any | None = None) -> str:
    if headers is not None:
        return (
            headers.get("x-fantasyiq-access-code", "")
            or headers.get("x-fantasy-iq-access-code", "")
        ).strip()
    return ""


def verify_customer_access(context: CustomerContext, path: str = "", headers: Any | None = None) -> None:
    if context.demo_mode:
        return
    blocked_statuses = {"canceled", "cancelled", "expired", "suspended", "unpaid", "incomplete_expired"}
    if str(context.status or "").strip().lower() in blocked_statuses or str(context.subscription_status or "").strip().lower() in blocked_statuses:
        raise PermissionError("This FantasyIQ subscription is not active. Update billing or contact support.")
    try:
        try:
            from auth_service import session_slug_from_headers
        except ImportError:
            from api.auth_service import session_slug_from_headers

        session_slug = session_slug_from_headers(headers)
        if session_slug and session_slug == context.slug:
            return
    except Exception:
        pass
    if context.access_code and access_code_from(path, headers) == context.access_code:
        return
    if context.password_configured and not context.access_code:
        raise PermissionError("Sign in with your checkout email and FantasyIQ password to open this dashboard.")
    if context.access_code:
        raise PermissionError("That access code does not match this customer dashboard. Check your setup email or contact support.")
    raise PermissionError("Sign in with your checkout email and FantasyIQ password to open this dashboard.")


def authorize_customer_context(path: str = "", headers: Any | None = None) -> CustomerContext:
    context = resolve_customer_context(path)
    verify_customer_access(context, path, headers)
    return context


def require_customer_config(context: CustomerContext) -> tuple[int, int]:
    if context.season is None:
        raise ConfigError("FANTASY_IQ_SEASON is not configured for this customer dashboard.")
    if context.league_id is None:
        raise ConfigError("FANTASY_IQ_LEAGUE_ID is not configured for this customer dashboard.")
    return context.league_id, context.season
