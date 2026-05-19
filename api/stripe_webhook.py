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
            "nextStep": "Run setup validation, then configure Vercel/customer registry.",
        }
    if event_type in {"customer.subscription.deleted", "invoice.payment_failed"}:
        return {
            "action": "subscription_attention_required",
            "status": "needs_review",
            "stripeObjectId": data_object.get("id"),
            "nextStep": "Review the subscription in Stripe and disable dashboard access if needed.",
        }
    if event_type == "customer.subscription.updated":
        return {
            "action": "subscription_updated",
            "status": data_object.get("status") or "updated",
            "stripeObjectId": data_object.get("id"),
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
