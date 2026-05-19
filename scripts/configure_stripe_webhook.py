from __future__ import annotations

import base64
import json
import os
import sys
import urllib.parse
import urllib.request
from typing import Any

from local_env import load_local_env


API_BASE = "https://api.stripe.com/v1"
DEFAULT_WEBHOOK_URL = "https://fantasyiq-paid.vercel.app/api/stripe-webhook"
ENABLED_EVENTS = [
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.payment_succeeded",
    "invoice.payment_failed",
]


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def stripe_key() -> str:
    key = env("STRIPE_SECRET_KEY")
    if not key:
        raise SystemExit("Set STRIPE_SECRET_KEY in your local shell first.")
    if not key.startswith(("sk_live_", "sk_test_")):
        raise SystemExit("STRIPE_SECRET_KEY should start with sk_live_ or sk_test_.")
    return key


def auth_header(key: str) -> str:
    token = base64.b64encode(f"{key}:".encode("utf-8")).decode("ascii")
    return f"Basic {token}"


def stripe_request(
    method: str,
    path: str,
    key: str,
    data: dict[str, Any] | None = None,
    params: dict[str, str] | None = None,
) -> dict[str, Any]:
    url = f"{API_BASE}{path}"
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"

    body = None
    headers = {"Authorization": auth_header(key)}
    if data is not None:
        body = urllib.parse.urlencode(data, doseq=True).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded"

    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        response_body = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Stripe API error {exc.code}: {response_body}") from exc


def find_webhook_endpoint(key: str, url: str) -> dict[str, Any] | None:
    starting_after = ""
    while True:
        params = {"limit": "100"}
        if starting_after:
            params["starting_after"] = starting_after
        page = stripe_request("GET", "/webhook_endpoints", key, params=params)
        endpoints = page.get("data", [])
        for endpoint in endpoints:
            if endpoint.get("url") == url:
                return endpoint
        if not page.get("has_more") or not endpoints:
            return None
        starting_after = endpoints[-1]["id"]


def event_payload() -> dict[str, Any]:
    return {f"enabled_events[{index}]": event for index, event in enumerate(ENABLED_EVENTS)}


def create_or_update_webhook(key: str, url: str) -> tuple[dict[str, Any], bool]:
    endpoint = find_webhook_endpoint(key, url)
    payload = {
        "url": url,
        "description": "FantasyIQ checkout and subscription fulfillment",
        "metadata[product]": "fantasy_iq_concierge",
        **event_payload(),
    }
    if endpoint:
        updated = stripe_request("POST", f"/webhook_endpoints/{endpoint['id']}", key, payload)
        return updated, False
    created = stripe_request("POST", "/webhook_endpoints", key, payload)
    return created, True


def main() -> int:
    load_local_env()
    key = stripe_key()
    url = env("FANTASYIQ_WEBHOOK_URL", DEFAULT_WEBHOOK_URL)
    endpoint, created = create_or_update_webhook(key, url)
    print(f"{'Created' if created else 'Updated'} Stripe webhook endpoint: {endpoint['url']}")
    print(f"Webhook endpoint ID: {endpoint['id']}")
    print("Enabled events:")
    for event in endpoint.get("enabled_events", []):
        print(f"- {event}")
    if created and endpoint.get("secret"):
        print()
        print("Set this in Vercel as STRIPE_WEBHOOK_SECRET:")
        print(endpoint["secret"])
    elif not created:
        print()
        print("Stripe does not reveal existing webhook secrets. Use Stripe Dashboard if STRIPE_WEBHOOK_SECRET is not already saved.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
