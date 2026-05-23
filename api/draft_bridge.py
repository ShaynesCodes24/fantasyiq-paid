from __future__ import annotations

import json
import hashlib
import hmac
import time
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from typing import Any
from urllib.parse import parse_qs, urlparse

try:
    from customer_context import authorize_customer_context
    from database import DatabaseUnavailable, connect, database_enabled, json_value
except (ModuleNotFoundError, ImportError):
    from api.customer_context import authorize_customer_context
    from api.database import DatabaseUnavailable, connect, database_enabled, json_value


MAX_BRIDGE_PICKS = 320
BRIDGE_TTL_SECONDS = 8 * 60 * 60
_memory_bridge: dict[str, dict[str, Any]] = {}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def int_value(value: Any, default: int = 0) -> int:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return default


def bridge_cache_key(league_id: int, season: int) -> str:
    return f"{league_id}:{season}"


def bridge_key_hash(bridge_key: str) -> str:
    cleaned = str(bridge_key or "").strip()
    if not cleaned:
        return ""
    return hashlib.sha256(cleaned.encode("utf-8")).hexdigest()


def constant_time_match(left: str, right: str) -> bool:
    return bool(left and right and hmac.compare_digest(left, right))


def clean_pick(raw: Any) -> dict[str, Any] | None:
    if not isinstance(raw, dict):
        return None
    player_id = int_value(raw.get("playerId"), -1)
    team_id = int_value(raw.get("teamId"), 0)
    if player_id <= 0 or team_id <= 0:
        return None
    overall = int_value(raw.get("overall") or raw.get("pickNumber"), 0)
    slot_id = int_value(raw.get("slotId"), -1)
    cleaned = {
        "playerId": player_id,
        "teamId": team_id,
    }
    if overall > 0:
        cleaned["overall"] = overall
        cleaned["pickNumber"] = overall
    if slot_id >= 0:
        cleaned["slotId"] = slot_id
    if raw.get("event"):
        cleaned["event"] = str(raw.get("event"))[:24]
    return cleaned


def clean_snapshot(payload: dict[str, Any]) -> dict[str, Any]:
    league_id = int_value(payload.get("leagueId"), 0)
    season = int_value(payload.get("season") or payload.get("seasonId"), 2026)
    picks = []
    seen: set[tuple[int, int]] = set()
    for raw_pick in payload.get("picks") or []:
        pick = clean_pick(raw_pick)
        if not pick:
            continue
        key = (int_value(pick.get("teamId")), int_value(pick.get("playerId")))
        if key in seen:
            continue
        seen.add(key)
        picks.append(pick)
        if len(picks) >= MAX_BRIDGE_PICKS:
            break
    return {
        "leagueId": league_id,
        "season": season,
        "picks": picks,
        "pickCount": len(picks),
        "source": str(payload.get("source") or "espnDraftRoomBridge")[:60],
        "postedAt": utc_now(),
    }


def ensure_bridge_table(cursor: Any) -> None:
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS fantasyiq_draft_bridge_snapshots (
            league_id BIGINT NOT NULL,
            season INTEGER NOT NULL,
            payload JSONB NOT NULL DEFAULT '{}'::jsonb,
            bridge_source TEXT NOT NULL DEFAULT 'espnDraftRoomBridge',
            bridge_key_hash TEXT NOT NULL DEFAULT '',
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (league_id, season)
        )
        """
    )
    cursor.execute(
        """
        ALTER TABLE fantasyiq_draft_bridge_snapshots
        ADD COLUMN IF NOT EXISTS bridge_key_hash TEXT NOT NULL DEFAULT ''
        """
    )


def register_bridge_session(league_id: int, season: int, bridge_key: str) -> dict[str, Any]:
    league_id = int_value(league_id, 0)
    season = int_value(season, 2026)
    key_hash = bridge_key_hash(bridge_key)
    if league_id <= 0:
        raise ValueError("leagueId is required.")
    if len(str(bridge_key or "")) < 24 or not key_hash:
        raise ValueError("Bridge key is invalid.")

    snapshot = {
        "leagueId": league_id,
        "season": season,
        "picks": [],
        "pickCount": 0,
        "source": "espnDraftRoomBridge",
        "postedAt": utc_now(),
        "registered": True,
    }
    _memory_bridge[bridge_cache_key(league_id, season)] = {
        "payload": snapshot,
        "keyHash": key_hash,
        "ts": time.time(),
    }

    if database_enabled():
        with connect() as connection:
            with connection.cursor() as cursor:
                ensure_bridge_table(cursor)
                cursor.execute(
                    """
                    INSERT INTO fantasyiq_draft_bridge_snapshots
                        (league_id, season, payload, bridge_source, bridge_key_hash, updated_at)
                    VALUES (%s, %s, %s::jsonb, %s, %s, NOW())
                    ON CONFLICT (league_id, season)
                    DO UPDATE SET
                        bridge_key_hash = EXCLUDED.bridge_key_hash,
                        bridge_source = EXCLUDED.bridge_source,
                        updated_at = NOW()
                    """,
                    (
                        league_id,
                        season,
                        json.dumps(snapshot),
                        snapshot["source"],
                        key_hash,
                    ),
                )
    return snapshot


def existing_bridge_key_hash(league_id: int, season: int) -> str:
    if database_enabled():
        try:
            with connect() as connection:
                with connection.cursor() as cursor:
                    ensure_bridge_table(cursor)
                    cursor.execute(
                        """
                        SELECT bridge_key_hash
                          FROM fantasyiq_draft_bridge_snapshots
                         WHERE league_id = %s
                           AND season = %s
                         LIMIT 1
                        """,
                        (league_id, season),
                    )
                    row = cursor.fetchone()
                    if row:
                        return str(row[0] if isinstance(row, tuple) else row["bridge_key_hash"] or "")
        except (DatabaseUnavailable, Exception):
            pass

    cached = _memory_bridge.get(bridge_cache_key(league_id, season)) or {}
    return str(cached.get("keyHash") or "")


def store_bridge_snapshot(snapshot: dict[str, Any], bridge_key: str = "") -> dict[str, Any]:
    league_id = int_value(snapshot.get("leagueId"), 0)
    season = int_value(snapshot.get("season"), 2026)
    if league_id <= 0:
        raise ValueError("leagueId is required.")
    key_hash = bridge_key_hash(bridge_key)
    existing_hash = existing_bridge_key_hash(league_id, season)
    if existing_hash and not constant_time_match(existing_hash, key_hash):
        raise PermissionError("Bridge key did not match this draft session.")

    key = bridge_cache_key(league_id, season)
    _memory_bridge[key] = {"payload": snapshot, "keyHash": existing_hash or key_hash, "ts": time.time()}

    if database_enabled():
        with connect() as connection:
            with connection.cursor() as cursor:
                ensure_bridge_table(cursor)
                cursor.execute(
                    """
                    INSERT INTO fantasyiq_draft_bridge_snapshots
                        (league_id, season, payload, bridge_source, bridge_key_hash, updated_at)
                    VALUES (%s, %s, %s::jsonb, %s, %s, NOW())
                    ON CONFLICT (league_id, season)
                    DO UPDATE SET
                        payload = EXCLUDED.payload,
                        bridge_source = EXCLUDED.bridge_source,
                        bridge_key_hash = COALESCE(NULLIF(fantasyiq_draft_bridge_snapshots.bridge_key_hash, ''), EXCLUDED.bridge_key_hash),
                        updated_at = NOW()
                    """,
                    (
                        league_id,
                        season,
                        json.dumps(snapshot),
                        snapshot.get("source") or "espnDraftRoomBridge",
                        existing_hash or key_hash,
                    ),
                )
    return snapshot


def bridge_snapshot_for_league(league_id: int, season: int) -> dict[str, Any] | None:
    league_id = int_value(league_id, 0)
    season = int_value(season, 2026)
    if league_id <= 0:
        return None

    if database_enabled():
        try:
            with connect() as connection:
                with connection.cursor() as cursor:
                    ensure_bridge_table(cursor)
                    cursor.execute(
                        """
                        SELECT payload, EXTRACT(EPOCH FROM updated_at) AS updated_epoch
                          FROM fantasyiq_draft_bridge_snapshots
                         WHERE league_id = %s
                           AND season = %s
                           AND updated_at >= NOW() - INTERVAL '8 hours'
                         LIMIT 1
                        """,
                        (league_id, season),
                    )
                    row = cursor.fetchone()
                    if row:
                        return json_value(row[0]) if isinstance(row, tuple) else json_value(row["payload"])
        except (DatabaseUnavailable, Exception):
            pass

    cached = _memory_bridge.get(bridge_cache_key(league_id, season))
    if cached and time.time() - float(cached.get("ts") or 0) <= BRIDGE_TTL_SECONDS:
        payload = cached.get("payload")
        return payload if isinstance(payload, dict) else None
    return None


def json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    for key, value in cors_headers(handler).items():
        handler.send_header(key, value)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def cors_headers(handler: BaseHTTPRequestHandler) -> dict[str, str]:
    origin = handler.headers.get("Origin") or ""
    allowed = {
        "https://fantasy.espn.com",
        "https://www.espn.com",
        "https://myfantasyiq.com",
    }
    allow_origin = origin if origin in allowed or origin.endswith(".espn.com") else "https://myfantasyiq.com"
    return {
        "Access-Control-Allow-Origin": allow_origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Vary": "Origin",
    }


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        for key, value in cors_headers(self).items():
            self.send_header(key, value)
        self.end_headers()

    def do_GET(self) -> None:
        params = parse_qs(urlparse(self.path).query)
        league_id = int_value(params.get("leagueId", [""])[0], 0)
        season = int_value(params.get("season", [""])[0], 2026)
        snapshot = bridge_snapshot_for_league(league_id, season)
        json_response(
            self,
            HTTPStatus.OK,
            {
                "ok": True,
                "leagueId": league_id,
                "season": season,
                "snapshot": snapshot,
                "syncedAt": utc_now(),
            },
        )

    def do_POST(self) -> None:
        try:
            length = min(int_value(self.headers.get("Content-Length"), 0), 128_000)
            body = self.rfile.read(length).decode("utf-8") if length else "{}"
            payload = json.loads(body)
            if not isinstance(payload, dict):
                raise ValueError("JSON body must be an object.")
            if str(payload.get("action") or "").lower() == "register":
                authorize_customer_context(self.path, self.headers)
                snapshot = register_bridge_session(
                    int_value(payload.get("leagueId"), 0),
                    int_value(payload.get("season") or payload.get("seasonId"), 2026),
                    str(payload.get("bridgeKey") or ""),
                )
            else:
                snapshot = store_bridge_snapshot(clean_snapshot(payload), str(payload.get("bridgeKey") or ""))
            json_response(
                self,
                HTTPStatus.OK,
                {
                    "ok": True,
                    "leagueId": snapshot["leagueId"],
                    "season": snapshot["season"],
                    "pickCount": snapshot["pickCount"],
                    "registered": bool(snapshot.get("registered")),
                    "syncedAt": utc_now(),
                },
            )
        except Exception as exc:
            json_response(
                self,
                HTTPStatus.BAD_REQUEST,
                {
                    "ok": False,
                    "error": str(exc),
                    "syncedAt": utc_now(),
                },
            )
