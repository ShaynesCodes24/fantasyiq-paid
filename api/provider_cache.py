from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

try:
    from database import connect, database_enabled, json_value
except (ModuleNotFoundError, ImportError):
    from api.database import connect, database_enabled, json_value


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


REQUIRED_DATA_SCOPES = (
    ("fantasyiq-cron", "fantasycalc-market"),
    ("fantasyiq-cron", "fantasycalc-trade-database"),
    ("fantasyiq-cron", "live-board-demo-snapshot"),
    ("fantasyiq-cron", "sos-heatmap"),
)


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


def parse_timestamp(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str) and value.strip():
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def iso_timestamp(value: Any) -> str:
    parsed = parse_timestamp(value)
    return parsed.isoformat().replace("+00:00", "Z") if parsed else ""


def health_status_for_row(row: dict[str, Any], now: datetime | None = None) -> dict[str, Any]:
    current = now or datetime.now(timezone.utc)
    success_at = parse_timestamp(row.get("last_success_at"))
    attempt_at = parse_timestamp(row.get("last_attempt_at"))
    max_age = int(row.get("max_age_seconds") or 0)
    age_seconds = int((current - success_at).total_seconds()) if success_at else None
    expires_at = success_at + timedelta(seconds=max_age) if success_at and max_age > 0 else None
    overdue = bool(success_at and max_age > 0 and current > expires_at)
    failed = bool(row.get("is_stale"))
    if failed:
        status = "critical"
        stale_reason = row.get("warning") or "Last refresh attempt failed."
    elif not success_at:
        status = "critical"
        stale_reason = "No successful refresh has been recorded."
    elif overdue:
        status = "critical"
        stale_reason = "Last successful refresh is older than its max age."
    elif max_age > 0 and age_seconds is not None and age_seconds > max_age * 0.8:
        status = "warning"
        stale_reason = "Refresh is close to its max age."
    else:
        status = "healthy"
        stale_reason = ""
    return {
        **row,
        "last_success_at": iso_timestamp(success_at),
        "last_attempt_at": iso_timestamp(attempt_at),
        "updated_at": iso_timestamp(row.get("updated_at")),
        "status": status,
        "computedStatus": status,
        "ageSeconds": age_seconds,
        "maxAgeSeconds": max_age,
        "expiresAt": iso_timestamp(expires_at),
        "overdue": overdue,
        "staleReason": stale_reason,
    }


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
                    item["metadata"] = json_value(item.get("metadata"))
                    rows.append(health_status_for_row(item))
                return rows
    except Exception:
        return []


def freshness_health_report(limit: int = 240, now: datetime | None = None) -> dict[str, Any]:
    current = now or datetime.now(timezone.utc)
    rows = [health_status_for_row(row, current) for row in freshness_snapshot(limit)]
    by_scope = {(str(row.get("source") or ""), str(row.get("source_scope") or "")): row for row in rows}
    missing = [
        {"source": source, "sourceScope": scope}
        for source, scope in REQUIRED_DATA_SCOPES
        if (source, scope) not in by_scope
    ]
    required_rows = [by_scope[key] for key in REQUIRED_DATA_SCOPES if key in by_scope]
    critical = [row for row in rows if row.get("status") == "critical"]
    warnings = [row for row in rows if row.get("status") == "warning"]
    required_problem_rows = [row for row in required_rows if row.get("status") != "healthy"]
    required_problem_ids = {
        (str(row.get("source") or ""), str(row.get("source_scope") or ""))
        for row in required_problem_rows
    }
    non_required_problem_rows = [
        row for row in [*critical, *warnings]
        if (str(row.get("source") or ""), str(row.get("source_scope") or "")) not in required_problem_ids
    ]
    if missing or required_problem_rows:
        status = "critical"
    elif warnings:
        status = "warning"
    elif rows:
        status = "healthy"
    else:
        status = "not_configured"
    latest_success = ""
    source_counts: dict[str, int] = {}
    for row in rows:
        source = str(row.get("source") or "unknown")
        source_counts[source] = source_counts.get(source, 0) + 1
        success_at = str(row.get("last_success_at") or "")
        if success_at and success_at > latest_success:
            latest_success = success_at
    cron_steps = sorted({str(row.get("source_scope") or "") for row in rows if row.get("source") == "fantasyiq-cron" and row.get("source_scope")})
    return {
        "ok": status in {"healthy", "warning"},
        "status": status,
        "syncedAt": utc_now(),
        "databaseBacked": bool(rows),
        "freshness": rows,
        "summary": {
            "rowCount": len(rows),
            "staleCount": len(critical),
            "warningCount": len(warnings),
            "overdueCount": sum(1 for row in rows if row.get("overdue")),
            "requiredProblemCount": len(required_problem_rows),
            "nonRequiredProblemCount": len(non_required_problem_rows),
            "blockingStaleCount": sum(1 for row in required_problem_rows if row.get("status") == "critical"),
            "sourceCounts": source_counts,
            "latestSuccessAt": latest_success,
            "cronStepCount": len(cron_steps),
            "cronSteps": cron_steps,
            "requiredCronSteps": [scope for source, scope in REQUIRED_DATA_SCOPES if source == "fantasyiq-cron"],
            "missingRequiredScopes": missing,
        },
        "requiredDataScopes": [{"source": source, "sourceScope": scope} for source, scope in REQUIRED_DATA_SCOPES],
        "missingRequiredScopes": missing,
        "requiredProblemRows": required_problem_rows[:25],
        "nonRequiredProblemRows": non_required_problem_rows[:25],
        "problemRows": critical[:25] + warnings[:25],
        "latestSuccessAt": latest_success,
    }


def provider_cache_snapshot(limit: int = 80) -> list[dict[str, Any]]:
    if not database_enabled():
        return []
    row_limit = max(10, min(int(limit or 80), 300))
    try:
        with connect() as connection:
            with connection.cursor() as cursor:
                ensure_provider_tables(cursor)
                cursor.execute(
                    """
                    SELECT cache_key, payload,
                           EXTRACT(EPOCH FROM (NOW() - updated_at)) AS age_seconds,
                           updated_at
                      FROM fantasyiq_provider_cache
                     ORDER BY updated_at DESC, cache_key ASC
                     LIMIT %s
                    """,
                    (row_limit,),
                )
                items: list[dict[str, Any]] = []
                for cache_key, payload, age_seconds, updated_at in cursor.fetchall():
                    parsed = json_value(payload)
                    payload_type = "object" if isinstance(parsed, dict) else "array" if isinstance(parsed, list) else type(parsed).__name__
                    sample_keys = list(parsed.keys())[:8] if isinstance(parsed, dict) else []
                    payload_count = len(parsed) if isinstance(parsed, (dict, list)) else 0
                    items.append({
                        "cacheKey": str(cache_key),
                        "payloadType": payload_type,
                        "payloadCount": payload_count,
                        "sampleKeys": [str(key) for key in sample_keys],
                        "ageSeconds": round(float(age_seconds or 0)),
                        "updatedAt": iso_timestamp(updated_at),
                    })
                return items
    except Exception:
        return []
