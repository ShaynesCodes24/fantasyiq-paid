from __future__ import annotations

import hashlib
import hmac
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from local_env import load_local_env  # noqa: E402


load_local_env()

SITE_URL = os.environ.get("FANTASYIQ_SITE_URL", "https://myfantasyiq.com").rstrip("/")
TEST_LEAGUE_ID = "584856941"
TEST_TEAM_ID = "5"
TEST_SEASON = "2026"


def env(name: str) -> str:
    return os.environ.get(name, "").strip()


def request_json(url: str, *, method: str = "GET", payload: dict[str, Any] | None = None, headers: dict[str, str] | None = None) -> tuple[int, dict[str, Any]]:
    body = None
    request_headers = headers or {}
    if payload is not None:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        request_headers = {"Content-Type": "application/json", **request_headers}
    request = urllib.request.Request(url, data=body, headers=request_headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = {"message": raw}
        return exc.code, data


def signed_stripe_headers(secret: str, body: bytes, timestamp: int) -> dict[str, str]:
    signed_payload = str(timestamp).encode("utf-8") + b"." + body
    signature = hmac.new(secret.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()
    return {"Content-Type": "application/json", "Stripe-Signature": f"t={timestamp},v1={signature}"}


def post_signed_stripe_event(event: dict[str, Any], secret: str, timestamp: int) -> tuple[int, dict[str, Any]]:
    body = json.dumps(event, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(
        f"{SITE_URL}/api/stripe-webhook",
        data=body,
        headers=signed_stripe_headers(secret, body, timestamp),
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = {"message": raw}
        return exc.code, data


def post_form(url: str, data: dict[str, str], headers: dict[str, str] | None = None) -> tuple[int, dict[str, Any]]:
    body = urllib.parse.urlencode(data).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded", **(headers or {})},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = {"message": raw}
        return exc.code, data


def admin_action(action: str, customer: str) -> dict[str, Any]:
    token = env("FANTASYIQ_ADMIN_TOKEN")
    if not token:
        raise RuntimeError("FANTASYIQ_ADMIN_TOKEN is missing from .env.local.")
    status, data = request_json(
        f"{SITE_URL}/api/admin-customers",
        method="POST",
        payload={"action": action, "customer": customer},
        headers={"x-fantasyiq-admin-token": token},
    )
    if status != 200 or not data.get("ok"):
        raise RuntimeError(f"Admin action {action} failed: {data}")
    return data


def main() -> int:
    secret = env("STRIPE_WEBHOOK_SECRET")
    if not secret:
        print("STRIPE_WEBHOOK_SECRET is missing from .env.local.")
        return 1

    timestamp = int(time.time())
    slug = f"self-serve-smoke-{timestamp}"
    test_email = f"delivered+{slug}@resend.dev"
    event_id = f"evt_{slug.replace('-', '_')}"
    event = {
        "id": event_id,
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": f"cs_{slug.replace('-', '_')}",
                "created": timestamp,
                "customer": "cus_self_serve_smoke",
                "payment_status": "paid",
                "amount_total": 3000,
                "currency": "usd",
                "metadata": {"customer_slug": slug},
                "customer_details": {"name": "FantasyIQ Smoke Customer", "email": test_email},
                "custom_fields": [
                    {"key": "leagueid", "type": "text", "text": {"value": TEST_LEAGUE_ID}},
                    {"key": "teamid", "type": "text", "text": {"value": TEST_TEAM_ID}},
                    {"key": "season", "type": "text", "text": {"value": TEST_SEASON}},
                    {"key": "leaguename", "type": "text", "text": {"value": "No Guts, No Glory"}},
                ],
            }
        },
    }
    created_customer = False
    try:
        status, webhook = post_signed_stripe_event(event, secret, timestamp)
        result = webhook.get("result") or {}
        database = result.get("database") or {}
        if status != 200 or not database.get("persistedDatabase"):
            raise RuntimeError(f"Webhook did not persist database customer: {webhook}")
        setup_email = database.get("setupEmail") or {}
        if os.environ.get("FANTASYIQ_ASSERT_EMAIL_DELIVERY", "1") != "0" and not setup_email.get("sent"):
            raise RuntimeError(f"Webhook did not send setup email: {setup_email}")
        created_customer = True
        print(f"PASS webhook persisted customer {database.get('customerSlug')}")
        print("PASS webhook sent setup email")

        reset = admin_action("reset_access_code", slug)
        access_code = (reset.get("customer") or {}).get("access_code")
        if not access_code:
            raise RuntimeError("Admin reset did not return an access code.")
        print("PASS admin reset returned access code")

        setup_status, setup = post_form(
            f"{SITE_URL}/api/setup-validate",
            {
                "customer": slug,
                "save": "1",
                "leagueLabel": "Smoke Verified League",
                "leagueId": TEST_LEAGUE_ID,
                "teamId": TEST_TEAM_ID,
                "season": TEST_SEASON,
                "scoringType": "ppr",
                "teamCount": "12",
                "flexCount": "1",
                "superflexCount": "0",
                "benchCount": "7",
                "draftRounds": "16",
            },
            {"x-fantasyiq-access-code": access_code},
        )
        if setup_status != 200 or not setup.get("saved"):
            raise RuntimeError(f"Setup save failed: {setup}")
        league_key = setup.get("leagueKey")
        print(f"PASS setup saved league {league_key}")

        customer_status, customer_payload = request_json(
            f"{SITE_URL}/api/customer-status?customer={slug}&league={league_key}",
            headers={"x-fantasyiq-access-code": access_code},
        )
        customer = customer_payload.get("customer") or {}
        if customer_status != 200 or customer.get("source") != "database" or not customer_payload.get("authenticated"):
            raise RuntimeError(f"Customer status failed: {customer_payload}")
        print("PASS customer-status reads database customer")

        login_status, login_payload = request_json(
            f"{SITE_URL}/api/customer-login",
            method="POST",
            payload={"customer": test_email, "accessCode": access_code, "league": league_key},
        )
        if login_status != 200 or not login_payload.get("authenticated") or (login_payload.get("customer") or {}).get("customerSlug") != slug:
            raise RuntimeError(f"Customer login failed: {login_payload}")
        print("PASS customer-login resolves email and access code")

        live_status, live_payload = request_json(
            f"{SITE_URL}/api/live-draft?customer={slug}&league={league_key}",
            headers={"x-fantasyiq-access-code": access_code},
        )
        if live_status != 200 or not live_payload.get("ok") or (live_payload.get("customer") or {}).get("source") != "database":
            raise RuntimeError(f"Live draft failed: {live_payload}")
        print("PASS live-draft reads database league")

        checkout_status, checkout_payload = request_json(
            f"{SITE_URL}/api/add-league-checkout?customer={slug}&league={league_key}",
            headers={"x-fantasyiq-access-code": access_code},
        )
        if checkout_status != 200 or checkout_payload.get("needsPayment"):
            raise RuntimeError(f"Included add-league checkout failed: {checkout_payload}")
        print("PASS add-league checkout routes included slot to setup")

        add_on_event_id = f"evt_{slug.replace('-', '_')}_addon"
        add_on_event = {
            "id": add_on_event_id,
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": f"cs_{slug.replace('-', '_')}_addon",
                    "created": timestamp,
                    "customer": "cus_self_serve_smoke",
                    "client_reference_id": slug,
                    "payment_status": "paid",
                    "amount_total": 500,
                    "currency": "usd",
                    "metadata": {"product": "additional_league"},
                    "customer_details": {"name": "FantasyIQ Smoke Customer", "email": test_email},
                    "custom_fields": [],
                }
            },
        }
        add_on_status, add_on_payload = post_signed_stripe_event(add_on_event, secret, timestamp)
        add_on_database = ((add_on_payload.get("result") or {}).get("database") or {})
        if add_on_status != 200 or (add_on_payload.get("result") or {}).get("action") != "additional_league_paid" or not add_on_database.get("persistedDatabase"):
            raise RuntimeError(f"Add-on webhook failed: {add_on_payload}")
        print("PASS add-on webhook credits additional league")
    finally:
        if created_customer:
            cleanup = admin_action("delete_smoke_customer", slug)
            if not cleanup.get("deleted"):
                raise RuntimeError(f"Cleanup failed: {cleanup}")
            print("PASS cleanup deleted smoke customer")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
