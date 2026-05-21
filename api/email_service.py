from __future__ import annotations

import json
import os
import urllib.parse
import urllib.error
import urllib.request
from html import escape
from typing import Any


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def site_url() -> str:
    return env("FANTASYIQ_SITE_URL", "https://myfantasyiq.com").rstrip("/")


def dashboard_url(customer_slug: str = "", league_key: str = "") -> str:
    url = f"{site_url()}/FantasyIQ/"
    params = {}
    if customer_slug:
        params["customer"] = customer_slug
    if league_key:
        params["league"] = league_key
    return f"{url}?{urllib.parse.urlencode(params)}" if params else url


def setup_url(customer_slug: str = "") -> str:
    url = f"{site_url()}/setup.html"
    return f"{url}?{urllib.parse.urlencode({'customer': customer_slug})}" if customer_slug else url


def help_url() -> str:
    return f"{site_url()}/help.html"


def support_email() -> str:
    return env("FANTASYIQ_SUPPORT_EMAIL", "support@myfantasyiq.com")


def email_from() -> str:
    return env("FANTASYIQ_EMAIL_FROM", "FantasyIQ <onboarding@resend.dev>")


def email_user_agent() -> str:
    return env("FANTASYIQ_EMAIL_USER_AGENT", "FantasyIQ/1.0 (+https://myfantasyiq.com)")


def email_status() -> dict[str, Any]:
    return {
        "provider": "resend",
        "configured": bool(env("RESEND_API_KEY")),
        "from": email_from(),
        "supportEmail": support_email(),
        "dryRun": env("FANTASYIQ_EMAIL_DRY_RUN") == "1",
    }


def record_email_event(customer: dict[str, Any], result: dict[str, Any], event_type: str = "email.setup") -> None:
    try:
        try:
            from database import record_ops_event
        except ImportError:
            from api.database import record_ops_event
        record_ops_event(
            event_type=event_type,
            severity="info" if result.get("sent") else "warning",
            source="email_service",
            customer_slug=str(customer.get("slug") or customer.get("customerSlug") or ""),
            league_key=str(customer.get("default_league_key") or customer.get("leagueKey") or ""),
            message="Setup email sent." if result.get("sent") else str(result.get("reason") or "Setup email was not sent."),
            payload={
                "provider": result.get("provider") or "resend",
                "sent": bool(result.get("sent")),
                "subject": result.get("subject") or "",
                "to": result.get("to") or "",
                "id": result.get("id") or "",
                "status": result.get("status") or "",
                "reason": result.get("reason") or "",
            },
        )
    except Exception:
        return


def customer_setup_email(
    *,
    customer_name: str,
    email: str,
    customer_slug: str,
    access_code: str,
    league_key: str = "",
    renewal_date: str = "",
) -> dict[str, str]:
    name = customer_name or "FantasyIQ customer"
    dashboard = dashboard_url(customer_slug, league_key)
    setup = setup_url(customer_slug)
    help_page = help_url()
    support = support_email()
    subject = "Your FantasyIQ dashboard is ready"
    text = f"""Thanks for grabbing FantasyIQ.

Your dashboard is ready:
{dashboard}

Access code:
{access_code}

Next step:
Open the setup page and validate each public ESPN league you want connected:
{setup}

Need help finding your ESPN league ID or team ID?
{help_page}

Support:
{support}
"""
    if renewal_date:
        text += f"\nRenewal date:\n{renewal_date}\n"

    html = f"""
    <div style="font-family: Arial, sans-serif; color: #151813; line-height: 1.55; max-width: 620px;">
      <p style="color:#8a4f24; font-weight:700; text-transform:uppercase; font-size:12px;">FantasyIQ Season Pass</p>
      <h1 style="color:#0f3a30;">Your FantasyIQ dashboard is ready</h1>
      <p>Thanks for grabbing FantasyIQ, {escape(name)}.</p>
      <p><a href="{escape(dashboard)}" style="color:#0f3a30; font-weight:700;">Open your dashboard</a></p>
      <p><strong>Access code:</strong><br />{escape(access_code)}</p>
      <p><strong>Next step:</strong><br />Validate each public ESPN league you want connected.</p>
      <p><a href="{escape(setup)}" style="color:#0f3a30; font-weight:700;">Open setup page</a></p>
      <p><a href="{escape(help_page)}" style="color:#0f3a30; font-weight:700;">Setup help and Q&amp;A</a></p>
      <p>Support: <a href="mailto:{escape(support)}">{escape(support)}</a></p>
    </div>
    """
    return {"to": email, "subject": subject, "text": text, "html": html}


def send_email(*, to: str, subject: str, html: str, text: str = "", idempotency_key: str = "") -> dict[str, Any]:
    api_key = env("RESEND_API_KEY")
    if not api_key:
        return {
            "sent": False,
            "provider": "resend",
            "reason": "RESEND_API_KEY is not configured",
            "to": to,
            "subject": subject,
        }
    if env("FANTASYIQ_EMAIL_DRY_RUN") == "1":
        return {"sent": False, "provider": "resend", "reason": "dry_run", "to": to, "subject": subject}

    payload = {
        "from": email_from(),
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if text:
        payload["text"] = text

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": email_user_agent(),
    }
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key

    request = urllib.request.Request(
        "https://api.resend.com/emails",
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            data = json.loads(response.read().decode("utf-8"))
            return {"sent": True, "provider": "resend", "id": data.get("id"), "to": to, "subject": subject}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return {"sent": False, "provider": "resend", "status": exc.code, "reason": body[:500], "to": to, "subject": subject}
    except Exception as exc:
        return {"sent": False, "provider": "resend", "reason": str(exc), "to": to, "subject": subject}


def send_customer_setup_email(customer: dict[str, Any], league_key: str = "", renewal_date: str = "", idempotency_key: str = "") -> dict[str, Any]:
    email = str(customer.get("email") or "").strip()
    access_code = str(customer.get("access_code") or customer.get("accessCode") or "").strip()
    if not email:
        return {"sent": False, "reason": "customer_email_missing"}
    if not access_code:
        return {"sent": False, "reason": "customer_access_code_missing", "to": email}
    message = customer_setup_email(
        customer_name=str(customer.get("customer_name") or customer.get("customerName") or ""),
        email=email,
        customer_slug=str(customer.get("slug") or customer.get("customerSlug") or ""),
        access_code=access_code,
        league_key=league_key,
        renewal_date=renewal_date,
    )
    result = send_email(
        to=message["to"],
        subject=message["subject"],
        html=message["html"],
        text=message["text"],
        idempotency_key=idempotency_key,
    )
    record_email_event({**customer, "leagueKey": league_key}, result)
    return result
