# FantasyIQ Architecture

## Frontend

Static HTML/CSS/JS in public/FantasyIQ.

The dashboard JavaScript is split across public/FantasyIQ/js and loaded in order by public/FantasyIQ/index.html. The root FantasyIQ directory is a mirror for the dashboard bundle.

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
7. FantasyIQ generates dashboard recommendations
