from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


CUSTOMER_FIELDS = [
    "customer_name",
    "email",
    "league_id",
    "team_id",
    "season",
    "league_name",
    "payment_provider",
    "payment_reference",
    "paid_at",
    "renewal_date",
    "dashboard_url",
    "status",
    "notes",
]


def decode_env_value(raw: str) -> str:
    value = raw.strip()
    if not value:
        return ""
    if value.startswith('"') and value.endswith('"'):
        try:
            decoded = json.loads(value)
            return decoded if isinstance(decoded, str) else str(decoded)
        except json.JSONDecodeError:
            return value[1:-1]
    if value.startswith("'") and value.endswith("'"):
        return value[1:-1]
    return value


def load_env_file(path: Path) -> None:
    if not path.exists():
        raise SystemExit(f"Env file not found: {path}")
    for line in path.read_text(encoding="utf-8").splitlines():
        clean = line.strip()
        if not clean or clean.startswith("#") or "=" not in clean:
            continue
        key, raw_value = line.split("=", 1)
        os.environ[key.strip()] = decode_env_value(raw_value)


def iso_date(value: Any) -> str:
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    text = str(value or "").strip()
    return text[:10] if len(text) >= 10 else text


def renewal_date(paid_at: str) -> str:
    if not paid_at:
        return ""
    try:
        paid = datetime.strptime(paid_at[:10], "%Y-%m-%d").date()
    except ValueError:
        return ""
    try:
        return paid.replace(year=paid.year + 1).isoformat()
    except ValueError:
        return paid.replace(year=paid.year + 1, day=28).isoformat()


def site_url() -> str:
    return os.environ.get("FANTASYIQ_SITE_URL", "https://myfantasyiq.com").strip().rstrip("/")


def dashboard_url(slug: str) -> str:
    return f"{site_url()}/FantasyIQ/?customer={slug}"


def blank_row() -> dict[str, str]:
    return {field: "" for field in CUSTOMER_FIELDS}


def latest_payment_events() -> dict[str, dict[str, Any]]:
    try:
        from api.database import connect, database_enabled, fetch_all_dicts
    except Exception:
        return {}
    if not database_enabled():
        return {}
    try:
        with connect() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT DISTINCT ON (customer_slug)
                           customer_slug, stripe_event_id, stripe_object_id,
                           status, created_at
                      FROM fantasyiq_payment_events
                     WHERE COALESCE(customer_slug, '') <> ''
                     ORDER BY customer_slug, created_at DESC
                    """
                )
                return {row.get("customer_slug", ""): row for row in fetch_all_dicts(cursor)}
    except Exception:
        return {}


def database_rows() -> list[dict[str, str]]:
    try:
        from api.database import admin_customer_detail, database_status, list_customers
    except Exception:
        return []

    status = database_status()
    if not status.get("enabled"):
        return []

    events = latest_payment_events()
    rows: list[dict[str, str]] = []
    for summary in list_customers():
        slug = str(summary.get("slug") or "").strip()
        detail = admin_customer_detail(slug) or summary
        leagues = detail.get("leagues") if isinstance(detail.get("leagues"), list) else []
        default_key = str(detail.get("default_league_key") or "").strip()
        league = next((item for item in leagues if str(item.get("league_key") or "") == default_key), None)
        if league is None and leagues:
            league = leagues[0]
        league = league or {}
        event = events.get(slug, {})
        paid_at = iso_date(event.get("created_at"))

        row = blank_row()
        row.update(
            {
                "customer_name": str(detail.get("customer_name") or "").strip(),
                "email": str(detail.get("email") or "").strip(),
                "league_id": str(league.get("league_id") or ""),
                "team_id": str(league.get("team_id") or ""),
                "season": str(league.get("season") or ""),
                "league_name": str(league.get("league_name") or league.get("label") or "").strip(),
                "payment_provider": "stripe" if event else "",
                "payment_reference": str(event.get("stripe_object_id") or event.get("stripe_event_id") or ""),
                "paid_at": paid_at,
                "renewal_date": renewal_date(paid_at),
                "dashboard_url": dashboard_url(slug),
                "status": str(detail.get("status") or "").strip(),
                "notes": "Recovered from production database.",
            }
        )
        rows.append(row)
    return rows


def env_rows() -> list[dict[str, str]]:
    try:
        from api.customer_context import customers_from_json
    except Exception:
        return []

    rows: list[dict[str, str]] = []
    for context in customers_from_json().values():
        if context.demo_mode:
            continue
        league = next(
            (item for item in context.available_leagues if item.get("key") == context.league_key),
            context.available_leagues[0] if context.available_leagues else {},
        )
        row = blank_row()
        row.update(
            {
                "customer_name": context.customer_name,
                "email": context.email,
                "league_id": str(league.get("leagueId") or context.league_id or ""),
                "team_id": str(league.get("teamId") or context.customer_team_id or ""),
                "season": str(league.get("season") or context.season or ""),
                "league_name": str(league.get("leagueName") or context.league_name or ""),
                "dashboard_url": dashboard_url(context.slug),
                "status": context.status,
                "notes": "Recovered from FANTASY_IQ_CUSTOMERS_JSON.",
            }
        )
        rows.append(row)
    return rows


def merged_rows() -> list[dict[str, str]]:
    rows_by_email: dict[str, dict[str, str]] = {}
    rows_by_slug_url: dict[str, dict[str, str]] = {}
    for row in env_rows() + database_rows():
        key = row.get("email", "").lower().strip()
        if key:
            rows_by_email[key] = {**rows_by_email.get(key, blank_row()), **row}
            continue
        rows_by_slug_url[row.get("dashboard_url", "")] = row
    return list(rows_by_email.values()) + list(rows_by_slug_url.values())


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CUSTOMER_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in CUSTOMER_FIELDS})


def main() -> int:
    parser = argparse.ArgumentParser(description="Export private FantasyIQ customers.csv from database/env records.")
    parser.add_argument("--env-file", action="append", default=[], help="Env file to load before exporting. Can be passed more than once.")
    parser.add_argument("--output", default="customers.csv", help="CSV output path. Defaults to customers.csv.")
    args = parser.parse_args()

    for env_file in args.env_file:
        load_env_file(Path(env_file))

    rows = merged_rows()
    write_csv(Path(args.output), rows)
    print(f"Wrote {len(rows)} customer row(s) to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
