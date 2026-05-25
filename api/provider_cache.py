from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

try:
    from database import connect, database_enabled, json_value
except (ModuleNotFoundError, ImportError):
    from api.database import connect, database_enabled, json_value


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def ensure_provider_tables(cursor: Any) -> None:
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS fantasyiq_provider_cache (
            cache_key TEXT PRIMARY KEY,
            payload JSONB NOT NULL DEFAULT '{}'::jsonb,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS fantasyiq_data_freshness (
            id BIGSERIAL PRIMARY KEY,
            customer_slug TEXT NOT NULL DEFAULT '',
            league_key TEXT NOT NULL DEFAULT '',
            source TEXT NOT NULL DEFAULT '',
            source_scope TEXT NOT NULL DEFAULT '',
            last_success_at TIMESTAMPTZ,
            last_attempt_at TIMESTAMPTZ,
            max_age_seconds INTEGER,
            is_stale BOOLEAN NOT NULL DEFAULT false,
            warning TEXT NOT NULL DEFAULT '',
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE (customer_slug, league_key, source, source_scope)
        )
        """
    )


def load_provider_payload(cache_key: str, max_age_seconds: int) -> dict[str, Any] | None:
    if not cache_key or not database_enabled():
        return None
    try:
        with connect() as connection:
            with connection.cursor() as cursor:
                ensure_provider_tables(cursor)
                cursor.execute(
                    """
                    SELECT payload, EXTRACT(EPOCH FROM (NOW() - updated_at)) AS age_seconds, updated_at
                      FROM fantasyiq_provider_cache
                     WHERE cache_key = %s
                    """,
                    (cache_key,),
                )
                row = cursor.fetchone()
                if not row:
                    return None
                payload = json_value(row[0])
                age_seconds = float(row[1] or 0)
                if not isinstance(payload, dict) or age_seconds > max_age_seconds:
                    return None
                payload["cache"] = {"layer": "postgres", "ageSeconds": round(age_seconds)}
                return payload
    except Exception:
        return None


def save_provider_payload(cache_key: str, payload: dict[str, Any]) -> bool:
    if not cache_key or not isinstance(payload, dict) or not database_enabled():
        return False
    try:
        with connect() as connection:
            with connection.cursor() as cursor:
                ensure_provider_tables(cursor)
                cursor.execute(
                    """
                    INSERT INTO fantasyiq_provider_cache (cache_key, payload, updated_at)
                    VALUES (%s, %s::jsonb, NOW())
                    ON CONFLICT (cache_key)
                    DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
                    """,
                    (cache_key, json.dumps(payload)),
                )
        return True
    except Exception:
        return False


def record_freshness(
    *,
    source: str,
    source_scope: str,
    ok: bool,
    max_age_seconds: int,
    warning: str = "",
    metadata: dict[str, Any] | None = None,
    customer_slug: str = "",
    league_key: str = "",
) -> bool:
    if not source or not source_scope or not database_enabled():
        return False
    try:
        with connect() as connection:
            with connection.cursor() as cursor:
                ensure_provider_tables(cursor)
                cursor.execute(
                    """
                    INSERT INTO fantasyiq_data_freshness (
                        customer_slug, league_key, source, source_scope,
                        last_success_at, last_attempt_at, max_age_seconds,
                        is_stale, warning, metadata, updated_at
                    )
                    VALUES (%s, %s, %s, %s, CASE WHEN %s THEN NOW() ELSE NULL END, NOW(), %s, %s, %s, %s::jsonb, NOW())
                    ON CONFLICT (customer_slug, league_key, source, source_scope)
                    DO UPDATE SET
                        last_success_at = CASE WHEN EXCLUDED.last_success_at IS NOT NULL THEN EXCLUDED.last_success_at ELSE fantasyiq_data_freshness.last_success_at END,
                        last_attempt_at = NOW(),
                        max_age_seconds = EXCLUDED.max_age_seconds,
                        is_stale = EXCLUDED.is_stale,
                        warning = EXCLUDED.warning,
                        metadata = EXCLUDED.metadata,
                        updated_at = NOW()
                    """,
                    (
                        customer_slug,
                        league_key,
                        source,
                        source_scope,
                        ok,
                        int(max_age_seconds or 0),
                        not ok,
                        warning[:1000],
                        json.dumps(metadata or {}),
                    ),
                )
        return True
    except Exception:
        return False


def freshness_snapshot(limit: int = 240) -> list[dict[str, Any]]:
    if not database_enabled():
        return []
    row_limit = max(20, min(int(limit or 240), 500))
    try:
        with connect() as connection:
            with connection.cursor() as cursor:
                ensure_provider_tables(cursor)
                cursor.execute(
                    """
                    SELECT customer_slug, league_key, source, source_scope,
                           last_success_at, last_attempt_at, max_age_seconds,
                           is_stale, warning, metadata, updated_at
                      FROM fantasyiq_data_freshness
                     ORDER BY updated_at DESC, source ASC, source_scope ASC
                     LIMIT %s
                    """,
                    (row_limit,),
                )
                rows = []
                columns = [item.name if hasattr(item, "name") else item[0] for item in cursor.description or []]
                for row in cursor.fetchall():
                    item = {column: row[index] for index, column in enumerate(columns)}
                    for key in ("last_success_at", "last_attempt_at", "updated_at"):
                        if item.get(key) is not None:
                            item[key] = item[key].isoformat().replace("+00:00", "Z")
                    item["metadata"] = json_value(item.get("metadata"))
                    rows.append(item)
                return rows
    except Exception:
        return []
