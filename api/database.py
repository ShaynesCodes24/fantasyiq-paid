from __future__ import annotations

import json
import os
import secrets
from contextlib import contextmanager
from datetime import date, datetime, timezone
from typing import Any, Iterator


DATABASE_ENV_NAMES = ("DATABASE_URL", "POSTGRES_URL", "POSTGRES_PRISMA_URL")
ACCESS_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


class DatabaseUnavailable(RuntimeError):
    pass


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def database_url() -> str:
    for name in DATABASE_ENV_NAMES:
        value = env(name)
        if value:
            return value
    return ""


def load_psycopg() -> Any | None:
    try:
        import psycopg  # type: ignore
    except ModuleNotFoundError:
        return None
    return psycopg


def dependency_ready() -> bool:
    return load_psycopg() is not None


def database_enabled() -> bool:
    return bool(database_url()) and dependency_ready()


def database_status() -> dict[str, Any]:
    return {
        "configured": bool(database_url()),
        "driverReady": dependency_ready(),
        "enabled": database_enabled(),
        "envNames": [name for name in DATABASE_ENV_NAMES if env(name)],
    }


@contextmanager
def connect() -> Iterator[Any]:
    url = database_url()
    psycopg = load_psycopg()
    if not url:
        raise DatabaseUnavailable("DATABASE_URL is not configured.")
    if psycopg is None:
        raise DatabaseUnavailable("psycopg is not installed. Run pip install -r requirements.txt.")
    with psycopg.connect(url, autocommit=True, connect_timeout=8) as connection:
        yield connection


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def slugify(value: str) -> str:
    cleaned = "".join(char.lower() if char.isalnum() else "-" for char in str(value or "").strip())
    while "--" in cleaned:
        cleaned = cleaned.replace("--", "-")
    return cleaned.strip("-") or "customer"


def customer_slug_from_email(email: str) -> str:
    clean = str(email or "").strip().lower()
    if "@" not in clean:
        return slugify(clean)
    local, domain = clean.split("@", 1)
    return slugify(f"{local}-{domain.replace('.', '-')}")


def generate_access_code(length: int = 12) -> str:
    return "".join(secrets.choice(ACCESS_CODE_ALPHABET) for _ in range(length))


def int_value(value: Any, default: int | None = None) -> int | None:
    if value in (None, ""):
        return default
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return default


def json_object(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}
    return {}


def json_value(value: Any) -> Any:
    if value is None:
        return {}
    if isinstance(value, str):
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return {}
    return value


def row_to_dict(cursor: Any, row: Any) -> dict[str, Any]:
    columns = [item.name if hasattr(item, "name") else item[0] for item in cursor.description or []]
    return {column: row[index] for index, column in enumerate(columns)}


def fetch_one_dict(cursor: Any) -> dict[str, Any] | None:
    row = cursor.fetchone()
    return row_to_dict(cursor, row) if row else None


def fetch_all_dicts(cursor: Any) -> list[dict[str, Any]]:
    return [row_to_dict(cursor, row) for row in cursor.fetchall()]


def selected_or_default_league(customer: dict[str, Any], leagues: list[dict[str, Any]], selected_league: str = "") -> str:
    keys = [str(league.get("league_key") or "") for league in leagues]
    requested = slugify(selected_league) if selected_league else ""
    default_key = slugify(str(customer.get("default_league_key") or "")) if customer.get("default_league_key") else ""
    if requested and requested in keys:
        return requested
    if default_key and default_key in keys:
        return default_key
    return keys[0] if keys else ""


def customer_entry(slug_or_email: str, selected_league: str = "") -> dict[str, Any] | None:
    lookup = slugify(slug_or_email)
    if not lookup or not database_enabled():
        return None

    with connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT slug, customer_name, email, access_code, status, stripe_customer_id,
                       subscription_status, included_league_limit, additional_league_count,
                       default_league_key, created_at, updated_at
                  FROM fantasyiq_customers
                 WHERE slug = %s OR lower(email) = lower(%s)
                 LIMIT 1
                """,
                (lookup, str(slug_or_email or "").strip()),
            )
            customer = fetch_one_dict(cursor)
            if not customer:
                return None

            cursor.execute(
                """
                SELECT league_key, label, league_name, league_id, team_id, team_name,
                       season, league_settings, status, source, created_at, updated_at
                  FROM fantasyiq_leagues
                 WHERE customer_slug = %s
                   AND COALESCE(status, 'configured') IN ('configured', 'active')
                 ORDER BY created_at ASC, league_key ASC
                """,
                (customer["slug"],),
            )
            leagues = fetch_all_dicts(cursor)

    active_key = selected_or_default_league(customer, leagues, selected_league)
    mapped_leagues = {}
    for league in leagues:
        key = slugify(str(league.get("league_key") or league.get("label") or "league"))
        mapped_leagues[key] = {
            "key": key,
            "label": league.get("label") or league.get("league_name") or key.replace("-", " ").title(),
            "leagueName": league.get("league_name") or league.get("label") or "",
            "leagueId": league.get("league_id"),
            "teamId": league.get("team_id"),
            "teamName": league.get("team_name") or "",
            "season": league.get("season"),
            "status": league.get("status") or "configured",
            "leagueSettings": json_object(json_value(league.get("league_settings"))),
        }

    return {
        "slug": customer["slug"],
        "customerName": customer.get("customer_name") or "",
        "email": customer.get("email") or "",
        "accessCode": customer.get("access_code") or "",
        "status": customer.get("status") or "configured",
        "subscriptionStatus": customer.get("subscription_status") or "",
        "includedLeagueLimit": customer.get("included_league_limit") or 3,
        "additionalLeagueCount": customer.get("additional_league_count") or 0,
        "defaultLeague": active_key,
        "leagues": mapped_leagues,
    }


def upsert_customer(
    *,
    slug: str = "",
    customer_name: str = "",
    email: str = "",
    access_code: str = "",
    status: str = "paid_needs_setup",
    stripe_customer_id: str = "",
    subscription_status: str = "",
    included_league_limit: int = 3,
    additional_league_count: int = 0,
    default_league_key: str = "",
) -> dict[str, Any]:
    if not database_enabled():
        raise DatabaseUnavailable("Database is not enabled.")

    resolved_slug = slugify(slug or customer_slug_from_email(email) or customer_name)
    resolved_code = access_code.strip() or generate_access_code()

    with connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO fantasyiq_customers (
                    slug, customer_name, email, access_code, status, stripe_customer_id,
                    subscription_status, included_league_limit, additional_league_count,
                    default_league_key, created_at, updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now(), now())
                ON CONFLICT (slug) DO UPDATE SET
                    customer_name = COALESCE(NULLIF(EXCLUDED.customer_name, ''), fantasyiq_customers.customer_name),
                    email = COALESCE(NULLIF(EXCLUDED.email, ''), fantasyiq_customers.email),
                    access_code = COALESCE(NULLIF(fantasyiq_customers.access_code, ''), EXCLUDED.access_code),
                    status = COALESCE(NULLIF(EXCLUDED.status, ''), fantasyiq_customers.status),
                    stripe_customer_id = COALESCE(NULLIF(EXCLUDED.stripe_customer_id, ''), fantasyiq_customers.stripe_customer_id),
                    subscription_status = COALESCE(NULLIF(EXCLUDED.subscription_status, ''), fantasyiq_customers.subscription_status),
                    included_league_limit = GREATEST(fantasyiq_customers.included_league_limit, EXCLUDED.included_league_limit),
                    additional_league_count = GREATEST(fantasyiq_customers.additional_league_count, EXCLUDED.additional_league_count),
                    default_league_key = COALESCE(NULLIF(EXCLUDED.default_league_key, ''), fantasyiq_customers.default_league_key),
                    updated_at = now()
                RETURNING slug, customer_name, email, access_code, status, included_league_limit,
                          additional_league_count, default_league_key
                """,
                (
                    resolved_slug,
                    customer_name.strip(),
                    email.strip().lower(),
                    resolved_code,
                    status.strip(),
                    stripe_customer_id.strip(),
                    subscription_status.strip(),
                    included_league_limit,
                    additional_league_count,
                    default_league_key.strip(),
                ),
            )
            saved = fetch_one_dict(cursor)
            return saved or {"slug": resolved_slug, "access_code": resolved_code}


def upsert_league(
    *,
    customer_slug: str,
    league_key: str,
    label: str = "",
    league_name: str = "",
    league_id: int | str | None = None,
    team_id: int | str | None = None,
    team_name: str = "",
    season: int | str | None = None,
    league_settings: dict[str, Any] | None = None,
    status: str = "configured",
    source: str = "setup_validator",
) -> dict[str, Any]:
    if not database_enabled():
        raise DatabaseUnavailable("Database is not enabled.")

    from psycopg.types.json import Jsonb  # type: ignore

    resolved_customer = slugify(customer_slug)
    resolved_key = slugify(league_key or label or league_name or str(league_id or "league"))
    settings = league_settings or {}

    with connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO fantasyiq_leagues (
                    customer_slug, league_key, label, league_name, league_id, team_id,
                    team_name, season, league_settings, status, source, created_at, updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now(), now())
                ON CONFLICT (customer_slug, league_key) DO UPDATE SET
                    label = COALESCE(NULLIF(EXCLUDED.label, ''), fantasyiq_leagues.label),
                    league_name = COALESCE(NULLIF(EXCLUDED.league_name, ''), fantasyiq_leagues.league_name),
                    league_id = COALESCE(EXCLUDED.league_id, fantasyiq_leagues.league_id),
                    team_id = COALESCE(EXCLUDED.team_id, fantasyiq_leagues.team_id),
                    team_name = COALESCE(NULLIF(EXCLUDED.team_name, ''), fantasyiq_leagues.team_name),
                    season = COALESCE(EXCLUDED.season, fantasyiq_leagues.season),
                    league_settings = COALESCE(EXCLUDED.league_settings, fantasyiq_leagues.league_settings),
                    status = COALESCE(NULLIF(EXCLUDED.status, ''), fantasyiq_leagues.status),
                    source = COALESCE(NULLIF(EXCLUDED.source, ''), fantasyiq_leagues.source),
                    updated_at = now()
                RETURNING customer_slug, league_key, label, league_name, league_id, team_id,
                          team_name, season, league_settings, status
                """,
                (
                    resolved_customer,
                    resolved_key,
                    label.strip(),
                    league_name.strip(),
                    int_value(league_id),
                    int_value(team_id),
                    team_name.strip(),
                    int_value(season),
                    Jsonb(settings),
                    status.strip(),
                    source.strip(),
                ),
            )
            saved = fetch_one_dict(cursor)

            cursor.execute(
                """
                UPDATE fantasyiq_customers
                   SET default_league_key = COALESCE(NULLIF(default_league_key, ''), %s),
                       status = CASE WHEN status = 'paid_needs_setup' THEN 'configured' ELSE status END,
                       updated_at = now()
                 WHERE slug = %s
                """,
                (resolved_key, resolved_customer),
            )
            return saved or {"customer_slug": resolved_customer, "league_key": resolved_key}


def record_stripe_event(
    *,
    stripe_event_id: str,
    event_type: str,
    stripe_object_id: str = "",
    customer_slug: str = "",
    email: str = "",
    amount_total: int | None = None,
    currency: str = "",
    status: str = "",
    payload: dict[str, Any] | None = None,
) -> bool:
    if not database_enabled():
        raise DatabaseUnavailable("Database is not enabled.")

    from psycopg.types.json import Jsonb  # type: ignore

    with connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO fantasyiq_payment_events (
                    stripe_event_id, event_type, stripe_object_id, customer_slug, email,
                    amount_total, currency, status, payload, created_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, now())
                ON CONFLICT (stripe_event_id) DO NOTHING
                RETURNING id
                """,
                (
                    stripe_event_id.strip(),
                    event_type.strip(),
                    stripe_object_id.strip(),
                    customer_slug.strip(),
                    email.strip().lower(),
                    amount_total,
                    currency.strip().lower(),
                    status.strip(),
                    Jsonb(payload or {}),
                ),
            )
            return cursor.fetchone() is not None


def list_customers() -> list[dict[str, Any]]:
    if not database_enabled():
        return []

    with connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT c.slug, c.customer_name, c.email, c.status, c.subscription_status,
                       c.included_league_limit, c.additional_league_count, c.default_league_key,
                       c.created_at, c.updated_at,
                       COUNT(l.id) AS league_count,
                       MAX(l.updated_at) AS last_league_update,
                       BOOL_OR(NULLIF(c.access_code, '') IS NOT NULL) AS access_code_set
                  FROM fantasyiq_customers c
                  LEFT JOIN fantasyiq_leagues l
                    ON l.customer_slug = c.slug
                   AND COALESCE(l.status, '') <> 'archived'
                 GROUP BY c.id
                 ORDER BY c.updated_at DESC, c.created_at DESC
                """
            )
            rows = fetch_all_dicts(cursor)

    output = []
    for row in rows:
        clean = dict(row)
        for key in ("created_at", "updated_at", "last_league_update"):
            value = clean.get(key)
            if isinstance(value, (datetime, date)):
                clean[key] = value.isoformat()
        output.append(clean)
    return output


def record_ops_event(
    *,
    event_type: str,
    severity: str = "info",
    source: str = "",
    customer_slug: str = "",
    league_key: str = "",
    message: str = "",
    payload: dict[str, Any] | None = None,
) -> bool:
    if not database_enabled():
        return False

    from psycopg.types.json import Jsonb  # type: ignore

    try:
        with connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO fantasyiq_ops_events (
                        event_type, severity, source, customer_slug, league_key, message, payload, created_at
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, now())
                    RETURNING id
                    """,
                    (
                        event_type.strip(),
                        severity.strip() or "info",
                        source.strip(),
                        slugify(customer_slug) if customer_slug else "",
                        slugify(league_key) if league_key else "",
                        message.strip(),
                        Jsonb(payload or {}),
                    ),
                )
                return cursor.fetchone() is not None
    except Exception:
        return False


def list_ops_events(limit: int = 50) -> list[dict[str, Any]]:
    if not database_enabled():
        return []
    safe_limit = max(1, min(int_value(limit, 50) or 50, 200))
    with connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, event_type, severity, source, customer_slug, league_key,
                       message, payload, created_at
                  FROM fantasyiq_ops_events
                 ORDER BY created_at DESC
                 LIMIT %s
                """,
                (safe_limit,),
            )
            rows = fetch_all_dicts(cursor)
    output = []
    for row in rows:
        clean = dict(row)
        value = clean.get("created_at")
        if isinstance(value, (datetime, date)):
            clean["created_at"] = value.isoformat()
        clean["payload"] = json_object(json_value(clean.get("payload")))
        output.append(clean)
    return output


def ops_summary() -> dict[str, Any]:
    if not database_enabled():
        return {"total": 0, "warnings": 0, "errors": 0, "lastEventAt": ""}
    with connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE severity = 'warning') AS warnings,
                    COUNT(*) FILTER (WHERE severity IN ('error', 'critical')) AS errors,
                    MAX(created_at) AS last_event_at
                  FROM fantasyiq_ops_events
                """
            )
            row = fetch_one_dict(cursor) or {}
    last_event = row.get("last_event_at")
    return {
        "total": row.get("total") or 0,
        "warnings": row.get("warnings") or 0,
        "errors": row.get("errors") or 0,
        "lastEventAt": last_event.isoformat() if isinstance(last_event, (datetime, date)) else "",
    }


def admin_customer_detail(slug: str) -> dict[str, Any] | None:
    if not database_enabled():
        return None
    lookup = slugify(slug)
    with connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT slug, customer_name, email, access_code, status, subscription_status,
                       included_league_limit, additional_league_count, default_league_key,
                       created_at, updated_at
                  FROM fantasyiq_customers
                 WHERE slug = %s
                 LIMIT 1
                """,
                (lookup,),
            )
            customer = fetch_one_dict(cursor)
            if not customer:
                return None
            cursor.execute(
                """
                SELECT league_key, label, league_name, league_id, team_id, team_name, season, status
                  FROM fantasyiq_leagues
                 WHERE customer_slug = %s
                   AND COALESCE(status, '') <> 'archived'
                 ORDER BY created_at ASC, league_key ASC
                """,
                (lookup,),
            )
            leagues = fetch_all_dicts(cursor)
    for key in ("created_at", "updated_at"):
        value = customer.get(key)
        if isinstance(value, (datetime, date)):
            customer[key] = value.isoformat()
    customer["leagues"] = leagues
    return customer


def reset_customer_access_code(slug: str) -> dict[str, Any] | None:
    if not database_enabled():
        return None
    lookup = slugify(slug)
    code = generate_access_code()
    with connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE fantasyiq_customers
                   SET access_code = %s,
                       updated_at = now()
                 WHERE slug = %s
             RETURNING slug, customer_name, email, access_code, status,
                       default_league_key, included_league_limit, additional_league_count
                """,
                (code, lookup),
            )
            return fetch_one_dict(cursor)


def increment_additional_league_count(slug_or_email: str, amount: int = 1) -> dict[str, Any] | None:
    if not database_enabled():
        raise DatabaseUnavailable("Database is not enabled.")
    lookup = slugify(slug_or_email)
    clean = str(slug_or_email or "").strip()
    safe_amount = max(1, int_value(amount, 1) or 1)
    with connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE fantasyiq_customers
                   SET additional_league_count = additional_league_count + %s,
                       updated_at = now()
                 WHERE slug = %s OR lower(email) = lower(%s)
             RETURNING slug, customer_name, email, access_code, status,
                       included_league_limit, additional_league_count, default_league_key
                """,
                (safe_amount, lookup, clean),
            )
            return fetch_one_dict(cursor)


def delete_smoke_customer(slug: str) -> bool:
    if not database_enabled():
        return False
    lookup = slugify(slug)
    if not lookup.startswith("self-serve-smoke-"):
        return False
    with connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "DELETE FROM fantasyiq_payment_events WHERE customer_slug = %s",
                (lookup,),
            )
            cursor.execute(
                "DELETE FROM fantasyiq_customers WHERE slug = %s RETURNING slug",
                (lookup,),
            )
            return cursor.fetchone() is not None


def apply_schema(schema_sql: str) -> None:
    if not database_enabled():
        raise DatabaseUnavailable("Database is not enabled.")
    with connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute(schema_sql)
