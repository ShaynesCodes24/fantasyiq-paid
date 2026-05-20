from __future__ import annotations

import csv
import json
from datetime import date, datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from typing import Any

try:
    from customer_context import ConfigError, all_customer_contexts, env
except ModuleNotFoundError:
    from api.customer_context import ConfigError, all_customer_contexts, env


CUSTOMER_CSV = Path("customers.csv")
SAFE_FIELDS = [
    "customer_name",
    "email",
    "league_id",
    "team_id",
    "season",
    "league_name",
    "paid_at",
    "renewal_date",
    "dashboard_url",
    "status",
    "notes",
]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def auth_token_from(handler: BaseHTTPRequestHandler) -> str:
    return handler.headers.get("x-fantasyiq-admin-token", "").strip()


def require_admin(handler: BaseHTTPRequestHandler) -> None:
    expected = env("FANTASYIQ_ADMIN_TOKEN")
    if not expected:
        raise PermissionError("FANTASYIQ_ADMIN_TOKEN is not configured.")
    if auth_token_from(handler) != expected:
        raise PermissionError("Invalid admin token.")


def days_until(value: str) -> int | None:
    if not value:
        return None
    try:
        return (date.fromisoformat(value) - date.today()).days
    except ValueError:
        return None


def csv_customers() -> list[dict[str, Any]]:
    if not CUSTOMER_CSV.exists():
        return []
    with CUSTOMER_CSV.open("r", newline="", encoding="utf-8") as handle:
        rows = []
        for row in csv.DictReader(handle):
            safe = {field: row.get(field, "") for field in SAFE_FIELDS}
            safe["daysUntilRenewal"] = days_until(safe.get("renewal_date", ""))
            rows.append(safe)
        return rows


def registry_customers() -> list[dict[str, Any]]:
    return [
        context.public_dict()
        for context in all_customer_contexts().values()
        if not context.demo_mode
    ]


def database_customers() -> tuple[dict[str, Any], list[dict[str, Any]]]:
    try:
        try:
            from database import database_status, list_customers
        except ImportError:
            from api.database import database_status, list_customers
        status = database_status()
        return status, list_customers() if status["enabled"] else []
    except Exception as exc:
        return {"configured": False, "driverReady": False, "enabled": False, "error": str(exc)}, []


def admin_payload() -> dict[str, Any]:
    csv_rows = csv_customers()
    registry_rows = registry_customers()
    database_status, database_rows = database_customers()
    configured_count = len([row for row in csv_rows if row.get("status") == "configured"])
    configured_count += len([row for row in registry_rows if row.get("status") == "configured"])
    configured_count += len([row for row in database_rows if row.get("status") == "configured"])
    needs_setup = [row for row in csv_rows if row.get("status") != "configured"]
    needs_setup += [row for row in database_rows if row.get("status") != "configured"]
    return {
        "ok": True,
        "syncedAt": utc_now(),
        "csvCustomerCount": len(csv_rows),
        "databaseCustomerCount": len(database_rows),
        "database": database_status,
        "configuredCount": configured_count,
        "needsSetupCount": len(needs_setup),
        "customers": csv_rows,
        "databaseCustomers": database_rows,
        "registry": registry_rows,
        "nextActions": [
            "Connect Neon/Postgres and run database/schema.sql to make checkout and setup records durable.",
            "Set FANTASYIQ_ADMIN_TOKEN in Vercel before using this endpoint in production.",
            "Use /setup.html from a signed-in dashboard to save each public ESPN league profile.",
        ],
    }


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
        try:
            require_admin(self)
            self.send_json(admin_payload())
        except PermissionError as exc:
            self.send_json({"ok": False, "message": str(exc), "syncedAt": utc_now()}, HTTPStatus.UNAUTHORIZED)
        except ConfigError as exc:
            self.send_json({"ok": False, "message": str(exc), "syncedAt": utc_now()}, HTTPStatus.BAD_REQUEST)

    def do_HEAD(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
