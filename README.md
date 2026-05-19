# Fantasy IQ Paid Customer Deploy

White-label deploy package for a paid Fantasy IQ league dashboard. The first
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
fantasy-iq-paid
```

If Vercel accepts that name, the live website URL will be:

```text
https://fantasy-iq-paid.vercel.app/
```

Stripe accepted business website URL:

```text
https://fantasy-iq-paid.vercel.app/FantasyIQ/
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
Fantasy IQ gives your ESPN fantasy football league a custom draft command
center with live public-league draft sync, ranked boards, mock draft practice,
trade discipline, and league branding.
```

Recommended checkout/onboarding flow:

1. Customer pays $25/year.
2. Customer submits the intake form in `CUSTOMER_INTAKE.md`.
3. You confirm the ESPN league is public.
4. You configure and deploy one Vercel project for that customer.
5. You email the customer their dashboard link and renewal date.

## Launch Files

- `SALES_COPY.md`: public offer copy for posts, checkout, and DMs.
- `PAYMENT_SETUP.md`: simple payment link setup checklist.
- `LAUNCH_CHECKLIST.md`: pre-sale and per-customer launch checklist.
- `scripts/create_stripe_payment_link.py`: optional local Stripe Payment Link creator.
- `CUSTOMER_INTAKE.md`: customer-facing setup form.
- `CUSTOMER_ONBOARDING.md`: internal fulfillment checklist.
- `CUSTOMER_EMAILS.md`: reusable customer messages.
- `SERVICE_SCOPE.md`: plain-language paid service scope and limits.
- `customers.example.csv`: lightweight customer tracker template.
- `.env.example`: required environment variables for each deployment.

Current payment link placeholder:

```text
PAYMENT_LINK_PLACEHOLDER
```

## Configure A Customer

Edit:

```text
public/FantasyIQ/config.js
```

Common fields:

```js
siteName: "fantasyiq",
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

The customer league must be public unless future private ESPN authentication is added.

Live endpoint:

```text
/api/live-draft
```

## Important Product Notes

This folder is ready for one-customer-per-deployment white-label sales.

For v1, keep setup manual and track subscriptions in Stripe, a spreadsheet, or
your customer records. Each renewal is simply another year of access/support for
that league dashboard.

For a true SaaS subscription product later, add these next:

- Login/accounts
- Stripe subscription checkout
- Customer database
- Per-user league configuration
- Admin customer management
- Private ESPN auth support
