# Payment Setup

Use Stripe Payment Links for v1 checkout while FantasyIQ handles customer
records, setup, and add-on league fulfillment through the webhook. Public site
CTAs should route through the ESPN compatibility check before exposing checkout.

Current payment link:

```text
https://buy.stripe.com/00wdR9dN7gBRacMb9fefC01
```

## Recommended Payment Link

```text
Product name: FantasyIQ Season Pass
Price: $30/year
Quantity: 1
Description: One manually configured dashboard account for up to three public ESPN fantasy football leagues.
Additional league add-on: $5/year for each league beyond the included three.
```

## Current Stripe Products

Verified in Stripe on 2026-05-22:

```text
Current Season Pass product: prod_UYMONg4fWFT0DJ
Current Season Pass price: price_1TZFfKI9VpZIldH0dEAVPQOR / $30/year
Additional League product: prod_UYMOnidLvyVwdO
Additional League price: price_1TZFfVI9VpZIldH0HsLFXTH9 / $5/year
Legacy product: prod_UXiy5YAhU8q1zW
Legacy price: price_1TYdWHI9VpZIldH0HdnXeQYj / $25/year
```

The legacy $25 product has been archived/hidden from new buyer paths in Stripe.
Keep any legacy subscriber access working as grandfathered access, and continue
to grant new buyers only through the current $30/year Season Pass.

## Webhook Fulfillment Guardrails

The webhook grants access only after the checkout session is eligible for
fulfillment. Configure these environment variables in production:

```text
FANTASYIQ_STRIPE_LIVEMODE=live
FANTASYIQ_STRIPE_ALLOWED_PAYMENT_LINK_IDS=plink_1TZFfOI9VpZIldH0YlrgjKGu,plink_1TZFfYI9VpZIldH0oE2jRNSd
FANTASYIQ_STRIPE_ALLOWED_PRICE_IDS=price_1TZFfKI9VpZIldH0dEAVPQOR,price_1TZFfVI9VpZIldH0HsLFXTH9
FANTASYIQ_STRIPE_ALLOWED_PRODUCT_IDS=prod_UYMONg4fWFT0DJ,prod_UYMOnidLvyVwdO
```

Verified live Payment Link IDs on 2026-05-24:

```text
Season Pass: plink_1TZFfOI9VpZIldH0YlrgjKGu
Additional League: plink_1TZFfYI9VpZIldH0oE2jRNSd
```

If `FANTASYIQ_STRIPE_ALLOWED_PAYMENT_LINK_IDS` is blank, the webhook still
requires paid USD checkout, a positive amount, and a Stripe customer or buyer
email. Price/product checks use the current product IDs above when Stripe
includes line item or metadata IDs in the session payload.

Do not rely on `client_reference_id`, checkout custom fields, or URL metadata to
choose an existing customer account. New Season Pass accounts derive their
dashboard slug from the Stripe buyer email/name. Additional league purchases are
credited by Stripe customer ID or buyer email.

## Stripe Dashboard Steps

1. Open Stripe Dashboard.
2. Go to Payments > Payment Links.
3. Create a new payment link.
4. Add a new product:

```text
Name: FantasyIQ Season Pass
Description: One manually configured dashboard account for up to three public ESPN fantasy football leagues.
Price: $30.00 USD
Billing period: Yearly / recurring
Quantity: 1
```

5. Add custom fields if available:

```text
Primary ESPN league ID
Primary ESPN team ID
ESPN season
Draft date/time
```

6. Create the link.
7. Replace the payment link in these product docs if Stripe creates a new URL later.

## Optional Local Script

If you want to create the Stripe Payment Link from this repo instead of clicking
through the dashboard, set your Stripe secret key locally and run:

```powershell
$env:STRIPE_SECRET_KEY="sk_live_your_key_here"
python .\scripts\create_stripe_payment_link.py
Remove-Item Env:\STRIPE_SECRET_KEY
```

Do not paste your Stripe secret key into chat, put it in documentation, or commit
it to the repo. The script creates:

```text
Product: FantasyIQ Season Pass
Price: $30/year recurring
Required checkout fields: primary ESPN league ID, primary ESPN team ID, ESPN season
Support email metadata: support@myfantasyiq.com
```

## Configure The Current Link

The live payment link is already:

```text
https://buy.stripe.com/00wdR9dN7gBRacMb9fefC01
```

To update that existing link with required checkout fields and the branded
after-payment redirect, run:

```powershell
$env:STRIPE_SECRET_KEY="sk_live_your_key_here"
$env:STRIPE_PAYMENT_LINK_URL="https://buy.stripe.com/00wdR9dN7gBRacMb9fefC01"
python .\scripts\configure_stripe_payment_link.py
Remove-Item Env:\STRIPE_SECRET_KEY
Remove-Item Env:\STRIPE_PAYMENT_LINK_URL
```

Or create a temporary local file that is ignored by git:

```powershell
@"
STRIPE_SECRET_KEY=sk_live_your_key_here
STRIPE_PAYMENT_LINK_URL=https://buy.stripe.com/00wdR9dN7gBRacMb9fefC01
"@ | Set-Content .env.local
python .\scripts\configure_stripe_payment_link.py
Remove-Item .env.local
```

The script finds the matching Payment Link URL, then configures:

```text
Required fields: primary ESPN league ID, primary ESPN team ID, ESPN season
After-payment redirect: https://myfantasyiq.com/success.html?checkout=season-pass
Metadata: product, support email, website URL, dashboard URL, setup URL, success URL
```

If Stripe cannot find the link by URL, open the link in Stripe Dashboard, copy
its `plink_...` id, set `STRIPE_PAYMENT_LINK_ID`, and run the same script.

## Checkout Fields

Collect these in checkout if your payment provider supports custom fields:

```text
Name
Email
Primary ESPN league ID
Primary ESPN team ID
ESPN season
Draft date/time
Number of leagues being configured
```

If custom fields are limited, collect only name/email at checkout and send
`CUSTOMER_INTAKE.md` immediately after payment.

## Finding ESPN IDs

Send this instruction if a customer is unsure:

```text
Open your ESPN fantasy league in a web browser.
The league ID is the number after leagueId= in the URL.
Open your team page or roster page.
The team ID is the number after teamId= in the URL.
If you cannot find teamId=, send the full ESPN league URL and your team name.
```

## After Payment

1. Stripe redirects the customer to `https://myfantasyiq.com/success.html?checkout=season-pass`.
2. The webhook creates or updates the customer record when `DATABASE_URL` is connected.
3. The webhook sends the setup/access-code email when `RESEND_API_KEY` is configured; otherwise the admin page can resend it after email is configured.
4. Complete the setup checklist in `CUSTOMER_ONBOARDING.md` if manual attention is needed.
5. Set a renewal reminder before the annual renewal date.

## Customer Portal

Signed-in customers can open Stripe's hosted billing portal from the Account tab.
The frontend calls:

```text
POST /api/customer-portal
```

The Python serverless endpoint reads the logged-in session cookie, looks up the
customer's saved `stripe_customer_id`, creates a Stripe Billing Portal Session,
and returns the short-lived hosted URL. The browser then redirects directly to
Stripe.

Required environment variables:

```text
STRIPE_SECRET_KEY=sk_live_...
FANTASYIQ_SITE_URL=https://myfantasyiq.com
FANTASYIQ_STRIPE_PORTAL_RETURN_URL=https://myfantasyiq.com/?login=1
```

In Stripe Dashboard, configure the Customer Portal rules for cancellations,
payment method updates, invoices, and subscription management before sharing the
button broadly.

## Notes

The $30/year Season Pass includes up to three public ESPN leagues on one
dashboard account. Extra leagues beyond the included three use the additional
league add-on link:

```text
https://buy.stripe.com/dRmcN5aAV1GX0Cc7X3efC02
```

The dashboard routes add-on purchases through `/api/add-league-checkout`. When
the included slots are full, that endpoint appends `client_reference_id` to the
Stripe Payment Link so `/api/stripe-webhook` can credit the correct customer
after `checkout.session.completed`. A successful add-on credit sends the
customer an extra-league-ready email and records an ops event; unmatched add-on
payments are recorded as warnings for owner follow-up.
