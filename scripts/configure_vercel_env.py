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
    "FANTASY_IQ_LEAGUE_NAME",
    "FANTASY_IQ_DEFAULT_CUSTOMER",
    "FANTASY_IQ_CUSTOMERS_JSON",
    "FANTASYIQ_ADMIN_TOKEN",
    "FANTASYIQ_DASHBOARD_URL",
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
    league_id = require_env("FANTASY_IQ_LEAGUE_ID")
    season = env("FANTASY_IQ_SEASON", DEFAULT_SEASON)

    results = [
        upsert_env_var(token, project, "FANTASY_IQ_LEAGUE_ID", league_id),
        upsert_env_var(token, project, "FANTASY_IQ_SEASON", season),
    ]
    for key in OPTIONAL_ENV_KEYS:
        value = env(key)
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
    print(f"FANTASY_IQ_LEAGUE_ID={league_id}")
    print(f"FANTASY_IQ_SEASON={season}")
    for key in OPTIONAL_ENV_KEYS:
        if env(key):
            print(f"{key}=set")
    print("Redeploy the Vercel project after changing env vars.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
