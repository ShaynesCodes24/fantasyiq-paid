# FantasyIQ Launch Checklist

## Before Selling

- Create a $25/year payment link.
- Use `shayneholladay@gmail.com` as the customer support email.
- Use the live Stripe payment link: `https://buy.stripe.com/eVq3cvdN71GX84E917efC00`.
- Run `python .\scripts\configure_stripe_payment_link.py` after setting `STRIPE_SECRET_KEY` locally.
- Use `fantasyiq-paid` as the Vercel project name.
- Set Vercel Build Command to `node scripts/build_static.js`.
- Set Vercel Output Directory to `dist`.
- Decide where customer records will live.
- Confirm your Vercel account can deploy one project per customer.
- Test the public demo dashboard and one customer dashboard using a real public ESPN league.
- Use `https://fantasyiq-paid.vercel.app/FantasyIQ/` as Stripe's business website.
- Run `python .\scripts\check_product_readiness.py` before sharing the offer publicly.

## For Each Customer

- Confirm payment.
- Run `python .\scripts\fulfill_latest_stripe_order.py` after setting `STRIPE_SECRET_KEY` locally.
- Collect intake details.
- Confirm ESPN league is public.
- Configure `public/FantasyIQ/config.js`.
- Set `isDemoPreview: false` in `public/FantasyIQ/config.js`.
- Upload or set the customer logo.
- Set `FANTASY_IQ_LEAGUE_ID` and `FANTASY_IQ_SEASON` in Vercel.
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

- Confirm the live Stripe payment link opens correctly.
- Configure the Stripe payment link fields and after-payment message.
- Verify at least one test customer deploy on Vercel with `FANTASY_IQ_LEAGUE_ID`.
