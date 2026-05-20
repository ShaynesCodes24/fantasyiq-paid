from __future__ import annotations

import csv
import hashlib
import hmac
import json
import os
import time
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from typing import Any

try:
    from customer_context import DEFAULT_SEASON, env
except ModuleNotFoundError:
    from api.customer_context import DEFAULT_SEASON, env


WEBHOOK_TOLERANCE_SECONDS = 300
CUSTOMER_FIELDS = [
    "customer_name",
    "email",
    "league_id",
    "team_id",
    "season",
    "league_name",
    "payment_provider",
    "payment_reference",
    "paid_at",
    "renewal_date",
    "dashboard_url",
    "status",
    "notes",
]


class WebhookError(RuntimeError):
    pass


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def utc_date_from_timestamp(timestamp: int) -> str:
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).date().isoformat()


def renewal_date(paid_at: str) -> str:
    paid = datetime.strptime(paid_at, "%Y-%m-%d").date()
    try:
        return paid.replace(year=paid.year + 1).isoformat()
    except ValueError:
        return paid.replace(year=paid.year + 1, day=28).isoformat()


def parse_signature(header: str) -> dict[str, list[str]]:
    parts: dict[str, list[str]] = {}
    for item in header.split(","):
        if "=" not in item:
            continue
        key, value = item.split("=", 1)
        parts.setdefault(key.strip(), []).append(value.strip())
    return parts


def verify_signature(payload: bytes, signature_header: str, secret: str) -> None:
    if not signature_header:
        raise WebhookError("Missing Stripe-Signature header.")
    parsed = parse_signature(signature_header)
    timestamp = (parsed.get("t") or [""])[0]
    signatures = parsed.get("v1") or []
    if not timestamp or not signatures:
        raise WebhookError("Stripe signature header is missing timestamp or v1 signature.")
    try:
        timestamp_int = int(timestamp)
    except ValueError as exc:
        raise WebhookError("Stripe signature timestamp is invalid.") from exc
    if abs(time.time() - timestamp_int) > WEBHOOK_TOLERANCE_SECONDS:
        raise WebhookError("Stripe webhook timestamp is outside the allowed tolerance.")

    signed_payload = timestamp.encode("utf-8") + b"." + payload
    expected = hmac.new(secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
    if not any(hmac.compare_digest(expected, signature) for signature in signatures):
        raise WebhookError("Stripe webhook signature verification failed.")


def custom_field_value(session: dict[str, Any], key: str) -> str:
    for field in session.get("custom_fields") or []:
        if field.get("key") != key:
            continue
        field_type = field.get("type") or "text"
        value_data = field.get(field_type) or {}
        return str(value_data.get("value") or "").strip()
    return ""


def checkout_row(session: dict[str, Any]) -> dict[str, str]:
    customer = session.get("customer_details") or {}
    paid_at = utc_date_from_timestamp(int(session.get("created") or time.time()))
    league_id = custom_field_value(session, "leagueid")
    team_id = custom_field_value(session, "teamid")
    season = custom_field_value(session, "season") or str(DEFAULT_SEASON)
    league_name = custom_field_value(session, "leaguename")
    dashboard_url = env("FANTASYIQ_DASHBOARD_URL", "https://fantasyiq-paid.vercel.app/FantasyIQ/")
    return {
        "customer_name": str(customer.get("name") or "").strip(),
        "email": str(customer.get("email") or "").strip(),
        "league_id": league_id,
        "team_id": team_id,
        "season": season,
        "league_name": league_name,
        "payment_provider": "stripe",
        "payment_reference": str(session.get("id") or ""),
        "paid_at": paid_at,
        "renewal_date": renewal_date(paid_at),
        "dashboard_url": dashboard_url,
        "status": "paid_needs_setup",
        "notes": "Received by Stripe webhook. Validate ESPN league/team, then configure customer dashboard.",
    }


def metadata_value(session: dict[str, Any], *keys: str) -> str:
    metadata = session.get("metadata") or {}
    for key in keys:
        value = metadata.get(key)
        if value not in (None, ""):
            return str(value).strip()
    return ""


def checkout_customer_slug(session: dict[str, Any], row: dict[str, str]) -> str:
    try:
        try:
            from database import customer_slug_from_email, slugify
        except ImportError:
            from api.database import customer_slug_from_email, slugify
    except ImportError:
        def slugify(value: str) -> str:
            cleaned = "".join(char.lower() if char.isalnum() else "-" for char in str(value or "").strip())
            return cleaned.strip("-") or "customer"

        def customer_slug_from_email(email: str) -> str:
            return slugify(email)

    explicit = (
        metadata_value(session, "customer_slug", "customer", "dashboard")
        or custom_field_value(session, "customerslug")
        or custom_field_value(session, "customer")
    )
    return slugify(explicit or customer_slug_from_email(row.get("email", "")) or row.get("customer_name", ""))


def persist_checkout_to_database(event: dict[str, Any], session: dict[str, Any], row: dict[str, str]) -> dict[str, Any]:
    try:
        try:
            from database import DatabaseUnavailable, database_status, record_stripe_event, upsert_customer, upsert_league
        except ImportError:
            from api.database import DatabaseUnavailable, database_status, record_stripe_event, upsert_customer, upsert_league

        status = database_status()
        if not status["enabled"]:
            return {"databaseEnabled": status["enabled"], "persistedDatabase": False, "reason": "database_not_connected"}

        customer_slug = checkout_customer_slug(session, row)
        saved_customer = upsert_customer(
            slug=customer_slug,
            customer_name=row["customer_name"],
            email=row["email"],
            status=row["status"],
            stripe_customer_id=str(session.get("customer") or ""),
            subscription_status=str(session.get("payment_status") or "paid"),
            included_league_limit=int(env("FANTASYIQ_INCLUDED_LEAGUE_LIMIT", "3") or 3),
        )

        if row.get("league_id") and row.get("team_id"):
            upsert_league(
                customer_slug=saved_customer.get("slug") or customer_slug,
                league_key=metadata_value(session, "league_key") or row.get("league_name") or row.get("league_id") or "league",
                label=row.get("league_name") or "Checkout league",
                league_name=row.get("league_name") or "",
                league_id=row.get("league_id"),
                team_id=row.get("team_id"),
                season=row.get("season"),
                league_settings={"source": "Stripe checkout intake"},
                status="pending_validation",
                source="stripe_checkout",
            )

        inserted_event = record_stripe_event(
            stripe_event_id=str(event.get("id") or ""),
            event_type=str(event.get("type") or ""),
            stripe_object_id=str(session.get("id") or ""),
            customer_slug=saved_customer.get("slug") or customer_slug,
            email=row["email"],
            amount_total=session.get("amount_total"),
            currency=str(session.get("currency") or ""),
            status=row["status"],
            payload={"session": session},
        )
        try:
            try:
                from email_service import send_customer_setup_email
            except ImportError:
                from api.email_service import send_customer_setup_email
            email_result = send_customer_setup_email(
                saved_customer,
                league_key=saved_customer.get("default_league_key") or metadata_value(session, "league_key") or "",
                renewal_date=row.get("renewal_date", ""),
                idempotency_key=f"fantasyiq-setup-{event.get('id') or session.get('id')}",
            )
        except Exception:
            email_result = {"sent": False, "reason": "email_send_failed"}
        return {
            "databaseEnabled": True,
            "persistedDatabase": True,
            "insertedEvent": inserted_event,
            "customerSlug": saved_customer.get("slug") or customer_slug,
            "setupEmail": email_result,
        }
    except (DatabaseUnavailable, ValueError) as exc:
        return {"databaseEnabled": False, "persistedDatabase": False, "reason": str(exc)}
    except Exception:
        return {
            "databaseEnabled": True,
            "persistedDatabase": False,
            "reason": "database_save_failed",
        }


def persist_generic_stripe_event(event: dict[str, Any], data_object: dict[str, Any], status: str = "") -> dict[str, Any]:
    try:
        try:
            from database import database_status, record_stripe_event
        except ImportError:
            from api.database import database_status, record_stripe_event

        database_state = database_status()
        if not database_state["enabled"]:
            return {"databaseEnabled": database_state["enabled"], "persistedDatabase": False}
        inserted = record_stripe_event(
            stripe_event_id=str(event.get("id") or ""),
            event_type=str(event.get("type") or ""),
            stripe_object_id=str(data_object.get("id") or ""),
            email=str((data_object.get("customer_details") or {}).get("email") or ""),
            status=status or str(data_object.get("status") or ""),
            payload={"object": data_object},
        )
        return {"databaseEnabled": True, "persistedDatabase": True, "insertedEvent": inserted}
    except Exception:
        return {"databaseEnabled": True, "persistedDatabase": False, "reason": "database_save_failed"}


def append_customer_locally(row: dict[str, str]) -> bool:
    path_value = env("FANTASYIQ_CUSTOMER_CSV_PATH")
    if not path_value:
        return False
    path = Path(path_value)
    path.parent.mkdir(parents=True, exist_ok=True)
    existing = set()
    if path.exists():
        with path.open("r", newline="", encoding="utf-8") as handle:
            existing = {item.get("payment_reference", "") for item in csv.DictReader(handle)}
    if row["payment_reference"] in existing:
        return False
    write_header = not path.exists()
    with path.open("a", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CUSTOMER_FIELDS)
        if write_header:
            writer.writeheader()
        writer.writerow({field: row.get(field, "") for field in CUSTOMER_FIELDS})
    return True


def append_event_log(event: dict[str, Any], result: dict[str, Any]) -> bool:
    path_value = env("FANTASYIQ_WEBHOOK_LOG_PATH")
    if not path_value:
        return False
    path = Path(path_value)
    path.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "receivedAt": utc_now(),
        "eventId": event.get("id"),
        "eventType": event.get("type"),
        "result": result,
    }
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(record, separators=(",", ":")) + "\n")
    return True


def process_event(event: dict[str, Any]) -> dict[str, Any]:
    event_type = event.get("type")
    data_object = ((event.get("data") or {}).get("object") or {})
    if event_type == "checkout.session.completed":
        row = checkout_row(data_object)
        appended = append_customer_locally(row)
        database_result = persist_checkout_to_database(event, data_object, row)
        return {
            "action": "customer_paid",
            "status": row["status"],
            "customer": {
                "customer_name": row["customer_name"],
                "email": row["email"],
                "league_id": row["league_id"],
                "team_id": row["team_id"],
                "season": row["season"],
                "dashboard_url": row["dashboard_url"],
            },
            "persistedLocally": appended,
            "database": database_result,
            "nextStep": "Run setup validation. When DATABASE_URL is connected, this checkout creates the customer account record automatically.",
        }
    if event_type in {"customer.subscription.deleted", "invoice.payment_failed"}:
        database_result = persist_generic_stripe_event(event, data_object, "needs_review")
        return {
            "action": "subscription_attention_required",
            "status": "needs_review",
            "stripeObjectId": data_object.get("id"),
            "database": database_result,
            "nextStep": "Review the subscription in Stripe and disable dashboard access if needed.",
        }
    if event_type == "customer.subscription.updated":
        database_result = persist_generic_stripe_event(event, data_object, str(data_object.get("status") or "updated"))
        return {
            "action": "subscription_updated",
            "status": data_object.get("status") or "updated",
            "stripeObjectId": data_object.get("id"),
            "database": database_result,
        }
    return {"action": "ignored", "eventType": event_type}


class handler(BaseHTTPRequestHandler):
    def send_json(self, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:
        secret = env("STRIPE_WEBHOOK_SECRET")
        if not secret:
            self.send_json({"ok": False, "message": "STRIPE_WEBHOOK_SECRET is not configured."}, HTTPStatus.SERVICE_UNAVAILABLE)
            return

        length = int(self.headers.get("Content-Length") or 0)
        payload = self.rfile.read(length)
        try:
            verify_signature(payload, self.headers.get("Stripe-Signature", ""), secret)
            event = json.loads(payload.decode("utf-8"))
            result = process_event(event)
            logged = append_event_log(event, result)
            self.send_json({"ok": True, "received": True, "logged": logged, "result": result})
        except (WebhookError, json.JSONDecodeError) as exc:
            self.send_json({"ok": False, "message": str(exc)}, HTTPStatus.BAD_REQUEST)
        except Exception as exc:
            self.send_json({"ok": False, "message": str(exc)}, HTTPStatus.INTERNAL_SERVER_ERROR)

    def do_GET(self) -> None:
        self.send_json(
            {
                "ok": True,
                "message": "Stripe webhook endpoint is installed. Configure it in Stripe for checkout.session.completed and subscription events.",
                "requires": ["STRIPE_WEBHOOK_SECRET"],
            }
        )

    def do_HEAD(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
