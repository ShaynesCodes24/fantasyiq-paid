from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SITE_URL = os.environ.get("FANTASYIQ_SITE_URL", "https://myfantasyiq.com").rstrip("/")
ADMIN_URL = os.environ.get("FANTASYIQ_ADMIN_URL", f"{SITE_URL}/api/admin-customers")
STRICT = os.environ.get("FANTASYIQ_MONITORING_STRICT", "").strip().lower() in {"1", "true", "yes"}


@dataclass
class Result:
    name: str
    status: str
    detail: str


def load_env() -> None:
    sys.path.insert(0, str(ROOT / "scripts"))
    try:
        from local_env import load_local_env
    except ImportError:
        return
    load_local_env(str(ROOT / ".env.local"))


def fetch(url: str, timeout: int = 30, headers: dict[str, str] | None = None) -> tuple[int, str]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "FantasyIQ production monitoring check",
            **(headers or {}),
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as exc:
        return 0, str(exc)


def post_json(
    url: str,
    payload: dict[str, Any],
    timeout: int = 30,
    headers: dict[str, str] | None = None,
) -> tuple[int, str]:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "User-Agent": "FantasyIQ production monitoring check",
            **(headers or {}),
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as exc:
        return 0, str(exc)


def parse_json(name: str, status: int, body: str) -> tuple[dict[str, Any] | None, Result | None]:
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return None, Result(name, "FAIL", f"returned non-JSON HTTP {status}")
    if not isinstance(payload, dict):
        return None, Result(name, "FAIL", f"returned unexpected JSON shape HTTP {status}")
    return payload, None


def page_check(name: str, path: str, required_text: str) -> Result:
    url = f"{SITE_URL}{path}"
    status, body = fetch(url)
    if status != 200:
        return Result(name, "FAIL", f"{url} returned HTTP {status}")
    if required_text not in body:
        return Result(name, "FAIL", f"{url} is missing expected text: {required_text}")
    return Result(name, "PASS", url)


def json_endpoint_check(name: str, path: str, required_ok: bool = True) -> Result:
    url = f"{SITE_URL}{path}"
    status, body = fetch(url)
    payload, error = parse_json(name, status, body)
    if error:
        return error
    if required_ok and not payload.get("ok"):
        message = payload.get("error") or payload.get("message") or "unknown error"
        return Result(name, "FAIL", f"{url} returned HTTP {status}: {message}")
    if status != 200:
        return Result(name, "FAIL", f"{url} returned HTTP {status}")
    return Result(name, "PASS", url)


def live_boards_check() -> Result:
    url = f"{SITE_URL}/api/live-boards?limit=20"
    status, body = fetch(url)
    payload, error = parse_json("Live boards API", status, body)
    if error:
        return error
    if status != 200:
        return Result("Live boards API", "FAIL", f"{url} returned HTTP {status}")
    boards = payload.get("boards")
    if not isinstance(boards, dict):
        return Result("Live boards API", "FAIL", "response did not include a boards object")
    row_count = 0
    for board in boards.values():
        if isinstance(board, dict) and isinstance(board.get("rows"), list):
            row_count += len(board["rows"])
    updated = payload.get("updated") or payload.get("syncedAt") or "unknown update time"
    if row_count <= 0:
        return Result("Live boards API", "FAIL", f"no board rows returned; updated={updated}")
    source = "live" if payload.get("live") else "bundled"
    return Result("Live boards API", "PASS", f"{source} boards returned {row_count} row(s); updated={updated}")


def webhook_boundary_check() -> Result:
    url = f"{SITE_URL}/api/stripe-webhook"
    status, body = fetch(url)
    payload, error = parse_json("Stripe webhook boundary", status, body)
    if error:
        return error
    if status != 200 or payload.get("ok") is not True:
        return Result("Stripe webhook boundary", "FAIL", f"GET returned HTTP {status}")

    post_status, post_body = post_json(url, {"id": "evt_monitoring_check", "type": "checkout.session.completed"})
    post_payload, post_error = parse_json("Stripe webhook boundary", post_status, post_body)
    if post_error:
        return post_error
    message = str(post_payload.get("message") or "")
    if post_status == 400 and ("signature" in message.lower() or "Stripe-Signature" in message):
        return Result("Stripe webhook boundary", "PASS", "endpoint is installed and rejects unsigned POSTs")
    if post_status == 503 and "STRIPE_WEBHOOK_SECRET" in message:
        return Result("Stripe webhook boundary", "FAIL", "STRIPE_WEBHOOK_SECRET is not configured in production")
    return Result("Stripe webhook boundary", "FAIL", f"unsigned POST returned HTTP {post_status}: {message or 'unknown error'}")


def admin_auth_boundary_check() -> Result:
    status, body = fetch(ADMIN_URL)
    payload, error = parse_json("Admin auth boundary", status, body)
    if error:
        return error
    if status == 401 and payload.get("ok") is False:
        return Result("Admin auth boundary", "PASS", "admin endpoint rejects missing token")
    return Result("Admin auth boundary", "FAIL", f"missing-token request returned HTTP {status}")


def admin_ops_check() -> Result:
    token = os.environ.get("FANTASYIQ_ADMIN_TOKEN", "").strip()
    if not token:
        status = "FAIL" if STRICT else "WARN"
        return Result(
            "Admin ops events",
            status,
            "set FANTASYIQ_ADMIN_TOKEN locally to verify protected production ops events",
        )

    status, body = post_json(
        ADMIN_URL,
        {"action": "ops_events", "limit": 10},
        headers={"x-fantasyiq-admin-token": token},
    )
    payload, error = parse_json("Admin ops events", status, body)
    if error:
        return error
    if status != 200 or payload.get("ok") is not True:
        return Result("Admin ops events", "FAIL", f"returned HTTP {status}: {payload.get('message', 'unknown error')}")

    events = payload.get("opsEvents")
    summary = payload.get("opsSummary") or {}
    if not isinstance(events, list):
        return Result("Admin ops events", "FAIL", "response did not include an opsEvents list")
    total = summary.get("total", len(events)) if isinstance(summary, dict) else len(events)
    errors = summary.get("errors", 0) if isinstance(summary, dict) else 0
    warnings = summary.get("warnings", 0) if isinstance(summary, dict) else 0
    return Result(
        "Admin ops events",
        "PASS",
        f"loaded {len(events)} recent event(s); summary total={total}, warnings={warnings}, errors={errors}",
    )


def recent_timestamp_check() -> Result:
    now = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    return Result("Monitor timestamp", "PASS", f"completed at {now}")


def main() -> int:
    global ADMIN_URL, SITE_URL, STRICT
    load_env()
    SITE_URL = os.environ.get("FANTASYIQ_SITE_URL", SITE_URL).rstrip("/")
    ADMIN_URL = os.environ.get("FANTASYIQ_ADMIN_URL", f"{SITE_URL}/api/admin-customers")
    STRICT = os.environ.get("FANTASYIQ_MONITORING_STRICT", "").strip().lower() in {"1", "true", "yes"}
    checks = [
        page_check("Root sales page", "/", "FantasyIQ"),
        page_check("Dashboard page", "/FantasyIQ/", "FantasyIQ"),
        page_check("Setup page", "/setup.html", "Set up FantasyIQ"),
        page_check("Help page", "/help.html", "FantasyIQ Q&A"),
        page_check("Admin page", "/admin.html", "Customer operations"),
        json_endpoint_check("Live draft API", "/api/live-draft"),
        live_boards_check(),
        webhook_boundary_check(),
        admin_auth_boundary_check(),
        admin_ops_check(),
        recent_timestamp_check(),
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
