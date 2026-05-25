# FantasyIQ Internal Agent Automation

FantasyIQ agents are internal development helpers. They inspect the platform,
run safe checks, identify bugs and inefficiency, and report findings for owner
approval. They do not act as customer-facing fantasy advice agents unless a
separate product plan approves that surface.

## Agent Team

Lead Agent:
- Owns the work cycle, assigns focused reviews, merges findings, and reports to
  the owner.
- Decides whether a finding is a bug, inefficiency, product risk, or follow-up.
- May run local validation commands and create local documentation or code
  changes.

Security and Guardrails Agent:
- Reviews auth, admin access, Stripe, webhooks, env handling, customer records,
  rate limits, and public data exposure.
- Blocks work that risks secrets, paid customer data, payment state, or
  production access.

QA and Reliability Agent:
- Runs repeatable checks, visual smoke tests, API import checks, and readiness
  scripts.
- Looks for broken routes, stale mirrored files, missing fixtures, and brittle
  workflows.

Platform Efficiency Agent:
- Finds duplicate source paths, manual sync steps, slow checks, and confusing
  deployment paths.
- Recommends low-risk automation before broad refactors.

Product Intelligence Agent:
- Keeps changes aligned with the north-star question: what should I do next to
  improve my fantasy team?
- Reviews recommendation quality, data confidence, Main Move clarity, and
  fantasy scoring assumptions.

Owner Reporting Agent:
- Produces a concise report after each work block with tests run, pass/fail
  status, bugs, inefficiencies, guardrail issues, and next actions.

## Safe Automation Loop

Run the local lead-agent audit:

```powershell
npm run agent:audit
```

The runner writes a timestamped report under `artifacts/agent-reports/`.

Default checks:
- `npm run typecheck`
- `npm run test:api`
- `python .\scripts\check_security_setup.py`
- `python .\scripts\check_os_readiness.py`
- `npm run build`

Optional browser smoke test:

```powershell
$env:FANTASYIQ_AGENT_AUDIT_VISUAL="1"
$env:VISUAL_SMOKE_BASE_URL="http://127.0.0.1:4173"
$env:VISUAL_SMOKE_IGNORE_STATIC_API_404="1"
npm run agent:audit
```

Optional production readiness check:

```powershell
$env:FANTASYIQ_AGENT_AUDIT_PRODUCTION="1"
npm run agent:audit
```

Only enable production checks when the owner approves live network validation.

## Guardrails

Agents may:
- Read repository files and docs.
- Run local tests, type checks, builds, and static smoke checks.
- Start local development or static preview servers for validation.
- Create local reports, docs, tests, and narrowly scoped fixes.
- Recommend production actions without performing them.

Agents must not:
- Deploy, promote, rollback, or mutate production unless the owner explicitly
  authorizes that specific action.
- Change Stripe products, prices, payment links, webhooks, refunds, customers,
  or live fulfillment without explicit approval.
- Read, print, copy, or commit secrets from `.env*`, Vercel, Stripe, Neon, or
  customer files.
- Send customer emails or password reset messages without explicit approval.
- Use private ESPN/customer data in generated examples or reports.
- Revert unrelated working-tree changes.
- Treat AI-generated recommendations as facts without source/data confidence.

High-risk actions require owner approval:
- Database schema changes or migrations.
- Admin action execution.
- Payment and billing changes.
- Email sending.
- Production monitoring that needs privileged tokens.
- Any change touching auth, sessions, passwords, access codes, customer records,
  or webhook verification.

## Security Backlog

Completed local guardrails:
- Customer status redacts protected customer and league metadata until the
  requester has a valid session or access code.
- Setup no longer reloads or persists access codes in browser storage.
- Live draft league overrides must match a saved league and season on the
  signed-in account.
- Draft bridge snapshots require a registered bridge key; re-registration clears
  old picks and rotates the key through an authenticated saved-league path.
- Login and password-reset failures return generic public responses while
  detailed reasons stay in ops logs.
- Checkout fulfillment rejects obviously unsafe sessions: unpaid checkouts,
  unsupported currencies, invalid amounts, and missing customer identity.
- Checkout fulfillment ignores client-controlled customer slug fields and uses
  Stripe buyer identity for new account slugs and add-on credit ownership.
- Stripe fulfillment has env-driven livemode, Payment Link, Price, and Product
  allowlists.
- Production Payment Link IDs were verified from Stripe on 2026-05-24 and added
  to `.env.local`, `.env.example`, and payment setup docs.

Approval-required next guardrails:
- Decide whether any cross-league draft preview is an intended paid feature. If
  so, add an explicit admin/dev-only path rather than a customer query override.
- Production probes are separate from `predeploy`. Run
  `npm run test:production-readiness` only after owner approval for live checks.

## Source-of-Truth Rule

Dashboard source lives in `public/FantasyIQ/`. Mirror copies are generated by:

```powershell
node .\scripts\sync_dashboard_mirror.js
```

Static deploy output is generated by:

```powershell
npm run build
```

Agents should edit the source path first, then run the mirror/build scripts.
They should not independently patch every mirrored copy unless the source path
is unavailable.

## Current AI Provider Status

No required OpenAI or other LLM provider integration is configured in this
repository yet. The internal development-agent loop can operate as a local
automation and reporting workflow first. If product-facing AI features are
added later, they need a separate design for API keys, grounding, evaluation,
rate limits, cost limits, and user-visible confidence.

## Next Automation Loop

Build the Daily League Intelligence Health Report before customer-facing AI.

Recommended first artifact:

```text
scripts/daily_league_intelligence_health.py
```

Run the local redacted version:

```powershell
npm run agent:health
```

The loop should:
- load customers and active configured leagues;
- run lightweight checks for account status, ESPN sync, team match, scoring
  settings, draft state, live board status, and backend intelligence output;
- write a redacted local JSON report under `artifacts/health/`;
- optionally, in a separately approved production mode, write one summarized
  `fantasyiq_ops_events` row plus `fantasyiq_data_freshness` updates.

The report must not include emails, access codes, password hashes, session
tokens, admin tokens, Stripe customer IDs, raw UDK payloads, or raw ops payloads.

Reusable code paths:
- `api/customer_context.py`: `all_customer_contexts()`,
  `database_customer_context()`, and `require_customer_config()`.
- `api/database.py`: `list_customers()`, `record_ops_event()`,
  `list_ops_events()`, and `ops_summary()`.
- `api/intelligence.py`: `response_payload()` for backend engine smoke checks.
- `api/live_draft.py` and `api/live_boards.py`: live sync and board payload
  helpers when an authorized request context is available.

Future protected admin action:

```json
{ "action": "daily_intelligence_health", "mode": "production" }
```

That action should live behind the existing admin gate and token checks. It
should return the same sanitized report shape and store only redacted summaries.
