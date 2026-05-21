# Payment Setup

Use a simple payment link for v1. Do not build self-serve provisioning yet.

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
After-payment redirect: https://myfantasyiq.com/success.html
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

1. Stripe redirects the customer to `https://myfantasyiq.com/success.html`.
2. The webhook creates or updates the customer record when `DATABASE_URL` is connected.
3. Send or verify the setup email from `CUSTOMER_EMAILS.md`.
4. Complete the setup checklist in `CUSTOMER_ONBOARDING.md` if manual attention is needed.
5. Set a renewal reminder before the annual renewal date.

## Notes

The $30/year Season Pass includes up to three public ESPN leagues on one
dashboard account. Extra leagues beyond the included three use the additional
league add-on link:

```text
https://buy.stripe.com/dRmcN5aAV1GX0Cc7X3efC02
```
