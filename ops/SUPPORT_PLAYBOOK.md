# FantasyIQ Support Playbook

Support should convert confusion into product clarity. If customers ask the same thing more than once, either the UI or Q&A should improve.

## Support Promise

FantasyIQ support helps customers connect public ESPN leagues, access their dashboard, understand league-specific settings, and prepare before draft day.

## First Response Checklist

Ask for:

- Dashboard link.
- Customer email used at checkout.
- Active league name.
- ESPN league ID and team ID if setup is involved.
- Screenshot if something looks wrong.
- Whether the ESPN league is public.

## Common Issues

Access code does not work:
- Confirm customer slug/dashboard link.
- Confirm the customer is using the latest access code.
- Check customer status in `/api/customer-status?customer=<slug>`.
- Reset access code in the customer record when admin tooling supports it.
- Remind customer that access code is not their ESPN password.

Dashboard refresh opens demo:
- Confirm the customer URL includes `?customer=<slug>`.
- Confirm local session exists after sign in.
- Confirm the config/env/database has the customer slug.
- Check that redirects are not stripping query params.

League dropdown empty:
- Confirm the customer has more than one saved league profile.
- Check `/api/customer-status?customer=<slug>`.
- Confirm database/env league profile includes `leagues`.
- Verify the active league key exists.

Live draft sync unavailable:
- Confirm league is public.
- Confirm league ID, team ID, and season.
- Confirm draft has started or draft detail exists.
- Check ESPN API response via `/api/live-draft`.
- Explain ESPN public access limitation if private.

Scoring looks wrong:
- Confirm active league.
- Confirm scoring type and roster slots.
- Check whether ESPN scoring items are available.
- Confirm raw-stat board is using the active league scoring profile.

Additional league payment:
- Confirm whether customer has reached 3 included leagues.
- Confirm Stripe add-on checkout.
- Save/setup the extra league after payment.

Refund request:
- Follow `refund-policy.html`.
- Check Stripe payment.
- Keep tone direct and respectful.
- Log why they asked for a refund so the product can improve.

## Q&A Topics To Keep Updated

- How to find ESPN league ID.
- How to find ESPN team ID.
- Why ESPN league must be public.
- What the dashboard access code is.
- How multiple leagues work.
- How scoring settings affect recommendations.
- What happens before draft day.
- What to do if live sync is unavailable.
- How add-on leagues work.
- What the refund policy covers.

## Response Tone

- Clear, calm, and specific.
- Do not over-explain technical internals.
- Give the next action.
- Use exact links when available.
- Never ask for ESPN passwords.
- Never request secrets in email.

## When To Escalate To Product Work

Create or update a roadmap item when:

- Two customers ask the same question.
- A support answer requires more than three steps.
- The customer has to understand implementation details.
- A UI label caused confusion.
- A manual owner step could be automated.

## Useful Files

- `CUSTOMER_EMAILS.md`
- `CUSTOMER_ONBOARDING.md`
- `CUSTOMER_INTAKE.md`
- `SERVICE_SCOPE.md`
- `DATABASE_SETUP.md`
- `ops/QA_PLAYBOOK.md`
