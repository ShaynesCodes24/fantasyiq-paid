# FantasyIQ Production Monitoring

Use this after every production deploy and during launch-week operations. The goal is to catch customer-impacting problems before a paying manager has to explain them.

## Monitoring Cadence

After every meaningful deploy:
- Run automated production checks.
- Open the admin ops event console and review new warnings or errors.
- Check Vercel deployment logs if any production endpoint fails.
- Check Stripe webhook delivery when checkout, setup, or access changed.
- Log unresolved follow-up work in `ops/ROADMAP.md` or Linear.

Daily during launch week:
- Run the production monitoring script.
- Review admin ops events from the last 24 hours.
- Confirm checkout, setup, login, and live draft events are not showing repeated failures.
- Check support inbox messages for repeated customer confusion.

Draft-day window:
- Run monitoring before the first customer draft.
- Keep `/admin.html` open with severity and source filters.
- Treat live draft sync failures as Priority 1 unless payment or access is also broken.

## Required Checks

Run the full production gate:

```powershell
python scripts\check_product_readiness.py
python scripts\check_production_monitoring.py
```

Run the no-charge self-serve dry run after any checkout, webhook, setup, database, or email change:

```powershell
python scripts\test_self_serve_flow.py
```

If email delivery changed or customer setup emails are in question:

```powershell
python scripts\check_email_delivery.py
```

## Signals To Watch

Public product:
- Root sales page returns 200.
- Dashboard returns 200.
- Setup, help, and success pages return 200.
- Live draft and live boards return JSON.

Payment and fulfillment:
- Stripe webhook endpoint is installed and rejects unsigned requests.
- Signed self-serve dry run creates, reads, saves, and deletes the test customer.
- Stripe Dashboard shows webhook deliveries with 2xx responses.
- Duplicate webhook events remain idempotent.

Admin and ops:
- `/api/admin-customers` rejects requests without `FANTASYIQ_ADMIN_TOKEN`.
- Admin ops events load with a valid token.
- Warnings and errors are rare, explainable, and tied to a customer or source when possible.
- Payload details do not expose secrets or access codes.

Customer experience:
- Login failures are not repeating for the same customer.
- Setup validation failures have clear causes.
- Live sync failures identify ESPN access, draft state, or league data limits.
- Email warnings identify provider configuration or delivery outcome.

## Severity Rules

Priority 0:
- Payment is broken.
- Customer access is broken for paying customers.
- Production deploy is broken.
- Private customer data or secrets are exposed.

Priority 1:
- Setup, league switching, live draft sync, or board scoring is broken for paying customers.
- Stripe checkout completes but customer records or setup flow do not persist.
- Admin cannot inspect customer or ops state during an active incident.

Priority 2:
- Repeated customer confusion.
- Repeated warning events with a known workaround.
- Mobile layout hides a primary action.
- Email delivery is degraded but dashboard access still works.

Priority 3:
- Low-risk polish, copy cleanup, or future observability improvements.

## Incident Workflow

1. Confirm scope with `python scripts\check_production_monitoring.py`.
2. Run `python scripts\check_product_readiness.py` if the issue touches public pages or core APIs.
3. Open `/admin.html`, enter the admin token, and filter ops events by `error`, then by the relevant source.
4. Inspect Vercel deployment logs for the failing route.
5. Inspect Stripe webhook delivery only when checkout, payment, or fulfillment is involved.
6. Record the customer slug, event type, time, route, and next action. Never paste secrets or access codes into docs or chat.
7. Fix the smallest customer-impacting cause, deploy when needed, then rerun the checks.

## Common Triage Paths

Checkout or webhook failure:
- Check `STRIPE_WEBHOOK_SECRET` in Vercel.
- Confirm Stripe is sending events to `https://myfantasyiq.com/api/stripe-webhook`.
- Run the signed self-serve dry run.
- Check ops events for `stripe` source warnings or errors.

Login or access failure:
- Confirm customer status through `/api/customer-status`.
- Check admin customer detail by slug.
- Review login ops events for wrong-code repeats or missing customer records.
- Reset access code only through admin tooling.

Setup failure:
- Re-run the setup validator with the customer league ID, team ID, and season.
- Confirm the ESPN league is public.
- Check database status in admin.
- Do not ask customers for ESPN passwords.

Live draft or board failure:
- Check `/api/live-draft` and `/api/live-boards`.
- Confirm active league settings and draft state.
- Review live sync ops events.
- If ESPN public data is unavailable, keep static board guidance useful and clearly label the limitation.

Email failure:
- Run `python scripts\check_email_delivery.py`.
- Confirm `RESEND_API_KEY` and sender domain configuration.
- Use admin setup-email resend only after the provider is healthy.

Database degraded:
- Confirm `DATABASE_URL` is configured in Vercel.
- Confirm `database/schema.sql` has been applied.
- Use env/customer registry fallback for dashboard access while checkout/setup persistence is repaired.

## Owner Notes

- Admin tokens, Stripe keys, webhook secrets, database URLs, access codes, and customer private data never belong in screenshots, docs, commit messages, or chat.
- Production monitoring is part of the release gate, not a future luxury.
- Repeated incidents should become product fixes, clearer UI, or automated checks.
