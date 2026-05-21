# FantasyIQ Roadmap

This roadmap keeps the platform focused on becoming easier to buy, easier to set up, easier to navigate, and harder to misuse.

## Current Product Position

FantasyIQ is a paid season-pass dashboard for ESPN fantasy football managers. It supports public ESPN league sync, customer access codes, multi-league profiles, league-aware draft values, mock practice, trade discipline, and a database-ready self-serve path.

## Success Metrics

- A new customer can buy and understand next steps in under 2 minutes.
- A customer can validate and connect a public ESPN league without owner help.
- A customer can refresh the dashboard and remain signed in.
- A customer with multiple leagues can switch leagues without losing context.
- Production readiness remains green after every release.
- Repeated support questions decrease over time because the platform explains itself at the right moment.

## Now

These are the highest-leverage upgrades for the next build cycle.

- Connect Neon/Postgres and run `database/schema.sql`.
- Verify Stripe webhook creates durable customer records in production.
- Add transactional access-code/setup emails after checkout.
- Add database-backed additional league fulfillment after Stripe add-on checkout.
- Add admin controls for customer status, access-code reset, and league archive.

## Next

These make the platform feel more premium after self-serve is stable.

- Add visual polish pass for dashboard spacing, forms, account card, and mobile drawer.
- Add customer renewal workflow and renewal status display.

## Recently Shipped

- Setup success routes saved customers directly into the correct dashboard and active league.
- Customer-visible Q&A/help page is linked from dashboard and setup.
- League Health checks account access, ESPN sync, team match, scoring, and draft state.
- Draft recommendations include compact proof lines for league settings, roster context, and draft state.
- Login success/failure events are recorded through the ops event system when the database is connected.
- Admin ops visibility shows setup, login, live sync, email, Stripe, and admin events with filters and payload details.
- Mock Simulator opponents use competitive manager profiles and stricter grading.
- Player cards use plain-English Daily Player Synopsis and FantasyIQ Read sections.
- Production monitoring runbook and script cover public pages, core APIs, webhook boundaries, admin auth boundaries, and ops event review.
- Pre-draft live room states show readiness, draft order, team-slot guidance, smarter empty queues, and an armed post-draft plan before pick 1.
- Private UDK+ CSV import adds expert alignment, board disagreement, and mock-manager signal support without committing premium data.

## Later

These are bigger bets once the core business loop is proven.

- Full account login with passwordless email or OAuth.
- Private ESPN league support if a stable auth path becomes available.
- AI setup assistant that reads customer league details and explains missing fields.
- Draft-room AI Q&A trained on live league state, board data, and customer settings.
- League comparison view for customers with 2 or more leagues.
- Commissioner/team import tooling if ESPN data allows it.
- More sports or platforms only after fantasy football is clean and profitable.

## Backlog Triage Rules

Priority 0:
- Payment broken, customer access broken, production deploy broken, or private data exposure.

Priority 1:
- Setup, league switching, live draft sync, or board scoring broken for paying customers.

Priority 2:
- Confusing UI, repeated customer questions, weak mobile experience, slow flow, missing admin visibility.

Priority 3:
- Nice-to-have polish, marketing assets, future AI features, experiments.

## Release Themes

Self-Serve Foundation:
- Database records, Stripe webhook fulfillment, setup saving, admin visibility.

Customer Confidence:
- Better Q&A, clearer setup, better empty states, less demo/customer confusion.

Draft-Day Excellence:
- Faster boards, clearer Draft Room hierarchy, better live sync states, stronger league-specific intelligence.

Premium Polish:
- Cleaner layout, consistent controls, crisp mobile behavior, product preview assets.
