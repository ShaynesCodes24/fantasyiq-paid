from __future__ import annotations

import base64
import json
import os
import sys
import urllib.parse
import urllib.request
from typing import Any


API_BASE = "https://api.stripe.com/v1"
PRODUCT_NAME = "Fantasy IQ League Dashboard"
PRODUCT_DESCRIPTION = "One manually configured dashboard for one public ESPN fantasy football league."
UNIT_AMOUNT_CENTS = 2500
CURRENCY = "usd"
SUPPORT_EMAIL = "shayneholladay@gmail.com"


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
            "custom_fields[0][label][custom]": "ESPN league ID",
            "custom_fields[0][type]": "text",
            "custom_fields[0][optional]": "false",
            "custom_fields[1][key]": "season",
            "custom_fields[1][label][type]": "custom",
            "custom_fields[1][label][custom]": "ESPN season",
            "custom_fields[1][type]": "numeric",
            "custom_fields[1][optional]": "false",
            "custom_fields[2][key]": "leaguename",
            "custom_fields[2][label][type]": "custom",
            "custom_fields[2][label][custom]": "League name",
            "custom_fields[2][type]": "text",
            "custom_fields[2][optional]": "false",
            "metadata[product]": "fantasy_iq_concierge",
            "metadata[support_email]": SUPPORT_EMAIL,
        },
        key,
    )
    return payment_link["url"]


if __name__ == "__main__":
    url = create_payment_link()
    print(url)
    print()
    print("Replace PAYMENT_LINK_PLACEHOLDER in the product docs with this URL.")
    sys.exit(0)
