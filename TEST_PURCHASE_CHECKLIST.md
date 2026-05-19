# Test Purchase Checklist

Use this for one real checkout test before sharing FantasyIQ publicly.

## Tester Steps

1. Open `https://fantasyiq-paid.vercel.app/`.
2. Click `Start setup` or `Subscribe`.
3. Complete Stripe checkout with a real email.
4. Fill in ESPN league ID, ESPN team ID, and ESPN season.
5. Confirm the hosted confirmation message appears.
6. Forward the Stripe receipt or screenshot the confirmation page.
7. Open the demo dashboard and confirm the board status says it synced a live ESPN board.

## Owner Steps

1. Confirm the payment appears in Stripe.
2. Confirm the custom checkout fields are present on the payment details.
3. Confirm the customer email appears correctly.
4. Send the intake email from `CUSTOMER_EMAILS.md`.
5. Refund the test payment in Stripe if this was only a test.
6. Run `python .\scripts\check_product_readiness.py` again.
