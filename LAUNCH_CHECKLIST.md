# Fantasy IQ Launch Checklist

## Before Selling

- Create a $25/year payment link.
- Use `shayneholladay@gmail.com` as the customer support email.
- Use the live Stripe payment link: `https://buy.stripe.com/eVq3cvdN71GX84E917efC00`.
- Use `fantasy-iq-paid` as the Vercel project name.
- Set Vercel Build Command to `node scripts/build_static.js`.
- Set Vercel Output Directory to `dist`.
- Decide where customer records will live.
- Confirm your Vercel account can deploy one project per customer.
- Test one dashboard using your own public ESPN league.
- Use `https://fantasy-iq-paid.vercel.app/FantasyIQ/` as Stripe's business website if Stripe accepts it.

## For Each Customer

- Confirm payment.
- Collect intake details.
- Confirm ESPN league is public.
- Configure `public/FantasyIQ/config.js`.
- Upload or set the customer logo.
- Set `FANTASY_IQ_LEAGUE_ID` and `FANTASY_IQ_SEASON` in Vercel.
- Deploy the customer dashboard.
- Test `/FantasyIQ/`.
- Test `/`, `/terms.html`, `/privacy.html`, and `/refund-policy.html`.
- Test `/api/live-draft`.
- Send the delivery email.
- Add renewal date to the customer tracker.

## Launch Blockers

These should be resolved before advertising widely:

- Confirm the live Stripe payment link opens correctly.
- No test customer deploy has been verified on Vercel.
