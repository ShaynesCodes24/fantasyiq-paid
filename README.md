# FantasyIQ Paid Customer Deploy

White-label deploy package for a paid FantasyIQ league dashboard. The first
release is a concierge setup product: customers pay, send their ESPN league
details, and you configure/deploy their dashboard manually.

Price model:

```text
$25 per league / year
```

Sales model:

```text
Concierge setup. No customer login or self-serve provisioning required for v1.
```

Website URL shape:

```text
https://<customer-project>.vercel.app/
```

Recommended Vercel project name:

```text
fantasyiq-paid
```

If Vercel accepts that name, the live website URL will be:

```text
https://fantasyiq-paid.vercel.app/
```

Stripe accepted business website URL:

```text
https://fantasyiq-paid.vercel.app/FantasyIQ/
```

Paid dashboard URL shape:

```text
https://<customer-project>.vercel.app/FantasyIQ/
```

The repo also keeps a root-level static copy of the site files so Vercel can
serve the website even if it ignores the `public` or `dist` output settings.

Vercel build settings:

```text
Framework Preset: Other
Root Directory: ./
Build Command: node scripts/build_static.js
Install Command: empty
Output Directory: dist
```

## Customer Promise

Use this positioning for the paid offer:

```text
FantasyIQ gives your ESPN fantasy football league a custom draft command
center with live public-league draft sync, ranked boards, mock draft practice,
trade discipline, and league branding.
```

Recommended checkout/onboarding flow:

1. Customer pays $25/year.
2. Checkout collects ESPN league ID, ESPN team ID, and season.
3. Customer or owner validates the IDs at `/setup.html`.
4. You confirm the ESPN league is public.
5. You configure the Vercel env/customer registry for that customer.
6. You email the customer their dashboard link and renewal date.

## Launch Files

- `SALES_COPY.md`: public offer copy for posts, checkout, and DMs.
- `PAYMENT_SETUP.md`: simple payment link setup checklist.
- `LAUNCH_CHECKLIST.md`: pre-sale and per-customer launch checklist.
- `TEST_PURCHASE_CHECKLIST.md`: first customer purchase and checkout validation record.
- `scripts/create_stripe_payment_link.py`: optional local Stripe Payment Link creator.
- `scripts/configure_stripe_payment_link.py`: updates the current Stripe link with intake fields.
- `scripts/configure_stripe_webhook.py`: creates or updates the Stripe webhook endpoint.
- `scripts/configure_vercel_env.py`: sets customer ESPN league env vars through the Vercel API.
- `scripts/fulfill_latest_stripe_order.py`: fetches the latest paid Stripe checkout and updates `customers.csv`.
- `scripts/check_product_readiness.py`: checks the live website, dashboard, Stripe link, and API.
- `scripts/check_security_setup.py`: checks tracked files, deploy ignores, and public Vercel config for secure setup.
- `scripts/secure_launch_setup.py`: orchestrates secure local checks plus optional Stripe, Vercel env, deploy, and readiness steps.
- `public/setup.html`: validates ESPN league ID, team ID, and season against ESPN before setup.
- `public/admin.html`: token-protected owner view that reads `/api/admin-customers`.
- `api/stripe_webhook.py`: verifies Stripe webhook signatures and prepares checkout fulfillment records.
- `CUSTOMER_INTAKE.md`: customer-facing setup form.
- `CUSTOMER_ONBOARDING.md`: internal fulfillment checklist.
- `CUSTOMER_EMAILS.md`: reusable customer messages.
- `SERVICE_SCOPE.md`: plain-language paid service scope and limits.
- `SECURITY_SETUP.md`: secure setup checklist for secrets, admin access, and customer records.
- `customers.example.csv`: lightweight customer tracker template.
- `.env.example`: required environment variables for each deployment.

Current payment link:

```text
https://buy.stripe.com/eVq3cvdN71GX84E917efC00
```

## Public Demo

The live `fantasyiq-paid.vercel.app/FantasyIQ/` dashboard is a public demo
preview. When `FANTASY_IQ_LEAGUE_ID` is not set, `/api/live-draft` connects to
a known public ESPN demo league so the product does not look broken during a
first checkout test.

Optional demo override:

```text
FANTASY_IQ_DEMO_LEAGUE_ID=584856941
```

For a paid customer deployment, set:

```js
isDemoPreview: false,
```

in `public/FantasyIQ/config.js`, then set the customer `FANTASY_IQ_LEAGUE_ID`
and redeploy.

## Configure A Customer

Edit:

```text
public/FantasyIQ/config.js
```

Common fields:

```js
siteName: "FantasyIQ",
leagueName: "Customer League Name",
leagueSubtitle: "ESPN PPR Redraft",
logoUrl: "./assets/league-logo.jpeg",
draftCardValue: "$25 / year",
supportEmail: "shayneholladay@gmail.com",
```

For a custom logo, replace:

```text
public/FantasyIQ/assets/fantasy-iq-logo.svg
```

or point `logoUrl` at a hosted image URL.

## ESPN League Sync

Set Vercel environment variables per customer:

```text
FANTASY_IQ_LEAGUE_ID=their_espn_league_id
FANTASY_IQ_SEASON=2026
```

With a Vercel token, you can set them from this repo:

```powershell
$env:VERCEL_TOKEN="your_vercel_token_here"
$env:FANTASY_IQ_LEAGUE_ID="their_espn_league_id"
$env:FANTASY_IQ_SEASON="2026"
python .\scripts\configure_vercel_env.py
Remove-Item Env:\VERCEL_TOKEN
Remove-Item Env:\FANTASY_IQ_LEAGUE_ID
Remove-Item Env:\FANTASY_IQ_SEASON
```

Redeploy the Vercel project after changing environment variables.

The setup scripts also read a temporary `.env.local` file if you prefer not to
set shell environment variables. `.env.local` is ignored by git and should be
deleted after the setup command finishes.

The customer league must be public unless future private ESPN authentication is added.

Live endpoint:

```text
/api/live-draft
```

Multi-customer API calls can include a customer slug:

```text
/api/live-draft?customer=katelyn
/api/trade-history?customer=katelyn
```

For one deployment serving multiple customers, set `FANTASY_IQ_CUSTOMERS_JSON`
to an object keyed by customer slug:

```json
{
  "katelyn": {
    "customerName": "Katelyn Holladay",
    "teamId": 5,
    "teamName": "KatAttack",
    "leagueId": 584856941,
    "season": 2026,
    "status": "configured"
  }
}
```

Set `FANTASYIQ_ADMIN_TOKEN` before using `/admin.html` in production.
Set `STRIPE_WEBHOOK_SECRET` before pointing Stripe at `/api/stripe-webhook`.
The webhook verifies Stripe signatures and can log locally, but durable
automatic fulfillment still needs a real database or storage service.

## Live Player Boards

The dashboard now loads player boards from:

```text
/api/live-boards
```

That endpoint rebuilds the big board, projected PPR points, tiers, value/risk
scores, trends, mock simulator board, and trade values from ESPN's public
fantasy player feed. The bundled `FantasyIQ/data/boards.json` file remains only
as a fallback if ESPN or the serverless endpoint is temporarily unavailable.

Live readiness check:

```powershell
python .\scripts\check_product_readiness.py
```

## Important Product Notes

This folder is ready for one-customer-per-deployment white-label sales.

For v1, keep setup manual and track subscriptions in Stripe, a spreadsheet, or
your customer records. Each renewal is simply another year of access/support for
that league dashboard. The repo now has setup validation, admin scaffolding,
customer-scoped browser settings, multi-customer API routing, and a verified
Stripe webhook endpoint ready for a future database.

For a true SaaS subscription product later, add these next:

- Login/accounts
- Stripe subscription checkout
- Customer database
- Per-user league configuration
- Admin customer management
- Private ESPN auth support
