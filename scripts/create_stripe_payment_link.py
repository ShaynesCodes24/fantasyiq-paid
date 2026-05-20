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
PRODUCT_NAME = "FantasyIQ Season Pass"
PRODUCT_DESCRIPTION = "One manually configured dashboard account for up to three public ESPN fantasy football leagues."
UNIT_AMOUNT_CENTS = 3000
CURRENCY = "usd"
SUPPORT_EMAIL = "shayneholladay@gmail.com"
CONFIRMATION_MESSAGE = (
    "Thanks for subscribing to FantasyIQ. If any checkout field was missed, "
    f"email {SUPPORT_EMAIL}. To find IDs in ESPN, open each league in a browser: "
    "leagueId is in the URL after leagueId=, and teamId appears after teamId= "
    "when viewing your team page. Your Season Pass includes up to three leagues."
)


def stripe_key() -> str:
    key = os.environ.get("STRIPE_SECRET_KEY", "").strip()
    if not key:
        raise SystemExit(
            "Set STRIPE_SECRET_KEY in your local shell first. Do not paste it into chat or commit it."
        )
    if not key.startswith(("sk_live_", "sk_test_")):
        raise SystemExit("STRIPE_SECRET_KEY should start with sk_live_ or sk_test_.")
    return key


def post(path: str, data: dict[str, Any], key: str) -> dict[str, Any]:
    encoded = urllib.parse.urlencode(data).encode("utf-8")
    auth = base64.b64encode(f"{key}:".encode("utf-8")).decode("ascii")
    request = urllib.request.Request(
        f"{API_BASE}{path}",
        data=encoded,
        headers={
            "Authorization": f"Basic {auth}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Stripe API error {exc.code}: {body}") from exc


def create_payment_link() -> str:
    key = stripe_key()
    product = post(
        "/products",
        {
            "name": PRODUCT_NAME,
            "description": PRODUCT_DESCRIPTION,
            "metadata[product]": "fantasy_iq_concierge",
            "metadata[support_email]": SUPPORT_EMAIL,
        },
        key,
    )
    price = post(
        "/prices",
        {
            "product": product["id"],
            "currency": CURRENCY,
            "unit_amount": str(UNIT_AMOUNT_CENTS),
            "recurring[interval]": "year",
            "metadata[product]": "fantasy_iq_concierge",
        },
        key,
    )
    payment_link = post(
        "/payment_links",
        {
            "line_items[0][price]": price["id"],
            "line_items[0][quantity]": "1",
            "custom_fields[0][key]": "leagueid",
            "custom_fields[0][label][type]": "custom",
            "custom_fields[0][label][custom]": "Primary ESPN league ID",
            "custom_fields[0][type]": "text",
            "custom_fields[0][optional]": "false",
            "custom_fields[1][key]": "teamid",
            "custom_fields[1][label][type]": "custom",
            "custom_fields[1][label][custom]": "Primary ESPN team ID",
            "custom_fields[1][type]": "numeric",
            "custom_fields[1][optional]": "false",
            "custom_fields[2][key]": "season",
            "custom_fields[2][label][type]": "custom",
            "custom_fields[2][label][custom]": "ESPN season",
            "custom_fields[2][type]": "numeric",
            "custom_fields[2][optional]": "false",
            "after_completion[type]": "hosted_confirmation",
            "after_completion[hosted_confirmation][custom_message]": CONFIRMATION_MESSAGE,
            "metadata[product]": "fantasy_iq_concierge",
            "metadata[support_email]": SUPPORT_EMAIL,
        },
        key,
    )
    return payment_link["url"]


if __name__ == "__main__":
    load_local_env()
    url = create_payment_link()
    print(url)
    print()
    print("Use this URL anywhere the product docs mention the Stripe payment link.")
    sys.exit(0)
