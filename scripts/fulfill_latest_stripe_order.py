from __future__ import annotations

import base64
import csv
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from local_env import load_local_env


API_BASE = "https://api.stripe.com/v1"
DEFAULT_PAYMENT_LINK_URL = "https://buy.stripe.com/00wdR9dN7gBRacMb9fefC01"
DEFAULT_DASHBOARD_URL = "https://myfantasyiq.com/FantasyIQ/"
ESPN_BASE = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl"
CUSTOMER_CSV = Path("customers.csv")
CUSTOMER_CSV_FIELDS = [
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


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def stripe_key() -> str:
    key = env("STRIPE_SECRET_KEY")
    if not key:
        raise SystemExit(
            "Set STRIPE_SECRET_KEY in .env.local first. Do not paste it into chat or commit it."
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
    params: dict[str, str] | list[tuple[str, str]] | None = None,
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


def fetch_json(url: str) -> dict[str, Any]:
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "FantasyIQ fulfillment setup",
        },
    )
    with urllib.request.urlopen(request, timeout=25) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_league_details(league_id: str, season: str, team_id: str) -> tuple[str, str, str]:
    if not league_id or not season:
        return "", "", ""
    url = (
        f"{ESPN_BASE}/seasons/{season}/segments/0/leagues/{league_id}"
        "?view=mSettings&view=mTeam"
    )
    try:
        league = fetch_json(url)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError):
        return "", "", ""

    settings = league.get("settings") or {}
    members = {item.get("id"): item.get("displayName", "") for item in league.get("members", [])}
    league_name = str(settings.get("name") or league.get("name") or "").strip()
    customer_team_name = ""
    customer_manager = ""

    for team in league.get("teams", []):
        if str(team.get("id") or "") != str(team_id):
            continue
        customer_team_name = str(team.get("name") or f"{team.get('location', '')} {team.get('nickname', '')}".strip()).strip()
        owner = team.get("primaryOwner")
        customer_manager = members.get(owner, "")
        break

    return league_name, customer_team_name, customer_manager


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
        return explicit_id
    link_url = env("STRIPE_PAYMENT_LINK_URL", DEFAULT_PAYMENT_LINK_URL)
    return find_payment_link_by_url(key, link_url)["id"]


def latest_paid_checkout_session(key: str, link_id: str) -> dict[str, Any]:
    sessions: list[dict[str, Any]] = []
    starting_after = ""
    while True:
        params: list[tuple[str, str]] = [
            ("limit", "100"),
            ("payment_link", link_id),
        ]
        if starting_after:
            params.append(("starting_after", starting_after))

        page = stripe_request("GET", "/checkout/sessions", key, params=params)
        sessions.extend(
            session
            for session in page.get("data", [])
            if session.get("payment_status") == "paid" or session.get("status") == "complete"
        )
        if not page.get("has_more") or not page.get("data"):
            break
        starting_after = page["data"][-1]["id"]

    if not sessions:
        raise SystemExit("No paid Checkout Sessions were found for this Payment Link yet.")
    sessions.sort(key=lambda session: int(session.get("created") or 0), reverse=True)
    return sessions[0]


def custom_field_value(session: dict[str, Any], key: str) -> str:
    for field in session.get("custom_fields") or []:
        if field.get("key") != key:
            continue
        field_type = field.get("type") or "text"
        value_data = field.get(field_type) or {}
        return str(value_data.get("value") or "").strip()
    return ""


def utc_date_from_timestamp(timestamp: int) -> str:
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).date().isoformat()


def renewal_date(paid_at: str) -> str:
    paid = datetime.strptime(paid_at, "%Y-%m-%d").date()
    try:
        return paid.replace(year=paid.year + 1).isoformat()
    except ValueError:
        return paid.replace(year=paid.year + 1, day=28).isoformat()


def row_from_session(session: dict[str, Any]) -> dict[str, str]:
    customer = session.get("customer_details") or {}
    paid_at = utc_date_from_timestamp(int(session.get("created") or 0))
    league_id = custom_field_value(session, "leagueid")
    team_id = custom_field_value(session, "teamid")
    season = custom_field_value(session, "season") or env("FANTASY_IQ_SEASON", "2026")
    league_name = custom_field_value(session, "leaguename")
    espn_league_name, team_name, manager_name = fetch_league_details(league_id, season, team_id)
    league_name = league_name or espn_league_name
    return {
        "customer_name": str(customer.get("name") or "").strip(),
        "email": str(customer.get("email") or "").strip(),
        "league_id": league_id,
        "team_id": team_id,
        "season": season,
        "league_name": league_name,
        "payment_provider": "stripe",
        "payment_reference": str(session.get("id") or ""),
        "paid_at": paid_at,
        "renewal_date": renewal_date(paid_at),
        "dashboard_url": env("FANTASYIQ_DASHBOARD_URL", DEFAULT_DASHBOARD_URL),
        "status": "paid_needs_setup",
        "notes": f"Fetched from Stripe. ESPN team: {team_name or '(missing)'}; manager: {manager_name or '(missing)'}.",
    }


def read_existing_refs(path: Path) -> set[str]:
    if not path.exists():
        return set()
    with path.open("r", newline="", encoding="utf-8") as handle:
        return {row.get("payment_reference", "") for row in csv.DictReader(handle)}


def migrate_customer_csv(path: Path = CUSTOMER_CSV) -> None:
    if not path.exists():
        return
    with path.open("r", newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames == CUSTOMER_CSV_FIELDS:
            return
        rows = list(reader)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CUSTOMER_CSV_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row.get(field, "") for field in CUSTOMER_CSV_FIELDS})


def append_customer(row: dict[str, str], path: Path = CUSTOMER_CSV) -> bool:
    migrate_customer_csv(path)
    existing_refs = read_existing_refs(path)
    if row["payment_reference"] in existing_refs:
        return False
    write_header = not path.exists()
    with path.open("a", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CUSTOMER_CSV_FIELDS)
        if write_header:
            writer.writeheader()
        writer.writerow(row)
    return True


def print_summary(row: dict[str, str], appended: bool) -> None:
    print("Latest paid FantasyIQ checkout")
    print(f"Customer: {row['customer_name'] or '(missing name)'}")
    print(f"Email: {row['email'] or '(missing email)'}")
    print(f"League ID: {row['league_id'] or '(missing)'}")
    print(f"Team ID: {row['team_id'] or '(missing)'}")
    print(f"Season: {row['season'] or '(missing)'}")
    print(f"League name: {row['league_name'] or '(missing)'}")
    print(f"Notes: {row['notes'] or '(none)'}")
    print(f"Payment reference: {row['payment_reference']}")
    print(f"Paid at: {row['paid_at']}")
    print(f"Renewal date: {row['renewal_date']}")
    print(f"Customer tracker: {'appended to' if appended else 'already had'} {CUSTOMER_CSV}")
    print()
    print("Vercel env values to use:")
    print(f"FANTASY_IQ_LEAGUE_ID={row['league_id']}")
    print(f"FANTASY_IQ_CUSTOMER_TEAM_ID={row['team_id']}")
    print(f"FANTASY_IQ_SEASON={row['season']}")


def main() -> int:
    load_local_env()
    key = stripe_key()
    link_id = payment_link_id(key)
    session = latest_paid_checkout_session(key, link_id)
    row = row_from_session(session)
    appended = append_customer(row)
    print_summary(row, appended)

    if not row["league_id"]:
        print("Missing ESPN league ID. Ask the customer for it before configuring Vercel.")
        return 2
    if not row["team_id"]:
        print("Missing ESPN team ID. Ask the customer for it before personalizing the dashboard.")
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
