from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass
from typing import Any


_MEMORY_BUCKETS: dict[str, tuple[int, int]] = {}


@dataclass
class RateLimitResult:
    allowed: bool
    limit: int
    count: int
    window_seconds: int
    reset_at: str = ""
    source: str = "memory"


def client_ip(headers: Any | None = None) -> str:
    if headers is None:
        return "unknown"
    forwarded = str(headers.get("x-forwarded-for") or headers.get("X-Forwarded-For") or "").strip()
    if forwarded:
        return forwarded.split(",", 1)[0].strip() or "unknown"
    real_ip = str(headers.get("x-real-ip") or headers.get("X-Real-IP") or "").strip()
    return real_ip or "unknown"


def raw_identity(raw: dict[str, Any] | None = None, fields: tuple[str, ...] = ()) -> str:
    payload = raw or {}
    values = []
    for field in fields:
        value = str(payload.get(field) or "").strip().lower()
        if value:
            values.append(value)
    return "|".join(values)


def bucket_key(scope: str, *, headers: Any | None = None, raw: dict[str, Any] | None = None, fields: tuple[str, ...] = ()) -> str:
    fingerprint = "|".join(
        part
        for part in (
            str(scope or "default").strip().lower(),
            client_ip(headers),
            raw_identity(raw, fields),
        )
        if part
    )
    digest = hashlib.sha256(fingerprint.encode("utf-8")).hexdigest()
    return f"{str(scope or 'default').strip().lower()}:{digest[:40]}"


def memory_rate_limit(key: str, *, limit: int, window_seconds: int) -> RateLimitResult:
    safe_limit = max(1, int(limit or 1))
    safe_window = max(1, int(window_seconds or 60))
    now = int(time.time())
    window_start = now - (now % safe_window)
    bucket_window, count = _MEMORY_BUCKETS.get(key, (window_start, 0))
    if bucket_window != window_start:
        bucket_window, count = window_start, 0
    count += 1
    _MEMORY_BUCKETS[key] = (bucket_window, count)

    if len(_MEMORY_BUCKETS) > 5000:
        expired_before = window_start - safe_window
        for existing_key, (existing_window, _) in list(_MEMORY_BUCKETS.items()):
            if existing_window < expired_before:
                _MEMORY_BUCKETS.pop(existing_key, None)

    return RateLimitResult(
        allowed=count <= safe_limit,
        limit=safe_limit,
        count=count,
        window_seconds=safe_window,
        reset_at=str(bucket_window + safe_window),
        source="memory",
    )


def check_rate_limit(
    scope: str,
    *,
    headers: Any | None = None,
    raw: dict[str, Any] | None = None,
    fields: tuple[str, ...] = (),
    limit: int = 30,
    window_seconds: int = 300,
) -> RateLimitResult:
    key = bucket_key(scope, headers=headers, raw=raw, fields=fields)
    try:
        try:
            from database import consume_rate_limit
        except ImportError:
            from api.database import consume_rate_limit

        result = consume_rate_limit(bucket_key=key, limit=limit, window_seconds=window_seconds)
        return RateLimitResult(
            allowed=bool(result.get("allowed")),
            limit=int(result.get("limit") or limit),
            count=int(result.get("count") or 0),
            window_seconds=int(result.get("windowSeconds") or window_seconds),
            reset_at=str(result.get("resetAt") or ""),
            source=str(result.get("source") or "database"),
        )
    except Exception:
        return memory_rate_limit(key, limit=limit, window_seconds=window_seconds)


def rate_limit_payload(result: RateLimitResult, message: str) -> dict[str, Any]:
    return {
        "ok": False,
        "message": message,
        "rateLimit": {
            "limit": result.limit,
            "count": result.count,
            "windowSeconds": result.window_seconds,
            "resetAt": result.reset_at,
        },
    }
