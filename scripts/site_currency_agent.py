from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
ARTIFACT_DIR = ROOT / "artifacts" / "site-currency"
DEFAULT_SITE_URL = os.environ.get("FANTASYIQ_SITE_URL", "https://myfantasyiq.com").rstrip("/")
EXPECTED_ASSETS = {
    "auth": "js/auth.js?v=20260524_email_login_1",
    "dashboard": "js/dashboard.js?v=20260525_big_board_adp_1",
    "trade": "js/trade.js?v=20260525_trade_quality_5",
    "draft": "js/draft.js?v=20260525_trade_quality_5",
    "sos": "js/sos.js?v=20260525_schedule_iq_1",
}
EXPECTED_DASHBOARD_MARKERS = [
    "Fantasy IQ Data",
    "boardAdpCompare",
    "ESPN ADP order",
    "RB Starter",
]
EXPECTED_DRAFT_MARKERS = [
    "Fantasy IQ Data is validating exact 1-for-1 and 2-for-1",
    "market-backed ideas stay available",
    "tradeIdeaQualityGate",
    "tradeDatabaseExactSupport",
    "consensusPlayerScore",
    "consensus-score-v2",
]
EXPECTED_TRADE_MARKERS = [
    "Fantasy IQ Data real-trade value",
    "Real-world acceptance",
]
EXPECTED_SOS_MARKERS = [
    "tier-elite",
    "colorGrade",
    "marketVsActualTrend",
    "scoringEnvironmentScore",
    "streamingOpportunity",
]
LOCAL_GATES = [
    ("typecheck", ["npm", "run", "typecheck"]),
    ("api imports", ["npm", "run", "test:api"]),
    ("security boundaries", ["npm", "run", "test:security-boundaries"]),
    ("mirror drift", ["npm", "run", "test:mirrors"]),
    ("csp hashes", ["npm", "run", "test:csp"]),
    ("static build", ["npm", "run", "build"]),
]


@dataclass
class Check:
    name: str
    status: str
    detail: str


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def run_command(name: str, command: list[str], timeout: int = 180) -> Check:
    executable = shutil.which(command[0])
    resolved = [executable or command[0], *command[1:]]
    try:
        completed = subprocess.run(
            resolved,
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return Check(name, "FAIL", f"{' '.join(command)} timed out after {timeout}s")
    except FileNotFoundError as exc:
        return Check(name, "FAIL", f"command unavailable: {exc}")

    if completed.returncode == 0:
        return Check(name, "PASS", " ".join(command))

    output = "\n".join(part.strip() for part in [completed.stdout, completed.stderr] if part.strip())
    detail = output[-1200:] if output else f"exit code {completed.returncode}"
    return Check(name, "FAIL", detail)


def git_currency_check(allow_dirty: bool) -> Check:
    status = subprocess.run(
        ["git", "status", "--porcelain=v1", "--branch"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    if status.returncode != 0:
        return Check("git currency", "FAIL", status.stderr.strip() or "git status failed")

    lines = [line for line in status.stdout.splitlines() if line.strip()]
    branch = lines[0] if lines else "unknown branch"
    dirty = [line for line in lines[1:] if line.strip()]
    if dirty and not allow_dirty:
        return Check("git currency", "FAIL", f"{branch}; working tree has {len(dirty)} uncommitted change(s)")
    if "behind" in branch:
        return Check("git currency", "FAIL", branch)
    if "ahead" in branch and not allow_dirty:
        return Check("git currency", "FAIL", branch)
    return Check("git currency", "PASS", branch)


def fetch(url: str, timeout: int = 30) -> tuple[int, dict[str, str], str]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "FantasyIQ site currency agent",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            headers = {key.lower(): value for key, value in response.headers.items()}
            body = response.read().decode("utf-8", errors="replace")
            return response.status, headers, body
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        headers = {key.lower(): value for key, value in exc.headers.items()}
        return exc.code, headers, body
    except urllib.error.URLError as exc:
        return 0, {}, str(exc)


def json_payload(name: str, status: int, body: str) -> tuple[dict[str, Any] | None, Check | None]:
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        return None, Check(name, "FAIL", f"returned non-JSON HTTP {status}")
    if not isinstance(payload, dict):
        return None, Check(name, "FAIL", f"unexpected JSON shape HTTP {status}")
    return payload, None


def dashboard_page_check(site_url: str) -> Check:
    url = f"{site_url}/FantasyIQ/?currency={int(time.time())}"
    status, headers, body = fetch(url)
    if status != 200:
        return Check("production dashboard", "FAIL", f"{url} returned HTTP {status}")
    cache = headers.get("cache-control", "")
    if "no-store" not in cache.lower():
        return Check("production dashboard", "FAIL", f"Cache-Control is {cache or 'missing'}")
    missing = [asset for asset in EXPECTED_ASSETS.values() if asset not in body]
    if missing:
        return Check("production dashboard", "FAIL", f"missing current asset marker(s): {', '.join(missing)}")
    if "Command Center" not in body:
        return Check("production dashboard", "FAIL", "dashboard shell is missing Command Center")
    return Check("production dashboard", "PASS", f"current assets served with {cache}")


def asset_marker_check(site_url: str, name: str, asset: str, markers: list[str]) -> Check:
    url = f"{site_url}/FantasyIQ/{asset}&currency={int(time.time())}"
    status, _, body = fetch(url)
    if status != 200:
        return Check(f"{name} bundle", "FAIL", f"{url} returned HTTP {status}")
    missing = [marker for marker in markers if marker not in body]
    if missing:
        return Check(f"{name} bundle", "FAIL", f"missing marker(s): {', '.join(missing)}")
    return Check(f"{name} bundle", "PASS", asset)


def data_freshness_check(site_url: str) -> Check:
    url = f"{site_url}/api/data-freshness?limit=240&currency={int(time.time())}"
    status, _, body = fetch(url)
    payload, error = json_payload("data freshness", status, body)
    if error:
        return error
    if status != 200 or payload.get("ok") is not True:
        return Check("data freshness", "FAIL", f"HTTP {status}: {payload.get('error') or payload.get('message')}")
    if payload.get("databaseBacked") is not True:
        return Check("data freshness", "FAIL", "databaseBacked is not true")
    rows = payload.get("freshness") if isinstance(payload.get("freshness"), list) else []
    required_cron_steps = {"fantasycalc-market", "fantasycalc-trade-database", "live-board-demo-snapshot", "sos-heatmap"}
    required_pairs = {("fantasyiq-cron", step) for step in required_cron_steps}
    payload_status = str(payload.get("status") or "").lower()
    if payload_status not in {"healthy", "warning"}:
        return Check("data freshness", "FAIL", f"data-health status is {payload_status or 'missing'}")
    critical_required = [
        row for row in rows
        if (
            isinstance(row, dict)
            and row.get("computedStatus", row.get("status")) == "critical"
            and (str(row.get("source") or ""), str(row.get("source_scope") or "")) in required_pairs
        )
    ]
    required_problem_rows = payload.get("requiredProblemRows") if isinstance(payload.get("requiredProblemRows"), list) else []
    blocking_stale = critical_required or [
        row for row in required_problem_rows
        if isinstance(row, dict) and row.get("computedStatus", row.get("status")) == "critical"
    ]
    if blocking_stale:
        scopes = ", ".join(str(row.get("source_scope") or row.get("source") or "unknown") for row in blocking_stale[:4])
        return Check("data freshness", "FAIL", f"{len(blocking_stale)} stale required data source(s): {scopes}")
    summary = payload.get("summary") if isinstance(payload.get("summary"), dict) else {}
    source_counts = summary.get("sourceCounts") if isinstance(summary.get("sourceCounts"), dict) else {}
    cron_steps = summary.get("cronSteps") if isinstance(summary.get("cronSteps"), list) else []
    missing_cron = required_cron_steps.difference(str(step) for step in cron_steps)
    missing_required = payload.get("missingRequiredScopes") if isinstance(payload.get("missingRequiredScopes"), list) else []
    if missing_required:
        scopes = ", ".join(f"{item.get('source')}:{item.get('sourceScope')}" for item in missing_required[:4] if isinstance(item, dict))
        return Check("data freshness", "FAIL", f"missing required freshness scope(s): {scopes}")
    if source_counts.get("fantasyiq-cron") and missing_cron:
        return Check("data freshness", "FAIL", f"missing cron freshness step(s): {', '.join(sorted(missing_cron))}")
    latest = payload.get("latestSuccessAt") or payload.get("syncedAt") or "unknown"
    cron_detail = f"; cron steps={len(cron_steps)}" if cron_steps else ""
    return Check("data freshness", "PASS", f"database-backed data current; latestSuccessAt={latest}{cron_detail}")


def live_board_check(site_url: str) -> Check:
    url = f"{site_url}/api/live-boards?limit=24&currency={int(time.time())}"
    status, _, body = fetch(url)
    payload, error = json_payload("live board ADP", status, body)
    if error:
        return error
    if status != 200 or payload.get("ok") is False:
        return Check("live board ADP", "FAIL", f"HTTP {status}: {payload.get('error') or payload.get('message')}")

    boards = payload.get("boards")
    if not isinstance(boards, dict):
        return Check("live board ADP", "FAIL", "response missing boards object")
    combined = boards.get("combined") if isinstance(boards.get("combined"), dict) else None
    rows = combined.get("rows") if combined else None
    if not isinstance(rows, list) or len(rows) < 8:
        return Check("live board ADP", "FAIL", "combined board returned too few rows")

    adps: list[float] = []
    tiers: set[str] = set()
    for row in rows[:12]:
        if not isinstance(row, dict):
            continue
        adp = row.get("True ADP") or row.get("ESPN ADP")
        try:
            adps.append(float(adp))
        except (TypeError, ValueError):
            return Check("live board ADP", "FAIL", f"row missing numeric ADP: {row.get('Name') or row}")
        if row.get("Tier"):
            tiers.add(str(row["Tier"]))

    if adps != sorted(adps):
        return Check("live board ADP", "FAIL", f"top board ADPs are not ascending: {adps}")
    if not any(any(word in tier for word in ["Elite", "Starter", "Flex", "Bench", "Deep", "Stream"]) for tier in tiers):
        return Check("live board ADP", "FAIL", f"simplified tiers not found in top rows: {sorted(tiers)}")
    updated = payload.get("updated") or payload.get("syncedAt") or "unknown"
    return Check("live board ADP", "PASS", f"{len(rows)} rows in ESPN ADP order; updated={updated}")


def trade_data_check(site_url: str) -> Check:
    url = f"{site_url}/api/fantasycalc-trades?limit=25&currency={int(time.time())}"
    status, _, body = fetch(url)
    payload, error = json_payload("accepted trade data", status, body)
    if error:
        return error
    if status != 200 or payload.get("ok") is not True:
        return Check("accepted trade data", "FAIL", f"HTTP {status}: {payload.get('error') or payload.get('message')}")
    source = str(payload.get("source") or "")
    if "FantasyCalc" not in source:
        return Check("accepted trade data", "FAIL", f"unexpected trade source: {source or 'missing'}")
    trade_count = payload.get("tradeCount")
    most_traded = payload.get("mostTraded")
    if not isinstance(trade_count, int) or trade_count < 1000:
        return Check("accepted trade data", "FAIL", f"tradeCount is not credible: {trade_count}")
    if not isinstance(most_traded, list) or not most_traded:
        return Check("accepted trade data", "FAIL", "most-traded database sample is empty")
    synced_at = payload.get("syncedAt") or "unknown"
    return Check("accepted trade data", "PASS", f"{trade_count:,} accepted trades indexed; syncedAt={synced_at}")


def schedule_iq_check(site_url: str) -> Check:
    url = f"{site_url}/api/sos-heatmap?season=2026&currency={int(time.time())}"
    status, _, body = fetch(url, timeout=180)
    payload, error = json_payload("Schedule IQ heatmap", status, body)
    if error:
        return error
    if status != 200 or payload.get("ok") is not True:
        return Check("Schedule IQ heatmap", "FAIL", f"HTTP {status}: {payload.get('error') or payload.get('message')}")
    rows = payload.get("rows") if isinstance(payload.get("rows"), list) else []
    if len(rows) < 150:
        return Check("Schedule IQ heatmap", "FAIL", f"too few schedule rows: {len(rows)}")
    workflow = payload.get("agentWorkflow") if isinstance(payload.get("agentWorkflow"), dict) else {}
    agents = workflow.get("agents") if isinstance(workflow.get("agents"), list) else []
    lead = workflow.get("leadAgent") if isinstance(workflow.get("leadAgent"), dict) else {}
    if len(agents) != 12 or lead.get("agent") != "Lead Schedule Intelligence Agent":
        return Check("Schedule IQ heatmap", "FAIL", f"agent workflow incomplete: lead={lead.get('agent')}, agents={len(agents)}")
    cells = [cell for row in rows[:12] for cell in (row.get("cells") or []) if isinstance(cell, dict)]
    if not any(cell.get("colorGrade") for cell in cells):
        return Check("Schedule IQ heatmap", "FAIL", "cells are missing colorGrade")
    if not isinstance(payload.get("weeklyRefreshLog"), dict):
        return Check("Schedule IQ heatmap", "FAIL", "weeklyRefreshLog missing")
    validation = payload.get("validation") if isinstance(payload.get("validation"), dict) else {}
    if validation.get("ok") is not True:
        return Check("Schedule IQ heatmap", "FAIL", f"validation failed or missing: {validation.get('errors') or validation.get('status') or 'missing'}")
    updated = payload.get("updatedAt") or "unknown"
    odds = (payload.get("providerMeta") or {}).get("odds") if isinstance(payload.get("providerMeta"), dict) else {}
    odds_note = "odds configured" if isinstance(odds, dict) and odds.get("configured") else "odds confidence lowered"
    return Check("Schedule IQ heatmap", "PASS", f"{len(rows)} rows, {len(agents)} agents, {odds_note}, updated={updated}")


def production_checks(site_url: str) -> list[Check]:
    return [
        dashboard_page_check(site_url),
        asset_marker_check(site_url, "dashboard", EXPECTED_ASSETS["dashboard"], EXPECTED_DASHBOARD_MARKERS),
        asset_marker_check(site_url, "Trade IQ", EXPECTED_ASSETS["trade"], EXPECTED_TRADE_MARKERS),
        asset_marker_check(site_url, "draft", EXPECTED_ASSETS["draft"], EXPECTED_DRAFT_MARKERS),
        asset_marker_check(site_url, "Schedule IQ", EXPECTED_ASSETS["sos"], EXPECTED_SOS_MARKERS),
        data_freshness_check(site_url),
        live_board_check(site_url),
        trade_data_check(site_url),
        schedule_iq_check(site_url),
    ]


def write_report(report: dict[str, Any]) -> Path:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = ARTIFACT_DIR / f"site-currency-{stamp}.json"
    path.write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
    return path


def print_checks(checks: list[Check]) -> None:
    for check in checks:
        print(f"{check.status:4} {check.name}: {check.detail}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verify the repo and live FantasyIQ site are up to date.")
    parser.add_argument("--site-url", default=DEFAULT_SITE_URL)
    parser.add_argument("--max-attempts", type=int, default=3, help="0 means keep retrying until production passes.")
    parser.add_argument("--sleep-seconds", type=int, default=20)
    parser.add_argument("--skip-local", action="store_true")
    parser.add_argument("--allow-dirty", action="store_true")
    parser.add_argument("--ci", action="store_true", help="CI mode; allows Vercel-generated ignored files after deploy.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    site_url = args.site_url.rstrip("/")
    started = utc_now()
    all_checks: list[Check] = []

    print(f"FantasyIQ site currency agent started at {started}")
    print(f"Production target: {site_url}")

    local_checks: list[Check] = []
    if not args.skip_local:
        local_checks.append(git_currency_check(args.allow_dirty or args.ci))
        for name, command in LOCAL_GATES:
            local_checks.append(run_command(name, command))
        print_checks(local_checks)
        all_checks.extend(local_checks)
        if any(check.status == "FAIL" for check in local_checks):
            report = {
                "ok": False,
                "startedAt": started,
                "completedAt": utc_now(),
                "siteUrl": site_url,
                "attempts": 0,
                "checks": [asdict(check) for check in all_checks],
            }
            path = write_report(report)
            print(f"Report written: {path}")
            return 1

    attempt = 0
    last_production_checks: list[Check] = []
    while True:
        attempt += 1
        print(f"\nProduction verification attempt {attempt}")
        last_production_checks = production_checks(site_url)
        print_checks(last_production_checks)
        if not any(check.status == "FAIL" for check in last_production_checks):
            break
        if args.max_attempts > 0 and attempt >= args.max_attempts:
            break
        time.sleep(max(1, args.sleep_seconds))

    all_checks.extend(last_production_checks)
    ok = not any(check.status == "FAIL" for check in all_checks)
    report = {
        "ok": ok,
        "startedAt": started,
        "completedAt": utc_now(),
        "siteUrl": site_url,
        "attempts": attempt,
        "checks": [asdict(check) for check in all_checks],
    }
    path = write_report(report)
    print(f"\nReport written: {path}")
    print(f"Summary: {'PASS' if ok else 'FAIL'}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
