# FantasyIQ QA Playbook

Use this before every meaningful deploy. The product can be simple, but the verification cannot be casual.

## Required Automated Checks

Run these locally before deploy:

```powershell
python -m compileall api scripts
node --check public\FantasyIQ\app.js
node --check FantasyIQ\app.js
node scripts\build_static.js
python scripts\check_security_setup.py
python scripts\check_os_readiness.py
```

Run this after production deploy:

```powershell
python scripts\check_product_readiness.py
python scripts\check_production_monitoring.py
python scripts\test_self_serve_flow.py
```

After `RESEND_API_KEY` is configured, also run:

```powershell
python scripts\check_email_delivery.py
```

## Manual Browser Checks

Dashboard:
- `/FantasyIQ/` loads without console-breaking errors.
- Public demo still shows subscribe messaging.
- Customer URL with `?customer=sample-owner` or a configured customer prompts for access when required.
- Sign in works with a valid access code.
- Sign out locks the customer dashboard again.
- Refresh keeps signed-in customer dashboards signed in.
- League switcher opens when multiple leagues exist.
- League Health shows account access, ESPN sync, team match, scoring, and draft state.
- Draft recommendations show compact proof lines for why the player is recommended.
- Add-league button opens the setup/add-on flow.

Setup:
- `/setup.html` loads on mobile and desktop.
- ESPN public league validation succeeds for known demo test data.
- Invalid league/team IDs show a useful error.
- Successful authenticated setup routes back into the saved dashboard and league.
- Customer setup save falls back gracefully when database is disconnected.
- Customer setup save writes to database when `DATABASE_URL` is connected.

Draft Room:
- League profile strip matches active league settings.
- Draft recommendations use current league scoring, team count, and superflex/flex settings.
- UDK+ expert alignment appears only when a private UDK signal file is configured.
- Cheatcode/intelligence is helpful but does not overpower the draft room.
- Live draft sync state is clear when draft has not started.
- Pre-draft states show readiness, draft order, team-slot guidance, useful empty pick queues, and an armed post-draft plan before pick 1.

Mock Simulator:
- Team count and draft rounds follow active league settings.
- Superflex toggles appear only when the league uses superflex.
- Mock grading appears inside the simulator flow.
- CPU managers draft competitively with varied value, scarcity, market, upside, floor, and roster-build profiles.
- Mock grade notes flag reaches, early risk, thin RB/WR depth, starter gaps, and early DST/K picks.

Player Cards:
- Daily Player Synopsis uses plain-English Bottom line, Why it matters, Risk, and Draft move sections.
- FantasyIQ Read uses Move, Fit, Risk, and Plain English sections.
- Player drawers do not show dense raw source-line paragraphs.

Trade Calculator:
- Current-season trade analysis remains.
- Prior-year trade analysis remains removed unless a reliable data source exists.
- Empty roster/trade states are clear.

Admin:
- `/admin.html` requires admin token by header.
- Admin endpoint does not expose access codes.
- Database status displays when database is connected.
- Ops event console filters setup, login, live sync, email, Stripe, and admin events by severity, type, customer, source, and search text.
- Ops event payload details are hidden behind expandable details, not shown by default.
- Production monitoring confirms admin auth boundaries and protected ops event access.

## Mobile Checks

Use a narrow viewport and verify:

- Top account/league controls do not overlap.
- Navigation remains readable.
- Buttons and form fields fit inside their containers.
- Draft Room and setup validator do not require horizontal scrolling.
- Access gate looks polished and the error message is visible.

## Payment Checks

Stripe:
- Season Pass link opens.
- Additional league add-on link opens.
- Webhook rejects unsigned requests.
- Webhook accepts signed Stripe events in test mode.
- Checkout metadata and custom fields are enough to create or identify a customer.

Database:
- `DATABASE_URL` is set only in Vercel/env, never committed.
- `python scripts\apply_database_schema.py` has been run after connecting the database.
- Stripe checkout creates/updates `fantasyiq_customers`.
- Setup validator creates/updates `fantasyiq_leagues`.
- Duplicate Stripe webhook events are idempotent.

UDK+:
- Raw UDK+ CSV exports are not committed.
- Generated UDK signal JSON is not committed.
- `python scripts\check_udk_import.py` passes.
- UDK View remains hidden when no private signal file is configured.
- When configured, UDK appears as expert alignment, not as a raw copied premium table.

## Release Gate

Do not ship if any of these are true:

- A paying customer cannot access their dashboard.
- Demo works but customer URLs break.
- Customer URLs work but the public sales/demo path breaks.
- Live draft or board APIs return non-JSON errors.
- Admin or customer access tokens are accepted through URLs.
- Mobile layout hides a primary action.
- Stripe webhook is unsigned or disabled in production.
- Database failures break env fallback behavior.

## Production Smoke Test

After deploy, confirm:

- Root sales page is live.
- Dashboard is live.
- Setup page is live.
- Customer status endpoint works.
- Live draft endpoint works.
- Live boards endpoint works.
- Stripe webhook endpoint rejects unsigned POSTs.
- No-charge self-serve dry run creates, saves, reads, and cleans up a temporary customer.
- Production monitoring script checks public pages, core APIs, webhook boundary, admin auth boundary, and ops events when an admin token is available.
- Readiness check has `0 failed`.
