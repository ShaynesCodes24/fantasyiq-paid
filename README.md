# FantasyIQ Paid Customer Deploy

White-label deploy package for a paid FantasyIQ league dashboard. The platform
now supports a self-serve-ready flow: Stripe checkout creates a durable customer
record, the customer validates public ESPN leagues, and the dashboard reads the
active league profile from Postgres with env/customer registry fallback.

Price model:

```text
$30/year FantasyIQ Season Pass
Includes up to 3 public ESPN fantasy football leagues on one account dashboard.
Additional leagues beyond 3: $5/year each.
```

Sales model:

```text
Self-serve-ready setup with a per-customer dashboard access code. Postgres can
store paid customer records, league profiles, and Stripe checkout events while
the env registry remains available as a fallback.
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
https://myfantasyiq.com/
```

Stripe accepted business website URL:

```text
https://myfantasyiq.com/FantasyIQ/
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

## Local Development

Use Vercel's local dev server whenever you need login, sessions, checkout
callbacks, live boards, or any `/api/...` route:

```powershell
npm run dev:vercel
```

Then open the local URL Vercel prints, usually:

```text
http://localhost:3000
```

Do not use Python's static server for auth/API testing. A static server can only
serve HTML, CSS, JavaScript, and images, so API calls such as
`/api/customer-login`, `/api/customer-session`, and `/api/live-boards` return
404 locally even though they work on Vercel.

For layout-only checks where API behavior is not needed, use:

```powershell
npm run preview:static
```

## Customer Promise

Use this positioning for the paid offer:

```text
FantasyIQ gives your ESPN fantasy football league a custom draft command
center with live public-league draft sync, ranked boards, mock draft practice,
trade discipline, and league branding.
```

Recommended checkout/onboarding flow:

1. Customer buys the $30/year Season Pass.
2. Stripe webhook creates or updates the customer record and access code.
3. FantasyIQ sends the dashboard/setup email when `RESEND_API_KEY` is configured.
4. Customer validates each public ESPN league at `/setup.html`.
5. Customer switches active leagues from the dashboard.
6. Owner uses `/admin.html` for customer detail, setup email resend, and access-code reset.

## Current Dashboard Experience

The dashboard now includes a customer-confidence layer and stronger draft
practice loop:

- League Health summarizes account access, ESPN sync, team match, scoring, and
  draft state at the top of the command center.
- Draft recommendations include compact `Based on` proof lines so customers can
  see the league settings and draft state behind a recommendation.
- Setup success routes saved customers directly back into the active dashboard
  and league.
- Mock Simulator opponents use distinct manager profiles for value, scarcity,
  market momentum, upside, floor, and roster construction.
- Mock grades are stricter and include roster-shape notes for reaches, early
  risk, thin RB/WR depth, starter gaps, and early DST/K picks.
- Player cards use plain-English Daily Player Synopsis and FantasyIQ Read
  sections instead of dense source-data paragraphs.
- Admin operations include an ops event console for setup, login, live sync,
  email, Stripe, and admin triage events.

## FantasyIQ OS

Use the operating system docs when planning, building, testing, supporting, or
selling the platform:

- `ops/FANTASYIQ_OS.md`: internal command center, cadence, plugin roles, and definition of done.
- `ops/ROADMAP.md`: now/next/later roadmap and backlog priority rules.
- `ops/QA_PLAYBOOK.md`: pre-deploy checks, manual browser QA, release gates, and production smoke tests.
- `ops/DESIGN_SYSTEM.md`: dashboard design principles, navigation rules, layout rules, and quality bar.
- `ops/SUPPORT_PLAYBOOK.md`: support triage, repeated customer issues, and escalation rules.
- `ops/REVENUE_OPERATIONS.md`: pricing, Stripe, database fulfillment, add-on leagues, renewals, and refunds.
- `ops/PLUGIN_WORKFLOWS.md`: how Codex should use GitHub, Vercel, Stripe, Browser/Chrome, Linear, Gmail, Drive/Notion, Figma, Canva, and OpenAI Developers.

Run this to confirm the operating docs and core scripts are in place:

```powershell
python .\scripts\check_os_readiness.py
```

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
- `scripts/check_os_readiness.py`: checks that the FantasyIQ OS docs and operating scripts are present.
- `scripts/check_email_delivery.py`: confirms Resend email readiness and can send an admin setup-email test.
- `scripts/apply_database_schema.py`: applies the Postgres schema after connecting Neon or another Postgres provider.
- `scripts/test_self_serve_flow.py`: runs a no-charge production dry run with a signed synthetic Stripe event, setup save, dashboard API checks, and cleanup.
- `scripts/sync_dashboard_mirror.js`: syncs the local `FantasyIQ` dashboard mirror from the deploy source in `public/FantasyIQ`.
- `scripts/secure_launch_setup.py`: orchestrates secure local checks plus optional Stripe, Vercel env, deploy, and readiness steps.
- `public/setup.html`: validates ESPN league ID, team ID, and season against ESPN before setup.
- `public/help.html`: customer-facing Q&A for setup, access, league switching, and ESPN public-league limits.
- `public/admin.html`: token-protected owner view that reads `/api/admin-customers`.
- `api/stripe_webhook.py`: verifies Stripe webhook signatures and prepares checkout fulfillment records.
- `CUSTOMER_INTAKE.md`: customer-facing setup form.
- `CUSTOMER_ONBOARDING.md`: internal fulfillment checklist.
- `CUSTOMER_EMAILS.md`: reusable customer messages.
- `SERVICE_SCOPE.md`: plain-language paid service scope and limits.
- `SECURITY_SETUP.md`: secure setup checklist for secrets, admin access, and customer records.
- `DATABASE_SETUP.md`: Neon/Postgres setup steps for durable self-serve customer records.
- `customers.example.csv`: lightweight customer tracker template.
- `.env.example`: required environment variables for each deployment.

Current payment link:

```text
https://buy.stripe.com/00wdR9dN7gBRacMb9fefC01
```

Additional league add-on link for customers with more than three leagues:

```text
https://buy.stripe.com/dRmcN5aAV1GX0Cc7X3efC02
```

## Public Demo

The live `myfantasyiq.com/FantasyIQ/` dashboard is a public demo
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
draftCardValue: "$30 / year",
draftCardNote: "Season Pass for up to 3 ESPN leagues",
supportEmail: "support@myfantasyiq.com",
leagueSettings: {
  teamCount: 12,
  scoringType: "ppr",
  lineupSlots: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, SUPERFLEX: 0, DST: 1, K: 1, BE: 7, IR: 1 },
  draftRounds: 16,
  playoffTeams: 6,
},
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
FANTASY_IQ_LEAGUE_SETTINGS={"teamCount":12,"scoringType":"ppr","lineupSlots":{"QB":1,"RB":2,"WR":2,"TE":1,"FLEX":1,"SUPERFLEX":0,"DST":1,"K":1,"BE":7,"IR":1},"draftRounds":16,"playoffTeams":6}
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

Multi-customer and multi-league API calls can include a customer slug and a
league key:

```text
/api/live-draft?customer=katelyn
/api/live-draft?customer=shayne&league=home
/api/trade-history?customer=katelyn
```

Customer dashboard URLs use the same slug and are treated as official customer
dashboards automatically, even when the slug is only defined in
`FANTASY_IQ_CUSTOMERS_JSON` and not prelisted in `public/FantasyIQ/config.js`:

```text
/FantasyIQ/?customer=katelyn
/FantasyIQ/?customer=new-customer-slug
/FantasyIQ/?customer=shayne&league=home
```

Any requested customer slug enables customer access handling, removes demo
checkout banners by default, and sends the slug to live board, live draft, trade
history, and customer status API calls.

Paid customer API calls require the customer's access code once `accessCode` is
set in the registry. The dashboard login stores that code in the browser and
sends it with live draft/trade requests.

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
    "status": "configured",
    "accessCode": "customer_code_here",
    "leagueSettings": {
      "teamCount": 12,
      "scoringType": "ppr",
      "lineupSlots": { "QB": 1, "RB": 2, "WR": 2, "TE": 1, "FLEX": 1, "SUPERFLEX": 0, "DST": 1, "K": 1, "BE": 7, "IR": 1 },
      "draftRounds": 16,
      "playoffTeams": 6
    }
  }
}
```

For one customer with multiple leagues, nest league profiles under `leagues`.
Each profile can carry its own ESPN league ID, team ID, team name, scoring,
team count, lineup slots, draft rounds, and playoff count. The dashboard shows
a top league switcher and all API calls include the active `league` key.

```json
{
  "shayne": {
    "customerName": "Shayne Holladay",
    "status": "configured",
    "accessCode": "customer_code_here",
    "defaultLeague": "home",
    "leagues": {
      "home": {
        "label": "Home League",
        "leagueId": 123456789,
        "teamId": 1,
        "teamName": "Gronk if you like TDs",
        "season": 2026,
        "leagueSettings": {
          "teamCount": 12,
          "scoringType": "ppr",
          "lineupSlots": { "QB": 1, "RB": 2, "WR": 2, "TE": 1, "FLEX": 1, "SUPERFLEX": 0, "DST": 1, "K": 1, "BE": 7, "IR": 1 },
          "draftRounds": 16,
          "playoffTeams": 6
        }
      },
      "work": {
        "label": "Work League",
        "leagueId": 234567890,
        "teamId": 4,
        "season": 2026,
        "leagueSettings": {
          "teamCount": 10,
          "scoringType": "half-ppr",
          "lineupSlots": { "QB": 1, "RB": 2, "WR": 2, "TE": 1, "FLEX": 2, "SUPERFLEX": 0, "DST": 1, "K": 1, "BE": 6, "IR": 1 },
          "draftRounds": 16,
          "playoffTeams": 4
        }
      }
    }
  }
}
```

ESPN does not currently provide a stable customer OAuth flow for FantasyIQ to
sign into a customer's ESPN account and automatically list every league. The v1
supported flow is account-level league linking by public ESPN league ID/team ID:
up to three league profiles are included in the Season Pass, and the dashboard
shows a `+` add-league button that points customers to the $5/year additional
league Stripe add-on.

Set `FANTASYIQ_ADMIN_TOKEN` before using `/admin.html` in production.
Set `STRIPE_WEBHOOK_SECRET` before pointing Stripe at `/api/stripe-webhook`.
Set `DATABASE_URL` through Neon/Postgres and run `python .\scripts\apply_database_schema.py`
before relying on fully durable self-serve checkout and setup records.

## Live Player Boards

The dashboard now loads player boards from:

```text
/api/live-boards
```

That endpoint rebuilds the big board, league-native projected points, tiers,
value/risk scores, trends, mock simulator board, and trade values from ESPN's
public fantasy player feed plus Sleeper's public add/drop trend API. Sleeper
signals are cached in the serverless function and used to surface both risers
and fallers, rookie momentum, and draft-room market warnings without manual
player updates. The bundled `FantasyIQ/data/boards.json` file remains only as a
fallback if ESPN or the serverless endpoint is temporarily unavailable.

## League Settings Engine

FantasyIQ now keeps a league profile for every dashboard. The profile controls
team count, scoring format, lineup slots, bench/IR, draft rounds, playoff
teams, and raw stat scoring items. Draft Room recommendations, Mock Simulator
team count/rounds, Big Board projection labels, and Trade Calculator values
read from that profile instead of assuming a 12-team full-PPR league.

Supported setup examples:

```json
{"teamCount":10,"scoringType":"half-ppr","lineupSlots":{"QB":1,"RB":2,"WR":2,"TE":1,"FLEX":2,"SUPERFLEX":0,"DST":1,"K":1,"BE":6,"IR":1},"draftRounds":16,"playoffTeams":6}
{"teamCount":12,"scoringType":"ppr","lineupSlots":{"QB":1,"RB":2,"WR":2,"TE":1,"FLEX":1,"SUPERFLEX":1,"DST":1,"K":0,"BE":7,"IR":2},"draftRounds":16,"playoffTeams":6}
```

The live board now scores ESPN raw projected stats against the active league's
scoring items. Half-PPR, standard, superflex, and custom reception formats get
native projected points instead of frontend PPR conversions. Draft Room Pick Now
recommendations also consider live Sleeper add/drop pressure so the top card is
not just the next available rank.

Live readiness check:

```powershell
python .\scripts\check_product_readiness.py
```

## Important Product Notes

This folder is ready for one deployment serving multiple customer dashboards,
with each customer able to carry one or more league profiles.

For v1, setup can be manual or database-backed. Each renewal is another year of
access/support for that customer dashboard and its included league profiles.
The repo now has setup validation, admin scaffolding, customer-scoped browser
settings, multi-customer and multi-league API routing, a verified Stripe
webhook endpoint, and optional Postgres customer records.

For a true SaaS subscription product later, add these next:

- Login/accounts
- Stripe subscription checkout
- Transactional setup/access-code email
- Full account login/password reset
- Private ESPN auth support
