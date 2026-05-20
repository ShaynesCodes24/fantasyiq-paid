# FantasyIQ Launch Checklist

## Before Selling

- Done: Create a $30/year Season Pass payment link.
- Done: Use `shayneholladay@gmail.com` as the customer support email.
- Done: Use the live Stripe Season Pass payment link: `https://buy.stripe.com/00wdR9dN7gBRacMb9fefC01`.
- Done: Create the additional league add-on link: `https://buy.stripe.com/dRmcN5aAV1GX0Cc7X3efC02`.
- Next: Configure the new Stripe Season Pass link fields and after-payment message.
- Done: Use `fantasyiq-paid` as the Vercel project name.
- Done: Set Vercel Build Command to `node scripts/build_static.js`.
- Done: Set Vercel Output Directory to `dist`.
- For v1: Keep customer records in `customers.csv`; move to persistent storage before relying on automatic webhook fulfillment.
- Confirm the Vercel customer registry includes every paid customer's league profiles.
- Done: Configure Katelyn as the first real customer using her public ESPN league.
- Next: Test the public demo dashboard after redeploying the public sales config.
- Use `https://fantasyiq-paid.vercel.app/FantasyIQ/` as Stripe's business website.
- Done: Run `python .\scripts\check_product_readiness.py` before sharing the offer publicly.
- Done: Run `python .\scripts\check_security_setup.py` before sharing the offer publicly.
- Done: Run `python .\scripts\secure_launch_setup.py` for the automated launch setup status.

## For Each Customer

- Confirm payment.
- Run `python .\scripts\fulfill_latest_stripe_order.py` after setting `STRIPE_SECRET_KEY` locally.
- Collect intake details.
- Confirm ESPN league is public.
- Confirm the customer's ESPN team ID.
- Configure `public/FantasyIQ/config.js`.
- Set `isDemoPreview: false` in `public/FantasyIQ/config.js`.
- Upload or set the customer logo.
- Set `FANTASY_IQ_CUSTOMERS_JSON` in Vercel for multi-customer or multi-league dashboards.
- For a single-league fallback, set `FANTASY_IQ_LEAGUE_ID` and `FANTASY_IQ_SEASON` in Vercel.
- Or set them with `python .\scripts\configure_vercel_env.py` after setting `VERCEL_TOKEN` locally.
- Deploy the customer dashboard.
- Test `/FantasyIQ/`.
- Test `/`, `/terms.html`, `/privacy.html`, and `/refund-policy.html`.
- Test `/api/live-draft`.
- Test `/api/live-boards`.
- Send the delivery email.
- Add renewal date to the customer tracker.

## Launch Blockers

These should be resolved before advertising widely:

- Done: Confirm the live Stripe payment link opens correctly.
- Next: Configure the new Stripe Season Pass link fields and after-payment message.
- Done: Verify at least one test customer deploy on Vercel with `FANTASY_IQ_LEAGUE_ID`.
