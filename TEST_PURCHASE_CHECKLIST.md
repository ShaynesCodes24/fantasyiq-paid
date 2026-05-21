# First Customer Checkout Checklist

Use this as the record for the first real customer purchase, which also
validated the checkout and fulfillment flow.

## Completed First Customer

```text
Customer: Katelyn Holladay
League: No Guts, No Glory
Team: KatAttack
League ID: 584856941
Team ID: 5
Season: 2026
Checkout session: cs_live_a1dFa5qV8Kbccz0TZx9j1Mxf9RcHkutClazb3BSs1TffjYLUhlFCBoKu6q
Paid at: 2026-05-19
Renewal date: 2027-05-19
Dashboard verified: https://myfantasyiq.com/FantasyIQ/?customer=katelyn
```

## Tester Steps

1. Done: Open `https://myfantasyiq.com/`.
2. Done: Click `Start setup` or `Subscribe`.
3. Done: Complete Stripe checkout with a real email.
4. Done: Fill in ESPN league ID, ESPN team ID, and ESPN season.
   - League ID is the number after `leagueId=` in the ESPN browser URL.
   - Team ID is the number after `teamId=` on the ESPN team/roster page URL.
5. Done: Confirm the hosted confirmation message is configured.
6. Owner action: Keep the Stripe receipt or confirmation screenshot for records.
7. Done: Open the dashboard and confirm the board status says it synced a live ESPN board.

## Owner Steps

1. Done: Confirm the payment appears in Stripe.
2. Done: Confirm the custom checkout fields are configured on the payment link.
3. Owner action: Confirm the customer email appears correctly.
4. Done: Customer tracker includes Katelyn as the first real customer.
5. Do not refund unless Katelyn asks to cancel.
6. Done: Run `python .\scripts\check_product_readiness.py` again.
