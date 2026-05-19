from __future__ import annotations

import json
import os
from dataclasses import dataclass
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
    customer_team_id: int | None = None
    customer_team_name: str = ""
    league_name: str = ""
    status: str = "configured"
    access_code: str = ""
    demo_mode: bool = False
    source: str = "env"

    @property
    def cache_key(self) -> str:
        return f"{self.slug}:{self.league_id or 'demo'}:{self.season}"

    def public_dict(self) -> dict[str, Any]:
        return {
            "customerSlug": self.slug,
            "customerName": self.customer_name,
            "customerTeamId": self.customer_team_id,
            "customerTeamName": self.customer_team_name,
            "leagueId": self.league_id,
            "leagueName": self.league_name,
            "season": self.season,
            "status": self.status,
            "accessRequired": bool(self.access_code),
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


def normalize_customer_entry(slug: str, entry: dict[str, Any]) -> CustomerContext:
    season = int_value(entry_value(entry, "season", "espnSeason", default=DEFAULT_SEASON), "season", DEFAULT_SEASON)
    league_id = int_value(entry_value(entry, "league_id", "leagueId", "espnLeagueId"), "leagueId")
    team_id = int_value(entry_value(entry, "team_id", "teamId", "customerTeamId"), "teamId")
    return CustomerContext(
        slug=slugify(str(entry_value(entry, "slug", default=slug))),
        league_id=league_id,
        season=season or DEFAULT_SEASON,
        customer_name=str(entry_value(entry, "customer_name", "customerName", "name", default="")).strip(),
        customer_team_id=team_id,
        customer_team_name=str(entry_value(entry, "team_name", "teamName", "customerTeamName", default="")).strip(),
        league_name=str(entry_value(entry, "league_name", "leagueName", default="")).strip(),
        status=str(entry_value(entry, "status", default="configured")).strip() or "configured",
        access_code=str(entry_value(entry, "access_code", "accessCode", "customerAccessCode", "code", default="")).strip(),
        demo_mode=False,
        source="FANTASY_IQ_CUSTOMERS_JSON",
    )


def customers_from_json() -> dict[str, CustomerContext]:
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
        context = normalize_customer_entry(slug, entry)
        customers[context.slug] = context
    return customers


def fallback_context(slug: str = "default") -> CustomerContext:
    configured_league = env("FANTASY_IQ_LEAGUE_ID")
    league_id = int_value(configured_league, "FANTASY_IQ_LEAGUE_ID", DEFAULT_DEMO_LEAGUE_ID)
    season = int_value(env("FANTASY_IQ_SEASON"), "FANTASY_IQ_SEASON", DEFAULT_SEASON) or DEFAULT_SEASON
    team_id = int_value(env("FANTASY_IQ_CUSTOMER_TEAM_ID"), "FANTASY_IQ_CUSTOMER_TEAM_ID")
    return CustomerContext(
        slug=slugify(env("FANTASY_IQ_CUSTOMER_SLUG", slug)),
        league_id=league_id,
        season=season,
        customer_name=env("FANTASY_IQ_CUSTOMER_NAME"),
        customer_team_id=team_id,
        customer_team_name=env("FANTASY_IQ_CUSTOMER_TEAM_NAME"),
        league_name=env("FANTASY_IQ_LEAGUE_NAME"),
        status=env("FANTASY_IQ_CUSTOMER_STATUS", "configured"),
        access_code=env("FANTASY_IQ_CUSTOMER_ACCESS_CODE"),
        demo_mode=not bool(configured_league),
        source="env",
    )


def requested_customer_slug(path: str) -> str:
    parsed = urlparse(path)
    params = parse_qs(parsed.query)
    requested = params.get("customer", [""])[0] or params.get("loadout", [""])[0] or params.get("dashboard", [""])[0]
    return slugify(requested) if requested else ""


def all_customer_contexts() -> dict[str, CustomerContext]:
    customers = customers_from_json()
    fallback = fallback_context(env("FANTASY_IQ_DEFAULT_CUSTOMER", "default"))
    if fallback.slug not in customers:
        customers[fallback.slug] = fallback
    if "default" not in customers:
        customers["default"] = fallback
    return customers


def resolve_customer_context(path: str = "") -> CustomerContext:
    customers = all_customer_contexts()
    requested = requested_customer_slug(path)
    if requested and requested in customers:
        return customers[requested]

    default_slug = slugify(env("FANTASY_IQ_DEFAULT_CUSTOMER", "default"))
    if default_slug in customers:
        context = customers[default_slug]
    else:
        context = next(iter(customers.values()))

    if requested:
        return CustomerContext(
            slug=requested,
            league_id=context.league_id,
            season=context.season,
            customer_name=context.customer_name,
            customer_team_id=context.customer_team_id,
            customer_team_name=context.customer_team_name,
            league_name=context.league_name,
            status=context.status,
            access_code=context.access_code,
            demo_mode=context.demo_mode,
            source=context.source,
        )
    return context


def access_code_from(path: str, headers: Any | None = None) -> str:
    parsed = urlparse(path)
    params = parse_qs(parsed.query)
    value = (
        params.get("accessCode", [""])[0]
        or params.get("access", [""])[0]
        or params.get("code", [""])[0]
    )
    if value:
        return value.strip()
    if headers is not None:
        return (
            headers.get("x-fantasyiq-access-code", "")
            or headers.get("x-fantasy-iq-access-code", "")
        ).strip()
    return ""


def verify_customer_access(context: CustomerContext, path: str = "", headers: Any | None = None) -> None:
    if context.demo_mode or not context.access_code:
        return
    if access_code_from(path, headers) != context.access_code:
        raise PermissionError("Valid customer access code required.")


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
