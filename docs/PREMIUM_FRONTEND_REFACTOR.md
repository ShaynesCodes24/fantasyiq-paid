# MyFantasyIQ Premium Frontend Refactor

This plan is repo-aware for `public/index.html`, `public/landing.css`, `public/setup.html`, `public/site.css`, and the canonical dashboard under `public/FantasyIQ/`. It preserves existing API calls, Stripe links, setup validation, auth routes, customer session cookies, and dashboard mirror behavior.

## 1. Design System Tokens

Use one shared premium dark token layer and alias the current `--fiq-*`, `--lux-*`, and legacy `--field/--gold` names into it. This can be appended near the top of `public/landing.css`, `public/site.css`, and `public/FantasyIQ/styles.css`, then selectors can migrate gradually.

```css
:root,
.theme-dark {
  color-scheme: dark;

  --bg-base: #00110f;
  --bg-base-rgb: 0 17 15;
  --bg-surface-muted: #061f1c;
  --bg-surface-elevated: rgba(5, 22, 19, 0.94);
  --bg-surface-glass: rgba(7, 29, 24, 0.72);
  --bg-surface-hover: rgba(249, 240, 220, 0.075);
  --border-subtle: rgba(249, 240, 220, 0.11);
  --border-strong: rgba(249, 240, 220, 0.22);
  --border-glow: rgba(231, 185, 90, 0.38);
  --shadow-card: 0 18px 54px rgba(0, 8, 7, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.045);
  --shadow-command: 0 30px 90px rgba(0, 8, 7, 0.48), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  --shadow-risk: 0 18px 44px rgba(255, 122, 104, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.045);

  --text-primary: #fffdf9;
  --text-secondary: #f9f0dc;
  --text-muted: rgba(249, 240, 220, 0.68);
  --text-disabled: rgba(249, 240, 220, 0.38);
  --text-inverse: #161006;
  --text-success: #6ee3a3;
  --text-warning: #e7b95a;
  --text-danger: #ff7a68;
  --text-info: #7cc7ba;

  --accent-green: #6ee3a3;
  --accent-green-bg: rgba(110, 227, 163, 0.1);
  --accent-green-bg-strong: rgba(110, 227, 163, 0.18);
  --accent-green-border: rgba(110, 227, 163, 0.34);
  --accent-green-glow: rgba(110, 227, 163, 0.28);
  --accent-green-text: #9cf0bf;
  --accent-green-muted: rgba(156, 240, 191, 0.72);

  --accent-blue: #7cc7ff;
  --accent-blue-bg: rgba(124, 199, 255, 0.09);
  --accent-blue-bg-strong: rgba(124, 199, 255, 0.16);
  --accent-blue-border: rgba(124, 199, 255, 0.3);
  --accent-blue-glow: rgba(124, 199, 255, 0.22);
  --accent-blue-text: #b5dcff;
  --accent-blue-muted: rgba(181, 220, 255, 0.72);

  --accent-amber: #e7b95a;
  --accent-amber-bg: rgba(231, 185, 90, 0.11);
  --accent-amber-bg-strong: rgba(231, 185, 90, 0.2);
  --accent-amber-border: rgba(231, 185, 90, 0.36);
  --accent-amber-glow: rgba(231, 185, 90, 0.28);
  --accent-amber-text: #ffe6a6;
  --accent-amber-muted: rgba(255, 230, 166, 0.72);

  --accent-crimson: #ff7a68;
  --accent-crimson-bg: rgba(255, 122, 104, 0.1);
  --accent-crimson-bg-strong: rgba(255, 122, 104, 0.18);
  --accent-crimson-border: rgba(255, 122, 104, 0.36);
  --accent-crimson-glow: rgba(255, 122, 104, 0.24);
  --accent-crimson-text: #ffb2a8;
  --accent-crimson-muted: rgba(255, 178, 168, 0.72);

  --gradient-app-shell:
    radial-gradient(circle at 16% -12%, rgba(231, 185, 90, 0.11), transparent 30%),
    linear-gradient(135deg, #00110f 0%, #031d1a 48%, #0b2f29 100%);
  --gradient-card: linear-gradient(180deg, rgba(249, 240, 220, 0.06), rgba(249, 240, 220, 0.024)), rgba(5, 22, 19, 0.9);
  --gradient-command: linear-gradient(135deg, rgba(0, 17, 15, 0.98), rgba(10, 44, 37, 0.96) 56%, rgba(231, 185, 90, 0.1));
  --gradient-risk: linear-gradient(135deg, rgba(255, 122, 104, 0.16), rgba(231, 185, 90, 0.07)), rgba(5, 22, 19, 0.9);
  --gradient-sos-easy: linear-gradient(135deg, rgba(110, 227, 163, 0.9), rgba(124, 199, 255, 0.55));
  --gradient-sos-neutral: linear-gradient(135deg, rgba(124, 199, 255, 0.35), rgba(231, 185, 90, 0.36));
  --gradient-sos-hard: linear-gradient(135deg, rgba(231, 185, 90, 0.58), rgba(255, 122, 104, 0.74));
  --gradient-sos-spectrum: linear-gradient(90deg, #6ee3a3 0%, #7cc7ff 42%, #e7b95a 68%, #ff7a68 100%);
  --gradient-waiver-value: linear-gradient(135deg, rgba(110, 227, 163, 0.18), rgba(231, 185, 90, 0.08));
  --gradient-draft-tier: linear-gradient(90deg, rgba(231, 185, 90, 0.28), rgba(124, 199, 255, 0.14));
  --gradient-market-move: linear-gradient(90deg, rgba(255, 122, 104, 0.72), rgba(231, 185, 90, 0.86), rgba(110, 227, 163, 0.82));

  --font-sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-size-label: 0.73rem;
  --font-size-tiny: 0.78rem;
  --font-size-body: clamp(0.95rem, 0.35vw + 0.86rem, 1.03rem);
  --font-size-body-lg: clamp(1.04rem, 0.5vw + 0.9rem, 1.18rem);
  --font-size-h3: clamp(1.15rem, 0.7vw + 0.95rem, 1.45rem);
  --font-size-h2: clamp(1.7rem, 2.2vw, 3rem);
  --font-size-hero: clamp(2.7rem, 5vw, 5.2rem);
  --font-size-metric: clamp(1.65rem, 2.5vw, 3.25rem);
  --line-tight: 1.05;
  --line-body: 1.52;
  --line-relaxed: 1.68;
  --tracking-label: 0.06em;

  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-pill: 999px;
  --motion-fast: 140ms ease;
  --motion-med: 190ms ease;
  --focus-ring: 0 0 0 3px rgba(231, 185, 90, 0.34), 0 0 0 6px rgba(249, 240, 220, 0.1);

  --fiq-ink: var(--bg-base);
  --fiq-field: #123f34;
  --fiq-gold: var(--accent-amber);
  --fiq-paper: var(--text-primary);
  --fiq-cream: var(--text-secondary);
  --field: #123f34;
  --field-dark: var(--bg-base);
  --gold: var(--accent-amber);
  --gold-bright: var(--accent-amber-text);
  --cream: var(--text-secondary);
  --paper: var(--bg-surface-muted);
  --ink: var(--text-secondary);
  --muted: var(--text-muted);
  --line: var(--border-subtle);
  --lux-ink: var(--bg-base);
  --lux-gold: var(--accent-amber);
  --lux-cream: var(--text-secondary);
  --lux-paper: var(--text-primary);
  --lux-muted: var(--text-muted);
  --lux-line: var(--border-subtle);
  --lux-shadow-soft: var(--shadow-card);
  --lux-shadow: var(--shadow-command);
}
```

Tailwind mapping suggestion:

```js
export default {
  theme: {
    extend: {
      colors: {
        fiq: {
          bg: "var(--bg-base)",
          surface: "var(--bg-surface-elevated)",
          glass: "var(--bg-surface-glass)",
          border: "var(--border-subtle)",
          gold: "var(--accent-amber)",
          green: "var(--accent-green)",
          blue: "var(--accent-blue)",
          danger: "var(--accent-crimson)",
        },
      },
      fontFamily: { sans: "var(--font-sans)" },
      borderRadius: { fiq: "var(--radius-md)" },
      boxShadow: { card: "var(--shadow-card)", command: "var(--shadow-command)" },
    },
  },
};
```

Color rules:

- Green means high value, low risk, positive roster edge, or actionable waiver/trade/draft opportunity.
- Blue means neutral intelligence, sync status, schedule/projection context, or informational state.
- Amber means medium risk, injury uncertainty, bye pressure, thin depth, or caution.
- Crimson means severe roster risk, overpay warning, blocked ESPN/private league state, or avoid.
- Gold is the brand premium accent. Use it for primary CTAs, active nav, key separators, and the single most important metric. Do not use it on every card.

Gradient rules:

- Use `--gradient-app-shell` only on full app/page canvases.
- Use `--gradient-card` for generic panels.
- Use `--gradient-command` only on the dominant Main Move surface.
- Use `--gradient-risk` only for risk containment.
- Use SoS gradients as continuous surfaces, not harsh red/yellow/green blocks.

Typography rules:

- Main Move directives use `--font-size-hero` or `--font-size-h2`, line-height `--line-tight`, and text balance.
- Metric values use `--font-size-metric`.
- Labels use `--font-size-label`, uppercase, and `--tracking-label`.
- Body analysis uses `--font-size-body`, `--line-body`, and muted text only for secondary detail.

## 2. Global Layout Refactor

The Command Center should answer "What should I do next?" before anything decorative. Current dashboard hooks live in `public/FantasyIQ/index.html`, `public/FantasyIQ/js/dashboard.js`, and `public/FantasyIQ/js/draft.js`.

Recommended order inside `#command`:

1. League Health Header.
2. Command Decision Shell.
3. Sync stage and module rail.
4. Existing Intelligence OS and diagnostic panels.

Keep these IDs because current JS writes into them:

- `league-health-panel`
- `league-health-title`
- `league-health-score`
- `league-health-grid`
- `command-main-move-card`
- `command-main-move`
- `command-main-reason`
- `command-fantasyiq-score`
- `command-score-detail`
- `command-roster-weakness`
- `command-weakness-detail`
- `command-confidence`
- `command-confidence-detail`
- `command-supporting-reasons`
- `command-risk-warning`
- `command-alternative-path`
- `intelligence-os-panel`

Command Center skeleton:

```html
<section class="panel active command-center" id="command" aria-labelledby="command-title">
  <section class="league-health-header" id="league-health-panel" aria-labelledby="league-health-title">
    <div class="league-health-header__summary">
      <p class="eyebrow">League Health</p>
      <h2 id="league-health-title">Checking setup</h2>
      <p>Active league, account access, ESPN sync, team match, and scoring profile are checked before the brief runs.</p>
    </div>
    <div class="league-health-header__status">
      <span>Readiness</span>
      <strong id="league-health-score" class="league-health-status-pill">Pending</strong>
    </div>
    <div class="league-health-grid" id="league-health-grid" aria-label="League readiness checks">
      <article class="warn">
        <span>Account</span>
        <strong>Checking</strong>
        <small>Customer access state</small>
      </article>
    </div>
  </section>

  <section class="command-decision-shell" aria-labelledby="command-main-move">
    <article class="command-main-move-card" id="command-main-move-card">
      <span class="command-section-label">What should I do next?</span>
      <h2 id="command-main-move"><span class="skeleton-line wide"></span></h2>
      <p id="command-main-reason">Run the brief to compare every action against standing still.</p>
      <div class="command-reason-chip-list" id="command-supporting-reasons" aria-live="polite">
        <p>Waiting for league data.</p>
      </div>
      <div class="command-action-row">
        <button class="primary-action" id="command-refresh" type="button">Run IQ Brief</button>
        <button class="secondary-action nav-jump" type="button" data-jump="my-team">Open Roster IQ</button>
      </div>
    </article>

    <aside class="command-decision-rail" aria-label="Decision score and constraints">
      <article class="command-score-card">
        <span>FantasyIQ Score</span>
        <div class="command-score-gauge" aria-hidden="true"></div>
        <output id="command-fantasyiq-score" class="score-glow command-score-value" aria-live="polite">--</output>
        <p id="command-score-detail">Decision quality and roster fit</p>
      </article>
      <article class="command-mini-card">
        <span>Primary Constraint</span>
        <strong id="command-roster-weakness">Awaiting scan</strong>
        <small id="command-weakness-detail">Roster context will refine the pressure point</small>
      </article>
      <article class="command-mini-card">
        <span>Confidence</span>
        <strong id="command-confidence">Ready</strong>
        <small id="command-confidence-detail">Updates after the next brief</small>
      </article>
      <article class="command-alert command-alert--risk">
        <span>Risk Warning</span>
        <p id="command-risk-warning">Pending</p>
      </article>
      <article class="command-alert command-alert--alternative">
        <span>Alternative Path</span>
        <p id="command-alternative-path">Pending</p>
      </article>
    </aside>
  </section>

  <nav class="command-lane-strip" aria-label="Command Center modules">
    <button class="nav-jump" type="button" data-jump="workbooks">Big Board</button>
    <button class="nav-jump" type="button" data-jump="draft">Draft Prep IQ</button>
    <button class="nav-jump" type="button" data-jump="simulator">Mock Simulator</button>
    <button class="nav-jump" type="button" data-jump="live">Schedule IQ</button>
    <button class="nav-jump" type="button" data-jump="waivers">Waiver IQ</button>
    <button class="nav-jump" type="button" data-jump="trade">Trade IQ</button>
  </nav>

  <section id="intelligence-os-panel" class="intelligence-os-panel" aria-label="FantasyIQ intelligence operating system">
    <!-- Preserve current Intelligence OS markup until loadIntelligence/renderIntelligenceOS is refactored. -->
  </section>
</section>
```

Layout CSS:

```css
.command-center {
  display: grid;
  gap: 14px;
}

.league-health-header,
.command-main-move-card,
.command-score-card,
.command-mini-card,
.command-alert {
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--gradient-card);
  color: var(--text-secondary);
  box-shadow: var(--shadow-card);
}

.league-health-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 14px;
  padding: 16px;
}

.league-health-grid {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.league-health-grid article {
  border-left: 3px solid var(--accent-blue-border);
  border-radius: var(--radius-md);
  background: rgba(249, 240, 220, 0.045);
  padding: 12px;
}

.league-health-grid article.good { border-left-color: var(--accent-green-border); }
.league-health-grid article.warn { border-left-color: var(--accent-amber-border); }
.league-health-grid article.danger { border-left-color: var(--accent-crimson-border); }

.command-decision-shell {
  display: grid;
  grid-template-columns: minmax(0, 1.48fr) minmax(280px, 0.72fr);
  gap: 14px;
}

.command-main-move-card {
  position: relative;
  overflow: hidden;
  min-height: 330px;
  display: grid;
  align-content: center;
  gap: 16px;
  border-color: var(--border-glow);
  background: var(--gradient-command);
  padding: clamp(18px, 3vw, 34px);
}

.command-section-label,
.command-main-move-card span,
.command-score-card span,
.command-mini-card span,
.command-alert span {
  color: var(--accent-amber-text);
  font-size: var(--font-size-label);
  font-weight: 950;
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

.command-main-move-card h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--font-size-hero);
  line-height: var(--line-tight);
  text-wrap: balance;
}

.command-main-move-card p {
  max-width: 760px;
  margin: 0;
  color: var(--text-muted);
  font-size: var(--font-size-body-lg);
}

.command-decision-rail {
  display: grid;
  gap: 10px;
}

.command-score-card,
.command-mini-card,
.command-alert {
  display: grid;
  gap: 8px;
  padding: 14px;
}

.command-score-gauge {
  --score-pct: 0%;
  --score-color: var(--accent-amber);
  width: 112px;
  aspect-ratio: 1;
  border-radius: 50%;
  background: conic-gradient(var(--score-color) var(--score-pct), rgba(249, 240, 220, 0.1) 0);
}

.command-score-value {
  color: var(--accent-amber-text);
  font-size: var(--font-size-metric);
  font-weight: 950;
  line-height: 1;
}

.command-reason-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.command-reason-chip-list p,
.reason-chip {
  margin: 0;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-pill);
  background: rgba(249, 240, 220, 0.045);
  padding: 7px 10px;
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 850;
}

.command-alert--risk {
  border-left: 3px solid var(--accent-crimson-border);
  background: var(--gradient-risk);
  box-shadow: var(--shadow-risk);
}

.command-alert--alternative {
  border-left: 3px solid var(--accent-green-border);
}

@media (max-width: 1180px) {
  .league-health-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .league-health-header,
  .command-decision-shell {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 620px) {
  .league-health-grid {
    grid-template-columns: 1fr;
  }

  .command-main-move-card {
    min-height: 0;
  }
}
```

Status/header states:

- `data-state="synced"`: green dot, "Synced".
- `data-state="syncing"`: blue dot, `aria-busy="true"`.
- `data-state="needs-attention"`: amber dot, show reconnect/resync.
- `data-state="private-blocked"`: crimson dot, message "Public ESPN league required".
- `data-state="no-league"`: muted dot, setup CTA.

## 3. Component Library

### League Health Header

HTML uses the skeleton in Section 2. `renderLeagueHealth()` should continue replacing only `#league-health-grid`.

Accessibility:

- Header is a `section` with `aria-labelledby`.
- Status text is visible, not color-only.
- Resync actions are real buttons.

### Main Move Card

```html
<article class="command-main-move-card" id="command-main-move-card" data-action="act-now">
  <span class="command-section-label">Main Move</span>
  <h2 id="command-main-move">Offer WR depth for an RB2 upgrade.</h2>
  <p id="command-main-reason">Your WR bench is replaceable. Weekly RB depth is the pressure point.</p>
</article>
```

State variants:

- `data-action="act-now"`: gold/green accent.
- `data-action="wait"`: blue/amber accent.
- `data-action="avoid"`: crimson risk accent.
- `data-action="syncing"`: skeleton and `aria-busy="true"`.

### FantasyIQ Score Gauge

```html
<article class="command-score-card" data-score-tone="strong">
  <span>FantasyIQ Score</span>
  <div class="command-score-gauge" style="--score-pct: 87%; --score-color: var(--accent-green);">
    <output id="command-fantasyiq-score" class="command-score-value">87</output>
  </div>
  <p id="command-score-detail">Starter impact plus roster fit</p>
</article>
```

Optional JS enhancement inside `renderCommandDecision()`:

```js
const gauge = document.querySelector(".command-score-gauge");
if (gauge && score) {
  gauge.style.setProperty("--score-pct", `${Math.max(0, Math.min(score, 100))}%`);
  gauge.style.setProperty(
    "--score-color",
    score >= 80 ? "var(--accent-green)" : score >= 60 ? "var(--accent-amber)" : "var(--accent-crimson)",
  );
}
```

### Reason Metric Chips

```html
<div class="command-reason-chip-list" aria-label="Recommendation signals">
  <span class="reason-chip" data-sentiment="positive"><b>Roster surplus</b> WR +2</span>
  <span class="reason-chip" data-sentiment="warning"><b>Bye pressure</b> Week 7</span>
  <span class="reason-chip" data-sentiment="neutral"><b>Market timing</b> Stable</span>
</div>
```

```css
.reason-chip[data-sentiment="positive"] { border-color: var(--accent-green-border); color: var(--accent-green-muted); }
.reason-chip[data-sentiment="warning"] { border-color: var(--accent-amber-border); color: var(--accent-amber-muted); }
.reason-chip[data-sentiment="danger"] { border-color: var(--accent-crimson-border); color: var(--accent-crimson-muted); }
```

### Risk Warning Card

```html
<article class="command-alert command-alert--risk" data-risk="elevated">
  <span>Risk Warning</span>
  <h3>Why this can fail</h3>
  <p id="command-risk-warning">The RB market tightens if injury news breaks before waivers process.</p>
  <strong>Safety rule: do not overpay if injury news changes.</strong>
</article>
```

Variants: `manageable`, `elevated`, `severe`, `avoid`.

### Alternative Path Card

```html
<article class="command-alert command-alert--alternative">
  <span>Alternative Path</span>
  <p id="command-alternative-path">Hold FAAB and target the top waiver RB if the manager declines.</p>
  <button class="secondary-action nav-jump" type="button" data-jump="waivers">Open Waiver IQ</button>
</article>
```

### Player Intelligence Card

Use an additive helper in `public/FantasyIQ/js/dashboard.js`. Keep `liveBoardRequestUrl()`, `applyBoardPayload()`, `filteredRows()`, and `renderBoard()` as the source of truth.

```js
function trendIndicator(row) {
  const label = String(row.Trend || row["Sleeper Trend"] || "").toLowerCase();
  const net = Number(row["Sleeper Net Adds"] || 0);
  const score = externalTrendScore(row);
  if (label.includes("ris") || score >= 7 || net >= 250) return { label: "Rising", className: "good" };
  if (label.includes("fall") || score <= -7 || net <= -250) return { label: "Falling", className: "danger" };
  if (label.includes("value")) return { label: "Value Gap", className: "watch" };
  return { label: "Watch", className: "watch" };
}

function renderPlayerIntelligenceCard(row) {
  const trend = trendIndicator(row);
  const market = playerMarketMomentum(row);
  const drafted = isDrafted(row);
  return `
    <article class="player-intel-card" data-state="ready">
      <section class="player-intel-main">
        <p class="eyebrow">${htmlEscape(row.Pos || "TBD")} / ${htmlEscape(row.Team || "FA")} / Bye ${htmlEscape(row.Bye || "TBD")}</p>
        <h3>${htmlEscape(row.Player || "Unknown Player")}</h3>
        <div class="player-intel-verdict ${drafted ? "danger" : trend.className}">
          <span>${drafted ? "Drafted" : htmlEscape(trend.label)}</span>
          <strong>${htmlEscape(row.Action || row["Draft Action"] || "Compare within tier")}</strong>
        </div>
      </section>
      <section class="analysis-grid player-intel-metrics">
        ${analysisChip("Rank", row.Rank ? `#${row.Rank}` : "TBD")}
        ${analysisChip("Tier", preciseTierDisplay(row))}
        ${analysisChip(scoringProjectionLabel(), projectionDisplay(row))}
        ${analysisChip("League Value", valueDisplay(row))}
        ${analysisChip("Risk", row.Risk ? `${row.Risk}/10` : "TBD", riskSignal(row).className)}
        ${analysisChip("Market", market.label, market.className)}
      </section>
      ${playerSynopsisBlock(row)}
      <h3>FantasyIQ Read</h3>
      ${fantasyIqReadHtml(row)}
    </article>
  `;
}
```

CSS:

```css
.player-intel-card {
  display: grid;
  gap: 14px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--gradient-card);
  padding: 16px;
}

.player-intel-main h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: clamp(1.6rem, 2vw, 2.4rem);
  line-height: var(--line-tight);
}

.player-intel-verdict {
  border-left: 3px solid var(--accent-blue-border);
  border-radius: var(--radius-md);
  background: rgba(249, 240, 220, 0.045);
  padding: 10px 12px;
}

.player-intel-verdict.good { border-left-color: var(--accent-green-border); }
.player-intel-verdict.watch { border-left-color: var(--accent-amber-border); }
.player-intel-verdict.danger { border-left-color: var(--accent-crimson-border); }
```

### Live Trend Indicator

```html
<span class="trend-indicator" data-trend="rising">
  <i aria-hidden="true"></i>
  <strong>Rising</strong>
  <small>+420 adds</small>
</span>
```

```css
.trend-indicator {
  display: inline-grid;
  grid-template-columns: 8px auto auto;
  gap: 7px;
  align-items: center;
  min-height: 30px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-pill);
  padding: 4px 9px;
  color: var(--text-muted);
}

.trend-indicator i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent-blue);
}

.trend-indicator[data-trend="rising"] i { background: var(--accent-green); box-shadow: 0 0 14px var(--accent-green-glow); }
.trend-indicator[data-trend="falling"] i { background: var(--accent-crimson); box-shadow: 0 0 14px var(--accent-crimson-glow); }
```

### Opponent Archetype Grid

```html
<section class="live-panel opponent-archetype-panel">
  <p class="eyebrow">Opponent Archetypes</p>
  <h3>Room tendencies</h3>
  <div id="sim-opponent-archetypes" class="opponent-archetype-grid">
    <article class="opponent-card" data-state="predraft">
      <span>Slot 04</span>
      <strong>Value Hunter</strong>
      <p>Likely RB/WR discount shopper. Next pick: WR if tier holds.</p>
      <small>Confidence 72%</small>
    </article>
  </div>
</section>
```

Use existing simulator profiles in `SIM_MANAGER_PERSONAS`; do not change CPU scoring. Add render helpers that surface current `mockSim.profiles[slot]`, `simTeam(slot).counts`, and `simFuturePicksForSlot(slot)`.

Variants:

- `empty`: no mock/live teams.
- `predraft`: slots known, no behavior yet.
- `active`: show current slot and next likely pick.
- `auto`: mock auto-advance active.
- `complete`: final archetype summary.

### Draft Room State Cards

```js
function liveDraftUiState(data = liveDraft) {
  if (!data) return { key: "connecting", tone: "watch", label: "Connecting" };
  if (data.staleError) return { key: "stale-cached", tone: "watch", label: "Cached sync" };
  if (data.drafted) return { key: "complete", tone: "good", label: "Draft complete" };
  const completed = Number(data.completedPicks || 0);
  const current = data.currentPick || null;
  const mine = current && String(current.teamId) === String(selectedTeamId());
  if (data.draftSyncMode === "espnLiveHidden") return { key: "live-hidden", tone: "danger", label: "Picks hidden" };
  if (data.draftSyncMode === "espnDraftRoomBridge") return { key: "bridge", tone: "good", label: "Bridge active" };
  if (data.draftSyncMode === "rosterFallback") return { key: "roster-fallback", tone: "watch", label: "Roster fallback" };
  if (data.inProgress || completed > 0) return { key: mine ? "on-clock" : "live", tone: mine ? "danger" : "good", label: mine ? "On clock" : "Draft live" };
  return { key: "predraft-ready", tone: "good", label: "Pre-draft" };
}
```

### Draft Grading Scorecard

Do not change `postDraftGrade()`. Wrap it for display:

```js
function postDraftScorecard(snapshot = activeRosterSnapshot()) {
  const grade = postDraftGrade(snapshot);
  const b = grade.scoreBreakdown || {};
  return [
    { label: "Overall Draft Grade", value: grade.grade, detail: grade.label },
    { label: "Starter Strength", value: Number(b.consensusStarterAvg || 0).toFixed(1), detail: "Consensus starter average" },
    { label: "Roster Shape", value: Number(b.consensusRosterAvg || 0).toFixed(1), detail: b.marketSupport || "Market pending" },
    { label: "Construction Drag", value: ((b.constructionPenalty || 0) + (b.depthPenalty || 0) + (b.riskPenalty || 0)).toFixed(1), detail: "Lower is better" },
  ];
}
```

### Pre-Draft Readiness Panel

Extract the current readiness check array from `renderDraftPrep()` into `draftPrepReadinessChecks()` unchanged, then render:

```html
<section class="pre-draft-readiness" data-state="ready">
  <div>
    <p class="eyebrow">Pre-Draft Readiness</p>
    <h3>Armed Strategy</h3>
    <p>Queue can stay empty until value opens. Your plan is loaded.</p>
  </div>
  <div class="readiness-check-grid">
    <article class="good"><strong>Slot guidance</strong><small>Pick 8 strategy active</small></article>
    <article class="watch"><strong>Tier windows</strong><small>WR cliff near Round 4</small></article>
    <article class="danger"><strong>Do-not-reach</strong><small>K/DST before endgame</small></article>
  </div>
</section>
```

### Billing Season Pass Section

Add this to `public/setup.html` after `#setup-mode-note` and before `.setup-steps`. Keep `#setup-form` as the validation source of truth.

```html
<section class="tool-card season-pass-card" id="season-pass" aria-labelledby="season-pass-title">
  <header class="season-pass-head">
    <div>
      <p class="eyebrow">Season Pass</p>
      <h2 id="season-pass-title">MyFantasyIQ Season Pass</h2>
      <p>$30/year includes up to 3 ESPN leagues. Extra ESPN leagues are $5/year each.</p>
    </div>
    <div class="season-pass-price" aria-label="$30 per year">$30 <span>/year</span></div>
  </header>
  <dl class="season-pass-facts">
    <div><dt>Included</dt><dd>Up to 3 ESPN fantasy football leagues</dd></div>
    <div><dt>Compatibility</dt><dd>Validate public ESPN league access before checkout</dd></div>
    <div><dt>Security</dt><dd>No ESPN password required. Stripe-secured billing.</dd></div>
  </dl>
  <div class="season-pass-calculator" aria-labelledby="season-pass-calculator-title">
    <div>
      <h3 id="season-pass-calculator-title">Annual estimate</h3>
      <p id="season-pass-extra-summary">No extra league fee</p>
    </div>
    <label>
      ESPN leagues
      <input id="season-pass-league-count" type="number" min="1" step="1" value="1" inputmode="numeric" />
    </label>
    <output id="season-pass-total" for="season-pass-league-count" aria-live="polite">$30/year</output>
  </div>
  <p class="season-pass-constraint">Private ESPN leagues cannot be checked from this setup page.</p>
  <div class="button-row">
    <a class="primary dark" href="#setup-form">Check ESPN compatibility</a>
    <a class="secondary dark-outline" id="season-pass-checkout-link" href="https://buy.stripe.com/00wdR9dN7gBRacMb9fefC01" data-checkout-link>Start Season Pass</a>
  </div>
</section>
```

Extra league calculator:

```js
const seasonPassCheckoutLink = document.querySelector("#season-pass-checkout-link");
const seasonPassLeagueCount = document.querySelector("#season-pass-league-count");
const seasonPassTotal = document.querySelector("#season-pass-total");
const seasonPassExtraSummary = document.querySelector("#season-pass-extra-summary");

function updateSeasonPassEstimate() {
  const basePrice = 30;
  const includedLeagues = 3;
  const extraLeaguePrice = 5;
  const leagueCount = Math.max(1, Number.parseInt(seasonPassLeagueCount?.value || "1", 10) || 1);
  const extraLeagues = Math.max(0, leagueCount - includedLeagues);
  const total = basePrice + extraLeagues * extraLeaguePrice;
  if (seasonPassLeagueCount) seasonPassLeagueCount.value = String(leagueCount);
  if (seasonPassTotal) seasonPassTotal.textContent = `$${total}/year`;
  if (seasonPassExtraSummary) {
    seasonPassExtraSummary.textContent = extraLeagues
      ? `${extraLeagues} extra ESPN league${extraLeagues === 1 ? "" : "s"} at $5/year each`
      : "No extra league fee";
  }
  if (seasonPassCheckoutLink) {
    seasonPassCheckoutLink.href = seasonPassPaymentLink;
    seasonPassCheckoutLink.dataset.leagueCount = String(leagueCount);
    seasonPassCheckoutLink.dataset.planTotal = String(total);
  }
}

seasonPassLeagueCount?.addEventListener("input", updateSeasonPassEstimate);
updateSeasonPassEstimate();
```

### Skeleton, Empty, Error States

```html
<article class="state-card state-card--loading" aria-busy="true">
  <span class="skeleton-line short"></span>
  <strong class="skeleton-line"></strong>
  <small class="skeleton-line long"></small>
</article>
```

```css
.skeleton-line {
  position: relative;
  display: block;
  height: 0.86em;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: rgba(249, 240, 220, 0.12);
}

.skeleton-line::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, rgba(249, 240, 220, 0.3), transparent);
  animation: skeleton-sheen 1.7s ease-in-out infinite;
}

@keyframes skeleton-sheen {
  to { transform: translateX(100%); }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

## 4. File-by-File Implementation Plan

`public/index.html`

- Preserve current lightweight landing page and CTAs to `/setup.html?mode=precheck` and `/FantasyIQ/?login=1`.
- Add only public marketing proof and static preview modules.
- Avoid dashboard scripts, API calls, or auth boot on `/`.

`public/landing.css`

- Add the shared token layer and alias existing `--fiq-*` variables.
- Keep hero/layout assets restrained and brand-forward.
- Avoid adding app dashboard controls to the landing page.

`public/setup.html`

- Add `#season-pass` before `.setup-steps`.
- Preserve `#setup-form`, `#setup-submit-button`, `#setup-result`, `#create-password`, `#setup-sign-in-link`, `#setup-open-dashboard-link`.
- Keep `/api/setup-validate`, `/api/customer-password`, and `[data-checkout-link]` tracking unchanged.
- Dashboard links should target `/FantasyIQ/`.

`public/site.css`

- Add dark premium setup tokens and `.season-pass-*` classes.
- Keep existing `.policy-page`, `.tool-card`, `.field-grid`, `.result-panel` compatibility.
- Make setup mobile single-column below 820px.

`public/FantasyIQ/index.html`

- Reorder `#command` so League Health and Main Move appear before the hero/orbit.
- Preserve all current IDs used by `state.js`, `dashboard.js`, and `draft.js`.
- Keep `#intelligence-os-panel` until `loadIntelligence()` is changed.

`public/FantasyIQ/styles.css`

- Consolidate late premium token aliases.
- Add `.command-decision-shell`, `.command-main-move-card`, `.command-score-gauge`, `.player-intel-card`, `.opponent-archetype-grid`, `.pre-draft-readiness`, and state-card classes.
- Keep reduced-motion protection.

`public/FantasyIQ/js/dashboard.js`

- Add `renderPlayerIntelligenceCard(row)` and reuse it from `showAnalysis()` / `showTrendAnalysis()`.
- Add board loading/empty/error rendering inside existing board surfaces.
- Do not change `filteredRows()` sorting/filtering.

`public/FantasyIQ/js/draft.js`

- Add score gauge CSS variable update inside `renderCommandDecision()`.
- Extract `draftPrepReadinessChecks()` from current `renderDraftPrep()` checks without changing scoring.
- Wrap `postDraftGrade()` with display-only scorecard helpers.

`public/FantasyIQ/js/simulator.js`

- Add render helpers for opponent archetypes.
- Use existing `SIM_MANAGER_PERSONAS`, `simManagerProfile()`, and `simBotScore()`.
- Do not change pick simulation logic.

`public/FantasyIQ/js/ui.js`

- Keep `liveBoardRequestUrl()` as the only `/api/live-boards` URL builder.
- Keep `loadLiveDraft()` as the only `/api/live-draft` sync entry point.
- Continue using `setLiveSyncPhase()` for premium sync state.

`middleware.js`, `scripts/serve_static.js`

- Preserve redirect compatibility from old apex dashboard query URLs to `/FantasyIQ/`.

`scripts/sync_dashboard_mirror.js`

- Continue editing canonical dashboard files under `public/FantasyIQ/`.
- Sync JS/config/assets/data broadly, and sync dashboard `index.html`/`styles.css` only to root `FantasyIQ/` compatibility shell.

## 5. Data Mapping Guidance

### `/api/live-boards`

Required:

- `boards.combined.rows[]`
- `boards[activeBoard].rows[]`
- `positionColors`
- `Player`
- `Pos`
- `Team`
- `Rank`
- `Pos Rank`
- `Pos Tier` or `Tier`
- `Proj PPR Pts` or `Native Projection`
- `Value Score`
- `Risk`
- `Action`

Optional:

- `Bye`
- `Category`
- `True ADP`
- `ESPN ADP`
- `Projection Edge`
- `Last Year PPR`
- `Volume`
- `Upside`
- `Floor`
- `Stability`
- `Ceiling`
- `Projection Source`
- `Prior Year Source`
- `Risk Notes`
- `Daily Synopsis`
- `Player Outlook`
- `Synopsis Updated`
- `Latest News Date`
- `News Status`
- `Sleeper Add Count`
- `Sleeper Drop Count`
- `Sleeper Net Adds`
- `External Trend Score`
- `External Signal`
- `UDK Matched`
- `UDK View`
- `UDK Rank`
- `UDK Delta`
- `UDK Tier`
- `UDK Alignment`
- `UDK Signal`

Derived:

- FantasyIQ score: `leagueValueScore(row)` / `valueDisplay(row)`.
- Market movement: `playerMarketMomentum(row)`.
- Add/drop pressure: `sleeperMarketCounts(row)` and net adds.
- Sleeper pressure: external trend score plus add/drop net.
- Rookie signal: `Category === "Rookie"` or rookie fields.
- Volatility: `Risk`, `Stability`, and market movement.
- Schedule quality: SoS module output when present; otherwise placeholder.
- Best use case: `Action`, tier, and roster fit.
- Avoid condition: `riskSignal(row).detail` or risk notes.
- Drafted/rostered state: `isDrafted(row)`, `liveDraftedKeys()`.

Placeholders:

- Projection: `TBD`.
- ADP: `N/A`.
- Last year: `Rookie` or `No 2025`.
- Team: `FA`.
- Bye: `TBD`.
- News: `No dated update`.
- Source: `Refreshed from the current FantasyIQ board.`

### `/api/live-draft`

Required:

- `ok`
- `draftSyncMode`
- `leagueId`
- `season`
- `leagueName`
- `leagueSettings`
- `completedPicks`
- `totalPicks`
- `inProgress`
- `drafted`
- `picks[]`
- `teams[]`
- `currentPick`
- `nextPicks[]`
- `recentPicks[]`
- `syncedAt`

Optional:

- `customer`
- `draftOrder`
- `rosteredNames`
- `staleError`
- `demoMode`
- `source`
- `fallback`

Derived:

- Draft state: `liveDraftUiState(liveDraft)`.
- Current pick: `currentPick` plus selected team comparison.
- User pick: `String(currentPick.teamId) === String(selectedTeamId())`.
- Opponent archetypes: live team picks, roster shape, value grades, or simulator personas.
- Queue state: saved watchlist plus user pick timing.
- Tier cliff warnings: existing tier alert helpers.
- Positional run signals: recent pick position counts.
- Roster shape notes: `teamRosterSnapshot()` and `postDraftGrade()`.
- Post-draft grade: existing `postDraftGrade(snapshot)`.
- Recommended next pick: existing live recommendations and best available helpers.

Placeholder:

- Opponent personality labels for live rooms are display-only until enough picks exist.
- Schedule quality inside player cards can display "Pending Schedule IQ" if no SoS data is loaded.

Safe view model:

```js
const LIVE_SYNC_MODE = {
  draftDetail: "ESPN public league API",
  rosterFallback: "ESPN roster fallback",
  espnDraftRoomBridge: "ESPN draft-room bridge",
  espnLiveHidden: "ESPN live picks hidden",
  staticDemo: "Sanitized demo",
};

function safeLiveDraftView(data = liveDraft) {
  return {
    ok: Boolean(data?.ok),
    staleError: data?.staleError || "",
    syncMode: data?.draftSyncMode || "draftDetail",
    syncLabel: LIVE_SYNC_MODE[data?.draftSyncMode] || data?.source || "ESPN public league API",
    league: {
      id: data?.leagueId || null,
      season: data?.season || null,
      name: data?.leagueName || "ESPN Fantasy League",
      settings: normalizeLeagueSettings(data?.leagueSettings || {}),
    },
    progress: {
      completed: Number(data?.completedPicks || 0),
      total: Number(data?.totalPicks || 0),
      inProgress: Boolean(data?.inProgress),
      drafted: Boolean(data?.drafted),
    },
    picks: Array.isArray(data?.picks) ? data.picks : [],
    teams: Array.isArray(data?.teams) ? data.teams : [],
    currentPick: data?.currentPick || null,
    nextPicks: Array.isArray(data?.nextPicks) ? data.nextPicks : [],
    recentPicks: Array.isArray(data?.recentPicks) ? data.recentPicks : [],
  };
}
```

## 6. Acceptance Criteria

- The Main Move is identifiable within 1 second.
- The recommended action is understandable within 3 seconds.
- Risk is visible without scrolling on desktop.
- League sync state is always visible in the command surface.
- Billing clearly communicates `$30/year`, up to 3 leagues, and `$5/year` per extra league.
- Mobile users see Main Move, Score, and Risk before secondary modules.
- `/` remains a lightweight public landing page.
- `/FantasyIQ/` remains the dashboard app.
- Legacy `/?login=1`, `/?customer=...`, and `/?dashboard=...` URLs redirect to `/FantasyIQ/` with params preserved.
- No existing API, checkout, authentication, or ESPN setup flow is broken.
- `/api/live-boards` and `/api/live-draft` retain their current client entry points.
- Loading, error, timeout, blocked private league, empty board, inactive draft, and partial-data states feel intentional.
- Components are reusable across Roster IQ, Waiver IQ, Trade IQ, Schedule IQ, and Draft Prep IQ.
- The design feels premium, restrained, and trustworthy.

## 7. Quality Bar Review

- Fintech credibility: pass if panels use one premium dark system, restrained borders, and clear status semantics.
- Hierarchy: pass if Main Move dominates and diagnostic modules are below it.
- Glow discipline: pass if only score, active status dots, and primary actions use glow.
- Decision focus: pass if every card either explains the next move, confidence, risk, or action route.
- Risk visibility: pass if risk appears in the first desktop viewport and before secondary modules on mobile.
- Mobile usability: pass if no horizontal scroll exists outside intended data tables and touch targets are at least 44px.
- Token reuse: pass if new components use the shared variables instead of one-off hex values.
- Billing clarity: pass if the calculator never hides the 3 included leagues or extra league math.
- Implementation specificity: pass if every change preserves existing IDs, API callers, checkout links, auth routes, CSP checks, and mirror sync.

Verification checklist before deployment:

```powershell
npm run lint
npm run lint:css
npm run typecheck
npm run test:mirrors
npm run test:csp
npm run test:playwright
npm run build
npm run test:visual
```
