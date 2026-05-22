# FantasyIQ Launch Checklist

## Before Selling

- Done: Create a $30/year Season Pass payment link.
- Done: Use `support@myfantasyiq.com` as the customer support email.
- Done: Use the live Stripe Season Pass payment link: `https://buy.stripe.com/00wdR9dN7gBRacMb9fefC01`.
- Done: Create the additional league add-on link: `https://buy.stripe.com/dRmcN5aAV1GX0Cc7X3efC02`.
- Done: Configure the Stripe Season Pass link fields and branded after-payment success page.
- Done: Route dashboard add-on league purchases through authenticated customer checkout.
- Done: Route new Season Pass buyers through the ESPN compatibility check before exposing checkout.
- Done: State that MyFantasyIQ is software only and does not handle dues, prize pools, payouts, or winnings.
- Done: Use `fantasyiq-paid` as the Vercel project name.
- Done: Set Vercel Build Command to `node scripts/build_static.js`.
- Done: Set Vercel Output Directory to `dist`.
- Done: Store paid customer records and league profiles in Neon/Postgres when `DATABASE_URL` is connected.
- Confirm the database customer registry includes every paid customer's league profiles.
- Done: Configure Katelyn as the first real customer using her public ESPN league.
- Next: Test the public demo dashboard after redeploying the public sales config.
- Use `https://myfantasyiq.com/FantasyIQ/` as Stripe's business website.
- Done: Run `python .\scripts\check_product_readiness.py` before sharing the offer publicly.
- Done: Run `python .\scripts\check_security_setup.py` before sharing the offer publicly.
- Run `python .\scripts\check_os_readiness.py` before major product releases.
- Done: Run `python .\scripts\secure_launch_setup.py` for the automated launch setup status.

## For Each Customer

- Confirm payment.
- Run `python .\scripts\fulfill_latest_stripe_order.py` after setting `STRIPE_SECRET_KEY` locally.
- Collect intake details.
- Confirm ESPN league is public.
- Confirm the ESPN compatibility check passes before sending a checkout link.
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
- Test password creation consumes the setup access code and password login still works.
- Test canceled/suspended subscription status blocks dashboard API access.
- Test User A cannot load User B's dashboard by changing the `customer` or `league` URL parameters.
- Test the draft-day readiness checklist and cached board fallback message.
- Send the delivery email.
- Add renewal date to the customer tracker.

## Launch Blockers

These should be resolved before advertising widely:

- Done: Confirm the live Stripe payment link opens correctly.
- Done: Configure the Stripe Season Pass link fields and branded after-payment success page.
- Done: Verify at least one test customer deploy on Vercel with `FANTASY_IQ_LEAGUE_ID`.
- Done: Public demo says "Demo Mode" and "No customer account is loaded."
- Done: Setup, success, admin, and API routes are marked noindex/noarchive through page metadata or response headers.
- Done: Archived/hidden the old $25 Stripe product from new buyers while preserving legacy access.
- Blocker: Create a Stripe customer portal link before scaling annual renewals beyond hands-on support.
- Blocker: Add stronger admin MFA or identity-provider protection before delegating admin access.
