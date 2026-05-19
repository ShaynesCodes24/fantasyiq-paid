# Payment Setup

Use a simple payment link for v1. Do not build self-serve provisioning yet.

Current payment link:

```text
https://buy.stripe.com/eVq3cvdN71GX84E917efC00
```

## Recommended Payment Link

```text
Product name: FantasyIQ League Dashboard
Price: $25/year
Quantity: 1
Description: One manually configured dashboard for one public ESPN fantasy football league.
```

## Stripe Dashboard Steps

1. Open Stripe Dashboard.
2. Go to Payments > Payment Links.
3. Create a new payment link.
4. Add a new product:

```text
Name: FantasyIQ League Dashboard
Description: One manually configured dashboard for one public ESPN fantasy football league.
Price: $25.00 USD
Billing period: Yearly / recurring
Quantity: 1
```

5. Add custom fields if available:

```text
ESPN league ID
ESPN season
League name
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
Product: FantasyIQ League Dashboard
Price: $25/year recurring
Required checkout fields: ESPN league ID, ESPN season, League name
Support email metadata: shayneholladay@gmail.com
```

## Configure The Current Link

The live payment link is already:

```text
https://buy.stripe.com/eVq3cvdN71GX84E917efC00
```

To update that existing link with required checkout fields and a hosted
after-payment message, run:

```powershell
$env:STRIPE_SECRET_KEY="sk_live_your_key_here"
$env:STRIPE_PAYMENT_LINK_URL="https://buy.stripe.com/eVq3cvdN71GX84E917efC00"
python .\scripts\configure_stripe_payment_link.py
Remove-Item Env:\STRIPE_SECRET_KEY
Remove-Item Env:\STRIPE_PAYMENT_LINK_URL
```

Or create a temporary local file that is ignored by git:

```powershell
@"
STRIPE_SECRET_KEY=sk_live_your_key_here
STRIPE_PAYMENT_LINK_URL=https://buy.stripe.com/eVq3cvdN71GX84E917efC00
"@ | Set-Content .env.local
python .\scripts\configure_stripe_payment_link.py
Remove-Item .env.local
```

The script finds the matching Payment Link URL, then configures:

```text
Required fields: ESPN league ID, ESPN season, League name
After-payment message: email setup details to shayneholladay@gmail.com
Metadata: product, support email, website URL, dashboard URL
```

If Stripe cannot find the link by URL, open the link in Stripe Dashboard, copy
its `plink_...` id, set `STRIPE_PAYMENT_LINK_ID`, and run the same script.

## Checkout Fields

Collect these in checkout if your payment provider supports custom fields:

```text
Name
Email
ESPN league ID
ESPN season
League name
Draft date/time
```

If custom fields are limited, collect only name/email at checkout and send
`CUSTOMER_INTAKE.md` immediately after payment.

## After Payment

1. Add the customer to `customers.example.csv` or your real tracker.
2. Send the intake email from `CUSTOMER_EMAILS.md`.
3. Complete the setup checklist in `CUSTOMER_ONBOARDING.md`.
4. Send the delivery email.
5. Set a renewal reminder before the annual renewal date.

## Notes

The $25/year price is for one ESPN league dashboard. Extra leagues should be
separate subscriptions unless you intentionally discount them.
