from __future__ import annotations

import argparse
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
ARTIFACT_DIR = ROOT / "artifacts" / "site-currency"
DEFAULT_SITE_URL = os.environ.get("FANTASYIQ_SITE_URL", "https://myfantasyiq.com").rstrip("/")
CURRENT_DRAFT_ASSET = "js/draft.js?v=20260525_trade_quality_4"
CURRENT_DASHBOARD_ASSET = "js/dashboard.js?v=20260525_big_board_adp_1"
CURRENT_STYLE_ASSET = "styles.css?v=20260525_trade_empty_state_1"
OLD_DRAFT_ASSET = "js/draft.js?v=20260525_trade_quality_3"
KATELYN_QUERY = "customer=katelyn&league=baltimore-beginner-h2h-points-ppr-league"


@dataclass
class Check:
    name: str
    status: str
    detail: str


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def fetch(url: str, timeout: int = 30, method: str = "GET", body: bytes | None = None) -> tuple[int, dict[str, str], str]:
    request = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={
            "User-Agent": "FantasyIQ peer site currency agent",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Accept": "application/json,text/html,*/*",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            headers = {key.lower(): value for key, value in response.headers.items()}
            return response.status, headers, response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        headers = {key.lower(): value for key, value in exc.headers.items()}
        return exc.code, headers, exc.read().decode("utf-8", errors="replace")
    except urllib.error.URLError as exc:
        return 0, {}, str(exc)


def parse_json(name: str, status: int, body: str) -> tuple[dict[str, Any] | None, Check | None]:
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return None, Check(name, "FAIL", f"non-JSON response HTTP {status}")
    if not isinstance(payload, dict):
        return None, Check(name, "FAIL", f"unexpected JSON shape HTTP {status}")
    return payload, None


def html_asset_check(site_url: str, path: str, name: str, extra_markers: list[str] | None = None) -> Check:
    separator = "&" if "?" in path else "?"
    url = f"{site_url}{path}{separator}peer={int(time.time())}"
    status, headers, body = fetch(url)
    if status != 200:
        return Check(name, "FAIL", f"{url} returned HTTP {status}")
    cache = headers.get("cache-control", "")
    if "no-store" not in cache.lower():
        return Check(name, "FAIL", f"Cache-Control is {cache or 'missing'}")
    markers = [CURRENT_DRAFT_ASSET, CURRENT_DASHBOARD_ASSET, CURRENT_STYLE_ASSET, *(extra_markers or [])]
    missing = [marker for marker in markers if marker not in body]
    if missing:
        return Check(name, "FAIL", f"missing current marker(s): {', '.join(missing)}")
    if OLD_DRAFT_ASSET in body:
        return Check(name, "FAIL", f"old draft asset is still referenced: {OLD_DRAFT_ASSET}")
    return Check(name, "PASS", f"{url} serves current assets")


def bundle_marker_check(site_url: str) -> Check:
    url = f"{site_url}/FantasyIQ/{CURRENT_DRAFT_ASSET}&peer={int(time.time())}"
    status, _, body = fetch(url)
    if status != 200:
        return Check("collaborator Trade IQ bundle", "FAIL", f"{url} returned HTTP {status}")
    markers = [
        "No verified Fantasy IQ Data trade ideas yet",
        "market-backed ideas stay available",
        "matched FantasyCalc.com market values",
    ]
    missing = [marker for marker in markers if marker not in body]
    if missing:
        return Check("collaborator Trade IQ bundle", "FAIL", f"missing marker(s): {', '.join(missing)}")
    return Check("collaborator Trade IQ bundle", "PASS", "no-match UI is present")


def style_marker_check(site_url: str) -> Check:
    url = f"{site_url}/FantasyIQ/{CURRENT_STYLE_ASSET}&peer={int(time.time())}"
    status, _, body = fetch(url)
    if status != 200:
        return Check("collaborator style bundle", "FAIL", f"{url} returned HTTP {status}")
    if ".trade-empty-state" not in body:
        return Check("collaborator style bundle", "FAIL", "trade-empty-state CSS is missing")
    return Check("collaborator style bundle", "PASS", "trade-empty-state CSS is present")


def katelyn_public_boundary_check(site_url: str) -> Check:
    url = f"{site_url}/api/customer-status?{KATELYN_QUERY}&peer={int(time.time())}"
    status, _, body = fetch(url)
    payload, error = parse_json("collaborator Katelyn auth boundary", status, body)
    if error:
        return error
    customer = payload.get("customer") if isinstance(payload.get("customer"), dict) else {}
    if status != 200 or payload.get("ok") is not True:
        return Check("collaborator Katelyn auth boundary", "FAIL", f"HTTP {status}: {payload.get('message') or payload.get('error')}")
    if payload.get("authenticated") is not False or payload.get("accessRequired") is not True:
        return Check("collaborator Katelyn auth boundary", "FAIL", "public request did not remain locked")
    if customer.get("customerName") or customer.get("leagueId"):
        return Check("collaborator Katelyn auth boundary", "FAIL", "redacted customer response leaked protected fields")
    if customer.get("customerSlug") != "katelyn":
        return Check("collaborator Katelyn auth boundary", "FAIL", f"unexpected customer slug: {customer.get('customerSlug')}")
    return Check("collaborator Katelyn auth boundary", "PASS", "locked customer page resolves and redacts correctly")


def freshness_payload(site_url: str) -> tuple[dict[str, Any] | None, Check | None]:
    url = f"{site_url}/api/data-freshness?limit=240&peer={int(time.time())}"
    status, _, body = fetch(url)
    payload, error = parse_json("data verifier freshness", status, body)
    if error:
        return None, error
    if status != 200 or payload.get("ok") is not True:
        return None, Check("data verifier freshness", "FAIL", f"HTTP {status}: {payload.get('message') or payload.get('error')}")
    return payload, None


def freshness_check(site_url: str) -> Check:
    payload, error = freshness_payload(site_url)
    if error:
        return error
    assert payload is not None
    summary = payload.get("summary") if isinstance(payload.get("summary"), dict) else {}
    cron_steps = {str(step) for step in summary.get("cronSteps", []) if step}
    required = {"fantasycalc-market", "fantasycalc-trade-database", "live-board-demo-snapshot"}
    missing = required.difference(cron_steps)
    if missing:
        return Check("data verifier freshness", "FAIL", f"missing cron step(s): {', '.join(sorted(missing))}")
    if payload.get("databaseBacked") is not True:
        return Check("data verifier freshness", "FAIL", "databaseBacked is not true")
    return Check("data verifier freshness", "PASS", f"cron steps verified: {', '.join(sorted(cron_steps))}")


def live_board_full_check(site_url: str) -> Check:
    url = f"{site_url}/api/live-boards?limit=260&peer={int(time.time())}"
    status, _, body = fetch(url, timeout=45)
    payload, error = parse_json("data verifier live board", status, body)
    if error:
        return error
    rows = (((payload.get("boards") or {}).get("combined") or {}).get("rows") or [])
    if status != 200 or payload.get("live") is not True or len(rows) < 200:
        return Check("data verifier live board", "FAIL", f"HTTP {status}; live={payload.get('live')}; rows={len(rows)}")
    previous_adp = -1.0
    for row in rows[:40]:
        try:
            adp = float(row.get("True ADP") or row.get("ESPN ADP"))
        except (TypeError, ValueError):
            return Check("data verifier live board", "FAIL", f"missing ADP for {row.get('Player')}")
        if adp < previous_adp:
            return Check("data verifier live board", "FAIL", "top 40 rows are not sorted by ADP")
        previous_adp = adp
        for key in ("Player", "Pos", "Tier", "Native Projection", "ADP Value"):
            if row.get(key) in (None, ""):
                return Check("data verifier live board", "FAIL", f"{row.get('Player') or 'row'} missing {key}")
    return Check("data verifier live board", "PASS", f"{len(rows)} live board rows; updated={payload.get('updated')}")


def fantasy_iq_data_check(site_url: str) -> Check:
    market_url = f"{site_url}/api/fantasycalc-market?peer={int(time.time())}"
    trades_url = f"{site_url}/api/fantasycalc-trades?peer={int(time.time())}"
    market_status, _, market_body = fetch(market_url)
    trades_status, _, trades_body = fetch(trades_url)
    market, market_error = parse_json("data verifier market", market_status, market_body)
    if market_error:
        return market_error
    trades, trades_error = parse_json("data verifier trades", trades_status, trades_body)
    if trades_error:
        return trades_error
    assert market is not None and trades is not None
    players = market.get("players") if isinstance(market.get("players"), list) else []
    trade_count = trades.get("tradeCount")
    if market_status != 200 or market.get("ok") is not True or len(players) < 50:
        return Check("data verifier Fantasy IQ Data", "FAIL", f"market HTTP {market_status}; players={len(players)}")
    if trades_status != 200 or trades.get("ok") is not True or not isinstance(trade_count, int) or trade_count < 1_000_000:
        return Check("data verifier Fantasy IQ Data", "FAIL", f"trades HTTP {trades_status}; tradeCount={trade_count}")
    return Check("data verifier Fantasy IQ Data", "PASS", f"{len(players)} market players; {trade_count:,} accepted trades")


def customer_flow_check(site_url: str) -> Check:
    url = f"{site_url}/api/live-draft?{KATELYN_QUERY}&peer={int(time.time())}"
    status, _, body = fetch(url)
    payload, error = parse_json("flow verifier protected live-draft", status, body)
    if error:
        return error
    if status != 401 or payload.get("ok") is not False:
        return Check("flow verifier protected live-draft", "FAIL", f"expected locked 401, got HTTP {status}")
    message = str(payload.get("error") or payload.get("message") or "")
    if "access code" not in message.lower() and "sign in" not in message.lower():
        return Check("flow verifier protected live-draft", "FAIL", f"unexpected lock message: {message}")
    return Check("flow verifier protected live-draft", "PASS", "protected customer API remains locked without session")


def demo_flow_check(site_url: str) -> Check:
    url = f"{site_url}/api/live-draft?peer={int(time.time())}"
    status, _, body = fetch(url, timeout=45)
    payload, error = parse_json("flow verifier demo live-draft", status, body)
    if error:
        return error
    teams = payload.get("teams") if isinstance(payload.get("teams"), list) else []
    if status != 200 or payload.get("ok") is not True or not teams:
        return Check("flow verifier demo live-draft", "FAIL", f"HTTP {status}; teams={len(teams)}")
    return Check("flow verifier demo live-draft", "PASS", f"{len(teams)} demo teams sync")


def webhook_boundary_check(site_url: str) -> Check:
    url = f"{site_url}/api/stripe-webhook"
    status, _, body = fetch(url)
    payload, error = parse_json("flow verifier webhook boundary", status, body)
    if error:
        return error
    if status != 200 or payload.get("ok") is not True:
        return Check("flow verifier webhook boundary", "FAIL", f"GET HTTP {status}")
    post_status, _, post_body = fetch(
        url,
        method="POST",
        body=json.dumps({"id": "evt_peer_agent", "type": "checkout.session.completed"}).encode("utf-8"),
    )
    post_payload, post_error = parse_json("flow verifier webhook boundary", post_status, post_body)
    if post_error:
        return post_error
    message = str(post_payload.get("message") or "")
    if post_status == 400 and "signature" in message.lower():
        return Check("flow verifier webhook boundary", "PASS", "unsigned webhook POST rejected")
    return Check("flow verifier webhook boundary", "FAIL", f"unsigned POST HTTP {post_status}: {message}")


def role_checks(role: str, site_url: str) -> list[Check]:
    if role == "collaborator":
        return [
            html_asset_check(site_url, "/FantasyIQ/", "collaborator dashboard shell"),
            html_asset_check(site_url, f"/?{KATELYN_QUERY}", "collaborator Katelyn shell", ["Trade IQ"]),
            bundle_marker_check(site_url),
            style_marker_check(site_url),
            katelyn_public_boundary_check(site_url),
        ]
    if role == "verifier-data":
        return [
            freshness_check(site_url),
            live_board_full_check(site_url),
            fantasy_iq_data_check(site_url),
        ]
    if role == "verifier-flow":
        return [
            html_asset_check(site_url, "/login", "flow verifier login route"),
            customer_flow_check(site_url),
            demo_flow_check(site_url),
            webhook_boundary_check(site_url),
        ]
    raise ValueError(f"Unsupported peer-agent role: {role}")


def write_report(role: str, site_url: str, started: str, checks: list[Check]) -> Path:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = ARTIFACT_DIR / f"site-currency-{role}-{stamp}.json"
    path.write_text(
        json.dumps(
            {
                "ok": not any(check.status == "FAIL" for check in checks),
                "role": role,
                "siteUrl": site_url,
                "startedAt": started,
                "completedAt": utc_now(),
                "checks": [asdict(check) for check in checks],
            },
            indent=2,
            sort_keys=True,
        ),
        encoding="utf-8",
    )
    return path


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a focused peer verification agent against live FantasyIQ production.")
    parser.add_argument("--role", required=True, choices=["collaborator", "verifier-data", "verifier-flow"])
    parser.add_argument("--site-url", default=DEFAULT_SITE_URL)
    args = parser.parse_args()

    site_url = args.site_url.rstrip("/")
    started = utc_now()
    print(f"FantasyIQ {args.role} agent started at {started}")
    checks = role_checks(args.role, site_url)
    for check in checks:
        print(f"{check.status:4} {check.name}: {check.detail}")
    path = write_report(args.role, site_url, started, checks)
    ok = not any(check.status == "FAIL" for check in checks)
    print(f"Report written: {path}")
    print(f"Summary: {'PASS' if ok else 'FAIL'}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
