from __future__ import annotations

import json
import os
import sys
import urllib.parse
import urllib.request
from typing import Any

from local_env import load_local_env


API_BASE = "https://api.vercel.com"
DEFAULT_PROJECT_NAME = "fantasyiq-paid"
DEFAULT_SEASON = "2026"
OPTIONAL_ENV_KEYS = [
    "FANTASY_IQ_CUSTOMER_SLUG",
    "FANTASY_IQ_CUSTOMER_NAME",
    "FANTASY_IQ_CUSTOMER_TEAM_ID",
    "FANTASY_IQ_CUSTOMER_TEAM_NAME",
    "FANTASY_IQ_CUSTOMER_STATUS",
    "FANTASY_IQ_CUSTOMER_ACCESS_CODE",
    "FANTASY_IQ_LEAGUE_NAME",
    "FANTASY_IQ_LEAGUES_JSON",
    "FANTASY_IQ_DEFAULT_LEAGUE",
    "FANTASY_IQ_DEFAULT_CUSTOMER",
    "FANTASY_IQ_CUSTOMERS_JSON",
    "FANTASYIQ_ADMIN_TOKEN",
    "FANTASYIQ_ADMIN_GATE_PASSWORD",
    "FANTASYIQ_ADMIN_GATE_SECRET",
    "FANTASYIQ_ADMIN_GATE_MAX_AGE_SECONDS",
    "FANTASYIQ_DASHBOARD_URL",
    "FANTASYIQ_STRIPE_LIVEMODE",
    "FANTASYIQ_STRIPE_ALLOWED_PAYMENT_LINK_IDS",
    "FANTASYIQ_STRIPE_ALLOWED_PRICE_IDS",
    "FANTASYIQ_STRIPE_ALLOWED_PRODUCT_IDS",
    "STRIPE_WEBHOOK_SECRET",
]


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def require_env(name: str) -> str:
    value = env(name)
    if not value:
        raise SystemExit(f"Set {name} in your local shell first.")
    return value


def vercel_request(
    method: str,
    path: str,
    token: str,
    body: dict[str, Any] | None = None,
    params: dict[str, str] | None = None,
) -> dict[str, Any]:
    url = f"{API_BASE}{path}"
    query = {k: v for k, v in (params or {}).items() if v}
    if query:
        url = f"{url}?{urllib.parse.urlencode(query)}"

    data = None
    headers = {"Authorization": f"Bearer {token}"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        response_body = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"Vercel API error {exc.code}: {response_body}") from exc


def upsert_env_var(token: str, project: str, key: str, value: str) -> dict[str, Any]:
    return vercel_request(
        "POST",
        f"/v10/projects/{urllib.parse.quote(project)}/env",
        token,
        body={
            "key": key,
            "value": value,
            "type": "plain",
            "target": ["production", "preview"],
            "comment": "FantasyIQ customer dashboard configuration",
        },
        params={
            "upsert": "true",
            "teamId": env("VERCEL_TEAM_ID"),
            "slug": env("VERCEL_TEAM_SLUG"),
        },
    )


def main() -> int:
    load_local_env()
    token = require_env("VERCEL_TOKEN")
    project = env("VERCEL_PROJECT_NAME", DEFAULT_PROJECT_NAME)
    customers_json = env("FANTASY_IQ_CUSTOMERS_JSON")
    leagues_json = env("FANTASY_IQ_LEAGUES_JSON")
    league_id = env("FANTASY_IQ_LEAGUE_ID")
    season = env("FANTASY_IQ_SEASON", DEFAULT_SEASON)
    optional_values = {key: env(key) for key in OPTIONAL_ENV_KEYS}
    if not customers_json and not leagues_json and not league_id and not any(optional_values.values()):
        raise SystemExit(
            "Set FANTASY_IQ_CUSTOMERS_JSON, FANTASY_IQ_LEAGUES_JSON, "
            "FANTASY_IQ_LEAGUE_ID, or at least one optional environment variable."
        )

    results = []
    if league_id:
        results.extend(
            [
                upsert_env_var(token, project, "FANTASY_IQ_LEAGUE_ID", league_id),
                upsert_env_var(token, project, "FANTASY_IQ_SEASON", season),
            ]
        )
    for key in OPTIONAL_ENV_KEYS:
        value = optional_values[key]
        if value:
            results.append(upsert_env_var(token, project, key, value))

    failed = [
        failure
        for result in results
        for failure in result.get("failed", [])
    ]
    if failed:
        print(json.dumps(failed, indent=2))
        return 1

    print(f"Updated Vercel env vars for project: {project}")
    if league_id:
        print(f"FANTASY_IQ_LEAGUE_ID={league_id}")
        print(f"FANTASY_IQ_SEASON={season}")
    if customers_json:
        print("FANTASY_IQ_CUSTOMERS_JSON=set")
    if leagues_json:
        print("FANTASY_IQ_LEAGUES_JSON=set")
    for key in OPTIONAL_ENV_KEYS:
        if optional_values[key] and key not in ("FANTASY_IQ_CUSTOMERS_JSON", "FANTASY_IQ_LEAGUES_JSON"):
            print(f"{key}=set")
    print("Redeploy the Vercel project after changing env vars.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
