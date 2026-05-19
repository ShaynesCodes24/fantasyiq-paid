from __future__ import annotations

import base64
import json
import os
import sys
import urllib.parse
import urllib.request
from typing import Any


API_BASE = "https://api.stripe.com/v1"
DEFAULT_PAYMENT_LINK_URL = "https://buy.stripe.com/eVq3cvdN71GX84E917efC00"
SUPPORT_EMAIL = "shayneholladay@gmail.com"
WEBSITE_URL = "https://fantasyiq-paid.vercel.app/"
DASHBOARD_URL = "https://fantasyiq-paid.vercel.app/FantasyIQ/"

CONFIRMATION_MESSAGE = (
    "Thanks for subscribing to FantasyIQ. Setup is concierge: email your ESPN "
    f"league ID, season, league name, draft date/time, and logo to {SUPPORT_EMAIL}. "
    "Your dashboard will be configured manually."
)


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def stripe_key() -> str:
    key = env("STRIPE_SECRET_KEY")
    if not key:
        raise SystemExit(
            "Set STRIPE_SECRET_KEY in your local shell first. Do not paste it into chat or commit it."
        )
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
        body = urllib.parse.urlencode(data).encode("utf-8")
        headers["Content-Type"] = "application/x-www-form-urlencoded"

    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        response_body = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Stripe API error {exc.code}: {response_body}") from exc


def find_payment_link_by_url(key: str, url: str) -> dict[str, Any]:
    starting_after = ""
    while True:
        params = {"limit": "100"}
        if starting_after:
            params["starting_after"] = starting_after

        page = stripe_request("GET", "/payment_links", key, params=params)
        links = page.get("data", [])
        for link in links:
            if link.get("url") == url:
                return link

        if not page.get("has_more") or not links:
            break
        starting_after = links[-1]["id"]

    raise SystemExit(
        f"Could not find a Stripe Payment Link with URL {url}. "
        "Set STRIPE_PAYMENT_LINK_ID=plink_... if you know the id."
    )


def payment_link_id(key: str) -> str:
    explicit_id = env("STRIPE_PAYMENT_LINK_ID")
    if explicit_id:
        if not explicit_id.startswith("plink_"):
            raise SystemExit("STRIPE_PAYMENT_LINK_ID should start with plink_.")
        return explicit_id

    link_url = env("STRIPE_PAYMENT_LINK_URL", DEFAULT_PAYMENT_LINK_URL)
    link = find_payment_link_by_url(key, link_url)
    return link["id"]


def update_payment_link(key: str, link_id: str) -> dict[str, Any]:
    return stripe_request(
        "POST",
        f"/payment_links/{link_id}",
        key,
        {
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
            "after_completion[type]": "hosted_confirmation",
            "after_completion[hosted_confirmation][custom_message]": CONFIRMATION_MESSAGE,
            "metadata[product]": "fantasy_iq_concierge",
            "metadata[support_email]": SUPPORT_EMAIL,
            "metadata[website_url]": WEBSITE_URL,
            "metadata[dashboard_url]": DASHBOARD_URL,
        },
    )


def main() -> int:
    key = stripe_key()
    link_id = payment_link_id(key)
    updated = update_payment_link(key, link_id)

    print(f"Updated Stripe Payment Link: {updated['url']}")
    print(f"Payment Link ID: {updated['id']}")
    print("Required checkout fields: ESPN league ID, ESPN season, League name")
    print("After-payment confirmation message is configured.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
