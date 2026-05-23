# Codex Plugin Workflows

Use plugins like a small product team. Each one has a job.

## Build And Release

GitHub:
- Check working tree before edits.
- Commit focused changes.
- Push to `main` when the change is verified.
- Use PRs for larger work when review history matters.

Vercel:
- Deploy production after verified changes.
- Inspect failed deployments and build logs.
- Confirm aliases point to `https://myfantasyiq.com`.
- Use Vercel docs/tools for env, deployment, storage, and function questions.

Browser or Chrome:
- Open local or production dashboard.
- Check mobile and desktop layouts.
- Test setup validator, login, sign out, league switching, and add-league flow.
- Capture screenshots when a UI bug is visual.

## Payments And Customers

Stripe:
- Inspect payment links, customers, checkout sessions, invoices, refunds, and webhook events.
- Verify Season Pass and add-on league products.
- Confirm webhook events are idempotent.
- Never expose secret keys.

Gmail:
- Draft customer setup, delivery, support, renewal, and refund emails.
- Search customer conversations when debugging setup confusion.
- Do not send customer emails without explicit confirmation.

Google Drive or Notion:
- Store official customer-facing docs, Q&A, support SOPs, and launch notes.
- Keep public docs in customer language and internal docs in operator language.

## Product Planning

Linear:
- Track bugs, roadmap items, and repeated support questions.
- Use priorities from `ops/ROADMAP.md`.
- Keep active build scope small.
- Close or update issues after deploy.

Figma:
- Turn UI cleanup ideas into reusable layout/component rules.
- Review dashboard hierarchy before major redesigns.
- Keep design system decisions aligned with `ops/DESIGN_SYSTEM.md`.

Canva:
- Produce product preview images, launch graphics, social graphics, and customer-facing visuals.
- Keep marketing visuals aligned with the actual dashboard.

OpenAI Developers:
- Build future AI-powered setup assistant, Q&A assistant, and draft intelligence.
- Use official docs before adding API-dependent features.
- Keep AI outputs grounded in customer league data and visible source constraints.

## Standard Codex Flow

For product changes:

1. Read relevant code and ops docs.
2. Implement the smallest durable change.
3. Run syntax/security/readiness checks.
4. Verify browser or production behavior.
5. Commit and push.
6. Deploy with Vercel when the change affects production.
7. Update docs or roadmap.

For customer issues:

1. Confirm customer slug, dashboard link, and active league.
2. Check customer status API.
3. Reproduce with Browser/Chrome where possible.
4. Check Vercel logs if production behavior differs.
5. Check Stripe only when payment or entitlement is involved.
6. Fix product issue or draft a support response.

For revenue changes:

1. Review `ops/REVENUE_OPERATIONS.md`.
2. Verify Stripe product/payment link behavior.
3. Verify webhook behavior.
4. Verify database/admin behavior.
5. Update customer emails or checkout docs.

For design changes:

1. Review `ops/DESIGN_SYSTEM.md`.
2. Make the dashboard easier to scan.
3. Check desktop and mobile.
4. Avoid adding tabs unless the workflow truly needs a separate space.
5. Use screenshots before finalizing visual changes.
