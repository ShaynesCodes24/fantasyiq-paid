const navItems = document.querySelectorAll(".nav-item");
const panels = document.querySelectorAll(".panel");
const tabs = document.querySelectorAll(".tab");
const plans = document.querySelectorAll(".plan");
const savedInputs = document.querySelectorAll("[data-save]");
const mockForm = document.querySelector("#mock-form");
const mockResult = document.querySelector("#mock-result");
const boardTable = document.querySelector("#board-table");
const boardSearch = document.querySelector("#board-search");
const positionFilter = document.querySelector("#position-filter");
const positionButtons = document.querySelectorAll(".position-toggle");
const analysisPane = document.querySelector("#analysis-pane");
const boardStatus = document.querySelector("#board-status");
const reloadBoards = document.querySelector("#reload-boards");
const navJumps = document.querySelectorAll(".nav-jump");
const mockPaste = document.querySelector("#mock-paste");
const gradeMockPicks = document.querySelector("#grade-mock-picks");
const mockPickOutput = document.querySelector("#mock-pick-output");
const tradeGive = document.querySelector("#trade-give");
const tradeGet = document.querySelector("#trade-get");
const tradeRoster = document.querySelector("#trade-roster");
const calculateTrade = document.querySelector("#calculate-trade");
const tradeOutput = document.querySelector("#trade-output");
const boardCount = document.querySelector("#board-count");
const liveSyncStatus = document.querySelector("#live-sync-status");
const liveStatus = document.querySelector("#live-status");
const liveSyncToggle = document.querySelector("#live-sync-toggle");
const manualSync = document.querySelector("#manual-sync");
const liveCurrentPick = document.querySelector("#live-current-pick");
const liveCurrentTeam = document.querySelector("#live-current-team");
const liveCompleted = document.querySelector("#live-completed");
const liveTotal = document.querySelector("#live-total");
const liveProgressBar = document.querySelector("#live-progress-bar");
const liveLastSync = document.querySelector("#live-last-sync");
const liveSource = document.querySelector("#live-source");
const myTeamSelect = document.querySelector("#my-team-select");
const hideDrafted = document.querySelector("#hide-drafted");
const hideDraftedBoard = document.querySelector("#hide-drafted-board");
const liveRecommendations = document.querySelector("#live-recommendations");
const liveTierSearch = document.querySelector("#live-tier-search");
const liveTierBoard = document.querySelector("#live-tier-board");
const liveTierButtons = document.querySelectorAll(".live-tier-toggle");
const liveMyRoster = document.querySelector("#live-my-roster");
const liveRecentPicks = document.querySelector("#live-recent-picks");
const liveNextPicks = document.querySelector("#live-next-picks");
const draftOrderGrid = document.querySelector("#draft-order-grid");
const nextPickRadar = document.querySelector("#next-pick-radar");
const tierAlerts = document.querySelector("#tier-alerts");
const roomDetector = document.querySelector("#room-detector");
const riskMeter = document.querySelector("#risk-meter");
const simSlot = document.querySelector("#sim-slot");
const simStart = document.querySelector("#sim-start");
const simAuto = document.querySelector("#sim-auto");
const simReset = document.querySelector("#sim-reset");
const simStatus = document.querySelector("#sim-status");
const simCurrentPick = document.querySelector("#sim-current-pick");
const simCurrentTeam = document.querySelector("#sim-current-team");
const simCompleted = document.querySelector("#sim-completed");
const simTotal = document.querySelector("#sim-total");
const simProgressBar = document.querySelector("#sim-progress-bar");
const simShape = document.querySelector("#sim-shape");
const simShapeDetail = document.querySelector("#sim-shape-detail");
const simGrade = document.querySelector("#sim-grade");
const simGradeDetail = document.querySelector("#sim-grade-detail");
const simRadar = document.querySelector("#sim-radar");
const simTierAlerts = document.querySelector("#sim-tier-alerts");
const simRoomDetector = document.querySelector("#sim-room-detector");
const simRiskMeter = document.querySelector("#sim-risk-meter");
const simRecommendations = document.querySelector("#sim-recommendations");
const simSearch = document.querySelector("#sim-search");
const simPosition = document.querySelector("#sim-position");
const simPositionButtons = document.querySelectorAll(".sim-position-toggle");
const simAvailable = document.querySelector("#sim-available");
const simRoster = document.querySelector("#sim-roster");
const simLog = document.querySelector("#sim-log");
const footballersPlayerCheck = document.querySelector("#footballers-player-check");
const footballersPlayerOutput = document.querySelector("#footballers-player-output");
const footballersTakeType = document.querySelector("#footballers-take-type");
const footballersRank = document.querySelector("#footballers-rank");
const footballersMarketPick = document.querySelector("#footballers-market-pick");
const footballersTakeContext = document.querySelector("#footballers-take-context");
const appConfig = window.FANTASY_IQ_CONFIG || {};

let boardData = null;
let activeBoard = "combined";
let liveDraft = null;
let liveTimer = null;
let mockSim = null;
let selectedBoardPlayerKey = null;
const LIVE_SYNC_INTERVAL_MS = 8000;

function applyAppConfig() {
  const siteName = appConfig.siteName || "fantasyiq";
  document.title = siteName;

  const brandTitle = document.querySelector(".brand-lockup h1");
  const brandEyebrow = document.querySelector(".brand-lockup .eyebrow");
  const brandSubtitle = document.querySelector(".brand-lockup small");
  const logo = document.querySelector(".brand-lockup img");
  const draftCardLabel = document.querySelector(".draft-card span");
  const draftCardValue = document.querySelector(".draft-card strong");
  const draftCardNote = document.querySelector(".draft-card small");
  const heroTitle = document.querySelector(".command-hero h2");
  const heroSubtitle = document.querySelector(".command-hero p:not(.eyebrow)");
  const leftEndzone = document.querySelector(".field-endzone-left");
  const rightEndzone = document.querySelector(".field-endzone-right");

  if (brandTitle) brandTitle.textContent = siteName;
  if (brandEyebrow) brandEyebrow.textContent = appConfig.leagueName || "League Command Center";
  if (brandSubtitle) brandSubtitle.textContent = appConfig.leagueSubtitle || "Configurable ESPN Fantasy Platform";
  if (logo && appConfig.logoUrl) logo.src = appConfig.logoUrl;
  if (logo) logo.alt = appConfig.logoAlt || `${siteName} league logo`;
  if (draftCardLabel) draftCardLabel.textContent = appConfig.draftCardLabel || "Subscription";
  if (draftCardValue) draftCardValue.textContent = appConfig.draftCardValue || "$25 / year";
  if (draftCardNote) draftCardNote.textContent = appConfig.draftCardNote || "Configured for your ESPN league";
  if (heroTitle) heroTitle.textContent = appConfig.heroTitle || "Draft smarter. Trade cleaner. Win your league.";
  if (heroSubtitle) {
    heroSubtitle.textContent =
      appConfig.heroSubtitle ||
      "Draft prep, player values, mock tracking, live room sync, and trade discipline in one command center.";
  }
  if (leftEndzone) leftEndzone.textContent = appConfig.fieldLeftLabel || "Fantasy";
  if (rightEndzone) rightEndzone.textContent = appConfig.fieldRightLabel || "IQ";
}

applyAppConfig();

function applyEspnLeagueBranding() {
  if (!appConfig.useEspnLeagueBranding || !liveDraft) return;
  const brandEyebrow = document.querySelector(".brand-lockup .eyebrow");
  const brandSubtitle = document.querySelector(".brand-lockup small");
  const logo = document.querySelector(".brand-lockup img");

  if (brandEyebrow && liveDraft.leagueName) brandEyebrow.textContent = liveDraft.leagueName;
  if (brandSubtitle && liveDraft.leagueId) {
    brandSubtitle.textContent = `ESPN league ${liveDraft.leagueId} / season ${liveDraft.season || ""}`.trim();
  }
  if (logo && liveDraft.leagueLogo) {
    logo.src = liveDraft.leagueLogo;
    logo.alt = `${liveDraft.leagueName || "ESPN"} league logo`;
  }
}

const boardColumns = [
  "Rank",
  "Player",
  "Pos",
  "Team",
  "Bye",
  "Category",
  "Proj PPR Pts",
  "Value Score",
  "Risk",
  "Action",
];

const trendColumns = [
  "Trend",
  "Player",
  "Pos",
  "Team",
  "Board Rank",
  "Proj PPR Pts",
  "Trend Score",
  "Confidence",
  "Draft Action",
];

function normalizePlayerName(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv)\b\.?/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function hideDraftedEnabled() {
  return Boolean(hideDrafted?.checked || hideDraftedBoard?.checked);
}

function liveDraftedKeys() {
  const keys = new Set();
  (liveDraft?.draftedNames || []).forEach((name) => {
    keys.add(normalizePlayerName(name));
    const row = findPlayer(name);
    if (row) keys.add(normalizePlayerName(row.Player));
  });
  return keys;
}

function isDrafted(row) {
  if (!row || !liveDraft) return false;
  return liveDraftedKeys().has(normalizePlayerName(row.Player));
}

function isTrendBoard() {
  return activeBoard === "trends";
}

function visibleBoardColumns() {
  const columns = isTrendBoard() ? [...trendColumns] : [...boardColumns];
  if (positionFilter?.value) {
    const insertAt = isTrendBoard() ? 5 : 6;
    columns.splice(insertAt, 0, "Tier");
  }
  return columns;
}

function setActive(items, activeItem) {
  items.forEach((item) => item.classList.toggle("active", item === activeItem));
}

function scrollDashboardTop(behavior = "auto") {
  const snapTop = () => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };
  if (behavior === "smooth") {
    window.scrollTo({ top: 0, left: 0, behavior });
  } else {
    snapTop();
  }
  window.requestAnimationFrame(snapTop);
  window.setTimeout(snapTop, 80);
  window.setTimeout(snapTop, 260);
  window.setTimeout(snapTop, 620);
}

navItems.forEach((button) => {
  button.addEventListener("click", () => {
    const section = button.dataset.section;
    history.replaceState(null, "", `#${section}`);
    setActive(navItems, button);
    panels.forEach((panel) => panel.classList.toggle("active", panel.id === section));
    scrollDashboardTop("smooth");
  });
});

function activateSection(section) {
  const targetButton = Array.from(navItems).find((button) => button.dataset.section === section);
  if (!targetButton) return;
  history.replaceState(null, "", `#${section}`);
  setActive(navItems, targetButton);
  panels.forEach((panel) => panel.classList.toggle("active", panel.id === section));
  scrollDashboardTop("auto");
}

const hashValue = window.location.hash.replace("#", "");
const [initialSection, initialBoard] = hashValue.split("/");
if (initialSection) {
  activateSection(initialSection);
} else {
  history.replaceState(null, "", window.location.pathname);
  scrollDashboardTop("auto");
}

window.addEventListener("load", () => scrollDashboardTop("auto"), { once: true });

tabs.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.board) {
      activeBoard = button.dataset.board;
      history.replaceState(null, "", `#workbooks/${activeBoard}`);
      document.querySelectorAll(".workbook-tabs .tab").forEach((tab) => {
        tab.classList.toggle("active", tab === button);
      });
      renderBoard();
      return;
    }
    const plan = button.dataset.plan;
    setActive(tabs, button);
    plans.forEach((item) => item.classList.toggle("active", item.id === `${plan}-plan`));
  });
});

if (initialBoard) {
  const initialBoardButton = document.querySelector(`.workbook-tabs .tab[data-board="${initialBoard}"]`);
  if (initialBoardButton) {
    activeBoard = initialBoard;
    document.querySelectorAll(".workbook-tabs .tab").forEach((tab) => {
      tab.classList.toggle("active", tab === initialBoardButton);
    });
  }
}

savedInputs.forEach((input) => {
  const key = `fantasy-dashboard:${input.dataset.save}`;
  input.checked = localStorage.getItem(key) === "true";
  input.addEventListener("change", () => {
    localStorage.setItem(key, String(input.checked));
  });
});

function numberValue(formData, key) {
  return Number(formData.get(key) || 0);
}

mockForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(mockForm);
  const counts = {
    QB: numberValue(data, "QB"),
    RB: numberValue(data, "RB"),
    WR: numberValue(data, "WR"),
    TE: numberValue(data, "TE"),
    DST: numberValue(data, "DST"),
    K: numberValue(data, "K"),
  };
  const qbRound = numberValue(data, "qbRound");
  const teRound = numberValue(data, "teRound");
  const notes = [];
  let score = 100;

  if (counts.RB < 4) {
    score -= 10;
    notes.push("RB depth is thin. Aim for at least 4.");
  }
  if (counts.WR < 5) {
    score -= 10;
    notes.push("WR depth is thin for PPR. Aim for at least 5.");
  }
  if (counts.QB > 1) {
    score -= 6;
    notes.push("Backup QB is usually a wasted bench spot.");
  }
  if (counts.TE > 2) {
    score -= 6;
    notes.push("Too many TEs can block RB/WR upside.");
  }
  if (counts.DST > 1 || counts.K > 1) {
    score -= 8;
    notes.push("Do not roster extra DST/K.");
  }
  if (qbRound > 0 && qbRound <= 4) {
    score -= 8;
    notes.push("Early QB needs to be a clear value, not a room panic pick.");
  }
  if (teRound > 0 && teRound <= 3) {
    notes.push("Early TE is fine only if RB/WR value stayed strong.");
  }

  const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
  mockResult.innerHTML = `
    <strong>Shape Grade: ${grade} (${Math.max(score, 0)}/100)</strong>
    <ul>${(notes.length ? notes : ["Clean shape. Now review player value and injury risk."])
      .map((note) => `<li>${note}</li>`)
      .join("")}</ul>
  `;
});

function cellValue(row, key) {
  return row[key] ?? "";
}

function filteredRows() {
  if (!boardData) return [];
  const query = boardSearch.value.trim().toLowerCase();
  const pos = positionFilter.value;
  const drafted = liveDraftedKeys();
  return boardData.boards[activeBoard].rows.filter((row) => {
    const matchesPosition = !pos || (pos === "FLEX" ? ["RB", "WR", "TE"].includes(row.Pos) : row.Pos === pos);
    const searchable = `${row.Player} ${row.Pos} ${row.Team} ${row.Category} ${row.Tier} ${row["Pos Tier"]} ${row.Action} ${row.Analysis} ${row.Trend} ${row["Source Signal"]} ${row.Catalyst} ${row["Why Rising/Falling"]} ${row["Draft Action"]}`.toLowerCase();
    const matchesDraftStatus = !hideDraftedEnabled() || !drafted.has(normalizePlayerName(row.Player));
    return matchesPosition && matchesDraftStatus && (!query || searchable.includes(query));
  });
}

function renderBoard() {
  if (!boardData || !boardTable) return;
  if (boardCount) {
    const total = boardData.boards?.combined?.rows?.length || 0;
    boardCount.textContent = `${total} players`;
  }
  const rows = filteredRows();
  if (boardStatus) {
    const title = boardData.boards[activeBoard]?.title || "Board";
    const updated = boardData.updated ? ` Updated ${boardData.updated}.` : "";
    const drafted = liveDraft?.completedPicks ? ` ESPN live sync has ${liveDraft.completedPicks} drafted players.` : "";
    const tierHint = positionFilter?.value ? " Tier dividers are on for this position view." : "";
    boardStatus.innerHTML = `<strong>${title}</strong>: showing ${rows.length} players. Click any player name for analysis.${tierHint}${updated}${drafted}`;
  }
  const thead = boardTable.querySelector("thead");
  const tbody = boardTable.querySelector("tbody");
  const columns = visibleBoardColumns();
  const activePosition = positionFilter?.value || "";
  const showTierDividers = Boolean(activePosition);
  const boardTierCounts = showTierDividers
    ? rows.reduce((counts, row) => {
        const key = tierLabel(row, activePosition);
        counts[key] = (counts[key] || 0) + 1;
        return counts;
      }, {})
    : {};
  if (rows.length && !rows.some((row) => normalizePlayerName(row.Player) === selectedBoardPlayerKey)) {
    selectedBoardPlayerKey = normalizePlayerName(rows[0].Player);
  }
  thead.innerHTML = `<tr>${columns.map((column) => `<th>${column === "Tier" ? "Pos Tier" : column}</th>`).join("")}</tr>`;
  let previousTier = "";
  tbody.innerHTML = rows
    .map((row, index) => {
      const currentTier = showTierDividers ? tierLabel(row, activePosition) : "";
      const divider = showTierDividers && currentTier !== previousTier
        ? `<tr class="board-tier-divider-row"><td colspan="${columns.length}">${renderTierDivider(currentTier, boardTierCounts[currentTier])}</td></tr>`
        : "";
      if (currentTier) previousTier = currentTier;
      const color = boardData.positionColors[row.Pos] || "FFFFFF";
      const tierClass = positionFilter?.value ? `tier-${row["Tier Sort"] || 99}` : "";
      const draftedClass = isDrafted(row) ? "drafted-row" : "";
      const selectedClass = selectedBoardPlayerKey === normalizePlayerName(row.Player) ? "selected-row" : "";
      const draftedBadge = draftedClass ? `<span class="drafted-badge">Drafted</span>` : "";
      return `${divider}<tr class="${tierClass} ${draftedClass} ${selectedClass}" style="background:#${color}" data-index="${index}">
        ${columns
          .map((column) => {
            if (column === "Player") {
              return `<td><button class="player-link" data-index="${index}">${htmlEscape(row.Player)}</button>${draftedBadge}</td>`;
            }
            if (column === "Tier") {
              return `<td><span class="tier-pill">${row["Pos Tier"] || cellValue(row, column)}</span></td>`;
            }
            const numberClass = typeof row[column] === "number" ? " class=\"number\"" : "";
            return `<td${numberClass}>${cellValue(row, column)}</td>`;
          })
          .join("")}
      </tr>`;
    })
    .join("");

  tbody.querySelectorAll(".player-link").forEach((button) => {
    button.addEventListener("click", () => {
      const row = rows[Number(button.dataset.index)];
      showAnalysis(row);
      renderBoard();
    });
  });

  const selectedRow = rows.find((row) => normalizePlayerName(row.Player) === selectedBoardPlayerKey);
  if (selectedRow || rows[0]) {
    showAnalysis(selectedRow || rows[0]);
  } else {
    analysisPane.innerHTML = `<p class="eyebrow">Player Analysis</p><h3>No results</h3><p>Try clearing the search or position filter.</p>`;
  }
}

function playerIndex() {
  const rows = boardData?.boards?.combined?.rows || [];
  const index = new Map();
  rows.forEach((row) => index.set(normalizePlayerName(row.Player), row));
  return index;
}

function findPlayer(name) {
  const clean = normalizePlayerName(name);
  if (!clean || !boardData) return null;
  const index = playerIndex();
  if (index.has(clean)) return index.get(clean);
  return (boardData.boards.combined.rows || []).find((row) => {
    const rowName = normalizePlayerName(row.Player);
    return rowName.includes(clean) || clean.includes(rowName);
  });
}

function showAnalysis(row) {
  if (!row || !analysisPane) return;
  selectedBoardPlayerKey = normalizePlayerName(row.Player);
  if (isTrendBoard()) {
    showTrendAnalysis(row);
    return;
  }
  const draftedChip = isDrafted(row)
    ? `<div class="analysis-chip drafted-chip"><span>Live Status</span><strong>Drafted</strong></div>`
    : `<div class="analysis-chip"><span>Live Status</span><strong>Available</strong></div>`;
  analysisPane.innerHTML = `
    <p class="eyebrow">${row.Pos} / ${row.Team} / Bye ${row.Bye}</p>
    <h3>${row.Player}</h3>
    <div class="analysis-grid">
      <div class="analysis-chip"><span>Rank</span><strong>${row.Rank}</strong></div>
      <div class="analysis-chip"><span>Position Tier</span><strong>${row["Pos Tier"]}</strong></div>
      <div class="analysis-chip"><span>Pos Rank</span><strong>${row.Pos}${row["Pos Rank"]}</strong></div>
      <div class="analysis-chip"><span>Proj PPR</span><strong>${row["Proj PPR Pts"]}</strong></div>
      <div class="analysis-chip"><span>Value</span><strong>${row["Value Score"]}</strong></div>
      <div class="analysis-chip"><span>Risk</span><strong>${row.Risk}/10</strong></div>
      <div class="analysis-chip"><span>Volume</span><strong>${row.Volume}</strong></div>
      <div class="analysis-chip"><span>Upside</span><strong>${row.Upside}</strong></div>
      ${draftedChip}
    </div>
    <p><strong>${row.Action}</strong></p>
    <p><strong>Projection source:</strong> ${row["Projection Source"]}</p>
    <p>${row.Analysis}</p>
  `;
}

function showTrendAnalysis(row) {
  const trendClass = row.Trend === "Riser" ? "trend-riser" : "trend-faller";
  const trendLabel = row.Trend === "Riser" ? "Rising" : "Falling";
  analysisPane.innerHTML = `
    <p class="eyebrow">${row.Pos || "Watch"} / ${row.Team || "TBD"} / ${trendLabel}</p>
    <h3>${row.Player}</h3>
    <div class="analysis-grid">
      <div class="analysis-chip ${trendClass}"><span>Trend</span><strong>${row.Trend}</strong></div>
      <div class="analysis-chip"><span>Trend Score</span><strong>${row["Trend Score"]}</strong></div>
      <div class="analysis-chip"><span>Confidence</span><strong>${row.Confidence}</strong></div>
      <div class="analysis-chip"><span>Board Rank</span><strong>${row["Board Rank"] || "Watch"}</strong></div>
      <div class="analysis-chip"><span>Position Tier</span><strong>${row["Pos Tier"] || "Watch"}</strong></div>
      <div class="analysis-chip"><span>Proj PPR</span><strong>${row["Proj PPR Pts"] || "TBD"}</strong></div>
    </div>
    <p><strong>${row["Draft Action"]}</strong></p>
    <p><strong>Source signal:</strong> ${row["Source Signal"]}</p>
    <p><strong>Catalyst:</strong> ${row.Catalyst}</p>
    <p>${row["Why Rising/Falling"]}</p>
  `;
}

function renderFootballersPlayerCheck() {
  if (!footballersPlayerOutput) return;
  const query = (footballersPlayerCheck?.value || "").trim();
  if (!query) {
    footballersPlayerOutput.textContent = "Type a player to see what they say next to what FantasyIQ says.";
    return;
  }
  const row = findPlayer(query);
  const take = footballersTakeType?.value || "neutral";
  const takeText = footballersTakeType?.selectedOptions?.[0]?.textContent || "Neutral / context only";
  const theirRank = Number(footballersRank?.value || 0);
  const marketPick = Number(footballersMarketPick?.value || 0);
  const context = (footballersTakeContext?.value || "").trim();

  if (!row) {
    footballersPlayerOutput.innerHTML = `
      <div class="footballers-verdict watch">
        <span>No FantasyIQ Match</span>
        <strong>${htmlEscape(query)} is not on the board yet.</strong>
        <small>Use the take as a watchlist note until the player enters FantasyIQ rankings.</small>
      </div>
      <div class="comparison-grid">
        <article>
          <span>Footballers Say</span>
          <strong>${htmlEscape(takeText)}</strong>
          <p>${context ? htmlEscape(context) : "No take summary entered."}</p>
        </article>
        <article>
          <span>FantasyIQ Says</span>
          <strong>No current board grade</strong>
          <p>No rank, tier, projection, or risk score available yet.</p>
        </article>
      </div>
    `;
    return;
  }

  const decision = footballersDecision(row, take, theirRank, marketPick, context);
  const rankGap = theirRank ? theirRank - Number(row.Rank || 999) : null;
  const costGap = marketPick ? marketPick - Number(row.Rank || 999) : null;
  const rankText = rankGap === null
    ? "No rank entered"
    : rankGap < 0
      ? `${Math.abs(rankGap)} spots higher than FantasyIQ`
      : rankGap > 0
        ? `${rankGap} spots lower than FantasyIQ`
        : "Same as FantasyIQ";
  const costText = costGap === null
    ? "No draft cost entered"
    : costGap < -8
      ? `${Math.abs(costGap)} picks more expensive than FantasyIQ`
      : costGap > 12
        ? `${costGap} picks cheaper than FantasyIQ`
        : "Near FantasyIQ price";
  const fantasyIqSummary = footballersFantasyIqSummary(row);
  const theirSummary = footballersTheirSummary(takeText, rankText, costText, context);

  footballersPlayerOutput.innerHTML = `
    <div class="footballers-verdict ${decision.className}">
      <span>${htmlEscape(decision.label)}</span>
      <strong>${htmlEscape(decision.headline)}</strong>
      <small>${htmlEscape(decision.detail)}</small>
    </div>
    <strong>${htmlEscape(row.Player)}</strong>
    <div class="comparison-grid">
      <article>
        <span>Footballers Say</span>
        <strong>${htmlEscape(takeText)}</strong>
        <p>${htmlEscape(theirSummary)}</p>
      </article>
      <article>
        <span>FantasyIQ Says</span>
        <strong>${htmlEscape(fantasyIqSummary.label)}</strong>
        <p>${htmlEscape(fantasyIqSummary.detail)}</p>
      </article>
    </div>
    <div class="comparison-bottom-line">
      <strong>Bottom line:</strong>
      <span>${htmlEscape(decision.rule)}</span>
    </div>
  `;
}

function footballersDecision(row, take, theirRank, marketPick, context) {
  const rank = Number(row.Rank || 999);
  const risk = Number(row.Risk || 0);
  const value = Number(row["Value Score"] || 0);
  const rankGap = theirRank ? theirRank - rank : 0;
  const costGap = marketPick ? marketPick - rank : 0;
  const positiveTake = ["higher", "sleeper", "breakout", "value", "research"].includes(take);
  const negativeTake = ["lower", "bust"].includes(take);
  const isDiscount = marketPick && costGap >= 12;
  const isExpensive = marketPick && costGap <= -8;
  const contextText = context.toLowerCase();
  const roleSignal = /role|target|touch|snap|route|red zone|market share|workload|starter|volume/.test(contextText);
  const healthSignal = /injury|health|ankle|knee|hamstring|suspension|contract|holdout/.test(contextText);
  const fantasyLikes = value >= 76 || (rank <= 60 && risk <= 4);
  const fantasyCautious = risk >= 5 || /discount|risk|avoid|slide/i.test(row.Action || "");

  if (take === "news") {
    return {
      label: "Check The News",
      className: "watch",
      headline: healthSignal || roleSignal ? "This could matter." : "This is context, not a board change yet.",
      detail: `FantasyIQ has him #${rank}, ${row.Pos}${row["Pos Rank"]}, ${row["Pos Tier"] || row.Category}.`,
      rule: "Move him only if the news changes role, health, target share, or cost.",
    };
  }

  if (positiveTake && fantasyLikes && !isExpensive) {
    return {
      label: "They Agree",
      className: "good",
      headline: "Footballers are positive and FantasyIQ already likes him.",
      detail: `FantasyIQ rank #${rank}, value ${value}, risk ${risk}/10.`,
      rule: "Target him at normal FantasyIQ price. Do not jump into a higher tier just because of the take.",
    };
  }

  if (positiveTake && isExpensive) {
    return {
      label: "They Like Him More",
      className: "danger",
      headline: "The take is positive, but the price is ahead of FantasyIQ.",
      detail: `Expected cost is ${Math.abs(costGap)} picks earlier than FantasyIQ rank #${rank}.`,
      rule: "Do not chase. Draft him only if he falls back near FantasyIQ rank.",
    };
  }

  if (positiveTake) {
    return {
      label: fantasyCautious ? "Mixed Signal" : "Small Bump",
      className: fantasyCautious ? "watch" : "good",
      headline: fantasyCautious ? "They like him more than FantasyIQ does." : "The take supports the FantasyIQ profile.",
      detail: `FantasyIQ rank #${rank}, value ${value}, risk ${risk}/10.`,
      rule: fantasyCautious
        ? "Use the take as a tiebreaker only. Keep the FantasyIQ risk discount."
        : "You can prefer him over close players in the same tier.",
    };
  }

  if (negativeTake && fantasyCautious && !isDiscount) {
    return {
      label: "They Agree",
      className: "watch",
      headline: "Footballers are cautious and FantasyIQ also has some caution.",
      detail: `FantasyIQ rank #${rank}, value ${value}, risk ${risk}/10.`,
      rule: `Draft only if he falls beyond FantasyIQ rank. A fair target is pick ${rank + 10} or later.`,
    };
  }

  if (negativeTake) {
    return {
      label: fantasyLikes && !isDiscount ? "They Disagree" : "Discount Only",
      className: fantasyLikes && !isDiscount ? "watch" : "danger",
      headline: fantasyLikes ? "Footballers are lower, but FantasyIQ still likes the player." : "Footballers are lower and FantasyIQ does not give enough cushion.",
      detail: `FantasyIQ rank #${rank}, value ${value}, risk ${risk}/10.`,
      rule: fantasyLikes
        ? "Do not erase him. Lower confidence slightly and take him only at fair value or a discount."
        : "Fade at cost. Only consider if the room gives you a clear discount.",
    };
  }

  if (theirRank && Math.abs(rankGap) >= 18) {
    return {
      label: "Rank Gap",
      className: "watch",
      headline: rankGap < 0 ? "They rank him much higher than FantasyIQ." : "They rank him much lower than FantasyIQ.",
      detail: `Their rank differs by ${Math.abs(rankGap)} spots from FantasyIQ rank #${rank}.`,
      rule: "Treat this as a research flag, not an automatic board move.",
    };
  }

  if (isDiscount) {
    return {
      label: "FantasyIQ Value",
      className: "good",
      headline: "The cost is cheaper than FantasyIQ rank.",
      detail: `Expected cost is ${costGap} picks after FantasyIQ rank #${rank}.`,
      rule: "Draft at the discount if your roster build needs the position.",
    };
  }

  return {
    label: "No Edge",
    className: "neutral",
    headline: "The take does not clearly change the FantasyIQ view.",
    detail: `FantasyIQ rank #${rank}, value ${value}, risk ${risk}/10.`,
    rule: "Use FantasyIQ rank, projected PPR points, and draft cost as the guide.",
  };
}

function footballersTheirSummary(takeText, rankText, costText, context) {
  const parts = [takeText, rankText, costText];
  if (context) parts.push(context);
  return parts.filter(Boolean).join(". ");
}

function footballersFantasyIqSummary(row) {
  return {
    label: `#${row.Rank} overall, ${row.Pos}${row["Pos Rank"]}, ${row["Pos Tier"] || row.Category}`,
    detail: `Projected ${row["Proj PPR Pts"]} PPR points. Value ${row["Value Score"]}. Risk ${row.Risk}/10. Action: ${row.Action}`,
  };
}

function expectedPickFor(row) {
  return Number(row?.Rank || 999);
}

function gradePick(round, pick, row) {
  if (!row) return { label: "Unknown", detail: "Player not found on board." };
  const expected = expectedPickFor(row);
  const delta = expected - pick;
  if (delta >= 18) return { label: "Steal", detail: `${row.Player} was ${delta} board spots cheaper than rank.` };
  if (delta >= 6) return { label: "Good value", detail: `${row.Player} beat board rank by ${delta} spots.` };
  if (delta >= -8) return { label: "Fair", detail: `${row.Player} was close to board value.` };
  return { label: "Reach", detail: `${row.Player} was ${Math.abs(delta)} spots earlier than board rank.` };
}

function parseLines(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function renderMockPickGrades() {
  if (!mockPaste || !mockPickOutput) return;
  const lines = parseLines(mockPaste.value);
  if (!lines.length) {
    mockPickOutput.textContent = "Paste round, pick, player.";
    return;
  }
  const rows = lines.map((line) => {
    const parts = line.split(",").map((part) => part.trim());
    const round = Number(parts[0] || 0);
    const pick = Number(parts[1] || 0);
    const playerName = parts.slice(2).join(", ");
    const row = findPlayer(playerName);
    const grade = gradePick(round, pick, row);
    return { round, pick, playerName, row, grade };
  });
  const reaches = rows.filter((row) => row.grade.label === "Reach").length;
  const steals = rows.filter((row) => row.grade.label === "Steal").length;
  mockPickOutput.innerHTML = `
    <strong>${rows.length} picks graded: ${steals} steals, ${reaches} reaches.</strong>
    <div class="mini-table">
      ${rows
        .map(
          (item) => `<div>
            <span>R${item.round} P${item.pick}</span>
            <strong>${item.row?.Player || item.playerName}</strong>
            <em>${item.grade.label}</em>
            <small>${item.grade.detail}</small>
          </div>`,
        )
        .join("")}
    </div>
  `;
  localStorage.setItem("fantasy-dashboard:mock-picks", mockPaste.value);
}

function tradeSideValue(text) {
  return parseLines(text).map((name) => {
    const row = findPlayer(name);
    return {
      name,
      row,
      value: row ? Number(row["Value Score"] || 0) : 0,
    };
  });
}

function positionCounts(players) {
  const counts = {};
  players.forEach((item) => {
    if (!item.row) return;
    counts[item.row.Pos] = (counts[item.row.Pos] || 0) + 1;
  });
  return counts;
}

function renderTradeCalc() {
  if (!tradeOutput) return;
  const give = tradeSideValue(tradeGive?.value || "");
  const get = tradeSideValue(tradeGet?.value || "");
  const roster = tradeSideValue(tradeRoster?.value || "");
  const giveTotal = give.reduce((sum, item) => sum + item.value, 0);
  const getTotal = get.reduce((sum, item) => sum + item.value, 0);
  const net = getTotal - giveTotal;
  const giveCounts = positionCounts(give);
  const getCounts = positionCounts(get);
  const rosterCounts = positionCounts(roster);
  const unknowns = [...give, ...get].filter((item) => !item.row).map((item) => item.name);
  const verdict =
    net >= 8
      ? "Do it if roster fit checks out"
      : net >= 0
        ? "Fair, negotiate for a small sweetener"
        : net >= -6
          ? "Only do it for roster construction"
          : "Reject or counter";
  const rosterFit =
    roster.length === 0
      ? "Roster-fit module is waiting for your drafted roster."
      : `Roster context loaded: QB ${rosterCounts.QB || 0}, RB ${rosterCounts.RB || 0}, WR ${rosterCounts.WR || 0}, TE ${rosterCounts.TE || 0}.`;
  tradeOutput.innerHTML = `
    <strong>${verdict}</strong>
    <div class="analysis-grid">
      <div class="analysis-chip"><span>Value Getting</span><strong>${getTotal.toFixed(1)}</strong></div>
      <div class="analysis-chip"><span>Value Losing</span><strong>${giveTotal.toFixed(1)}</strong></div>
      <div class="analysis-chip"><span>Net Edge</span><strong>${net.toFixed(1)}</strong></div>
      <div class="analysis-chip"><span>Roster Fit</span><strong>${roster.length ? "Active" : "Pending"}</strong></div>
    </div>
    <p>${rosterFit}</p>
    <p><strong>Positions:</strong> Give RB ${giveCounts.RB || 0}, WR ${giveCounts.WR || 0}, TE ${giveCounts.TE || 0}, QB ${giveCounts.QB || 0}. Get RB ${getCounts.RB || 0}, WR ${getCounts.WR || 0}, TE ${getCounts.TE || 0}, QB ${getCounts.QB || 0}.</p>
    ${unknowns.length ? `<p><strong>Unknown players:</strong> ${unknowns.join(", ")}. Add or correct names from the board.</p>` : ""}
  `;
}

function formatSyncTime(iso) {
  if (!iso) return "Pending";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Pending";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function pickBoardRow(pick) {
  return pick?.player ? findPlayer(pick.player) : null;
}

function valueForPick(pick) {
  const row = pickBoardRow(pick);
  if (!row) return { label: "Off board", detail: "No board match yet.", row: null };
  const grade = gradePick(pick.round || 0, pick.overall || 0, row);
  return { ...grade, row };
}

function rosterCountsFor(teamId) {
  const counts = { QB: 0, RB: 0, WR: 0, TE: 0, DST: 0, K: 0 };
  const picks = (liveDraft?.picks || []).filter((pick) => String(pick.teamId) === String(teamId) && pick.status === "drafted");
  picks.forEach((pick) => {
    const row = pickBoardRow(pick);
    const pos = row?.Pos || pick.pos;
    if (counts[pos] !== undefined) counts[pos] += 1;
  });
  return { counts, picks };
}

function selectedTeamId() {
  return myTeamSelect?.value || "";
}

function currentRound() {
  return Number(liveDraft?.currentPick?.round || Math.floor((liveDraft?.completedPicks || 0) / 12) + 1);
}

function currentOverallPick() {
  return Number(liveDraft?.currentPick?.overall || (liveDraft?.completedPicks || 0) + 1);
}

function starterTargetCounts() {
  return { QB: 1, RB: 2, WR: 2, TE: 1, DST: 1, K: 1 };
}

function draftTargetCounts() {
  return { QB: 1, RB: 5, WR: 6, TE: 1, DST: 1, K: 1 };
}

function pendingPicksForTeam(teamId) {
  if (!teamId) return [];
  return (liveDraft?.picks || [])
    .filter((pick) => String(pick.teamId) === String(teamId) && pick.status !== "drafted")
    .sort((a, b) => Number(a.overall || 999) - Number(b.overall || 999));
}

function nextMyPick(teamId = selectedTeamId()) {
  return pendingPicksForTeam(teamId)[0] || null;
}

function recommendationTargetPick(teamId = selectedTeamId()) {
  const upcoming = pendingPicksForTeam(teamId);
  if (!upcoming.length) return null;
  const current = currentOverallPick();
  if (Number(upcoming[0].overall || 0) <= current && upcoming[1]) {
    return upcoming[1];
  }
  return upcoming[0];
}

function picksUntil(pick) {
  if (!pick) return null;
  return Math.max(0, Number(pick.overall || 0) - currentOverallPick());
}

function topAvailableByPosition(pos) {
  return availableRows().filter((row) => row.Pos === pos).sort((a, b) => Number(a.Rank) - Number(b.Rank));
}

function topTierInfo(pos) {
  const rows = topAvailableByPosition(pos);
  if (!rows.length) return { pos, tier: "Empty", count: 0, rows: [] };
  const tier = rows[0]["Pos Tier"] || rows[0].Category || "Top tier";
  const tierRows = rows.filter((row) => (row["Pos Tier"] || row.Category) === tier);
  return { pos, tier, count: tierRows.length, rows: tierRows };
}

function recentDraftedPicks(limit = 12) {
  return (liveDraft?.picks || [])
    .filter((pick) => pick.status === "drafted")
    .sort((a, b) => Number(b.overall || 0) - Number(a.overall || 0))
    .slice(0, limit);
}

function recentPositionCounts(limit = 12) {
  const counts = {};
  recentDraftedPicks(limit).forEach((pick) => {
    const row = pickBoardRow(pick);
    const pos = row?.Pos || pick.pos || "UNK";
    counts[pos] = (counts[pos] || 0) + 1;
  });
  return counts;
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function survivalProjection(row, targetPick = nextMyPick()) {
  if (!row || !targetPick) {
    return { pct: 0, label: "Select team", className: "neutral", detail: "Choose your ESPN team for survival odds." };
  }
  const until = picksUntil(targetPick);
  if (until === 0) {
    return { pct: 5, label: "On clock", className: "danger", detail: "You are on the clock. Waiting means passing on this player." };
  }
  const boardRank = Number(row.Rank || 999);
  const targetOverall = Number(targetPick.overall || 999);
  const gap = boardRank - targetOverall;
  let pct = 50 + gap * 5;
  const recentCounts = recentPositionCounts(10);
  const tier = topTierInfo(row.Pos);

  if ((recentCounts[row.Pos] || 0) >= 4) pct -= 16;
  if (tier.count <= 2 && (row["Pos Tier"] || row.Category) === tier.tier) pct -= 16;
  if (["DST", "K"].includes(row.Pos) && currentRound() < 14) pct += 22;
  if (Number(row.Risk || 0) >= 6 && currentRound() <= 8) pct += 5;

  pct = Math.round(clampNumber(pct, 5, 95));
  const label = pct < 30 ? "Unlikely" : pct < 50 ? "Danger" : pct < 70 ? "Coin flip" : "Likely";
  const className = pct < 40 ? "danger" : pct < 70 ? "watch" : "good";
  return {
    pct,
    label,
    className,
    detail: `${until} picks until you are up at overall ${targetPick.overall}.`,
  };
}

function rosterNeed(row, counts) {
  const starters = starterTargetCounts();
  const targets = draftTargetCounts();
  if (counts[row.Pos] < starters[row.Pos]) return "starter";
  if (counts[row.Pos] < targets[row.Pos]) return "depth";
  return "luxury";
}

function positionClosed(row, counts) {
  if (!row) return false;
  if (row.Pos === "QB" && counts.QB >= 1) return true;
  if (row.Pos === "TE" && counts.TE >= 1) return true;
  if (row.Pos === "DST" && counts.DST >= 1) return true;
  if (row.Pos === "K" && counts.K >= 1) return true;
  return false;
}

function recommendationDecision(row, counts) {
  const round = currentRound();
  const targetPick = recommendationTargetPick();
  const survival = survivalProjection(row, targetPick);
  const need = rosterNeed(row, counts);

  if (!targetPick) {
    return { label: "Board value", className: "target", survival, reason: recommendationReason(row, counts) };
  }

  if (positionClosed(row, counts)) {
    return { label: "Avoid", className: "wait", survival, reason: `You already filled ${row.Pos}. Use bench spots on RB/WR upside instead.` };
  }
  if (["DST", "K"].includes(row.Pos) && round < 14) {
    return { label: "Wait", className: "wait", survival, reason: "K/DST are final-round tools unless the draft is already late." };
  }
  if (need === "starter" && survival.pct < 65) {
    return { label: "Pick now", className: "smash", survival, reason: `${row.Pos} starter slot is still open and this player may not return.` };
  }
  if (survival.pct < 35) {
    return { label: "Pick now", className: "smash", survival, reason: "Likely gone before your next pick." };
  }
  if (need === "luxury" && survival.pct > 50) {
    return { label: "Can wait", className: "wait", survival, reason: "Roster need is lower here; use this as a tiebreaker only." };
  }
  if (Number(row.Risk || 0) >= 6 && round <= 8) {
    return { label: "Controlled risk", className: "watch", survival, reason: "Upside is real, but this is still foundation territory." };
  }
  if (survival.pct >= 70) {
    return { label: "Can wait", className: "wait", survival, reason: "Good chance he survives. Prefer a scarcer tier if one exists." };
  }
  return { label: "Target", className: "target", survival, reason: recommendationReason(row, counts) };
}

function adjustedRecommendationScore(row, counts) {
  const round = currentRound();
  const decision = recommendationDecision(row, counts);
  const rank = Number(row.Rank || 999);
  const value = Number(row["Value Score"] || 0);
  const hasTeamContext = Boolean(selectedTeamId());
  let score = 2000 - rank * 5 + value * 0.5;

  if (!hasTeamContext) {
    return 2000 - rank * 10 + value * 0.1;
  }

  if (positionClosed(row, counts)) score -= 900;

  if (row.Pos === "RB" && counts.RB < 2) score += 90;
  if (row.Pos === "WR" && counts.WR < 2) score += 90;
  if (row.Pos === "RB" && counts.RB >= 2 && counts.RB < 5) score += 28;
  if (row.Pos === "WR" && counts.WR >= 2 && counts.WR < 6) score += 28;
  if (row.Pos === "RB" && counts.RB < 4 && round >= 8) score += 60;
  if (row.Pos === "WR" && counts.WR < 5 && round >= 8) score += 50;
  if (row.Pos === "RB" && counts.RB < 4 && round >= 10) score += 180;
  if (row.Pos !== "RB" && counts.RB < 4 && round >= 12 && round < 15) score -= 260;
  if (row.Pos === "TE" && counts.TE < 1 && round >= 3) score += 35;
  if (row.Pos === "QB" && counts.QB < 1 && round >= 5) score += 42;

  if (row.Pos === "QB" && counts.QB >= 1) score -= 220;
  if (row.Pos === "TE" && counts.TE >= 1) score -= 180;
  if (row.Pos === "QB" && round < 5) score -= 65;
  if (row.Pos === "TE" && round < 3) score -= 30;
  if (["DST", "K"].includes(row.Pos) && round < 14) score -= 320;
  if (row.Pos === "DST" && counts.DST < 1 && round >= 15) score += 620;
  if (row.Pos === "K" && counts.K < 1 && round >= 16) score += 720;
  if (row.Pos === "K" && counts.K < 1 && counts.DST >= 1 && round >= 15) score += 260;
  if (row.Pos !== "DST" && counts.DST < 1 && round >= 15) score -= 180;
  if (row.Pos !== "K" && counts.K < 1 && round >= 16) score -= 260;
  if (Number(row.Risk || 0) >= 6 && round <= 8) score -= 18;
  if (decision.survival.pct < 20) score += 80;
  else if (decision.survival.pct < 35) score += 45;
  if (decision.survival.pct >= 75) score -= 28;
  if (decision.label === "Pick now") score += 38;
  if (decision.label === "Wait") score -= 34;
  if (topTierInfo(row.Pos).count <= 2 && !["DST", "K"].includes(row.Pos)) score += 24;
  return score;
}

function recommendationReason(row, counts) {
  if (["DST", "K"].includes(row.Pos) && currentRound() < 14) return "Late only. Keep loading RB/WR upside first.";
  if (row.Pos === "DST" && counts.DST < 1 && currentRound() >= 15) return "Roster requirement. Take the best DST left.";
  if (row.Pos === "K" && counts.K < 1 && currentRound() >= 16) return "Roster requirement. Kicker should be last.";
  if (row.Pos === "RB" && counts.RB < 2) return "Fills a starting RB slot.";
  if (row.Pos === "WR" && counts.WR < 2) return "Fills a starting WR slot.";
  if (row.Pos === "TE" && counts.TE < 1) return "Fills TE if value is real.";
  if (row.Pos === "QB" && counts.QB < 1) return "QB value window if the board falls this way.";
  if (["RB", "WR", "TE"].includes(row.Pos)) return "Best available FLEX/bench value.";
  return "Depth or late-round utility.";
}

function availableRows() {
  if (!boardData) return [];
  const drafted = liveDraftedKeys();
  return (boardData.boards?.combined?.rows || []).filter((row) => !drafted.has(normalizePlayerName(row.Player)));
}

function positionMatches(row, pos) {
  if (!pos) return true;
  if (pos === "FLEX") return ["RB", "WR", "TE"].includes(row.Pos);
  return row.Pos === pos;
}

function tierLabel(row, pos) {
  const tier = row["Pos Tier"] || row.Category || "Tier";
  return pos === "FLEX" && row.Pos ? `${row.Pos} / ${tier}` : tier;
}

function renderTierDivider(label, count) {
  return `<div class="tier-divider">
    <span>${htmlEscape(label)}</span>
    <small>${count} left</small>
  </div>`;
}

function renderTierPlayerRow(row, options = {}) {
  const action = options.showDraftButton
    ? `<button type="button" ${options.canDraft ? "" : "disabled"} data-sim-player="${normalizePlayerName(row.Player)}">Draft</button>`
    : "";
  const projection = row["Proj PPR Pts"] ?? "TBD";
  return `<div class="sim-player-row tier-player-row">
    <div>
      <strong>${htmlEscape(row.Player)}</strong>
      <small>#${row.Rank} / ${row.Pos} / ${row.Team} / ${projection} PPR / ${htmlEscape(row["Pos Tier"] || row.Category)}</small>
    </div>
    ${action}
  </div>`;
}

function renderTieredRows(rows, pos, options = {}) {
  if (!rows.length) return `<p>${options.emptyMessage || "No players match this search/filter."}</p>`;
  const showDividers = Boolean(pos);
  if (!showDividers) {
    return rows.map((row) => renderTierPlayerRow(row, options)).join("");
  }
  const tierCounts = rows.reduce((counts, row) => {
    const key = tierLabel(row, pos);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  let lastTier = "";
  return rows
    .map((row) => {
      const label = tierLabel(row, pos);
      const divider = label !== lastTier ? renderTierDivider(label, tierCounts[label]) : "";
      lastTier = label;
      return `${divider}${renderTierPlayerRow(row, options)}`;
    })
    .join("");
}

function renderRecommendationCard(row, counts, index = 0) {
  const decision = recommendationDecision(row, counts);
  const priority = decision.label === "Pick now" || index < 3 ? "priority" : "";
  const survivalText = decision.survival.label === "Select team" ? "team needed" : `${decision.survival.pct}% back`;
  return `<div class="pick-card recommendation ${priority} ${decision.className}">
    <span>#${row.Rank} / ${row.Pos} / ${row.Team}</span>
    <strong>${row.Player}</strong>
    <div class="rec-meta">
      <em>${decision.label}</em>
      <b class="${decision.survival.className}">${survivalText}</b>
      <b>${row["Pos Tier"] || row.Category}</b>
    </div>
    <small>${decision.reason} Proj PPR: ${row["Proj PPR Pts"]}. Value: ${row["Value Score"]}. ${decision.survival.detail}</small>
  </div>`;
}

function avoidRows(counts) {
  return availableRows()
    .filter((row) => {
      if (positionClosed(row, counts)) return true;
      if (["DST", "K"].includes(row.Pos) && currentRound() < 14) return true;
      if (Number(row.Risk || 0) >= 7 && currentRound() <= 8) return true;
      return rosterNeed(row, counts) === "luxury" && ["QB", "TE"].includes(row.Pos);
    })
    .sort((a, b) => Number(a.Rank) - Number(b.Rank))
    .slice(0, 3);
}

function renderRecommendations() {
  if (!liveRecommendations) return;
  if (!boardData) {
    liveRecommendations.textContent = "Waiting for board data.";
    return;
  }
  const teamId = selectedTeamId();
  const { counts } = teamId ? rosterCountsFor(teamId) : { counts: { QB: 0, RB: 0, WR: 0, TE: 0, DST: 0, K: 0 } };
  const ranked = availableRows()
    .map((row) => ({ row, score: adjustedRecommendationScore(row, counts) }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.row);
  const pickNow = teamId
    ? ranked.filter((row) => !["Wait", "Can wait", "Avoid"].includes(recommendationDecision(row, counts).label)).slice(0, 5)
    : ranked.slice(0, 5);
  const waitList = teamId
    ? ranked.filter((row) => recommendationDecision(row, counts).label === "Can wait").slice(0, 3)
    : [];
  const avoids = teamId ? avoidRows(counts) : [];

  liveRecommendations.innerHTML = `
    <div class="recommendation-block">
      <h4>${teamId ? "Pick Now" : "Best Board Values"}</h4>
      ${pickNow.length ? pickNow.map((row, index) => renderRecommendationCard(row, counts, index)).join("") : "<p>No urgent pick yet. Let the room make the first mistake.</p>"}
    </div>
    <div class="recommendation-block">
      <h4>Can Wait</h4>
      ${waitList.length ? waitList.map((row) => renderRecommendationCard(row, counts)).join("") : "<p>Not enough separation yet for a confident wait list.</p>"}
    </div>
    <div class="recommendation-block compact-block">
      <h4>Avoid Under Clock</h4>
      ${avoids.length ? avoids.map((row) => renderRecommendationCard(row, counts)).join("") : "<p>No major avoid flags from roster/round logic.</p>"}
    </div>
  `;
}

function activeLiveTierPosition() {
  return Array.from(liveTierButtons).find((button) => button.classList.contains("active"))?.dataset.liveTierPos || "";
}

function renderLiveTierBoard() {
  if (!liveTierBoard) return;
  if (!boardData) {
    liveTierBoard.textContent = "Waiting for board data.";
    return;
  }
  const query = (liveTierSearch?.value || "").trim().toLowerCase();
  const pos = activeLiveTierPosition();
  const rows = availableRows()
    .filter((row) => positionMatches(row, pos))
    .filter((row) => !query || `${row.Player} ${row.Pos} ${row.Team} ${row.Action} ${row["Pos Tier"] || ""}`.toLowerCase().includes(query))
    .sort((a, b) => Number(a.Rank) - Number(b.Rank))
    .slice(0, pos ? 120 : 50);
  liveTierBoard.innerHTML = renderTieredRows(rows, pos, {
    emptyMessage: "No available players match this position/search.",
  });
}

function renderTeamOptions() {
  if (!myTeamSelect || !liveDraft?.teams) return;
  const saved = localStorage.getItem("fantasy-dashboard:my-team") || myTeamSelect.value;
  myTeamSelect.innerHTML = `<option value="">Choose your team</option>${liveDraft.teams
    .map((team) => `<option value="${team.teamId}">${team.teamName}${team.manager ? ` (${team.manager})` : ""}</option>`)
    .join("")}`;
  if (saved) myTeamSelect.value = saved;
}

function renderPickCards(container, picks, emptyMessage) {
  if (!container) return;
  if (!picks?.length) {
    container.textContent = emptyMessage;
    return;
  }
  container.innerHTML = picks
    .map((pick) => {
      const value = pick.status === "drafted" ? valueForPick(pick) : null;
      const playerText = pick.player || "Pending";
      const valueLabel = value ? `<em>${value.label}</em>` : `<em>Upcoming</em>`;
      const detail = value?.row
        ? `${value.row.Pos} / ${value.row.Team} / board rank ${value.row.Rank}`
        : pick.status === "drafted"
          ? "No board match yet."
          : `${pick.fantasyTeam} is queued here.`;
      return `<div class="pick-card ${pick.status === "drafted" ? "made" : ""}">
        <span>R${pick.round} P${pick.roundPick} / Overall ${pick.overall}</span>
        <strong>${playerText}</strong>
        ${valueLabel}
        <small>${pick.fantasyTeam}${pick.manager ? ` / ${pick.manager}` : ""}. ${detail}</small>
      </div>`;
    })
    .join("");
}

function renderMyRoster() {
  if (!liveMyRoster) return;
  const teamId = selectedTeamId();
  if (!teamId) {
    liveMyRoster.textContent = "Select your ESPN team after the order appears.";
    return;
  }
  const { counts, picks } = rosterCountsFor(teamId);
  if (!picks.length) {
    liveMyRoster.innerHTML = `
      <div class="roster-counts">
        <span>QB ${counts.QB}</span><span>RB ${counts.RB}</span><span>WR ${counts.WR}</span><span>TE ${counts.TE}</span><span>DST ${counts.DST}</span><span>K ${counts.K}</span>
      </div>
      <p>No picks for your team yet.</p>
    `;
    return;
  }
  liveMyRoster.innerHTML = `
    <div class="roster-counts">
      <span>QB ${counts.QB}</span><span>RB ${counts.RB}</span><span>WR ${counts.WR}</span><span>TE ${counts.TE}</span><span>DST ${counts.DST}</span><span>K ${counts.K}</span>
    </div>
    ${picks
      .map((pick) => {
        const row = pickBoardRow(pick);
        return `<div class="pick-card made">
          <span>R${pick.round} P${pick.roundPick}</span>
          <strong>${pick.player}</strong>
          <em>${row?.Pos || pick.pos || "Player"}</em>
          <small>${row ? `Board rank ${row.Rank}. ${row.Action}` : "No board match yet."}</small>
        </div>`;
      })
      .join("")}
  `;
}

function renderNextPickRadar() {
  if (!nextPickRadar) return;
  if (!boardData) {
    nextPickRadar.textContent = "Waiting for board data.";
    return;
  }
  const teamId = selectedTeamId();
  if (!teamId) {
    nextPickRadar.textContent = "Select your ESPN team to unlock live survival odds.";
    return;
  }
  const upcoming = pendingPicksForTeam(teamId);
  const next = upcoming[0];
  if (!next) {
    nextPickRadar.innerHTML = `<div class="intel-card good"><strong>Draft complete</strong><small>No remaining picks for your team.</small></div>`;
    return;
  }
  const until = picksUntil(next);
  const returnPick = upcoming[1];
  const danger = availableRows()
    .filter((row) => !["DST", "K"].includes(row.Pos))
    .map((row) => ({ row, survival: survivalProjection(row, next) }))
    .filter((item) => item.survival.pct < 45)
    .sort((a, b) => Number(a.row.Rank) - Number(b.row.Rank))
    .slice(0, 5);
  const wait = availableRows()
    .filter((row) => !["DST", "K"].includes(row.Pos))
    .map((row) => ({ row, survival: survivalProjection(row, next) }))
    .filter((item) => item.survival.pct >= 72 && Number(item.row.Rank || 999) < Number(next.overall || 999) + 45)
    .sort((a, b) => Number(a.row.Rank) - Number(b.row.Rank))
    .slice(0, 3);

  nextPickRadar.innerHTML = `
    <div class="intel-card ${until === 0 ? "danger" : until <= 3 ? "watch" : "good"}">
      <strong>${until === 0 ? "You are on the clock" : `${until} picks until you`}</strong>
      <small>Next pick: Round ${next.round}, Pick ${next.roundPick}, Overall ${next.overall}.${returnPick ? ` Return pick: Overall ${returnPick.overall}.` : ""}</small>
    </div>
    <div class="intel-subgrid">
      <div>
        <h4>Likely Gone</h4>
        ${danger.length ? danger.map((item) => `<span>${item.row.Player} <b>${item.survival.pct}%</b></span>`).join("") : "<p>No urgent survival threats yet.</p>"}
      </div>
      <div>
        <h4>Can Wait</h4>
        ${wait.length ? wait.map((item) => `<span>${item.row.Player} <b>${item.survival.pct}%</b></span>`).join("") : "<p>No clean wait candidates yet.</p>"}
      </div>
    </div>
  `;
}

function renderTierAlerts() {
  if (!tierAlerts) return;
  if (!boardData) {
    tierAlerts.textContent = "Waiting for board data.";
    return;
  }
  const positions = ["RB", "WR", "TE", "QB"];
  const cards = positions.map((pos) => {
    const info = topTierInfo(pos);
    const severity = info.count <= 2 ? "danger" : info.count <= 4 ? "watch" : "good";
    const names = info.rows.slice(0, 3).map((row) => row.Player).join(", ") || "No players left";
    const message =
      info.count <= 2
        ? `Hard cliff. Only ${info.count} left in ${info.tier}.`
        : info.count <= 4
          ? `Watch this tier. ${info.count} left in ${info.tier}.`
          : `${info.count} left in the current ${pos} tier.`;
    return `<div class="intel-card ${severity}">
      <strong>${pos}: ${message}</strong>
      <small>${names}</small>
    </div>`;
  });
  const flexRows = availableRows().filter((row) => ["RB", "WR", "TE"].includes(row.Pos)).slice(0, 12);
  const flexMix = flexRows.reduce((counts, row) => {
    counts[row.Pos] = (counts[row.Pos] || 0) + 1;
    return counts;
  }, {});
  cards.push(`<div class="intel-card ${flexRows.length < 8 ? "watch" : "good"}">
    <strong>FLEX pool: RB ${flexMix.RB || 0}, WR ${flexMix.WR || 0}, TE ${flexMix.TE || 0}</strong>
    <small>Top 12 skill-position players left. Use this to avoid chasing a fake run.</small>
  </div>`);
  tierAlerts.innerHTML = cards.join("");
}

function renderRoomDetector() {
  if (!roomDetector) return;
  const recent = recentDraftedPicks(12);
  if (!recent.length) {
    roomDetector.innerHTML = `<div class="intel-card good"><strong>No run yet</strong><small>ESPN has not recorded any picks. Once the room starts drafting, this will spot panic pockets.</small></div>`;
    return;
  }
  const counts = recentPositionCounts(12);
  const leaders = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [runPos, runCount] = leaders[0] || ["UNK", 0];
  const grades = recent.map((pick) => valueForPick(pick).label);
  const reaches = grades.filter((label) => label === "Reach").length;
  const steals = grades.filter((label) => label === "Steal" || label === "Good value").length;
  const severity = runCount >= 5 ? "danger" : runCount >= 3 ? "watch" : "good";
  const runCopy =
    runCount >= 5
      ? `${runPos} run is hot: ${runCount} of last ${recent.length}.`
      : runCount >= 3
        ? `${runPos} pressure is building: ${runCount} of last ${recent.length}.`
        : "Room is balanced so far.";
  const exploit =
    ["QB", "TE", "DST", "K"].includes(runPos) && currentRound() < 10
      ? "Exploit it by taking falling RB/WR value unless your tier cliff says otherwise."
      : runCount >= 3
        ? "Trust the tier board. React only if your starter slot or top tier is actually drying up."
        : "Keep taking value. No panic adjustment needed.";
  roomDetector.innerHTML = `
    <div class="intel-card ${severity}">
      <strong>${runCopy}</strong>
      <small>${exploit}</small>
    </div>
    <div class="intel-subgrid">
      <div><h4>Last 12</h4>${leaders.map(([pos, count]) => `<span>${pos} <b>${count}</b></span>`).join("")}</div>
      <div><h4>Value Signal</h4><span>Reaches <b>${reaches}</b></span><span>Values/steals <b>${steals}</b></span></div>
    </div>
  `;
}

function renderRiskMeter() {
  if (!riskMeter) return;
  const teamId = selectedTeamId();
  if (!teamId) {
    riskMeter.textContent = "Select your ESPN team after the order appears.";
    return;
  }
  const { counts, picks } = rosterCountsFor(teamId);
  const rows = picks.map((pick) => pickBoardRow(pick)).filter(Boolean);
  if (!rows.length) {
    riskMeter.innerHTML = `
      <div class="intel-card good">
        <strong>Baseline plan</strong>
        <small>Golden zone means stable early foundation, then 2-4 upside swings after your starters are protected.</small>
      </div>
    `;
    return;
  }
  const avgRisk = rows.reduce((sum, row) => sum + Number(row.Risk || 0), 0) / rows.length;
  const highRisk = rows.filter((row) => Number(row.Risk || 0) >= 5).length;
  const totalProj = rows.reduce((sum, row) => sum + Number(row["Proj PPR Pts"] || 0), 0);
  const rbWrCount = (counts.RB || 0) + (counts.WR || 0);
  const round = currentRound();
  const warnings = [];

  if (round >= 6 && rbWrCount < 4) warnings.push("RB/WR base is behind pace.");
  if (counts.QB > 1) warnings.push("Backup QB is blocking upside depth.");
  if (counts.TE > 1 && round < 12) warnings.push("Second TE needs a strong reason.");
  if (counts.DST > 0 && round < 14) warnings.push("DST was earlier than preferred.");
  if (counts.K > 0 && round < 16) warnings.push("Kicker should usually be last.");

  const state =
    avgRisk >= 5 || highRisk >= Math.ceil(rows.length / 2)
      ? { label: "Too spicy", className: "danger" }
      : avgRisk <= 2.5 && rows.length >= 5
        ? { label: "Too safe", className: "watch" }
        : { label: "Golden zone", className: "good" };

  riskMeter.innerHTML = `
    <div class="intel-card ${state.className}">
      <strong>${state.label}</strong>
      <small>Average risk ${avgRisk.toFixed(1)}/10. High-risk picks ${highRisk}/${rows.length}. Projected PPR ${totalProj.toFixed(1)}.</small>
    </div>
    <div class="intel-subgrid">
      <div><h4>Build</h4><span>RB/WR <b>${rbWrCount}</b></span><span>QB <b>${counts.QB || 0}</b></span><span>TE <b>${counts.TE || 0}</b></span></div>
      <div><h4>Warnings</h4>${warnings.length ? warnings.map((item) => `<span>${item}</span>`).join("") : "<p>No roster-shape warnings.</p>"}</div>
    </div>
  `;
}

function renderDraftOrder() {
  if (!draftOrderGrid) return;
  const order = liveDraft?.draftOrder || [];
  if (!order.length) {
    draftOrderGrid.textContent = "Waiting for ESPN to publish the draft order.";
    return;
  }
  draftOrderGrid.innerHTML = order
    .map(
      (pick) => `<div>
        <strong>${pick.roundPick}</strong>
        <span>${pick.fantasyTeam}</span>
        <small>${pick.manager || "Manager TBD"}</small>
      </div>`,
    )
    .join("");
}

function renderLiveDraft() {
  if (!liveStatus) return;
  if (!liveDraft) {
    liveStatus.textContent = "Connecting to ESPN public draft sync...";
    return;
  }

  renderTeamOptions();
  applyEspnLeagueBranding();
  const current = liveDraft.currentPick;
  const completed = Number(liveDraft.completedPicks || 0);
  const total = Number(liveDraft.totalPicks || 0);
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const stale = liveDraft.staleError ? ` Stale fallback shown because ESPN sync errored: ${liveDraft.staleError}` : "";
  const state = liveDraft.inProgress ? "Draft live" : liveDraft.drafted ? "Draft complete" : "Draft board loaded";

  liveStatus.innerHTML = `<strong>${state}</strong>: ${completed}/${total || 192} picks completed. Auto sync checks ESPN every ${LIVE_SYNC_INTERVAL_MS / 1000} seconds.${stale}`;
  if (liveSyncStatus) liveSyncStatus.textContent = liveDraft.inProgress ? "Draft live" : "ESPN connected";
  if (liveCurrentPick) {
    liveCurrentPick.textContent = current ? `Round ${current.round}, Pick ${current.roundPick}` : "Draft complete";
  }
  if (liveCurrentTeam) {
    liveCurrentTeam.textContent = current
      ? `Overall ${current.overall}: ${current.fantasyTeam}${current.manager ? ` / ${current.manager}` : ""}`
      : "All picks are complete.";
  }
  if (liveCompleted) liveCompleted.textContent = String(completed);
  if (liveTotal) liveTotal.textContent = `of ${total || 192}`;
  if (liveProgressBar) liveProgressBar.style.width = `${pct}%`;
  if (liveLastSync) liveLastSync.textContent = formatSyncTime(liveDraft.syncedAt);
  if (liveSource) liveSource.textContent = liveDraft.source || "ESPN public league API";

  renderRecommendations();
  renderMyRoster();
  renderNextPickRadar();
  renderTierAlerts();
  renderRoomDetector();
  renderRiskMeter();
  renderPickCards(liveRecentPicks, liveDraft.recentPicks, "No picks have been made yet.");
  renderPickCards(liveNextPicks, liveDraft.nextPicks, "No upcoming picks found.");
  renderLiveTierBoard();
  renderDraftOrder();
  renderBoard();
}

function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function emptyPositionCounts() {
  return { QB: 0, RB: 0, WR: 0, TE: 0, DST: 0, K: 0 };
}

function simRound(overall = mockSim?.currentOverall || 1) {
  return Math.floor((Number(overall) - 1) / 12) + 1;
}

function simSlotFromOverall(overall) {
  const round = simRound(overall);
  const pickInRound = ((Number(overall) - 1) % 12) + 1;
  return round % 2 === 1 ? pickInRound : 13 - pickInRound;
}

function simRoundPick(overall) {
  return ((Number(overall) - 1) % 12) + 1;
}

function simTeam(slot) {
  return mockSim?.teams?.[slot];
}

function simAvailableRows() {
  if (!boardData || !mockSim) return [];
  return (boardData.boards?.combined?.rows || []).filter((row) => !mockSim.drafted.has(normalizePlayerName(row.Player)));
}

function simRecentPicks(limit = 12) {
  return (mockSim?.picks || []).slice(-limit).reverse();
}

function simRecentPositionCounts(limit = 10) {
  const counts = {};
  simRecentPicks(limit).forEach((pick) => {
    counts[pick.row.Pos] = (counts[pick.row.Pos] || 0) + 1;
  });
  return counts;
}

function simFutureUserPicks() {
  if (!mockSim) return [];
  const picks = [];
  for (let overall = mockSim.currentOverall; overall <= 192; overall += 1) {
    if (simSlotFromOverall(overall) === mockSim.userSlot) {
      picks.push(overall);
    }
  }
  return picks;
}

function simRecommendationTargetOverall() {
  const upcoming = simFutureUserPicks();
  if (!upcoming.length) return null;
  if (upcoming[0] === mockSim.currentOverall && upcoming[1]) return upcoming[1];
  return upcoming[0];
}

function simTopTierInfo(pos) {
  const rows = simAvailableRows().filter((row) => row.Pos === pos).sort((a, b) => Number(a.Rank) - Number(b.Rank));
  if (!rows.length) return { pos, tier: "Empty", count: 0, rows: [] };
  const tier = rows[0]["Pos Tier"] || rows[0].Category || "Top tier";
  const tierRows = rows.filter((row) => (row["Pos Tier"] || row.Category) === tier);
  return { pos, tier, count: tierRows.length, rows: tierRows };
}

function simSurvivalProjection(row, targetOverall = simRecommendationTargetOverall()) {
  if (!row || !targetOverall || !mockSim) {
    return { pct: 0, label: "No turn", className: "neutral", detail: "Start a mock to unlock survival odds." };
  }
  if (targetOverall <= mockSim.currentOverall) {
    return { pct: 5, label: "On clock", className: "danger", detail: "You are on the clock." };
  }
  const gap = Number(row.Rank || 999) - Number(targetOverall || 999);
  let pct = 50 + gap * 5;
  const recentCounts = simRecentPositionCounts(10);
  const tier = simTopTierInfo(row.Pos);

  if ((recentCounts[row.Pos] || 0) >= 4) pct -= 16;
  if (tier.count <= 2 && (row["Pos Tier"] || row.Category) === tier.tier) pct -= 16;
  if (["DST", "K"].includes(row.Pos) && simRound() < 14) pct += 22;
  if (Number(row.Risk || 0) >= 6 && simRound() <= 8) pct += 5;

  pct = Math.round(clampNumber(pct, 5, 95));
  const label = pct < 30 ? "Unlikely" : pct < 50 ? "Danger" : pct < 70 ? "Coin flip" : "Likely";
  const className = pct < 40 ? "danger" : pct < 70 ? "watch" : "good";
  return {
    pct,
    label,
    className,
    detail: `${Math.max(0, targetOverall - mockSim.currentOverall)} picks until your next turn at overall ${targetOverall}.`,
  };
}

function simDecision(row, counts) {
  const round = simRound();
  const survival = simSurvivalProjection(row);
  const need = rosterNeed(row, counts);

  if (positionClosed(row, counts)) {
    return { label: "Avoid", className: "wait", survival, reason: `You already filled ${row.Pos}. Practice discipline and take RB/WR upside.` };
  }
  if (["DST", "K"].includes(row.Pos) && round < 14) {
    return { label: "Wait", className: "wait", survival, reason: "K/DST are final-round tools." };
  }
  if (need === "starter" && survival.pct < 65) {
    return { label: "Pick now", className: "smash", survival, reason: `${row.Pos} starter slot is open and he may not return.` };
  }
  if (survival.pct < 35) {
    return { label: "Pick now", className: "smash", survival, reason: "Likely gone before your next turn." };
  }
  if (need === "luxury" && survival.pct > 50) {
    return { label: "Can wait", className: "wait", survival, reason: "Lower roster need. Use only as a tiebreaker." };
  }
  if (Number(row.Risk || 0) >= 6 && round <= 8) {
    return { label: "Controlled risk", className: "watch", survival, reason: "Upside is real, but protect your foundation." };
  }
  if (survival.pct >= 70) {
    return { label: "Can wait", className: "wait", survival, reason: "Good chance he survives to your next turn." };
  }
  return { label: "Target", className: "target", survival, reason: recommendationReason(row, counts) };
}

function simRecommendationScore(row, counts) {
  const round = simRound();
  const decision = simDecision(row, counts);
  const rank = Number(row.Rank || 999);
  const value = Number(row["Value Score"] || 0);
  let score = 2000 - rank * 5 + value * 0.5;

  if (positionClosed(row, counts)) score -= 900;
  if (row.Pos === "RB" && counts.RB < 2) score += 90;
  if (row.Pos === "WR" && counts.WR < 2) score += 90;
  if (row.Pos === "RB" && counts.RB >= 2 && counts.RB < 5) score += 28;
  if (row.Pos === "WR" && counts.WR >= 2 && counts.WR < 6) score += 28;
  if (row.Pos === "RB" && counts.RB < 4 && round >= 8) score += 60;
  if (row.Pos === "WR" && counts.WR < 5 && round >= 8) score += 50;
  if (row.Pos === "RB" && counts.RB < 4 && round >= 10) score += 180;
  if (row.Pos !== "RB" && counts.RB < 4 && round >= 12 && round < 15) score -= 260;
  if (row.Pos === "TE" && counts.TE < 1 && round >= 3) score += 35;
  if (row.Pos === "QB" && counts.QB < 1 && round >= 5) score += 42;
  if (row.Pos === "QB" && counts.QB >= 1) score -= 220;
  if (row.Pos === "TE" && counts.TE >= 1) score -= 180;
  if (row.Pos === "QB" && round < 5) score -= 65;
  if (row.Pos === "TE" && round < 3) score -= 30;
  if (["DST", "K"].includes(row.Pos) && round < 14) score -= 320;
  if (row.Pos === "DST" && counts.DST < 1 && round >= 15) score += 620;
  if (row.Pos === "K" && counts.K < 1 && round >= 16) score += 720;
  if (row.Pos === "K" && counts.K < 1 && counts.DST >= 1 && round >= 15) score += 260;
  if (row.Pos !== "DST" && counts.DST < 1 && round >= 15) score -= 180;
  if (row.Pos !== "K" && counts.K < 1 && round >= 16) score -= 260;
  if (Number(row.Risk || 0) >= 6 && round <= 8) score -= 18;
  if (decision.survival.pct < 20) score += 80;
  else if (decision.survival.pct < 35) score += 45;
  if (decision.survival.pct >= 75) score -= 28;
  if (decision.label === "Pick now") score += 38;
  if (decision.label === "Wait") score -= 34;
  if (simTopTierInfo(row.Pos).count <= 2 && !["DST", "K"].includes(row.Pos)) score += 24;
  return score;
}

function simBotScore(row, counts, slot) {
  const round = simRound();
  let score = 1800 - Number(row.Rank || 999) * 6 + Number(row["Value Score"] || 0);
  if (row.Pos === "RB" && counts.RB < 2) score += 110;
  if (row.Pos === "WR" && counts.WR < 2) score += 110;
  if (["RB", "WR"].includes(row.Pos) && counts[row.Pos] < (row.Pos === "RB" ? 5 : 6)) score += 30;
  if (row.Pos === "RB" && counts.RB < 4 && round >= 8) score += 60;
  if (row.Pos === "WR" && counts.WR < 5 && round >= 8) score += 50;
  if (row.Pos === "RB" && counts.RB < 4 && round >= 10) score += 180;
  if (row.Pos !== "RB" && counts.RB < 4 && round >= 12 && round < 15) score -= 260;
  if (row.Pos === "TE" && counts.TE < 1 && round >= 3) score += 35;
  if (row.Pos === "QB" && counts.QB < 1 && round >= 5) score += 45;
  if (positionClosed(row, counts)) score -= 700;
  if (["DST", "K"].includes(row.Pos) && round < 14) score -= 500;
  if (row.Pos === "DST" && counts.DST < 1 && round >= 15) score += 620;
  if (row.Pos === "K" && counts.K < 1 && round >= 16) score += 720;
  if (row.Pos !== "DST" && counts.DST < 1 && round >= 15) score -= 180;
  if (row.Pos !== "K" && counts.K < 1 && round >= 16) score -= 260;
  const wobble = Math.sin((mockSim.currentOverall + 1) * (slot + 3) * (Number(row.Rank || 1) + 11)) * 18;
  return score + wobble;
}

function simTopRecommendations() {
  if (!mockSim) return [];
  const counts = simTeam(mockSim.userSlot).counts;
  return simAvailableRows()
    .map((row) => ({ row, score: simRecommendationScore(row, counts), decision: simDecision(row, counts) }))
    .filter((item) => item.decision.label !== "Avoid")
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
}

function simAddPick(slot, row, pickedByUser = false) {
  if (!mockSim || !row) return;
  const overall = mockSim.currentOverall;
  const team = simTeam(slot);
  team.counts[row.Pos] = (team.counts[row.Pos] || 0) + 1;
  team.picks.push({ row, overall, round: simRound(overall), roundPick: simRoundPick(overall), pickedByUser });
  mockSim.picks.push({ row, slot, overall, round: simRound(overall), roundPick: simRoundPick(overall), pickedByUser });
  mockSim.drafted.add(normalizePlayerName(row.Player));
  mockSim.currentOverall += 1;
}

function simOpponentPick() {
  if (!mockSim || mockSim.currentOverall > 192) return;
  const slot = simSlotFromOverall(mockSim.currentOverall);
  const team = simTeam(slot);
  const candidates = simAvailableRows().slice(0, 90);
  const row = candidates.sort((a, b) => simBotScore(b, team.counts, slot) - simBotScore(a, team.counts, slot))[0];
  if (!row) {
    mockSim.currentOverall = 193;
    return;
  }
  simAddPick(slot, row, false);
}

function simAdvanceToUserPick() {
  if (!mockSim) return;
  while (mockSim.currentOverall <= 192 && simSlotFromOverall(mockSim.currentOverall) !== mockSim.userSlot) {
    simOpponentPick();
  }
}

function simStartDraft() {
  if (!boardData) {
    if (simStatus) simStatus.innerHTML = "<strong>Board data is still loading.</strong> Try again in a second.";
    return;
  }
  const selectedSlot = simSlot?.value || localStorage.getItem("fantasy-dashboard:sim-slot") || "random";
  const slot = selectedSlot === "random" ? Math.floor(Math.random() * 12) + 1 : Number(selectedSlot || 1);
  const teams = {};
  for (let teamSlot = 1; teamSlot <= 12; teamSlot += 1) {
    teams[teamSlot] = { counts: emptyPositionCounts(), picks: [] };
  }
  mockSim = {
    active: true,
    userSlot: slot,
    currentOverall: 1,
    drafted: new Set(),
    picks: [],
    teams,
  };
  localStorage.setItem("fantasy-dashboard:sim-slot", selectedSlot);
  simAdvanceToUserPick();
  renderMockSimulator();
}

function simResetDraft() {
  mockSim = null;
  renderMockSimulator();
}

function simDraftPlayer(playerKey) {
  if (!mockSim || mockSim.currentOverall > 192) return;
  if (simSlotFromOverall(mockSim.currentOverall) !== mockSim.userSlot) return;
  const row = simAvailableRows().find((candidate) => normalizePlayerName(candidate.Player) === playerKey);
  if (!row) return;
  simAddPick(mockSim.userSlot, row, true);
  simAdvanceToUserPick();
  renderMockSimulator();
}

function simGradeRoster() {
  if (!mockSim) return { grade: "Pending", detail: "Start a mock." };
  const team = simTeam(mockSim.userSlot);
  const counts = team.counts;
  let score = 100;
  const notes = [];

  if (counts.RB < 4) {
    score -= 12;
    notes.push("RB depth thin");
  }
  if (counts.WR < 5) {
    score -= 12;
    notes.push("WR depth thin");
  }
  if (counts.QB > 1) {
    score -= 8;
    notes.push("backup QB");
  }
  if (counts.TE > 1) {
    score -= 8;
    notes.push("extra TE");
  }
  if (counts.DST > 1 || counts.K > 1) {
    score -= 8;
    notes.push("extra DST/K");
  }
  const dstPick = team.picks.find((pick) => pick.row.Pos === "DST");
  const kPick = team.picks.find((pick) => pick.row.Pos === "K");
  if (dstPick && dstPick.round < 14) {
    score -= 6;
    notes.push("early DST");
  }
  if (kPick && kPick.round < 16) {
    score -= 6;
    notes.push("early K");
  }

  score = Math.max(0, score);
  const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
  return {
    grade: team.picks.length ? `${grade} (${score})` : "Pending",
    detail: notes.length ? notes.join(", ") : team.picks.length ? "Shape is clean so far." : "Grade appears after picks.",
  };
}

function renderSimRecommendationCard(item, index = 0) {
  const { row, decision } = item;
  const survivalText = decision.survival.pct ? `${decision.survival.pct}% back` : "no turn";
  return `<div class="pick-card recommendation ${index < 3 ? "priority" : ""} ${decision.className}">
    <span>#${row.Rank} / ${row.Pos} / ${row.Team}</span>
    <strong>${htmlEscape(row.Player)}</strong>
    <div class="rec-meta">
      <em>${decision.label}</em>
      <b class="${decision.survival.className}">${survivalText}</b>
      <b>${htmlEscape(row["Pos Tier"] || row.Category)}</b>
    </div>
    <small>${htmlEscape(decision.reason)} Proj PPR: ${row["Proj PPR Pts"]}. Value: ${row["Value Score"]}. ${htmlEscape(decision.survival.detail)}</small>
    <button type="button" class="sim-draft-button" data-sim-player="${normalizePlayerName(row.Player)}">Draft</button>
  </div>`;
}

function renderSimRecommendations() {
  if (!simRecommendations) return;
  if (!mockSim) {
    simRecommendations.textContent = "Start a mock to see recommendations.";
    return;
  }
  if (mockSim.currentOverall > 192) {
    simRecommendations.innerHTML = "<strong>Mock complete.</strong>";
    return;
  }
  if (simSlotFromOverall(mockSim.currentOverall) !== mockSim.userSlot) {
    simRecommendations.textContent = "Auto-draft to your next pick to resume practice.";
    return;
  }
  const recommendations = simTopRecommendations();
  const waits = recommendations.filter((item) => item.decision.label === "Can wait").slice(0, 3);
  const pickNow = recommendations.filter((item) => !["Can wait", "Wait"].includes(item.decision.label)).slice(0, 5);
  const avoids = simAvailableRows()
    .filter((row) => simDecision(row, simTeam(mockSim.userSlot).counts).label === "Avoid")
    .sort((a, b) => Number(a.Rank) - Number(b.Rank))
    .slice(0, 3);
  simRecommendations.innerHTML = `
    <div class="recommendation-block">
      <h4>Pick Now</h4>
      ${pickNow.map((item, index) => renderSimRecommendationCard(item, index)).join("") || "<p>No urgent pick. Take best board value.</p>"}
    </div>
    <div class="recommendation-block">
      <h4>Can Wait</h4>
      ${waits.map((item) => renderSimRecommendationCard(item)).join("") || "<p>No strong wait candidates.</p>"}
    </div>
    <div class="recommendation-block compact-block">
      <h4>Avoid Under Clock</h4>
      ${avoids.map((row) => `<div class="pick-card recommendation wait"><strong>${htmlEscape(row.Player)}</strong><small>${row.Pos} is already filled or poorly timed for this roster.</small></div>`).join("") || "<p>No avoid flags yet.</p>"}
    </div>
  `;
  simRecommendations.querySelectorAll(".sim-draft-button").forEach((button) => {
    button.addEventListener("click", () => simDraftPlayer(button.dataset.simPlayer));
  });
}

function renderSimAvailable() {
  if (!simAvailable) return;
  if (!mockSim) {
    simAvailable.textContent = "Start a mock to load players.";
    return;
  }
  const query = (simSearch?.value || "").trim().toLowerCase();
  const pos = simPosition?.value || "";
  const isUserPick = simSlotFromOverall(mockSim.currentOverall) === mockSim.userSlot;
  const rows = simAvailableRows()
    .filter((row) => positionMatches(row, pos))
    .filter((row) => !query || `${row.Player} ${row.Pos} ${row.Team} ${row.Action} ${row["Pos Tier"] || ""}`.toLowerCase().includes(query))
    .sort((a, b) => Number(a.Rank) - Number(b.Rank))
    .slice(0, pos ? 120 : 50);
  simAvailable.innerHTML = renderTieredRows(rows, pos, {
    showDraftButton: true,
    canDraft: isUserPick,
    emptyMessage: "No players match this search/filter.",
  });
  simAvailable.querySelectorAll("button[data-sim-player]").forEach((button) => {
    button.addEventListener("click", () => simDraftPlayer(button.dataset.simPlayer));
  });
}

function renderSimRoster() {
  if (!simRoster) return;
  if (!mockSim) {
    simRoster.textContent = "No picks yet.";
    return;
  }
  const team = simTeam(mockSim.userSlot);
  simRoster.innerHTML = `
    <div class="roster-counts">
      <span>QB ${team.counts.QB}</span><span>RB ${team.counts.RB}</span><span>WR ${team.counts.WR}</span><span>TE ${team.counts.TE}</span><span>DST ${team.counts.DST}</span><span>K ${team.counts.K}</span>
    </div>
    ${team.picks.map((pick) => `<div class="pick-card made"><span>R${pick.round} P${pick.roundPick}</span><strong>${htmlEscape(pick.row.Player)}</strong><em>${pick.row.Pos}</em><small>Board rank ${pick.row.Rank}. ${htmlEscape(pick.row.Action)}</small></div>`).join("") || "<p>No picks yet.</p>"}
  `;
}

function renderSimIntel() {
  if (!mockSim) {
    if (simRadar) simRadar.textContent = "Start a mock to unlock pick radar.";
    if (simTierAlerts) simTierAlerts.textContent = "Waiting for mock.";
    if (simRoomDetector) simRoomDetector.textContent = "Waiting for picks.";
    if (simRiskMeter) simRiskMeter.textContent = "Waiting for your roster.";
    return;
  }
  const upcoming = simFutureUserPicks();
  const next = upcoming[0];
  const returnPick = upcoming[1];
  if (simRadar) {
    simRadar.innerHTML = next
      ? `<div class="intel-card ${next === mockSim.currentOverall ? "danger" : "good"}"><strong>${next === mockSim.currentOverall ? "You are on the clock" : `${next - mockSim.currentOverall} picks until you`}</strong><small>Next pick overall ${next}.${returnPick ? ` Return pick overall ${returnPick}.` : ""}</small></div>`
      : `<div class="intel-card good"><strong>Mock complete</strong><small>No picks left.</small></div>`;
  }
  if (simTierAlerts) {
    const cards = ["RB", "WR", "TE", "QB"].map((posName) => {
      const info = simTopTierInfo(posName);
      const severity = info.count <= 2 ? "danger" : info.count <= 4 ? "watch" : "good";
      const names = info.rows.slice(0, 3).map((row) => row.Player).join(", ");
      return `<div class="intel-card ${severity}"><strong>${posName}: ${info.count} left in ${htmlEscape(info.tier)}</strong><small>${htmlEscape(names)}</small></div>`;
    });
    simTierAlerts.innerHTML = cards.join("");
  }
  if (simRoomDetector) {
    const counts = simRecentPositionCounts(12);
    const leaders = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const [runPos, runCount] = leaders[0] || ["None", 0];
    simRoomDetector.innerHTML = `<div class="intel-card ${runCount >= 5 ? "danger" : runCount >= 3 ? "watch" : "good"}"><strong>${runCount ? `${runPos} pressure: ${runCount} of last 12` : "No run yet"}</strong><small>${runCount >= 3 ? "Check tier cliffs before reacting." : "Keep taking value."}</small></div>`;
  }
  if (simRiskMeter) {
    const team = simTeam(mockSim.userSlot);
    const rows = team.picks.map((pick) => pick.row);
    const avgRisk = rows.length ? rows.reduce((sum, row) => sum + Number(row.Risk || 0), 0) / rows.length : 0;
    const label = rows.length ? (avgRisk >= 5 ? "Too spicy" : avgRisk <= 2.5 && rows.length >= 5 ? "Too safe" : "Golden zone") : "Baseline plan";
    const className = label === "Too spicy" ? "danger" : label === "Too safe" ? "watch" : "good";
    simRiskMeter.innerHTML = `<div class="intel-card ${className}"><strong>${label}</strong><small>${rows.length ? `Average risk ${avgRisk.toFixed(1)}/10.` : "Stable early, upside late."}</small></div>`;
  }
}

function renderSimLog() {
  if (!simLog) return;
  if (!mockSim || !mockSim.picks.length) {
    simLog.textContent = "No mock picks yet.";
    return;
  }
  simLog.innerHTML = simRecentPicks(14)
    .map((pick) => `<div class="pick-card ${pick.pickedByUser ? "priority" : ""}"><span>R${pick.round} P${pick.roundPick} / Team ${pick.slot}</span><strong>${htmlEscape(pick.row.Player)}</strong><em>${pick.row.Pos}</em><small>${pick.pickedByUser ? "Your pick" : "Opponent pick"} / board rank ${pick.row.Rank}</small></div>`)
    .join("");
}

function renderMockSimulator() {
  if (!simStatus) return;
  const active = Boolean(mockSim);
  const completed = active ? Math.min(mockSim.currentOverall - 1, 192) : 0;
  const pct = Math.round((completed / 192) * 100);
  const userPick = active && mockSim.currentOverall <= 192 && simSlotFromOverall(mockSim.currentOverall) === mockSim.userSlot;
  const grade = simGradeRoster();
  const team = active ? simTeam(mockSim.userSlot) : { counts: emptyPositionCounts(), picks: [] };

  simStatus.innerHTML = active
    ? `<strong>${userPick ? "You are on the clock." : "Mock in progress."}</strong> Slot ${mockSim.userSlot}, ${completed}/192 picks complete.`
    : "Start a mock, then practice making picks while the room auto-drafts around you.";
  if (simCurrentPick) simCurrentPick.textContent = active && mockSim.currentOverall <= 192 ? `Round ${simRound()}, Pick ${simRoundPick(mockSim.currentOverall)}` : active ? "Mock complete" : "No mock started";
  if (simCurrentTeam) simCurrentTeam.textContent = active && mockSim.currentOverall <= 192 ? `Overall ${mockSim.currentOverall}: Team ${simSlotFromOverall(mockSim.currentOverall)}${userPick ? " (you)" : ""}` : "Choose a slot and start.";
  if (simCompleted) simCompleted.textContent = String(completed);
  if (simTotal) simTotal.textContent = "of 192";
  if (simProgressBar) simProgressBar.style.width = `${pct}%`;
  if (simShape) simShape.textContent = `${team.picks.length} players`;
  if (simShapeDetail) simShapeDetail.textContent = `QB ${team.counts.QB} / RB ${team.counts.RB} / WR ${team.counts.WR} / TE ${team.counts.TE} / DST ${team.counts.DST} / K ${team.counts.K}`;
  if (simGrade) simGrade.textContent = grade.grade;
  if (simGradeDetail) simGradeDetail.textContent = grade.detail;
  if (simAuto) simAuto.disabled = !active || mockSim.currentOverall > 192 || userPick;

  renderSimIntel();
  renderSimRecommendations();
  renderSimAvailable();
  renderSimRoster();
  renderSimLog();
}

function liveServerHelp(error) {
  const support = appConfig.supportEmail
    ? ` If this keeps happening, contact ${htmlEscape(appConfig.supportEmail)}.`
    : " If this keeps happening, contact dashboard support.";
  if (liveStatus) {
    liveStatus.innerHTML = `
      <strong>Live sync is unavailable.</strong>
      Confirm the ESPN league is public and that the league ID/season were configured correctly.${support}
      ${error ? `<p>${htmlEscape(error)}</p>` : ""}
    `;
  }
  if (liveSyncStatus) liveSyncStatus.textContent = "Sync unavailable";
}

function loadLiveDraft(force = false) {
  if (!liveStatus) return;
  fetch(`/api/live-draft${force ? "?force=1" : ""}`, { cache: "no-store" })
    .then(async (response) => {
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      if (!data) throw new Error("Live sync returned an empty response");
      return data;
    })
    .then((data) => {
      if (data.ok) {
        liveDraft = data;
      } else if (data.fallback) {
        liveDraft = { ...data.fallback, staleError: data.error || "Unknown ESPN error" };
      } else {
        throw new Error(data.error || "ESPN returned no draft data");
      }
      renderLiveDraft();
    })
    .catch((error) => {
      liveServerHelp(error.message);
    });
}

function startLiveSync() {
  if (!liveSyncToggle?.checked) return;
  window.clearInterval(liveTimer);
  loadLiveDraft();
  liveTimer = window.setInterval(() => loadLiveDraft(), LIVE_SYNC_INTERVAL_MS);
}

function loadBoards() {
  if (boardStatus) {
    boardStatus.textContent = "Loading website boards...";
  }
  fetch(`./data/boards.json?v=${Date.now()}`, { cache: "no-store" })
    .then((response) => response.json())
    .then((data) => {
      boardData = data;
      renderBoard();
      renderLiveDraft();
      renderLiveTierBoard();
      renderMockSimulator();
      renderFootballersPlayerCheck();
    })
    .catch((error) => {
      if (boardStatus) {
        boardStatus.innerHTML =
          "<strong>Could not load website boards.</strong> Open the deployed dashboard through /FantasyIQ/ or refresh the deploy package.";
      }
      console.error(error);
    });
}

if (boardTable) {
  if (window.FANTASY_BOARDS) {
    boardData = window.FANTASY_BOARDS;
    renderBoard();
    renderLiveDraft();
    renderLiveTierBoard();
    renderMockSimulator();
    renderFootballersPlayerCheck();
  } else {
    loadBoards();
  }
}

boardSearch?.addEventListener("input", renderBoard);
positionFilter?.addEventListener("change", renderBoard);
positionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const value = button.dataset.position || "";
    if (positionFilter) {
      positionFilter.value = value;
    }
    positionButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderBoard();
  });
});
reloadBoards?.addEventListener("click", loadBoards);
navJumps.forEach((button) => {
  button.addEventListener("click", () => activateSection(button.dataset.jump));
});

liveTierSearch?.addEventListener("input", renderLiveTierBoard);
liveTierButtons.forEach((button) => {
  button.addEventListener("click", () => {
    liveTierButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderLiveTierBoard();
  });
});

function renderFootballersLayer() {
  renderFootballersPlayerCheck();
}

footballersPlayerCheck?.addEventListener("input", renderFootballersPlayerCheck);
footballersTakeType?.addEventListener("change", renderFootballersLayer);
footballersRank?.addEventListener("input", renderFootballersLayer);
footballersMarketPick?.addEventListener("input", renderFootballersLayer);
footballersTakeContext?.addEventListener("input", renderFootballersLayer);
const savedSimSlot = localStorage.getItem("fantasy-dashboard:sim-slot");
if (simSlot && savedSimSlot) {
  simSlot.value = savedSimSlot;
}
simSlot?.addEventListener("change", () => {
  localStorage.setItem("fantasy-dashboard:sim-slot", simSlot.value);
});
simStart?.addEventListener("click", simStartDraft);
simAuto?.addEventListener("click", () => {
  if (!mockSim) {
    simStartDraft();
    return;
  }
  simAdvanceToUserPick();
  renderMockSimulator();
});
simReset?.addEventListener("click", simResetDraft);
simSearch?.addEventListener("input", renderSimAvailable);
simPosition?.addEventListener("change", () => {
  simPositionButtons.forEach((button) => {
    button.classList.toggle("active", (button.dataset.simPos || "") === (simPosition.value || ""));
  });
  renderSimAvailable();
});
simPositionButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const value = button.dataset.simPos || "";
    if (simPosition) simPosition.value = value;
    simPositionButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderSimAvailable();
  });
});
if (mockPaste) {
  mockPaste.value = localStorage.getItem("fantasy-dashboard:mock-picks") || "";
}
gradeMockPicks?.addEventListener("click", renderMockPickGrades);
calculateTrade?.addEventListener("click", renderTradeCalc);

const savedHideDrafted = localStorage.getItem("fantasy-dashboard:hide-drafted");
const initialHideDrafted = savedHideDrafted === null ? true : savedHideDrafted === "true";
if (hideDrafted) hideDrafted.checked = initialHideDrafted;
if (hideDraftedBoard) hideDraftedBoard.checked = initialHideDrafted;

function setHideDrafted(value) {
  if (hideDrafted) hideDrafted.checked = value;
  if (hideDraftedBoard) hideDraftedBoard.checked = value;
  localStorage.setItem("fantasy-dashboard:hide-drafted", String(value));
  renderBoard();
  renderRecommendations();
  renderLiveTierBoard();
  renderNextPickRadar();
  renderTierAlerts();
  renderRoomDetector();
  renderRiskMeter();
}

hideDrafted?.addEventListener("change", () => setHideDrafted(hideDrafted.checked));
hideDraftedBoard?.addEventListener("change", () => setHideDrafted(hideDraftedBoard.checked));
myTeamSelect?.addEventListener("change", () => {
  localStorage.setItem("fantasy-dashboard:my-team", myTeamSelect.value);
  renderLiveDraft();
});
manualSync?.addEventListener("click", () => loadLiveDraft(true));
liveSyncToggle?.addEventListener("change", () => {
  localStorage.setItem("fantasy-dashboard:auto-sync", String(liveSyncToggle.checked));
  if (liveSyncToggle.checked) {
    startLiveSync();
  } else {
    window.clearInterval(liveTimer);
    if (liveStatus) liveStatus.innerHTML = "<strong>Auto sync paused.</strong> Use Sync Now for a one-time ESPN refresh.";
  }
});

const savedAutoSync = localStorage.getItem("fantasy-dashboard:auto-sync");
if (liveSyncToggle && savedAutoSync !== null) {
  liveSyncToggle.checked = savedAutoSync === "true";
}
renderFootballersLayer();
startLiveSync();

