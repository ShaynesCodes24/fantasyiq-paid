from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass


SITE_URL = os.environ.get("FANTASYIQ_SITE_URL", "https://fantasyiq-paid.vercel.app/").rstrip("/")
ROOT_URL = f"{SITE_URL}/"
DASHBOARD_URL = f"{SITE_URL}/FantasyIQ/"
STRIPE_URL = os.environ.get(
    "FANTASYIQ_STRIPE_URL",
    "https://buy.stripe.com/eVq3cvdN71GX84E917efC00",
)
API_URL = os.environ.get("FANTASYIQ_API_URL", f"{SITE_URL}/api/live-draft")


@dataclass
class CheckResult:
    name: str
    status: str
    detail: str


def fetch(url: str, timeout: int = 30) -> tuple[int, str]:
    request = urllib.request.Request(url, headers={"User-Agent": "FantasyIQ readiness check"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")


def page_check(name: str, url: str, required_text: list[str]) -> CheckResult:
    status, body = fetch(url)
    if status != 200:
        return CheckResult(name, "FAIL", f"{url} returned HTTP {status}")
    missing = [text for text in required_text if text not in body]
    if missing:
        return CheckResult(name, "FAIL", f"{url} missing: {', '.join(missing)}")
    return CheckResult(name, "PASS", url)


def stripe_check() -> CheckResult:
    status, _ = fetch(STRIPE_URL)
    if 200 <= status < 400:
        return CheckResult("Stripe link", "PASS", STRIPE_URL)
    return CheckResult("Stripe link", "FAIL", f"{STRIPE_URL} returned HTTP {status}")


def api_check() -> CheckResult:
    status, body = fetch(API_URL)
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return CheckResult("Live draft API", "FAIL", f"{API_URL} returned non-JSON HTTP {status}")

    if status == 200 and payload.get("ok") is True:
        league = payload.get("league", {}).get("name", "configured league")
        return CheckResult("Live draft API", "PASS", f"{API_URL} is syncing {league}")

    error = str(payload.get("error", "unknown error"))
    if status == 503 and "FANTASY_IQ_LEAGUE_ID" in error:
        return CheckResult(
            "Live draft API",
            "WARN",
            "Vercel is live, but no customer ESPN league env var is configured yet.",
        )

    return CheckResult("Live draft API", "FAIL", f"{API_URL} returned HTTP {status}: {error}")


def main() -> int:
    checks = [
        page_check("Landing page", ROOT_URL, ["FantasyIQ", "buy.stripe.com"]),
        page_check("Dashboard", DASHBOARD_URL, ["FantasyIQ", "Subscribe", "buy.stripe.com"]),
        page_check("Terms", f"{SITE_URL}/terms.html", ["Terms"]),
        page_check("Privacy", f"{SITE_URL}/privacy.html", ["Privacy"]),
        page_check("Refund policy", f"{SITE_URL}/refund-policy.html", ["Refund"]),
        stripe_check(),
        api_check(),
    ]

    for result in checks:
        print(f"{result.status:4} {result.name}: {result.detail}")

    failures = [result for result in checks if result.status == "FAIL"]
    warnings = [result for result in checks if result.status == "WARN"]
    print()
    print(f"Summary: {len(failures)} failed, {len(warnings)} warning(s), {len(checks)} checks total.")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
