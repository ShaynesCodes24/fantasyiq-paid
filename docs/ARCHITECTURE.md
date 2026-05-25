# FantasyIQ Architecture

## Frontend

Static HTML/CSS/JS in `public/`.

The production app is served from the apex domain, `https://myfantasyiq.com/`.
The `/FantasyIQ/` path remains as a compatibility copy, but it is not the
primary product URL.

The dashboard JavaScript is split across `public/js` for the root app and
`public/FantasyIQ/js` for the compatibility copy. The root `FantasyIQ/`
directory mirrors the dashboard bundle for legacy static hosting fallbacks.

## Backend

Vercel serverless API routes in /api.

## Database

Neon Postgres using psycopg.

## Payments

Stripe webhook at /api/stripe-webhook.

## Email

Resend setup emails.

## Fantasy Data

ESPN public league API.

## Main User Flow

1. User pays through Stripe
2. Stripe webhook creates customer
3. Setup email is sent
4. User creates password or uses access code
5. User validates ESPN league
6. Dashboard loads ESPN data
7. FantasyIQ generates the Main Move, FantasyIQ Score, supporting reasons, risk warning, and alternative path
