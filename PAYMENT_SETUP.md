# Payment Setup

Use a simple payment link for v1. Do not build self-serve provisioning yet.

Current placeholder:

```text
PAYMENT_LINK_PLACEHOLDER
```

## Recommended Payment Link

```text
Product name: Fantasy IQ League Dashboard
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
Name: Fantasy IQ League Dashboard
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
7. Replace every `PAYMENT_LINK_PLACEHOLDER` in these product docs with the real Stripe URL.

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
Product: Fantasy IQ League Dashboard
Price: $25/year recurring
Required checkout fields: ESPN league ID, ESPN season, League name
Support email metadata: shayneholladay@gmail.com
```

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
