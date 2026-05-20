from __future__ import annotations

import csv
import json
import urllib.parse
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


def public_site_url() -> str:
    return env("FANTASYIQ_SITE_URL", "https://fantasyiq-paid.vercel.app").rstrip("/")


def dashboard_url(customer_slug: str) -> str:
    return f"{public_site_url()}/FantasyIQ/?customer={urllib.parse.quote(customer_slug)}"


def setup_url(customer_slug: str) -> str:
    return f"{public_site_url()}/setup.html?customer={urllib.parse.quote(customer_slug)}"


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


def database_ops() -> tuple[dict[str, Any], list[dict[str, Any]]]:
    try:
        try:
            from database import list_ops_events, ops_summary
        except ImportError:
            from api.database import list_ops_events, ops_summary
        return ops_summary(), list_ops_events(50)
    except Exception as exc:
        return {"total": 0, "warnings": 0, "errors": 0, "lastEventAt": "", "error": str(exc)}, []


def email_readiness() -> dict[str, Any]:
    try:
        try:
            from email_service import email_status
        except ImportError:
            from api.email_service import email_status
        return email_status()
    except Exception as exc:
        return {"provider": "resend", "configured": False, "error": str(exc)}


def admin_payload() -> dict[str, Any]:
    csv_rows = csv_customers()
    registry_rows = registry_customers()
    database_status, database_rows = database_customers()
    ops_status, ops_events = database_ops()
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
        "email": email_readiness(),
        "opsSummary": ops_status,
        "opsEvents": ops_events,
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


def parse_body(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    length = int(handler.headers.get("Content-Length") or 0)
    if length <= 0:
        return {}
    raw = handler.rfile.read(length).decode("utf-8")
    if "application/json" in handler.headers.get("Content-Type", ""):
        return json.loads(raw or "{}")
    parsed: dict[str, str] = {}
    for pair in raw.split("&"):
        if not pair:
            continue
        key, _, value = pair.partition("=")
        parsed[urllib.parse.unquote_plus(key)] = urllib.parse.unquote_plus(value)
    return parsed


def admin_action(raw: dict[str, Any]) -> dict[str, Any]:
    action = str(raw.get("action") or "").strip()
    customer_slug = str(raw.get("customer") or raw.get("slug") or "").strip()
    try:
        try:
            from database import admin_customer_detail, reset_customer_access_code
        except ImportError:
            from api.database import admin_customer_detail, reset_customer_access_code
    except ImportError as exc:
        raise ConfigError("Database admin tools are unavailable.") from exc

    if action == "customer_detail":
        detail = admin_customer_detail(customer_slug)
        if not detail:
            raise ConfigError("Customer was not found in the database.")
        return {
            "ok": True,
            "action": action,
            "customer": detail,
            "dashboardUrl": dashboard_url(detail["slug"]),
            "setupUrl": setup_url(detail["slug"]),
            "syncedAt": utc_now(),
        }

    if action == "reset_access_code":
        detail = reset_customer_access_code(customer_slug)
        if not detail:
            raise ConfigError("Customer was not found in the database.")
        return {
            "ok": True,
            "action": action,
            "customer": detail,
            "dashboardUrl": dashboard_url(detail["slug"]),
            "setupUrl": setup_url(detail["slug"]),
            "syncedAt": utc_now(),
        }

    if action == "send_setup_email":
        detail = admin_customer_detail(customer_slug)
        if not detail:
            raise ConfigError("Customer was not found in the database.")
        try:
            try:
                from email_service import send_customer_setup_email
            except ImportError:
                from api.email_service import send_customer_setup_email
            email_result = send_customer_setup_email(
                detail,
                league_key=str(detail.get("default_league_key") or ""),
                idempotency_key=f"fantasyiq-admin-setup-{detail['slug']}-{int(datetime.now(timezone.utc).timestamp())}",
            )
        except Exception as exc:
            email_result = {"sent": False, "reason": str(exc)}
        return {
            "ok": True,
            "action": action,
            "customer": {
                "slug": detail.get("slug"),
                "customer_name": detail.get("customer_name"),
                "email": detail.get("email"),
            },
            "email": email_result,
            "syncedAt": utc_now(),
        }

    if action == "delete_smoke_customer":
        try:
            try:
                from database import delete_smoke_customer
            except ImportError:
                from api.database import delete_smoke_customer
            deleted = delete_smoke_customer(customer_slug)
        except Exception:
            deleted = False
        return {
            "ok": True,
            "action": action,
            "deleted": deleted,
            "syncedAt": utc_now(),
        }

    raise ConfigError("Unsupported admin action.")


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

    def do_POST(self) -> None:
        try:
            require_admin(self)
            self.send_json(admin_action(parse_body(self)))
        except PermissionError as exc:
            self.send_json({"ok": False, "message": str(exc), "syncedAt": utc_now()}, HTTPStatus.UNAUTHORIZED)
        except (ConfigError, json.JSONDecodeError) as exc:
            self.send_json({"ok": False, "message": str(exc), "syncedAt": utc_now()}, HTTPStatus.BAD_REQUEST)

    def do_HEAD(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
