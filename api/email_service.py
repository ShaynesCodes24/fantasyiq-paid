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
    url = f"{site_url()}/"
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


def feedback_url(customer_slug: str = "", league_key: str = "") -> str:
    url = f"{site_url()}/feedback.html"
    params = {}
    if customer_slug:
        params["customer"] = customer_slug
    if league_key:
        params["league"] = league_key
    return f"{url}?{urllib.parse.urlencode(params)}" if params else url


def support_email() -> str:
    return env("FANTASYIQ_SUPPORT_EMAIL", "support@myfantasyiq.com")


def alert_email() -> str:
    return env("FANTASYIQ_ALERT_EMAIL", support_email())


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
        "alertEmail": alert_email(),
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
    create_password = f"{setup}#create-password"
    help_page = help_url()
    feedback = feedback_url(customer_slug, league_key)
    support = support_email()
    subject = "Create your FantasyIQ password"
    text = f"""Thanks for grabbing FantasyIQ.

Your account was created from this checkout email, and this is your setup email.

Your dashboard is ready:
{dashboard}

Access code:
{access_code}

Create your password:
{create_password}

Next step:
Open the setup page and validate each public ESPN league you want connected. FantasyIQ auto-detects scoring, team count, flex, superflex, bench, and draft rounds from ESPN:
{setup}

Before draft day:
- You need your ESPN league ID and team ID.
- Your ESPN league must be public for live FantasyIQ sync.
- If the access code does not match your checkout email, contact support.

How to find your ESPN IDs:
1. Open your ESPN fantasy league in a web browser, not the mobile app.
2. Copy the number after leagueId= in the address bar. That is your league ID.
3. Open your team page or roster page.
4. Copy the number after teamId= in the address bar. That is your team ID.
5. If the URL has seasonId=, make sure it matches the season you are setting up.

Need more help finding your ESPN league ID or team ID?
{help_page}

After your first setup or dashboard session, tell us what was confusing, useful, or missing:
{feedback}

Support:
{support}
"""
    if renewal_date:
        text += f"\nRenewal date:\n{renewal_date}\n"

    html = f"""
    <div style="font-family: Arial, sans-serif; color: #151813; line-height: 1.55; max-width: 620px;">
      <p style="color:#8a4f24; font-weight:700; text-transform:uppercase; font-size:12px;">FantasyIQ Season Pass</p>
      <h1 style="color:#0f3a30;">Create your FantasyIQ password</h1>
      <p>Thanks for grabbing FantasyIQ, {escape(name)}.</p>
      <p>Your account was created from this checkout email, and this is your setup email.</p>
      <p><strong>Access code:</strong><br />{escape(access_code)}</p>
      <p><a href="{escape(create_password)}" style="display:inline-block; background:#0f3a30; color:#fff8e8; font-weight:700; padding:12px 16px; border-radius:8px; text-decoration:none;">Create / reset password</a></p>
      <p><a href="{escape(dashboard)}" style="color:#0f3a30; font-weight:700;">Open your dashboard</a></p>
      <p><strong>Next step:</strong><br />Validate each public ESPN league you want connected. FantasyIQ auto-detects scoring, team count, flex, superflex, bench, and draft rounds from ESPN.</p>
      <p><a href="{escape(setup)}" style="color:#0f3a30; font-weight:700;">Open setup page</a></p>
      <div style="background:#eef8f1; border:1px solid #b8d8c0; border-radius:8px; padding:14px; margin:18px 0;">
        <p style="margin:0 0 8px 0;"><strong>Before draft day</strong></p>
        <ul style="margin:0; padding-left:20px;">
          <li>You need your ESPN league ID and team ID.</li>
          <li>Your ESPN league must be public for live FantasyIQ sync.</li>
          <li>If the access code does not match your checkout email, contact support.</li>
        </ul>
      </div>
      <div style="background:#fbf6e8; border:1px solid #e3c875; border-radius:8px; padding:14px; margin:18px 0;">
        <p style="margin:0 0 8px 0;"><strong>How to find your ESPN IDs</strong></p>
        <ol style="margin:0; padding-left:20px;">
          <li>Open your ESPN fantasy league in a web browser, not the mobile app.</li>
          <li>Copy the number after <strong>leagueId=</strong> in the address bar. That is your league ID.</li>
          <li>Open your team page or roster page.</li>
          <li>Copy the number after <strong>teamId=</strong> in the address bar. That is your team ID.</li>
          <li>If the URL has <strong>seasonId=</strong>, make sure it matches the season you are setting up.</li>
        </ol>
      </div>
      <p><a href="{escape(help_page)}" style="color:#0f3a30; font-weight:700;">Setup help and Q&amp;A</a></p>
      <p><a href="{escape(feedback)}" style="color:#0f3a30; font-weight:700;">Share quick feedback after first use</a></p>
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


def send_ops_alert(
    *,
    event_type: str,
    severity: str,
    source: str = "",
    customer_slug: str = "",
    league_key: str = "",
    message: str = "",
) -> dict[str, Any]:
    to = alert_email()
    if not to or "@" not in to:
        return {"sent": False, "reason": "alert_email_missing"}
    subject = f"FantasyIQ alert: {severity or 'warning'} / {event_type or 'platform'}"
    text = f"""FantasyIQ needs attention.

Severity: {severity}
Event: {event_type}
Source: {source}
Customer: {customer_slug or "platform"}
League: {league_key or "n/a"}

Message:
{message or "No message supplied."}

Admin:
{site_url()}/admin.html
"""
    html = f"""
    <div style="font-family:Arial,sans-serif;color:#151813;line-height:1.55;max-width:620px;">
      <p style="color:#8a4f24;font-weight:700;text-transform:uppercase;font-size:12px;">FantasyIQ alert</p>
      <h1 style="color:#0f3a30;">{escape(severity or "Warning")} / {escape(event_type or "platform")}</h1>
      <p><strong>Source:</strong> {escape(source or "platform")}</p>
      <p><strong>Customer:</strong> {escape(customer_slug or "platform")}</p>
      <p><strong>League:</strong> {escape(league_key or "n/a")}</p>
      <div style="background:#fbf6e8;border:1px solid #e3c875;border-radius:8px;padding:14px;margin:18px 0;">
        {escape(message or "No message supplied.")}
      </div>
      <p><a href="{escape(site_url())}/admin.html" style="color:#0f3a30;font-weight:700;">Open admin dashboard</a></p>
    </div>
    """
    return send_email(
        to=to,
        subject=subject,
        html=html,
        text=text,
        idempotency_key=f"fantasyiq-alert-{event_type}-{customer_slug}-{league_key}-{severity}",
    )


def customer_password_reset_email(
    *,
    customer_name: str,
    email: str,
    customer_slug: str,
    access_code: str,
    league_key: str = "",
) -> dict[str, str]:
    name = customer_name or "FantasyIQ customer"
    setup = setup_url(customer_slug)
    dashboard = dashboard_url(customer_slug, league_key)
    create_password = f"{setup}#create-password"
    feedback = feedback_url(customer_slug, league_key)
    support = support_email()
    subject = "Create or reset your FantasyIQ password"
    text = f"""Your FantasyIQ account now supports email and password login.

Use this link to create or reset your FantasyIQ password:
{create_password}

Access code:
{access_code}

Dashboard:
{dashboard}

After your first dashboard session, quick feedback helps us improve FantasyIQ:
{feedback}

If you did not request this, you can ignore this email.

Support:
{support}
"""
    html = f"""
    <div style="font-family:Arial,sans-serif;color:#151813;line-height:1.55;max-width:620px;">
      <p style="color:#8a4f24;font-weight:700;text-transform:uppercase;font-size:12px;">FantasyIQ account</p>
      <h1 style="color:#0f3a30;">Create or reset your FantasyIQ password</h1>
      <p>Hi {escape(name)}. Your FantasyIQ account now supports email and password login.</p>
      <p>Use the button below with your access code to create a new password.</p>
      <p><strong>Access code:</strong><br />{escape(access_code)}</p>
      <p><a href="{escape(create_password)}" style="display:inline-block;background:#0f3a30;color:#fff8e8;font-weight:700;padding:12px 16px;border-radius:8px;text-decoration:none;">Create / reset password</a></p>
      <p><a href="{escape(dashboard)}" style="color:#0f3a30;font-weight:700;">Open dashboard</a></p>
      <p><a href="{escape(feedback)}" style="color:#0f3a30;font-weight:700;">Share quick feedback after first use</a></p>
      <p>If you did not request this, you can ignore this email.</p>
      <p>Support: <a href="mailto:{escape(support)}">{escape(support)}</a></p>
    </div>
    """
    return {"to": email, "subject": subject, "text": text, "html": html}


ONBOARDING_STAGES: dict[str, dict[str, str]] = {
    "account": {
        "subject": "Your FantasyIQ account is ready",
        "title": "Your command center is ready",
        "body": "Open your dashboard, confirm your active league, and create your password if you have not already.",
        "cta": "Open dashboard",
    },
    "espn_ids": {
        "subject": "How to find your ESPN league and team IDs",
        "title": "Find your ESPN IDs in under a minute",
        "body": "Open ESPN in a browser, enter your league, then copy leagueId and teamId from the address bar. FantasyIQ uses those to auto-detect scoring and roster settings.",
        "cta": "Open setup",
    },
    "draft_room": {
        "subject": "How to use your FantasyIQ Draft Room",
        "title": "Use Draft Room as your draft-day command center",
        "body": "Start with the top recommendation, check safe/upside/avoid notes, and let roster needs plus tier cliffs decide close calls.",
        "cta": "Open dashboard",
    },
    "checklist": {
        "subject": "Your FantasyIQ draft-day checklist",
        "title": "Draft-day checklist",
        "body": "Confirm your league is public, open the dashboard before the draft, turn on live sync, and keep your active league selected at the top.",
        "cta": "Open dashboard",
    },
}


def customer_onboarding_email(customer: dict[str, Any], stage: str = "account", league_key: str = "") -> dict[str, str]:
    config = ONBOARDING_STAGES.get(stage) or ONBOARDING_STAGES["account"]
    customer_slug = str(customer.get("slug") or customer.get("customerSlug") or "")
    target_url = setup_url(customer_slug) if stage == "espn_ids" else dashboard_url(customer_slug, league_key)
    support = support_email()
    text = f"""{config["title"]}

{config["body"]}

{config["cta"]}:
{target_url}

Support:
{support}
"""
    html = f"""
    <div style="font-family:Arial,sans-serif;color:#151813;line-height:1.55;max-width:620px;">
      <p style="color:#8a4f24;font-weight:700;text-transform:uppercase;font-size:12px;">FantasyIQ onboarding</p>
      <h1 style="color:#0f3a30;">{escape(config["title"])}</h1>
      <p>{escape(config["body"])}</p>
      <p><a href="{escape(target_url)}" style="display:inline-block;background:#0f3a30;color:#fff8e8;font-weight:700;padding:12px 16px;border-radius:8px;text-decoration:none;">{escape(config["cta"])}</a></p>
      <p>Support: <a href="mailto:{escape(support)}">{escape(support)}</a></p>
    </div>
    """
    return {
        "to": str(customer.get("email") or "").strip(),
        "subject": config["subject"],
        "text": text,
        "html": html,
    }


def additional_league_email(customer: dict[str, Any]) -> dict[str, str]:
    customer_slug = str(customer.get("slug") or customer.get("customerSlug") or "")
    email = str(customer.get("email") or "").strip()
    setup = setup_url(customer_slug)
    dashboard = dashboard_url(customer_slug, str(customer.get("default_league_key") or ""))
    support = support_email()
    allowed = int(customer.get("included_league_limit") or customer.get("includedLeagueLimit") or 3) + int(
        customer.get("additional_league_count") or customer.get("additionalLeagueCount") or 0
    )
    subject = "Your extra FantasyIQ league slot is ready"
    text = f"""Your extra FantasyIQ league slot is ready.

You can now connect another public ESPN league from setup:
{setup}

Your account currently supports up to {allowed} saved league profile(s).

Dashboard:
{dashboard}

Support:
{support}
"""
    html = f"""
    <div style="font-family:Arial,sans-serif;color:#151813;line-height:1.55;max-width:620px;">
      <p style="color:#8a4f24;font-weight:700;text-transform:uppercase;font-size:12px;">FantasyIQ add-on</p>
      <h1 style="color:#0f3a30;">Your extra league slot is ready</h1>
      <p>You can now connect another public ESPN league from setup.</p>
      <p>Your account currently supports up to <strong>{escape(str(allowed))}</strong> saved league profile(s).</p>
      <p><a href="{escape(setup)}" style="display:inline-block;background:#0f3a30;color:#fff8e8;font-weight:700;padding:12px 16px;border-radius:8px;text-decoration:none;">Connect another league</a></p>
      <p><a href="{escape(dashboard)}" style="color:#0f3a30;font-weight:700;">Open dashboard</a></p>
      <p>Support: <a href="mailto:{escape(support)}">{escape(support)}</a></p>
    </div>
    """
    return {"to": email, "subject": subject, "text": text, "html": html}


def send_customer_password_reset_email(customer: dict[str, Any], league_key: str = "", idempotency_key: str = "") -> dict[str, Any]:
    email = str(customer.get("email") or "").strip()
    access_code = str(customer.get("access_code") or customer.get("accessCode") or "").strip()
    if not email:
        return {"sent": False, "reason": "customer_email_missing"}
    if not access_code:
        return {"sent": False, "reason": "customer_access_code_missing", "to": email}
    message = customer_password_reset_email(
        customer_name=str(customer.get("customer_name") or customer.get("customerName") or ""),
        email=email,
        customer_slug=str(customer.get("slug") or customer.get("customerSlug") or ""),
        access_code=access_code,
        league_key=league_key,
    )
    result = send_email(
        to=message["to"],
        subject=message["subject"],
        html=message["html"],
        text=message["text"],
        idempotency_key=idempotency_key,
    )
    record_email_event({**customer, "leagueKey": league_key}, result, event_type="email.password_reset")
    return result


def send_customer_onboarding_email(customer: dict[str, Any], stage: str = "account", league_key: str = "", idempotency_key: str = "") -> dict[str, Any]:
    message = customer_onboarding_email(customer, stage=stage, league_key=league_key)
    if not message["to"]:
        return {"sent": False, "reason": "customer_email_missing"}
    result = send_email(
        to=message["to"],
        subject=message["subject"],
        html=message["html"],
        text=message["text"],
        idempotency_key=idempotency_key,
    )
    record_email_event({**customer, "leagueKey": league_key}, result, event_type=f"email.onboarding.{stage}")
    return result


def send_additional_league_email(customer: dict[str, Any], idempotency_key: str = "") -> dict[str, Any]:
    message = additional_league_email(customer)
    if not message["to"]:
        return {"sent": False, "reason": "customer_email_missing"}
    result = send_email(
        to=message["to"],
        subject=message["subject"],
        html=message["html"],
        text=message["text"],
        idempotency_key=idempotency_key,
    )
    record_email_event(customer, result, event_type="email.additional_league")
    return result


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
