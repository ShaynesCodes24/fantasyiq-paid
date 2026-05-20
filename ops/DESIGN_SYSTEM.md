# FantasyIQ Design System

FantasyIQ should feel like a premium sports command center: confident, clean, fast, and practical. The visual design should support decisions, not decorate around them.

## Product Feel

- Clean and high quality.
- Dense enough for draft-day scanning.
- Calm enough to trust.
- Sport-specific without becoming gimmicky.
- Premium without looking like a generic SaaS landing page.

## Layout Rules

- The dashboard should open into the actual product, not a marketing-style hero.
- The active league and account state must be obvious near the top.
- Draft Room should remain the primary experience.
- Intelligence panels should support the Draft Room, not compete with it.
- Repeated cards are fine; avoid cards inside cards.
- Keep control groups compact and predictable.
- Avoid layout shifts when filters, buttons, or labels change.

## Navigation Rules

- Keep tab count low.
- Remove or merge tabs when functionality already lives inside a stronger workflow.
- Draft Room owns live draft intelligence.
- Mock Simulator owns mock grading.
- Trade Calculator owns trade analysis.
- Workbooks should only stay if it has a clearly useful customer workflow.

## Component Rules

Buttons:
- Use clear action labels for primary workflow buttons.
- Use icon buttons only for obvious repeated controls or when a tooltip is present.
- Keep buttons from stretching awkwardly on mobile.

Forms:
- Labels should be plain and direct.
- Every form error should explain the fix.
- Setup fields should map to language customers already understand: league ID, team ID, scoring, teams, flex, superflex, bench, draft rounds.

Cards:
- Use cards for individual items, modals, or focused tools.
- Do not use floating cards as page-section decoration.
- Keep border radius restrained.

Tables and boards:
- Prioritize scan speed.
- Position, rank, value, and action should be easy to compare.
- Do not hide important active-league scoring context.

## Color And Type

- Avoid one-note palettes.
- Keep gold as a brand accent, not a full-screen wash.
- Use dark green/field tones sparingly enough that the interface still breathes.
- Avoid giant text inside compact dashboards.
- Keep letter spacing normal.
- Make long labels wrap cleanly instead of shrinking everything.

## Dashboard Hierarchy

Top:
- Brand
- Active league
- Account sign in/out
- Important customer/demo state

Primary:
- Draft Room
- Live recommendations
- Big board
- League profile

Secondary:
- Mock Simulator
- Trade Calculator
- Setup/help/admin links

## First-Time Customer Experience

The customer should immediately understand:

- Whether they are signed in.
- Which league is active.
- Whether live ESPN sync is connected.
- What the next useful action is.
- Where to get help if setup is incomplete.

## Quality Bar

Before a UI change ships:

- Desktop looks aligned and intentional.
- Mobile does not overlap or clip primary content.
- Empty states are useful.
- Loading states are calm.
- Error states tell the customer what to do next.
- Demo and customer dashboards both still make sense.
