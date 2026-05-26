from __future__ import annotations

import csv
import hmac
import json
import time
import urllib.parse
from datetime import date, datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from typing import Any

try:
    from admin_gate_auth import (
        admin_gate_cookie,
        admin_gate_max_age,
        admin_gate_password,
        admin_gate_secret,
        admin_gate_token_from_headers,
        clear_admin_gate_cookie,
        require_admin_gate,
        sign_admin_gate,
        verify_admin_gate_token,
    )
    from customer_context import ConfigError, all_customer_contexts, env
    from rate_limit import check_rate_limit, rate_limit_payload
except ModuleNotFoundError:
    from api.admin_gate_auth import (
        admin_gate_cookie,
        admin_gate_max_age,
        admin_gate_password,
        admin_gate_secret,
        admin_gate_token_from_headers,
        clear_admin_gate_cookie,
        require_admin_gate,
        sign_admin_gate,
        verify_admin_gate_token,
    )
    from api.customer_context import ConfigError, all_customer_contexts, env
    from api.rate_limit import check_rate_limit, rate_limit_payload


CUSTOMER_CSV = Path("customers.csv")
SAFE_FIELDS = [
    "customer_name",
    "email",
    "league_id",
    "team_id",
    "season",
    "league_name",
    "paid_at",
    "renewal_date",
    "dashboard_url",
    "status",
    "notes",
]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def public_site_url() -> str:
    return env("FANTASYIQ_SITE_URL", "https://myfantasyiq.com").rstrip("/")


def dashboard_url(customer_slug: str) -> str:
    return f"{public_site_url()}/FantasyIQ/?customer={urllib.parse.quote(customer_slug)}"


def setup_url(customer_slug: str) -> str:
    return f"{public_site_url()}/setup.html?customer={urllib.parse.quote(customer_slug)}"


def auth_token_from(handler: BaseHTTPRequestHandler) -> str:
    return handler.headers.get("x-fantasyiq-admin-token", "").strip()


def require_admin(handler: BaseHTTPRequestHandler) -> None:
    require_admin_gate(handler.headers)
    expected = env("FANTASYIQ_ADMIN_TOKEN")
    if not expected:
        raise PermissionError("FANTASYIQ_ADMIN_TOKEN is not configured.")
    if not hmac.compare_digest(auth_token_from(handler), expected):
        raise PermissionError("Invalid admin token.")


def is_admin_gate_request(handler: BaseHTTPRequestHandler) -> bool:
    return "route=admin_gate" in str(handler.path or "")


def admin_gate_payload(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    ok = verify_admin_gate_token(admin_gate_token_from_headers(handler.headers))
    return {"ok": ok, "authenticated": ok, "syncedAt": utc_now()}


def handle_admin_gate_post(handler: BaseHTTPRequestHandler) -> tuple[dict[str, Any], HTTPStatus, list[tuple[str, str]]]:
    raw = parse_body(handler)
    action = str(raw.get("action") or "login").strip().lower()
    if action == "logout":
        return (
            {"ok": True, "authenticated": False, "syncedAt": utc_now()},
            HTTPStatus.OK,
            [("Set-Cookie", clear_admin_gate_cookie(handler.headers))],
        )

    limit = check_rate_limit(
        "admin_gate",
        headers=handler.headers,
        raw={"password": "attempt"},
        fields=("password",),
        limit=8,
        window_seconds=600,
    )
    if not limit.allowed:
        return (
            rate_limit_payload(limit, "Too many admin gate attempts. Wait a few minutes, then try again."),
            HTTPStatus.TOO_MANY_REQUESTS,
            [],
        )

    expected = admin_gate_password()
    if not expected:
        raise PermissionError("FANTASYIQ_ADMIN_GATE_PASSWORD is not configured.")
    if not admin_gate_secret():
        raise PermissionError("FANTASYIQ_ADMIN_GATE_SECRET is not configured.")
    if not hmac.compare_digest(str(raw.get("password") or ""), expected):
        raise PermissionError("Invalid admin gate password.")

    token = sign_admin_gate(int(time.time()))
    return (
        {"ok": True, "authenticated": True, "syncedAt": utc_now()},
        HTTPStatus.OK,
        [("Set-Cookie", admin_gate_cookie(token, handler.headers, max_age=admin_gate_max_age()))],
    )


def days_until(value: str) -> int | None:
    if not value:
        return None
    try:
        return (date.fromisoformat(value) - date.today()).days
    except ValueError:
        return None


def csv_customers() -> list[dict[str, Any]]:
    if not CUSTOMER_CSV.exists():
        return []
    with CUSTOMER_CSV.open("r", newline="", encoding="utf-8") as handle:
        rows = []
        for row in csv.DictReader(handle):
            safe = {field: row.get(field, "") for field in SAFE_FIELDS}
            safe["daysUntilRenewal"] = days_until(safe.get("renewal_date", ""))
            rows.append(safe)
        return rows


def registry_customers() -> list[dict[str, Any]]:
    return [
        context.public_dict()
        for context in all_customer_contexts().values()
        if not context.demo_mode
    ]


def database_customers() -> tuple[dict[str, Any], list[dict[str, Any]]]:
    try:
        try:
            from database import database_status, list_customers
        except ImportError:
            from api.database import database_status, list_customers
        status = database_status()
        return status, list_customers() if status["enabled"] else []
    except Exception as exc:
        return {"configured": False, "driverReady": False, "enabled": False, "error": str(exc)}, []


def database_ops() -> tuple[dict[str, Any], list[dict[str, Any]]]:
    try:
        try:
            from database import list_ops_events, ops_summary
        except ImportError:
            from api.database import list_ops_events, ops_summary
        return ops_summary(), list_ops_events(50)
    except Exception as exc:
        return {"total": 0, "warnings": 0, "errors": 0, "lastEventAt": "", "error": str(exc)}, []


def email_readiness() -> dict[str, Any]:
    try:
        try:
            from email_service import email_status
        except ImportError:
            from api.email_service import email_status
        return email_status()
    except Exception as exc:
        return {"provider": "resend", "configured": False, "error": str(exc)}


def customer_key(row: dict[str, Any]) -> str:
    for field in ("slug", "customerSlug", "customer_slug"):
        value = str(row.get(field) or "").strip().lower()
        if value:
            return f"slug:{value}"
    dashboard = str(row.get("dashboard_url") or row.get("dashboardUrl") or "").strip().lower()
    if dashboard:
        parsed = urllib.parse.urlparse(dashboard)
        requested = urllib.parse.parse_qs(parsed.query).get("customer", [""])[0]
        if requested:
            return f"slug:{requested.strip().lower()}"
        return f"dashboard:{dashboard}"
    for field in ("email", "customerEmail"):
        value = str(row.get(field) or "").strip().lower()
        if value:
            return f"email:{value}"
    return f"row:{id(row)}"


def customer_totals(*sources: list[dict[str, Any]]) -> tuple[int, int]:
    statuses: dict[str, set[str]] = {}
    for rows in sources:
        for row in rows:
            statuses.setdefault(customer_key(row), set()).add(str(row.get("status") or "").strip().lower())
    configured_statuses = {"configured", "active"}
    configured = 0
    needs_setup = 0
    for row_statuses in statuses.values():
        if row_statuses & configured_statuses:
            configured += 1
        else:
            needs_setup += 1
    return configured, needs_setup


def admin_payload() -> dict[str, Any]:
    csv_rows = csv_customers()
    registry_rows = registry_customers()
    database_status, database_rows = database_customers()
    ops_status, ops_events = database_ops()
    data_health = data_health_payload(limit=120, cache_limit=40, summary_only=True)
    configured_count, needs_setup_count = customer_totals(csv_rows, registry_rows, database_rows)
    return {
        "ok": True,
        "syncedAt": utc_now(),
        "csvCustomerCount": len(csv_rows),
        "registryCustomerCount": len(registry_rows),
        "databaseCustomerCount": len(database_rows),
        "database": database_status,
        "email": email_readiness(),
        "opsSummary": ops_status,
        "opsEvents": ops_events,
        "dataHealthSummary": data_health.get("summary") or {},
        "dataHealthStatus": data_health.get("status") or "not_configured",
        "configuredCount": configured_count,
        "needsSetupCount": needs_setup_count,
        "customers": csv_rows,
        "databaseCustomers": database_rows,
        "registry": registry_rows,
        "nextActions": [
            "Connect Neon/Postgres and run database/schema.sql to make checkout and setup records durable.",
            "Set FANTASYIQ_ADMIN_TOKEN in Vercel before using this endpoint in production.",
            "Use /setup.html from a signed-in dashboard to save each public ESPN league profile.",
        ],
    }


def data_health_payload(limit: int = 240, cache_limit: int = 80, summary_only: bool = False) -> dict[str, Any]:
    try:
        try:
            from provider_cache import freshness_health_report, provider_cache_snapshot
        except ImportError:
            from api.provider_cache import freshness_health_report, provider_cache_snapshot
        report = freshness_health_report(limit)
        cache_rows = provider_cache_snapshot(cache_limit) if not summary_only else []
        recommended = []
        if report.get("missingRequiredScopes"):
            recommended.append("Run daily and Schedule IQ refresh jobs; required freshness scopes are missing.")
        required_problem_rows = report.get("requiredProblemRows") if isinstance(report.get("requiredProblemRows"), list) else []
        problem_rows = report.get("problemRows") if isinstance(report.get("problemRows"), list) else []
        if required_problem_rows:
            recommended.append("Rerun the affected required refresh before trusting site-wide recommendations.")
        elif report.get("status") == "warning" and problem_rows:
            recommended.append("Review warning provider rows and rerun the affected refresh when practical.")
        if report.get("status") == "not_configured":
            recommended.append("Connect the database and wait for the first production cron run.")
        return {
            "ok": True,
            "action": "data_health",
            "status": report.get("status") or "not_configured",
            "syncedAt": utc_now(),
            "summary": report.get("summary") or {},
            "freshness": [] if summary_only else report.get("freshness") or [],
            "providerCache": cache_rows,
            "problemRows": [] if summary_only else report.get("problemRows") or [],
            "requiredProblemRows": [] if summary_only else report.get("requiredProblemRows") or [],
            "nonRequiredProblemRows": [] if summary_only else report.get("nonRequiredProblemRows") or [],
            "missingRequiredScopes": report.get("missingRequiredScopes") or [],
            "recommendedActions": recommended,
        }
    except Exception as exc:
        return {
            "ok": False,
            "action": "data_health",
            "status": "critical",
            "syncedAt": utc_now(),
            "message": str(exc),
            "summary": {},
            "freshness": [],
            "providerCache": [],
            "recommendedActions": ["Fix the data-health aggregation error before trusting provider status."],
        }


def parse_body(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    length = int(handler.headers.get("Content-Length") or 0)
    if length <= 0:
        return {}
    raw = handler.rfile.read(length).decode("utf-8")
    if "application/json" in handler.headers.get("Content-Type", ""):
        return json.loads(raw or "{}")
    parsed: dict[str, str] = {}
    for pair in raw.split("&"):
        if not pair:
            continue
        key, _, value = pair.partition("=")
        parsed[urllib.parse.unquote_plus(key)] = urllib.parse.unquote_plus(value)
    return parsed


def admin_action(raw: dict[str, Any]) -> dict[str, Any]:
    action = str(raw.get("action") or "").strip()
    customer_slug = str(raw.get("customer") or raw.get("slug") or "").strip()
    league_key = str(raw.get("league") or raw.get("leagueKey") or raw.get("league_key") or "").strip()
    try:
        try:
            from database import (
                admin_customer_detail,
                archive_customer_league,
                archive_pending_duplicate_leagues,
                record_ops_event,
                reset_customer_access_code,
                revoke_customer_sessions,
                update_customer_status,
            )
        except ImportError:
            from api.database import (
                admin_customer_detail,
                archive_customer_league,
                archive_pending_duplicate_leagues,
                record_ops_event,
                reset_customer_access_code,
                revoke_customer_sessions,
                update_customer_status,
            )
    except ImportError as exc:
        raise ConfigError("Database admin tools are unavailable.") from exc

    if action == "customer_detail":
        detail = admin_customer_detail(customer_slug)
        if not detail:
            raise ConfigError("Customer was not found in the database.")
        return {
            "ok": True,
            "action": action,
            "customer": detail,
            "dashboardUrl": dashboard_url(detail["slug"]),
            "setupUrl": setup_url(detail["slug"]),
            "syncedAt": utc_now(),
        }

    if action == "ops_events":
        try:
            try:
                from database import list_ops_events, ops_summary
            except ImportError:
                from api.database import list_ops_events, ops_summary
            events = list_ops_events(
                int(raw.get("limit") or 100),
                severity=str(raw.get("severity") or "").strip(),
                source=str(raw.get("source") or "").strip(),
                customer_slug=customer_slug,
                event_type=str(raw.get("eventType") or raw.get("event_type") or "").strip(),
                query=str(raw.get("query") or "").strip(),
            )
            summary = ops_summary()
        except Exception as exc:
            raise ConfigError(f"Could not load ops events: {exc}") from exc
        return {
            "ok": True,
            "action": action,
            "opsSummary": summary,
            "opsEvents": events,
            "syncedAt": utc_now(),
        }

    if action == "refresh_sos_heatmap":
        season = int(raw.get("season") or 2026)
        try:
            try:
                from sos_heatmap import force_refresh_payload
            except ImportError:
                from api.sos_heatmap import force_refresh_payload
            refreshed = force_refresh_payload(season)
        except Exception as exc:
            raise ConfigError(f"Could not refresh Schedule IQ: {exc}") from exc
        try:
            try:
                from database import record_ops_event
            except ImportError:
                from api.database import record_ops_event
            record_ops_event(
                event_type="admin.refresh_sos_heatmap",
                severity="info",
                source="admin_customers",
                message=f"Schedule IQ refreshed manually for {season}.",
                payload={
                    "season": refreshed.get("season"),
                    "rows": len(refreshed.get("rows") or []),
                    "sources": refreshed.get("sources") or {},
                    "cache": refreshed.get("cache") or {},
                    "providerMeta": refreshed.get("providerMeta") or {},
                },
            )
        except Exception:
            pass
        return {
            "ok": True,
            "action": action,
            "season": refreshed.get("season"),
            "rows": len(refreshed.get("rows") or []),
            "sources": refreshed.get("sources") or {},
            "cache": refreshed.get("cache") or {},
            "providerMeta": refreshed.get("providerMeta") or {},
            "updatedAt": refreshed.get("updatedAt"),
            "refreshCadence": refreshed.get("refreshCadence"),
            "syncedAt": utc_now(),
        }

    if action == "data_health":
        limit = int(raw.get("limit") or 240)
        cache_limit = int(raw.get("cacheLimit") or raw.get("cache_limit") or 80)
        payload = data_health_payload(limit=limit, cache_limit=cache_limit)
        if not payload.get("ok"):
            raise ConfigError(payload.get("message") or "Could not load data health.")
        return payload

    if action == "refresh_daily_data":
        try:
            try:
                from cron_daily_refresh import daily_refresh_payload
            except ImportError:
                from api.cron_daily_refresh import daily_refresh_payload
            refreshed = daily_refresh_payload()
        except Exception as exc:
            raise ConfigError(f"Could not run daily data refresh: {exc}") from exc
        try:
            try:
                from database import record_ops_event
            except ImportError:
                from api.database import record_ops_event
            record_ops_event(
                event_type="admin.refresh_daily_data",
                severity="info" if refreshed.get("ok") else "warning",
                source="admin_customers",
                message="Daily provider data refresh was run from the protected admin console.",
                payload={"ok": refreshed.get("ok"), "steps": refreshed.get("steps") or []},
            )
        except Exception:
            pass
        return {
            "ok": bool(refreshed.get("ok")),
            "action": action,
            "refresh": refreshed,
            "dataHealth": data_health_payload(limit=240, cache_limit=80),
            "syncedAt": utc_now(),
        }

    if action == "apply_database_schema":
        schema_path = Path(__file__).resolve().parents[1] / "database" / "schema.sql"
        if not schema_path.exists():
            raise ConfigError("Database schema file was not found in the deployment.")
        try:
            try:
                from database import apply_schema, database_status
            except ImportError:
                from api.database import apply_schema, database_status

            before = database_status()
            apply_schema(schema_path.read_text(encoding="utf-8"))
            after = database_status()
        except Exception as exc:
            raise ConfigError(f"Could not apply database schema: {exc}") from exc
        try:
            try:
                from database import record_ops_event
            except ImportError:
                from api.database import record_ops_event
            record_ops_event(
                event_type="admin.apply_database_schema",
                severity="info",
                source="admin_customers",
                message="Database schema applied from protected admin action.",
                payload={"before": before, "after": after},
            )
        except Exception:
            pass
        return {
            "ok": True,
            "action": action,
            "database": after,
            "syncedAt": utc_now(),
        }

    if action == "reset_access_code":
        detail = reset_customer_access_code(customer_slug)
        if not detail:
            raise ConfigError("Customer was not found in the database.")
        revoke_customer_sessions(str(detail.get("slug") or customer_slug))
        record_ops_event(
            event_type="admin.reset_access_code",
            severity="info",
            source="admin_customers",
            customer_slug=str(detail.get("slug") or customer_slug),
            message="Admin reset a customer access code.",
            payload={"accessCodeSet": bool(detail.get("access_code"))},
        )
        return {
            "ok": True,
            "action": action,
            "customer": detail,
            "dashboardUrl": dashboard_url(detail["slug"]),
            "setupUrl": setup_url(detail["slug"]),
            "syncedAt": utc_now(),
        }

    if action == "update_customer_status":
        status = str(raw.get("status") or raw.get("customerStatus") or raw.get("customer_status") or "").strip()
        subscription_status = str(raw.get("subscriptionStatus") or raw.get("subscription_status") or "").strip()
        allowed_statuses = {"paid_needs_setup", "configured", "active", "suspended", "canceled", "refunded"}
        if status not in allowed_statuses:
            raise ConfigError("Unsupported customer status.")
        detail = update_customer_status(customer_slug, status, subscription_status)
        if not detail:
            raise ConfigError("Customer was not found in the database.")
        record_ops_event(
            event_type="admin.update_customer_status",
            severity="info",
            source="admin_customers",
            customer_slug=str(detail.get("slug") or customer_slug),
            message=f"Admin changed customer status to {status}.",
            payload={"status": status, "subscriptionStatus": subscription_status},
        )
        return {
            "ok": True,
            "action": action,
            "customer": detail,
            "dashboardUrl": dashboard_url(detail["slug"]),
            "setupUrl": setup_url(detail["slug"]),
            "syncedAt": utc_now(),
        }

    if action == "archive_league":
        if not league_key:
            raise ConfigError("Choose a league to archive.")
        try:
            archived = archive_customer_league(customer_slug, league_key)
        except (KeyError, ValueError) as exc:
            raise ConfigError(str(exc)) from exc
        record_ops_event(
            event_type="admin.archive_league",
            severity="info",
            source="admin_customers",
            customer_slug=customer_slug,
            league_key=league_key,
            message="Admin archived a customer league profile.",
            payload=archived,
        )
        return {
            "ok": True,
            "action": action,
            "archived": archived.get("archived") or {},
            "nextLeagueKey": archived.get("nextLeagueKey") or "",
            "remainingLeagueCount": archived.get("remainingLeagueCount") or 0,
            "customer": admin_customer_detail(customer_slug) or {},
            "syncedAt": utc_now(),
        }

    if action == "send_setup_email":
        detail = admin_customer_detail(customer_slug)
        if not detail:
            raise ConfigError("Customer was not found in the database.")
        try:
            try:
                from email_service import send_customer_setup_email
            except ImportError:
                from api.email_service import send_customer_setup_email
            email_result = send_customer_setup_email(
                detail,
                league_key=str(detail.get("default_league_key") or ""),
                idempotency_key=f"fantasyiq-admin-setup-{detail['slug']}-{int(datetime.now(timezone.utc).timestamp())}",
            )
        except Exception as exc:
            email_result = {"sent": False, "reason": str(exc)}
        return {
            "ok": True,
            "action": action,
            "customer": {
                "slug": detail.get("slug"),
                "customer_name": detail.get("customer_name"),
                "email": detail.get("email"),
                "passwordConfigured": bool(detail.get("password_configured")),
            },
            "email": email_result,
            "syncedAt": utc_now(),
        }

    if action == "send_password_reset_email":
        detail = admin_customer_detail(customer_slug)
        if not detail:
            raise ConfigError("Customer was not found in the database.")
        if not str(detail.get("access_code") or "").strip():
            detail = reset_customer_access_code(customer_slug)
            if not detail:
                raise ConfigError("Customer was not found in the database.")
            revoke_customer_sessions(str(detail.get("slug") or customer_slug))
            record_ops_event(
                event_type="admin.reset_access_code",
                severity="info",
                source="admin_customers",
                customer_slug=str(detail.get("slug") or customer_slug),
                message="Admin rotated an access code before sending a password reset email.",
                payload={"accessCodeSet": bool(detail.get("access_code"))},
            )
        try:
            try:
                from email_service import send_customer_password_reset_email
            except ImportError:
                from api.email_service import send_customer_password_reset_email
            email_result = send_customer_password_reset_email(
                detail,
                league_key=str(detail.get("default_league_key") or ""),
                idempotency_key=f"fantasyiq-admin-reset-{detail['slug']}-{int(datetime.now(timezone.utc).timestamp())}",
            )
        except Exception as exc:
            email_result = {"sent": False, "reason": str(exc)}
        return {
            "ok": True,
            "action": action,
            "customer": {
                "slug": detail.get("slug"),
                "customer_name": detail.get("customer_name"),
                "email": detail.get("email"),
            },
            "email": email_result,
            "syncedAt": utc_now(),
        }

    if action == "upsert_customer_account":
        slug = str(raw.get("slug") or raw.get("customer") or "").strip()
        email = str(raw.get("email") or "").strip()
        customer_name = str(raw.get("customerName") or raw.get("customer_name") or "").strip()
        league_key = str(raw.get("leagueKey") or raw.get("league_key") or "primary").strip()
        league_name = str(raw.get("leagueName") or raw.get("league_name") or "").strip()
        team_name = str(raw.get("teamName") or raw.get("team_name") or "").strip()
        league_id = raw.get("leagueId") or raw.get("league_id")
        team_id = raw.get("teamId") or raw.get("team_id")
        season = raw.get("season") or 2026
        status = str(raw.get("status") or "configured").strip()
        subscription_status = str(raw.get("subscriptionStatus") or raw.get("subscription_status") or "").strip()
        if not slug and not email:
            raise ConfigError("Enter a customer slug or email.")
        if not email:
            raise ConfigError("Enter the customer email for email-first login.")
        try:
            try:
                from database import upsert_customer, upsert_league
            except ImportError:
                from api.database import upsert_customer, upsert_league

            customer = upsert_customer(
                slug=slug,
                customer_name=customer_name,
                email=email,
                status=status,
                subscription_status=subscription_status,
                default_league_key=league_key,
            )
            resolved_slug = str(customer.get("slug") or slug)
            league = None
            if league_id or league_name:
                league = upsert_league(
                    customer_slug=resolved_slug,
                    league_key=league_key,
                    label=league_name or league_key,
                    league_name=league_name,
                    league_id=league_id,
                    team_id=team_id,
                    team_name=team_name,
                    season=season,
                    league_settings=raw.get("leagueSettings") if isinstance(raw.get("leagueSettings"), dict) else {},
                    status="configured",
                    source="admin_account_repair",
                )
            detail = admin_customer_detail(resolved_slug) or customer
        except Exception as exc:
            raise ConfigError(f"Could not repair customer account: {exc}") from exc
        return {
            "ok": True,
            "action": action,
            "customer": {
                "slug": detail.get("slug"),
                "customer_name": detail.get("customer_name"),
                "email": detail.get("email"),
                "status": detail.get("status"),
                "passwordConfigured": bool(detail.get("password_configured")),
                "accessCodeSet": bool(detail.get("access_code") or detail.get("accessCode")),
            },
            "league": league,
            "dashboardUrl": dashboard_url(str(detail.get("slug") or "")),
            "setupUrl": setup_url(str(detail.get("slug") or "")),
            "syncedAt": utc_now(),
        }

    if action == "send_onboarding_email":
        detail = admin_customer_detail(customer_slug)
        if not detail:
            raise ConfigError("Customer was not found in the database.")
        stage = str(raw.get("stage") or "account").strip() or "account"
        try:
            try:
                from email_service import send_customer_onboarding_email
            except ImportError:
                from api.email_service import send_customer_onboarding_email
            email_result = send_customer_onboarding_email(
                detail,
                stage=stage,
                league_key=str(detail.get("default_league_key") or ""),
                idempotency_key=f"fantasyiq-admin-onboarding-{stage}-{detail['slug']}-{int(datetime.now(timezone.utc).timestamp())}",
            )
        except Exception as exc:
            email_result = {"sent": False, "reason": str(exc)}
        return {
            "ok": True,
            "action": action,
            "stage": stage,
            "customer": {
                "slug": detail.get("slug"),
                "customer_name": detail.get("customer_name"),
                "email": detail.get("email"),
            },
            "email": email_result,
            "syncedAt": utc_now(),
        }

    if action == "clean_pending_leagues":
        archived = archive_pending_duplicate_leagues(customer_slug)
        try:
            try:
                from database import record_ops_event
            except ImportError:
                from api.database import record_ops_event
            record_ops_event(
                event_type="admin.cleanup_pending_leagues",
                severity="info",
                source="admin_customers",
                customer_slug=customer_slug,
                message=f"Archived {len(archived)} duplicate pending league profile(s).",
                payload={"archived": archived},
            )
        except Exception:
            pass
        return {
            "ok": True,
            "action": action,
            "archivedCount": len(archived),
            "archived": archived,
            "syncedAt": utc_now(),
        }

    if action == "send_test_setup_email":
        to = str(raw.get("email") or raw.get("to") or "").strip()
        if "@" not in to:
            raise ConfigError("Enter a valid test email address.")
        try:
            try:
                from email_service import customer_setup_email, send_email
            except ImportError:
                from api.email_service import customer_setup_email, send_email
            message = customer_setup_email(
                customer_name=str(raw.get("customerName") or "FantasyIQ preview"),
                email=to,
                customer_slug=str(raw.get("customer") or "test-preview"),
                access_code="TEST-CODE-ONLY",
            )
            html = (
                '<p style="font-family:Arial,sans-serif;color:#8a4f24;font-weight:700;">'
                "TEST EMAIL ONLY - fake access code for layout review.</p>"
                + message["html"]
            )
            text = "TEST EMAIL ONLY - fake access code for layout review.\n\n" + message["text"]
            email_result = send_email(
                to=message["to"],
                subject=f"[TEST] {message['subject']}",
                html=html,
                text=text,
                idempotency_key=f"fantasyiq-admin-test-setup-{int(datetime.now(timezone.utc).timestamp())}",
            )
        except Exception as exc:
            email_result = {"sent": False, "reason": str(exc)}
        return {
            "ok": True,
            "action": action,
            "email": email_result,
            "syncedAt": utc_now(),
        }

    if action == "self_serve_smoke_test":
        timestamp = int(time.time())
        slug = f"self-serve-smoke-{timestamp}"
        test_email = f"delivered+{slug}@resend.dev"
        event = {
            "id": f"evt_{slug.replace('-', '_')}",
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": f"cs_{slug.replace('-', '_')}",
                    "created": timestamp,
                    "customer": "cus_self_serve_smoke",
                    "payment_status": "paid",
                    "amount_total": 3000,
                    "currency": "usd",
                    "metadata": {"customer_slug": slug},
                    "customer_details": {"name": "FantasyIQ Smoke Customer", "email": test_email},
                    "custom_fields": [
                        {"key": "leagueid", "type": "text", "text": {"value": "584856941"}},
                        {"key": "teamid", "type": "text", "text": {"value": "5"}},
                        {"key": "season", "type": "text", "text": {"value": "2026"}},
                        {"key": "leaguename", "type": "text", "text": {"value": "No Guts, No Glory"}},
                    ],
                }
            },
        }
        deleted = False
        try:
            try:
                from stripe_webhook import process_event
                from database import delete_smoke_customer
            except ImportError:
                from api.stripe_webhook import process_event
                from api.database import delete_smoke_customer
            result = process_event(event)
            database = result.get("database") or {}
            auto_setup = database.get("autoSetup") or {}
            email_result = database.get("setupEmail") or {}
            ok = bool(database.get("persistedDatabase") and auto_setup.get("saved"))
            deleted = delete_smoke_customer(slug)
            return {
                "ok": ok,
                "action": action,
                "customerSlug": slug,
                "persistedDatabase": bool(database.get("persistedDatabase")),
                "autoSetupSaved": bool(auto_setup.get("saved")),
                "leagueKey": auto_setup.get("leagueKey") or "",
                "setupEmailSent": bool(email_result.get("sent")),
                "setupEmailReason": email_result.get("reason") or "",
                "deleted": deleted,
                "syncedAt": utc_now(),
            }
        except Exception as exc:
            try:
                try:
                    from database import delete_smoke_customer
                except ImportError:
                    from api.database import delete_smoke_customer
                deleted = delete_smoke_customer(slug)
            except Exception:
                deleted = False
            return {
                "ok": False,
                "action": action,
                "message": str(exc),
                "customerSlug": slug,
                "deleted": deleted,
                "syncedAt": utc_now(),
            }

    if action == "delete_smoke_customer":
        try:
            try:
                from database import delete_smoke_customer
            except ImportError:
                from api.database import delete_smoke_customer
            deleted = delete_smoke_customer(customer_slug)
        except Exception:
            deleted = False
        return {
            "ok": True,
            "action": action,
            "deleted": deleted,
            "syncedAt": utc_now(),
        }

    raise ConfigError("Unsupported admin action.")


class handler(BaseHTTPRequestHandler):
    def send_json(
        self,
        payload: dict[str, Any],
        status: HTTPStatus = HTTPStatus.OK,
        extra_headers: list[tuple[str, str]] | None = None,
    ) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Robots-Tag", "noindex, nofollow")
        for name, value in extra_headers or []:
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        try:
            if is_admin_gate_request(self):
                self.send_json(admin_gate_payload(self))
                return
            limit = check_rate_limit("admin_customers", headers=self.headers, limit=20, window_seconds=600)
            if not limit.allowed:
                self.send_json(
                    rate_limit_payload(limit, "Too many admin attempts. Wait a few minutes, then try again."),
                    HTTPStatus.TOO_MANY_REQUESTS,
                )
                return
            require_admin(self)
            self.send_json(admin_payload())
        except PermissionError as exc:
            self.send_json({"ok": False, "message": str(exc), "syncedAt": utc_now()}, HTTPStatus.UNAUTHORIZED)
        except ConfigError as exc:
            self.send_json({"ok": False, "message": str(exc), "syncedAt": utc_now()}, HTTPStatus.BAD_REQUEST)

    def do_POST(self) -> None:
        try:
            if is_admin_gate_request(self):
                payload, status, extra_headers = handle_admin_gate_post(self)
                self.send_json(payload, status, extra_headers)
                return
            limit = check_rate_limit("admin_customers", headers=self.headers, limit=20, window_seconds=600)
            if not limit.allowed:
                self.send_json(
                    rate_limit_payload(limit, "Too many admin attempts. Wait a few minutes, then try again."),
                    HTTPStatus.TOO_MANY_REQUESTS,
                )
                return
            require_admin(self)
            self.send_json(admin_action(parse_body(self)))
        except PermissionError as exc:
            self.send_json({"ok": False, "message": str(exc), "syncedAt": utc_now()}, HTTPStatus.UNAUTHORIZED)
        except (ConfigError, json.JSONDecodeError) as exc:
            self.send_json({"ok": False, "message": str(exc), "syncedAt": utc_now()}, HTTPStatus.BAD_REQUEST)

    def do_HEAD(self) -> None:
        self.send_response(HTTPStatus.OK)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
