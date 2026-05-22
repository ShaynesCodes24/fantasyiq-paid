# FantasyIQ Secure Setup

Use this checklist before sharing the public sales link or deploying a customer
dashboard.

## Local Secrets

- Keep Stripe, Vercel, and admin tokens in local shell environment variables or
  `.env.local`.
- Never paste live secrets into docs, chat, screenshots, or committed files.
- Delete `.env.local` after one-time setup commands if the values are no longer
  needed.

## Production Environment

Set these in Vercel project settings, not in `vercel.json`:

```text
FANTASYIQ_ADMIN_TOKEN
STRIPE_WEBHOOK_SECRET
FANTASY_IQ_CUSTOMERS_JSON
```

For durable self-serve records and transactional setup email, also set:

```text
DATABASE_URL
RESEND_API_KEY
FANTASYIQ_EMAIL_FROM
FANTASYIQ_SITE_URL
FANTASYIQ_SUPPORT_EMAIL
```

`RESEND_API_KEY` is optional during dry runs. If it is missing, Stripe checkout
still creates the customer record and the admin page can resend setup email
after the key is configured.

Run the database schema after connecting Neon/Postgres. The schema now includes
customer records, sessions, ops events, and the `fantasyiq_rate_limits` table
used to throttle login, password, setup, admin, event tracking, and live draft
requests.

For a single customer deployment, also set:

```text
FANTASY_IQ_LEAGUE_ID
FANTASY_IQ_SEASON
FANTASY_IQ_CUSTOMER_TEAM_ID
FANTASY_IQ_CUSTOMER_NAME
FANTASY_IQ_CUSTOMER_TEAM_NAME
FANTASY_IQ_CUSTOMER_ACCESS_CODE
```

## Admin Access

- Use `public/admin.html` with the admin token field.
- Do not put admin tokens in URLs.
- Rotate `FANTASYIQ_ADMIN_TOKEN` if it is ever pasted into a browser URL, chat,
  email, or screenshot.
- Use a long random value for `FANTASYIQ_ADMIN_TOKEN`; the API accepts it by
  header only and compares it without timing leaks.

## Launch Abuse Protection

- Customer login and password setup endpoints are rate limited by IP plus
  customer identity.
- Password reset requests return the same public message whether or not the
  account exists.
- ESPN setup validation and live draft sync are throttled so one stuck browser
  or repeated refresh loop does not overload the API.
- Client-side tracking is sanitized and throttled before it writes ops events.

## Customer Records

- Keep real customer records in `customers.csv` locally for v1.
- `customers.csv` is ignored by git and excluded from Vercel deploys.
- Use `customers.example.csv` for shareable structure.
- Move customer records to persistent storage before depending on automatic
  webhook fulfillment.

## Stripe

- Configure the Payment Link with required ESPN setup fields.
- Configure a Stripe webhook endpoint for `checkout.session.completed` and
  subscription lifecycle events.
- Set `STRIPE_WEBHOOK_SECRET` in Vercel before enabling webhook processing.

## Pre-Share Check

```powershell
.\.venv\Scripts\Activate.ps1
python .\scripts\check_product_readiness.py
```

Run the security checks before every launch push:

```powershell
python .\scripts\check_security_setup.py
```

After deploying database/webhook changes, run the no-charge self-serve dry run:

```powershell
python .\scripts\test_self_serve_flow.py
```

After `RESEND_API_KEY` is set in Vercel, confirm transactional email readiness:

```powershell
python .\scripts\check_email_delivery.py
```

## Automated Launch Setup

Run the safe local setup first. This compiles Python, runs security checks,
checks public launch copy, and reports which account-level steps are missing.

```powershell
.\.venv\Scripts\Activate.ps1
python .\scripts\secure_launch_setup.py
```

To configure Stripe after setting your local Stripe secret:

```powershell
$env:STRIPE_SECRET_KEY="sk_live_your_key_here"
python .\scripts\secure_launch_setup.py --apply-stripe
Remove-Item Env:\STRIPE_SECRET_KEY
```

This configures the Payment Link and creates or updates the Stripe webhook
endpoint. If the webhook is newly created, the script prints the webhook secret;
set that value in Vercel as `STRIPE_WEBHOOK_SECRET`.

To configure Vercel env vars after setting a local token:

```powershell
$env:VERCEL_TOKEN="your_vercel_token_here"
$env:VERCEL_PROJECT_NAME="fantasyiq-paid"
$env:FANTASYIQ_ADMIN_TOKEN="long_random_admin_token_here"
$env:STRIPE_WEBHOOK_SECRET="whsec_your_webhook_secret_here"
$env:FANTASY_IQ_CUSTOMERS_JSON='{"katelyn":{"customerName":"Katelyn Holladay","teamId":5,"teamName":"KatAttack","leagueId":584856941,"season":2026,"status":"configured","accessCode":"customer_code_here"}}'
python .\scripts\secure_launch_setup.py --apply-vercel-env
Remove-Item Env:\VERCEL_TOKEN
Remove-Item Env:\FANTASYIQ_ADMIN_TOKEN
Remove-Item Env:\STRIPE_WEBHOOK_SECRET
Remove-Item Env:\FANTASY_IQ_CUSTOMERS_JSON
```

To deploy and verify after Vercel CLI is installed:

```powershell
vercel --version
python .\scripts\secure_launch_setup.py --deploy --readiness
```

If all local secrets and tools are ready, one command can run the whole flow:

```powershell
python .\scripts\secure_launch_setup.py --all
```
