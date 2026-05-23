# FantasyIQ Database Setup

FantasyIQ is now database-ready for self-serve customer accounts, league profiles, setup saves, and Stripe checkout records. The live site still falls back to `FANTASY_IQ_CUSTOMERS_JSON` until a Postgres database is connected.

## Recommended Database

Use Neon Postgres through the Vercel Marketplace so Vercel injects the database environment variables into the project automatically.

```powershell
npx vercel install neon --name fantasyiq-db --plan free -e production -e preview
npx vercel env pull .env.local --yes
pip install -r requirements.txt
python .\scripts\apply_database_schema.py
```

The app checks these env vars in order:

```text
DATABASE_URL
POSTGRES_URL
POSTGRES_PRISMA_URL
```

## Current Production Database

FantasyIQ production is connected to Neon through `DATABASE_URL`.

```text
Neon project: fantasyiq-db
Project ID: weathered-dew-82493690
Branch: main
Branch ID: br-flat-surf-aksa72p5
Database: neondb
Vercel project: fantasyiq-paid
```

Do not commit or paste the connection string. It is stored as an encrypted Vercel environment variable for Production and Development.

Production currently has these tables:

```text
fantasyiq_customers
fantasyiq_leagues
fantasyiq_payment_events
fantasyiq_sessions
fantasyiq_ops_events
fantasyiq_rate_limits
```

## What The Database Stores

- `fantasyiq_customers`: customer slug, name, email, dashboard access code, Stripe customer id, subscription status, included league limit.
- `fantasyiq_leagues`: one or more ESPN league profiles per customer, including league ID, team ID, season, scoring, roster slots, and draft settings.
- `fantasyiq_payment_events`: idempotent Stripe webhook records so paid checkouts do not disappear after a serverless function ends.
- `fantasyiq_sessions`: hashed customer session tokens with expiration and revocation timestamps.
- `fantasyiq_ops_events`: launch funnel, setup, login, email, and error telemetry for support/debugging.
- `fantasyiq_rate_limits`: rolling request counters for login, setup, admin, live draft, and tracking endpoints.

## Self-Serve Flow

1. Stripe checkout completes and `/api/stripe-webhook` creates or updates a customer record when `DATABASE_URL` is connected.
2. The customer opens their dashboard with `?customer=<slug>` and signs in with their access code.
3. The `+` add-league button sends them to `/setup.html?customer=<slug>`.
4. `/setup.html` validates the public ESPN league/team and saves the league profile to Postgres.
5. The dashboard reads the database first, then falls back to the old env registry if no database record exists.

## Safe Rollout

This can be deployed before Neon is connected. Without `DATABASE_URL`, the database status shows disabled, setup validation still works, Stripe webhook behavior stays compatible, and existing customers keep loading from env/config.

Run this after connecting Neon:

```powershell
python .\scripts\check_security_setup.py
python .\scripts\check_product_readiness.py
```
