from __future__ import annotations

import argparse
import http.cookiejar
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from local_env import load_local_env  # noqa: E402


def env(name: str) -> str:
    return os.environ.get(name, "").strip()


def request_json(
    url: str,
    *,
    payload: dict[str, Any] | None = None,
    token: str = "",
    opener: urllib.request.OpenerDirector | None = None,
) -> tuple[int, dict[str, Any]]:
    body = None
    method = "GET"
    headers = {"x-fantasyiq-admin-token": token} if token else {}
    if payload is not None:
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        headers["Content-Type"] = "application/json"
        method = "POST"
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        open_request = opener.open if opener else urllib.request.urlopen
        with open_request(request, timeout=30) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = {"message": raw}
        return exc.code, data


def admin_opener(site_url: str) -> urllib.request.OpenerDirector:
    gate_password = env("FANTASYIQ_ADMIN_GATE_PASSWORD")
    if not gate_password:
        raise RuntimeError("FANTASYIQ_ADMIN_GATE_PASSWORD is missing from .env.local.")
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    status, payload = request_json(
        f"{site_url.rstrip('/')}/api/admin-gate",
        payload={"password": gate_password},
        opener=opener,
    )
    if status != 200 or not payload.get("ok"):
        raise RuntimeError(f"Admin gate sign-in failed: {payload.get('message') or status}")
    return opener


def main() -> int:
    parser = argparse.ArgumentParser(description="Check FantasyIQ transactional email readiness.")
    parser.add_argument("--send", metavar="CUSTOMER_SLUG", help="Send the setup email to a customer through the admin action.")
    args = parser.parse_args()
    load_local_env()

    site_url = env("FANTASYIQ_SITE_URL") or "https://myfantasyiq.com"
    token = env("FANTASYIQ_ADMIN_TOKEN")
    if not token:
        print("FANTASYIQ_ADMIN_TOKEN is missing from .env.local.")
        return 1
    try:
        opener = admin_opener(site_url)
    except RuntimeError as exc:
        print(str(exc))
        return 1

    status, payload = request_json(f"{site_url.rstrip('/')}/api/admin-customers", token=token, opener=opener)
    if status != 200 or not payload.get("ok"):
        print(f"Admin email readiness check failed: {payload.get('message') or status}")
        return 1

    email = payload.get("email") or {}
    if not email.get("configured"):
        print("Email provider is not ready: RESEND_API_KEY is not configured in Vercel.")
        return 1

    print(f"PASS email provider ready: {email.get('provider')} / {email.get('from')}")
    if args.send:
        send_status, send_payload = request_json(
            f"{site_url.rstrip('/')}/api/admin-customers",
            payload={"action": "send_setup_email", "customer": args.send},
            token=token,
            opener=opener,
        )
        result = send_payload.get("email") or {}
        if send_status != 200 or not send_payload.get("ok") or not result.get("sent"):
            print(f"Setup email send failed: {result.get('reason') or send_payload.get('message') or send_status}")
            return 1
        print(f"PASS setup email sent for {args.send}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
