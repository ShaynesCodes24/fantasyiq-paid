from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime


SITE_URL = os.environ.get("FANTASYIQ_SITE_URL", "https://myfantasyiq.com/").rstrip("/")
ROOT_URL = f"{SITE_URL}/"
DASHBOARD_URL = f"{SITE_URL}/FantasyIQ/"
STRIPE_URL = os.environ.get(
    "FANTASYIQ_STRIPE_URL",
    "https://buy.stripe.com/00wdR9dN7gBRacMb9fefC01",
)
API_URL = os.environ.get("FANTASYIQ_API_URL", f"{SITE_URL}/api/live-draft")
BOARDS_URL = os.environ.get("FANTASYIQ_BOARDS_URL", f"{SITE_URL}/api/live-boards")
TRADE_HISTORY_URL = os.environ.get("FANTASYIQ_TRADE_HISTORY_URL", f"{SITE_URL}/api/trade-history")
SETUP_VALIDATE_URL = os.environ.get(
    "FANTASYIQ_SETUP_VALIDATE_URL",
    f"{SITE_URL}/api/setup-validate?leagueId=584856941&teamId=5&season=2026",
)
CUSTOMER_STATUS_URL = os.environ.get("FANTASYIQ_CUSTOMER_STATUS_URL", f"{SITE_URL}/api/customer-status?customer=katelyn")
WEBHOOK_URL = os.environ.get("FANTASYIQ_WEBHOOK_URL", f"{SITE_URL}/api/stripe-webhook")
SUCCESS_URL = os.environ.get("FANTASYIQ_SUCCESS_URL", f"{SITE_URL}/success.html")
PASSWORD_RESET_URL = os.environ.get("FANTASYIQ_PASSWORD_RESET_URL", f"{SITE_URL}/api/customer-password-reset")


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


def post_json(url: str, payload: dict[str, object], timeout: int = 30) -> tuple[int, str]:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "FantasyIQ readiness check",
        },
        method="POST",
    )
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


def dashboard_check() -> CheckResult:
    status, body = fetch(DASHBOARD_URL)
    if status != 200:
        return CheckResult("Dashboard", "FAIL", f"{DASHBOARD_URL} returned HTTP {status}")
    if "FantasyIQ" not in body:
        return CheckResult("Dashboard", "FAIL", f"{DASHBOARD_URL} missing: FantasyIQ")
    if "Demo Mode" in body and "No customer account is loaded" in body:
        return CheckResult("Dashboard", "PASS", f"{DASHBOARD_URL} is in public demo mode")
    if "Active" in body and "Configured for" in body and "Demo Mode" not in body:
        return CheckResult("Dashboard", "PASS", f"{DASHBOARD_URL} is in paid customer mode")
    return CheckResult("Dashboard", "FAIL", f"{DASHBOARD_URL} is neither demo mode nor paid customer mode")


def root_check() -> CheckResult:
    status, body = fetch(ROOT_URL)
    if status != 200:
        return CheckResult("Root URL", "FAIL", f"{ROOT_URL} returned HTTP {status}")
    if "FantasyIQ" not in body:
        return CheckResult("Root URL", "FAIL", f"{ROOT_URL} missing: FantasyIQ")
    if ("Start setup" in body or "Start Season Pass" in body or "Check ESPN compatibility" in body) and "setup.html?mode=precheck" in body:
        return CheckResult("Root URL", "PASS", f"{ROOT_URL} is in public sales mode")
    if "Active" in body and "Configured for" in body:
        return CheckResult("Root URL", "PASS", f"{ROOT_URL} redirects to paid customer dashboard")
    return CheckResult("Root URL", "FAIL", f"{ROOT_URL} is neither sales mode nor paid dashboard mode")


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
        league = payload.get("leagueName") or "configured league"
        mode = "demo league" if payload.get("demoMode") else "customer league"
        return CheckResult("Live draft API", "PASS", f"{API_URL} is syncing {mode}: {league}")

    error = str(payload.get("error", "unknown error"))
    if status == 503 and "FANTASY_IQ_LEAGUE_ID" in error:
        return CheckResult(
            "Live draft API",
            "WARN",
            "Vercel is live, but no customer ESPN league env var is configured yet.",
        )

    return CheckResult("Live draft API", "FAIL", f"{API_URL} returned HTTP {status}: {error}")


def board_freshness_check() -> CheckResult:
    status, body = fetch(BOARDS_URL)
    if status != 200:
        return CheckResult("Board freshness", "FAIL", f"{BOARDS_URL} returned HTTP {status}")
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return CheckResult("Board freshness", "FAIL", f"{BOARDS_URL} returned non-JSON HTTP {status}")

    raw_updated = str(payload.get("updated") or "")
    try:
        updated = datetime.strptime(raw_updated, "%Y-%m-%d").date()
    except ValueError:
        return CheckResult("Board freshness", "WARN", f"Could not parse board updated date: {raw_updated or 'missing'}")

    age_days = max(0, (date.today() - updated).days)
    source = "live" if payload.get("live") else "bundled"
    if age_days <= 45:
        return CheckResult("Board freshness", "PASS", f"{source} rankings updated {raw_updated} ({age_days} day(s) old)")
    if age_days <= 90:
        return CheckResult("Board freshness", "WARN", f"{source} rankings updated {raw_updated} ({age_days} days old)")
    return CheckResult("Board freshness", "FAIL", f"{source} rankings updated {raw_updated} ({age_days} days old)")


def trade_history_check() -> CheckResult:
    status, body = fetch(TRADE_HISTORY_URL)
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return CheckResult("Trade history API", "FAIL", f"{TRADE_HISTORY_URL} returned non-JSON HTTP {status}")

    if status == 200 and payload.get("ok") is True:
        trades = len(payload.get("trades") or [])
        teams = len(payload.get("teams") or [])
        unavailable = len(payload.get("unavailableSeasons") or [])
        detail = f"{TRADE_HISTORY_URL} loaded {teams} teams and {trades} exposed trade(s)"
        if unavailable:
            detail += f"; {unavailable} season(s) unavailable through ESPN"
        return CheckResult("Trade history API", "PASS", detail)

    return CheckResult("Trade history API", "FAIL", f"{TRADE_HISTORY_URL} returned HTTP {status}: {payload.get('error', 'unknown error')}")


def setup_validate_check() -> CheckResult:
    status, body = fetch(SETUP_VALIDATE_URL)
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return CheckResult("Setup validator", "FAIL", f"{SETUP_VALIDATE_URL} returned non-JSON HTTP {status}")
    if status == 200 and payload.get("ok") is True:
        settings = payload.get("leagueSettings") or {}
        slots = settings.get("lineupSlots") if isinstance(settings.get("lineupSlots"), dict) else {}
        missing = [
            label
            for label, value in {
                "scoringType": settings.get("scoringType"),
                "teamCount": settings.get("teamCount"),
                "draftRounds": settings.get("draftRounds"),
                "lineupSlots": slots,
            }.items()
            if not value
        ]
        if missing:
            return CheckResult("Setup validator", "FAIL", f"validated but missing detected setting(s): {', '.join(missing)}")
        return CheckResult(
            "Setup validator",
            "PASS",
            f"{payload.get('leagueName')} / {payload.get('teamName')} validated with {settings.get('scoringLabel') or settings.get('scoringType')}, {settings.get('teamCount')} teams, {settings.get('draftRounds')} rounds",
        )
    return CheckResult("Setup validator", "FAIL", f"{SETUP_VALIDATE_URL} returned HTTP {status}: {payload.get('message', 'unknown error')}")


def customer_status_check() -> CheckResult:
    status, body = fetch(CUSTOMER_STATUS_URL)
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return CheckResult("Customer status API", "FAIL", f"{CUSTOMER_STATUS_URL} returned non-JSON HTTP {status}")
    if status == 200 and payload.get("ok") is True and payload.get("customer"):
        customer = payload["customer"]
        return CheckResult("Customer status API", "PASS", f"{customer.get('customerSlug')} routes to league {customer.get('leagueId')}")
    return CheckResult("Customer status API", "FAIL", f"{CUSTOMER_STATUS_URL} returned HTTP {status}: {payload.get('message', 'unknown error')}")


def password_reset_check() -> CheckResult:
    status, body = post_json(PASSWORD_RESET_URL, {"customer": "readiness-no-account@example.com"})
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return CheckResult("Password reset API", "FAIL", f"{PASSWORD_RESET_URL} returned non-JSON HTTP {status}")
    if status == 200 and payload.get("ok") is True and "password reset email" in str(payload.get("message", "")).lower():
        return CheckResult("Password reset API", "PASS", "endpoint responds without exposing account existence")
    return CheckResult("Password reset API", "FAIL", f"{PASSWORD_RESET_URL} returned HTTP {status}: {payload.get('message', 'unknown error')}")


def webhook_install_check() -> CheckResult:
    status, body = fetch(WEBHOOK_URL)
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return CheckResult("Stripe webhook endpoint", "FAIL", f"{WEBHOOK_URL} returned non-JSON HTTP {status}")
    if status != 200 or payload.get("ok") is not True:
        return CheckResult("Stripe webhook endpoint", "FAIL", f"{WEBHOOK_URL} returned HTTP {status}: {payload.get('message', 'unknown error')}")

    post_status, post_body = post_json(
        WEBHOOK_URL,
        {"id": "evt_readiness_check", "type": "checkout.session.completed", "data": {"object": {}}},
    )
    try:
        post_payload = json.loads(post_body)
    except json.JSONDecodeError:
        return CheckResult("Stripe webhook endpoint", "FAIL", f"{WEBHOOK_URL} POST returned non-JSON HTTP {post_status}")
    message = str(post_payload.get("message", ""))
    if post_status == 400 and "Missing Stripe-Signature header" in message:
        return CheckResult("Stripe webhook endpoint", "PASS", "endpoint installed and rejects unsigned POSTs")
    if post_status == 503 and "STRIPE_WEBHOOK_SECRET" in message:
        return CheckResult("Stripe webhook endpoint", "FAIL", "STRIPE_WEBHOOK_SECRET is not configured in the live deployment")
    if post_status == 400 and "signature" in message.lower():
        return CheckResult("Stripe webhook endpoint", "PASS", "endpoint installed and verifies Stripe signatures")
    return CheckResult("Stripe webhook endpoint", "FAIL", f"{WEBHOOK_URL} POST returned HTTP {post_status}: {message or 'unknown error'}")


def main() -> int:
    checks = [
        root_check(),
        dashboard_check(),
        page_check("Terms", f"{SITE_URL}/terms.html", ["Terms"]),
        page_check("Privacy", f"{SITE_URL}/privacy.html", ["Privacy"]),
        page_check("Refund policy", f"{SITE_URL}/refund-policy.html", ["Refund"]),
        page_check("Help", f"{SITE_URL}/help.html", ["FantasyIQ Q&A"]),
        page_check("Checkout success page", SUCCESS_URL, ["Welcome to FantasyIQ", "Finish league setup"]),
        stripe_check(),
        api_check(),
        board_freshness_check(),
        trade_history_check(),
        page_check("Setup page", f"{SITE_URL}/setup.html", ["Set up FantasyIQ in two minutes", "Create or reset your password", "auto-fills"]),
        page_check("Admin gate page", f"{SITE_URL}/admin-login.html", ["Admin sign in"]),
        setup_validate_check(),
        customer_status_check(),
        password_reset_check(),
        webhook_install_check(),
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
