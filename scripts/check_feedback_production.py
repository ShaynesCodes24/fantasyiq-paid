from __future__ import annotations

import argparse
import http.cookiejar
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from local_env import load_local_env  # noqa: E402


LOCAL_SECRET_KEYS = {
    "FANTASYIQ_ADMIN_TOKEN",
    "FANTASYIQ_ADMIN_GATE_PASSWORD",
    "FANTASYIQ_ADMIN_GATE_SECRET",
    "DATABASE_URL",
    "RESEND_API_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
}


def load_env() -> None:
    load_local_env(str(ROOT / ".env.local"))
    production_env = ROOT / ".env.production.local"
    if not production_env.exists():
        return
    for raw_line in production_env.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key in LOCAL_SECRET_KEYS:
            continue
        if key and value:
            os.environ[key] = value


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, "").strip() or default


def request_json(
    opener: urllib.request.OpenerDirector,
    url: str,
    *,
    method: str = "GET",
    payload: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> tuple[int, dict[str, Any]]:
    body = None
    request_headers = {"User-Agent": "FantasyIQ feedback production check", **(headers or {})}
    if payload is not None:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        request_headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=body, headers=request_headers, method=method)
    try:
        with opener.open(request, timeout=45) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = {"message": raw}
        return exc.code, data


def fetch_text(url: str) -> tuple[int, str]:
    request = urllib.request.Request(url, headers={"User-Agent": "FantasyIQ feedback production check"})
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            return response.status, response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def admin_opener(site_url: str) -> urllib.request.OpenerDirector:
    gate_password = env("FANTASYIQ_ADMIN_GATE_PASSWORD")
    require(bool(gate_password), "FANTASYIQ_ADMIN_GATE_PASSWORD is missing locally.")
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    status, payload = request_json(
        opener,
        f"{site_url}/api/admin-gate",
        method="POST",
        payload={"password": gate_password},
    )
    require(status == 200 and payload.get("ok") is True, f"Admin gate failed: {payload.get('message') or status}")
    return opener


def admin_action(opener: urllib.request.OpenerDirector, site_url: str, action: str, **extra: Any) -> dict[str, Any]:
    token = env("FANTASYIQ_ADMIN_TOKEN")
    require(bool(token), "FANTASYIQ_ADMIN_TOKEN is missing locally.")
    status, payload = request_json(
        opener,
        f"{site_url}/api/admin-customers",
        method="POST",
        payload={"action": action, **extra},
        headers={"x-fantasyiq-admin-token": token},
    )
    require(status == 200 and payload.get("ok") is True, f"Admin action {action} failed: {payload}")
    return payload


def check_email_templates() -> None:
    sys.path.insert(0, str(ROOT))
    from api.email_service import customer_password_reset_email, customer_setup_email  # noqa: WPS433

    setup = customer_setup_email(
        customer_name="Production Check",
        email="support@myfantasyiq.com",
        customer_slug="production-feedback-check",
        access_code="TEST-CODE",
        league_key="primary",
    )
    reset = customer_password_reset_email(
        customer_name="Production Check",
        email="support@myfantasyiq.com",
        customer_slug="production-feedback-check",
        access_code="TEST-CODE",
        league_key="primary",
    )
    for label, message in {"setup": setup, "password reset": reset}.items():
        combined = f"{message.get('text', '')}\n{message.get('html', '')}"
        require("/feedback.html?customer=production-feedback-check" in combined, f"{label} email is missing feedback link.")
    print("PASS email templates include feedback links")


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify production feedback storage and admin ops visibility.")
    parser.add_argument("--send-smoke-email", action="store_true", help="Run the existing admin checkout smoke test, which attempts a setup email through Resend.")
    args = parser.parse_args()

    load_env()
    site_url = env("FANTASYIQ_SITE_URL", "https://myfantasyiq.com").rstrip("/")
    require(site_url.startswith("https://"), "FANTASYIQ_SITE_URL must point at the production https site.")

    status, body = fetch_text(f"{site_url}/feedback.html")
    require(status == 200 and "Help improve MyFantasyIQ" in body, f"feedback page failed: HTTP {status}")
    print("PASS production feedback page loads")

    check_email_templates()

    opener = admin_opener(site_url)
    admin_status = admin_action(opener, site_url, "ops_events", limit=1)
    database = admin_status.get("opsSummary") or {}
    require("total" in database, "Admin ops summary did not load; database may be unavailable.")
    print("PASS production admin gate and ops database are reachable")

    schema_result = admin_action(opener, site_url, "apply_database_schema")
    require((schema_result.get("database") or {}).get("enabled") is True, "Production database is not enabled after schema check.")
    print("PASS production database schema apply/check completed")

    marker = f"production-feedback-check-{int(time.time())}"
    feedback_payload = {
        "email": "ops+feedback-check@myfantasyiq.com",
        "customer": "production-feedback-check",
        "league": "primary",
        "onboardingEase": "Strongly Agree",
        "dashboardClarity": "Strongly Agree",
        "productValue": "Strongly Agree",
        "decisionConfidence": "Strongly Agree",
        "issues": marker,
        "improvements": "Automated production storage verification.",
        "satisfaction": 5,
        "source": "production_feedback_check",
    }
    feedback_status, feedback_result = request_json(
        urllib.request.build_opener(),
        f"{site_url}/api/customer-feedback",
        method="POST",
        payload=feedback_payload,
    )
    require(feedback_status == 200 and feedback_result.get("ok") is True, f"feedback submit failed: {feedback_result}")
    print("PASS production feedback endpoint accepted survey")

    events = admin_action(opener, site_url, "ops_events", eventType="feedback.new_customer_survey", limit=10).get("opsEvents") or []
    found = any(
        isinstance(event, dict)
        and event.get("event_type") == "feedback.new_customer_survey"
        and ((event.get("payload") or {}).get("issues") == marker)
        for event in events
    )
    require(found, "feedback.new_customer_survey event was not visible in admin ops.")
    print("PASS feedback.new_customer_survey event is visible in admin ops")

    if args.send_smoke_email:
        smoke = admin_action(opener, site_url, "self_serve_smoke_test")
        require(smoke.get("ok") is True, f"self-serve smoke test failed: {smoke}")
        if smoke.get("setupEmailSent"):
            print("PASS production setup email smoke sent through Resend")
        else:
            print(f"WARN production setup email smoke did not send: {smoke.get('setupEmailReason') or 'unknown'}")

    print("PASS production feedback verification completed")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as exc:
        print(f"FAIL {exc}")
        raise SystemExit(1)
