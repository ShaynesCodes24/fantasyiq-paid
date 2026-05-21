# FantasyIQ Operating System

This is the internal command center for building, launching, supporting, and improving FantasyIQ.

The goal is simple: every change should make the platform easier to use, easier to trust, and easier to operate.

## North Star

FantasyIQ should feel like a draft-day cheat code without feeling complicated. A customer should be able to open the dashboard, know what league is active, understand what to do next, and trust that every recommendation is using their league settings.

## Operating Rules

- Make customer dashboards official across the board, not one-off demo hacks.
- Keep the dashboard clean, fast, and obvious.
- Prefer reusable customer/account/league systems over customer-specific patches.
- Verify production after every meaningful change.
- Keep secrets out of docs, screenshots, chat, and git.
- Treat ESPN public-league access as a product constraint until private ESPN auth exists.
- Do not ship a UI change unless it works on mobile and desktop.

## Weekly Cadence

Monday:
- Review open bugs and customer friction.
- Pick the smallest set of upgrades that improves trust or ease of use.
- Move roadmap items into the active build list.

Build days:
- Implement one focused improvement at a time.
- Run local syntax checks before deploy.
- Verify with browser or production checks.
- Commit and push with a clear message.

Release day:
- Run security, product readiness, and OS readiness checks.
- Verify Vercel production.
- Run production monitoring and review ops events.
- Update customer-facing docs or emails if behavior changed.
- Log follow-up issues in Linear or the roadmap.

Customer support day:
- Review setup questions, refunds, and failed access attempts.
- Update Q&A and onboarding docs when a repeated question appears.
- Convert confusion into product fixes where possible.

## Plugin Roles

GitHub:
- Source control, commits, branches, PRs, issue references, review history.

Vercel:
- Production deployments, build logs, project settings, domain checks, env verification, protected preview access.

Stripe:
- Payment links, add-on leagues, customers, checkout sessions, refunds, disputes, webhook verification.

Browser or Chrome:
- Real visual QA, customer login flow, mobile layout checks, setup form checks, dashboard switching.

Linear:
- Roadmap execution, bug queue, customer friction tracking, release planning.

Google Drive or Notion:
- Official operating docs, customer FAQs, setup docs, launch notes, knowledge base.

Gmail:
- Intake emails, setup replies, support triage, renewal messages, refund communications.

Figma:
- Design system, layout reviews, future dashboard redesigns, component specs.

Canva:
- Marketing visuals, product preview images, social posts, launch graphics.

OpenAI Developers:
- Future AI features, support assistant, setup assistant, draft-room intelligence, data extraction workflows.

## Source Of Truth

- Roadmap: `ops/ROADMAP.md`
- QA and release gates: `ops/QA_PLAYBOOK.md`
- Production monitoring: `ops/PRODUCTION_MONITORING.md`
- Design system: `ops/DESIGN_SYSTEM.md`
- Customer support: `ops/SUPPORT_PLAYBOOK.md`
- Revenue and self-serve: `ops/REVENUE_OPERATIONS.md`
- UDK+ signal import: `ops/UDK_PLUS_INTEGRATION.md`
- Plugin usage: `ops/PLUGIN_WORKFLOWS.md`
- Database setup: `DATABASE_SETUP.md`
- Security: `SECURITY_SETUP.md`

## Definition Of Done

A change is done only when:

- The feature works for demo and customer dashboards unless intentionally scoped.
- The behavior is customer/league-aware when it touches dashboard data.
- Syntax/build checks pass.
- Security checks pass when secrets, auth, admin, payments, or customer records are touched.
- Production readiness passes after deploy.
- The README or relevant ops doc is updated if the workflow changed.
- Any known gap is written down instead of living in memory.

## Standard Commands

```powershell
python -m compileall api scripts
node --check public\FantasyIQ\app.js
node --check FantasyIQ\app.js
node scripts\build_static.js
python scripts\check_security_setup.py
python scripts\check_product_readiness.py
python scripts\check_production_monitoring.py
python scripts\check_os_readiness.py
python scripts\check_udk_import.py
```

## Upgrade Principles

- If a feature saves customer confusion, prioritize it.
- If a feature reduces manual owner work, systematize it.
- If a UI element does not help someone draft, trade, set up, or trust the product, simplify it.
- If a customer asks the same question twice, turn it into either UI clarity or Q&A.
- If a data source is unreliable, show the limitation clearly and keep the rest of the platform useful.
