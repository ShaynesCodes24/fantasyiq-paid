from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

REPORT_DIR = ROOT / "artifacts" / "health"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def compact_account(context: Any) -> dict[str, Any]:
    return {
        "status": str(getattr(context, "status", "") or ""),
        "subscriptionStatus": str(getattr(context, "subscription_status", "") or ""),
        "accessRequired": bool(getattr(context, "access_code", "") or getattr(context, "password_configured", False)),
        "passwordConfigured": bool(getattr(context, "password_configured", False)),
    }


def league_rows_for_context(context: Any) -> list[dict[str, Any]]:
    leagues = getattr(context, "available_leagues", None) or []
    if leagues:
        return [league for league in leagues if isinstance(league, dict)]
    return [
        {
            "leagueKey": getattr(context, "league_key", "") or "primary",
            "label": getattr(context, "league_name", "") or "Primary league",
            "leagueName": getattr(context, "league_name", "") or "",
            "leagueId": getattr(context, "league_id", None),
            "teamId": getattr(context, "customer_team_id", None),
            "teamName": getattr(context, "customer_team_name", "") or "",
            "season": getattr(context, "season", None),
            "leagueSettings": getattr(context, "league_settings", {}) or {},
            "status": getattr(context, "status", "") or "",
        }
    ]


def classify_league(context: Any, league: dict[str, Any], no_network: bool) -> dict[str, Any]:
    league_id = int_or_none(league.get("leagueId"))
    team_id = int_or_none(league.get("teamId"))
    season = int_or_none(league.get("season")) or int_or_none(getattr(context, "season", None))
    settings = league.get("leagueSettings") if isinstance(league.get("leagueSettings"), dict) else {}
    warnings: list[str] = []
    errors: list[str] = []

    if not league_id:
        warnings.append("league_id_missing")
    if not team_id:
        warnings.append("team_id_missing")
    if not season:
        warnings.append("season_missing")
    if not settings:
        warnings.append("league_settings_missing")

    health = {
        "espnSync": "skipped" if no_network else "not_run",
        "teamMatch": "ok" if team_id else "warning",
        "scoring": "ok" if settings else "warning",
        "draftState": "unknown",
        "liveBoard": "skipped" if no_network else "not_run",
        "intelligenceEngine": "ok",
    }

    intelligence_smoke = backend_intelligence_smoke(context, league)
    if not intelligence_smoke.get("ok"):
        health["intelligenceEngine"] = "warning"
        warnings.append("intelligence_engine_warning")

    status = "ready"
    if errors:
        status = "error"
    elif warnings:
        status = "warning"

    return {
        "customerSlug": getattr(context, "slug", ""),
        "leagueKey": str(league.get("leagueKey") or league.get("key") or getattr(context, "league_key", "") or "primary"),
        "leagueId": league_id,
        "season": season,
        "status": status,
        "account": compact_account(context),
        "health": health,
        "details": {
            "scoringLabel": settings.get("scoringLabel") or settings.get("scoringType") or "",
            "teamCount": settings.get("teamCount") or "",
            "teamConfigured": bool(team_id),
            "fallbackCodes": warnings,
            "errors": errors,
            "networkMode": "disabled" if no_network else "local_offline_only",
            "backendRecommendation": intelligence_smoke.get("mainMove", ""),
            "backendConfidence": intelligence_smoke.get("score", ""),
        },
    }


def backend_intelligence_smoke(context: Any, league: dict[str, Any]) -> dict[str, Any]:
    try:
        from api.intelligence import response_payload

        query = {
            "customer": [str(getattr(context, "slug", "") or "")],
            "league": [str(league.get("leagueKey") or league.get("key") or getattr(context, "league_key", "") or "")],
        }
        payload = response_payload(query, {})
        recommendation = payload.get("recommendation") if isinstance(payload.get("recommendation"), dict) else {}
        engine = payload.get("engine") if isinstance(payload.get("engine"), dict) else {}
        return {
            "ok": bool(payload.get("ok")),
            "mainMove": recommendation.get("mainMove") or "",
            "score": engine.get("fantasyIqScore") or "",
        }
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


def int_or_none(value: Any) -> int | None:
    try:
        parsed = int(str(value).strip())
    except (TypeError, ValueError):
        return None
    return parsed if parsed > 0 else None


def load_contexts(customer_filter: str = "") -> list[Any]:
    from api.customer_context import all_customer_contexts, database_customer_context

    contexts = dict(all_customer_contexts())
    try:
        from api.database import database_enabled, list_customers

        if database_enabled():
            for row in list_customers():
                slug = str(row.get("slug") or "").strip()
                if slug and slug not in contexts:
                    database_context = database_customer_context(slug)
                    if database_context:
                        contexts[slug] = database_context
    except Exception:
        pass
    if customer_filter:
        context = contexts.get(customer_filter)
        return [context] if context else []
    return list(contexts.values())


def build_report(mode: str, customer_filter: str = "", league_filter: str = "", no_network: bool = True) -> dict[str, Any]:
    contexts = load_contexts(customer_filter)
    league_reports: list[dict[str, Any]] = []

    for context in contexts:
        for league in league_rows_for_context(context):
            league_key = str(league.get("leagueKey") or league.get("key") or getattr(context, "league_key", "") or "primary")
            if league_filter and league_key != league_filter:
                continue
            league_reports.append(classify_league(context, league, no_network=no_network))

    summary = {
        "customersChecked": len({item["customerSlug"] for item in league_reports}),
        "leaguesChecked": len(league_reports),
        "ready": sum(1 for item in league_reports if item["status"] == "ready"),
        "warnings": sum(1 for item in league_reports if item["status"] == "warning"),
        "errors": sum(1 for item in league_reports if item["status"] == "error"),
    }

    return {
        "ok": summary["errors"] == 0,
        "generatedAt": utc_now(),
        "mode": mode,
        "summary": summary,
        "leagues": league_reports,
        "ops": {
            "productionWrites": False,
            "redacted": True,
            "network": "disabled" if no_network else "not_enabled_in_this_version",
        },
    }


def write_report(report: dict[str, Any]) -> Path:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d")
    report_path = REPORT_DIR / f"daily-league-intelligence-{stamp}.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a redacted local FantasyIQ league intelligence health report.")
    parser.add_argument("--mode", choices=["local"], default="local", help="Only local redacted artifact mode is enabled.")
    parser.add_argument("--customer", default="", help="Optional customer slug filter.")
    parser.add_argument("--league", default="", help="Optional league key filter.")
    parser.add_argument("--no-network", action="store_true", default=True, help="Do not call ESPN or production services.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    report = build_report(args.mode, args.customer, args.league, no_network=True)
    report_path = write_report(report)
    print(
        "Daily league intelligence health report: "
        f"{report['summary']['customersChecked']} customer(s), "
        f"{report['summary']['leaguesChecked']} league(s), "
        f"{report['summary']['warnings']} warning(s), "
        f"{report['summary']['errors']} error(s)."
    )
    print(f"REPORT {report_path}")
    return 1 if report["summary"]["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
