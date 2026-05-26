# FantasyIQ Revenue Operations

This is the operating guide for pricing, checkout, add-on leagues, renewals, refunds, and payment-driven fulfillment.

## Current Offer

FantasyIQ Season Pass:

```text
$30/year
Includes up to 3 public ESPN fantasy football leagues on one account dashboard.
Additional leagues beyond 3: $5/year each.
```

## Revenue Principles

- Sell the account dashboard, not a single isolated league.
- Keep the base offer easy to understand.
- Keep add-on leagues cheap enough to feel fair.
- Do not charge for confusion caused by setup friction.
- Use Stripe as the payment source of truth.
- Use the database as the fulfillment source of truth once connected.

## Checkout Flow

Ideal self-serve flow:

1. Customer buys the Season Pass.
2. Stripe webhook creates `fantasyiq_customers`.
3. Customer receives dashboard link, access code, and setup link.
4. Customer validates one to three public ESPN leagues.
5. Setup validator saves `fantasyiq_leagues`.
6. Dashboard loads customer and league profiles from database.
7. Add-on checkout unlocks extra league profiles beyond 3.

Current safe fallback:

1. Stripe confirms payment.
2. Owner validates or collects setup details.
3. Customer records can still be served from env while database rollout finishes.

## Stripe Operations

Season Pass link:

```text
https://buy.stripe.com/00wdR9dN7gBRacMb9fefC01
```

Additional league add-on:

```text
https://buy.stripe.com/dRmcN5aAV1GX0Cc7X3efC02
```

Webhook endpoint:

```text
/api/stripe-webhook
```

Required production env:

```text
STRIPE_WEBHOOK_SECRET
```

Recommended metadata/custom fields:

```text
customer_slug
primary ESPN league ID
primary ESPN team ID
ESPN season
number of leagues
```

## Database Fulfillment

Required production env:

```text
DATABASE_URL
DATABASE_URL_UNPOOLED
```

Required setup:

```powershell
python scripts\apply_database_schema.py
```

Records:

- Customer account: `fantasyiq_customers`
- League profile: `fantasyiq_leagues`
- Payment event: `fantasyiq_payment_events`
- Add-on entitlement: `fantasyiq_customers.additional_league_count`

## Add-On League Rules

- First 3 leagues are included.
- The fourth and later leagues require the add-on payment.
- The add-on should not confuse the customer with a second account.
- The active dashboard remains the same; only another league profile gets added.
- Admin should be able to see configured league count and add-on count.
- Successful add-on checkout sends an extra-league-ready email when Resend is configured.
- Paid add-ons that do not match a customer by Stripe customer id or email are warning-level ops events.

## Renewal Rules

- Annual renewal preserves the dashboard, access code, and league profiles.
- Customers can update league details before the new fantasy season.
- Renewal reminders should go out before expiration.
- If a payment fails, dashboard status should move to needs review before access is removed.

## Refund Rules

- Follow `refund-policy.html`.
- Be generous when the product cannot support the customer's league because of ESPN public access limits.
- Track refund reasons as product feedback.

## Revenue QA

Before advertising widely:

- Season Pass link opens.
- Add-on league link opens.
- Webhook rejects unsigned POSTs.
- Signed Stripe test events persist when database is connected.
- Admin page shows database customer count.
- Setup page can save a league for an authenticated customer.
- Customer dashboard reads database records first and env fallback second.
