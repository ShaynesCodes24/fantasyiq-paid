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
const tradeGiveTotal = document.querySelector("#trade-give-total");
const tradeGetTotal = document.querySelector("#trade-get-total");
const tradeGiveList = document.querySelector("#trade-give-list");
const tradeGetList = document.querySelector("#trade-get-list");
const tradeRosterStatus = document.querySelector("#trade-roster-status");
const tradeRosterPills = document.querySelector("#trade-roster-pills");
const cheatcodeStatus = document.querySelector("#cheatcode-status");
const cheatcodeHero = document.querySelector("#cheatcode-hero");
const cheatcodeNow = document.querySelector("#cheatcode-now");
const cheatcodeValue = document.querySelector("#cheatcode-value");
const cheatcodeSafe = document.querySelector("#cheatcode-safe");
const cheatcodeUpside = document.querySelector("#cheatcode-upside");
const cheatcodeTier = document.querySelector("#cheatcode-tier");
const cheatcodeWait = document.querySelector("#cheatcode-wait");
const cheatcodeAvoid = document.querySelector("#cheatcode-avoid");
const cheatcodeRoom = document.querySelector("#cheatcode-room");
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
const accountCard = document.querySelector("#account-card");
const accountLabel = document.querySelector("#account-label");
const accountState = document.querySelector("#account-state");
const accountAction = document.querySelector("#account-action");
const appConfig = resolveAppConfig(window.FANTASY_IQ_CONFIG || {});
window.FANTASY_IQ_ACTIVE_CONFIG = appConfig;

let boardData = null;
let activeBoard = "combined";
let liveDraft = null;
let liveTimer = null;
let mockSim = null;
let selectedBoardPlayerKey = null;
const LIVE_SYNC_INTERVAL_MS = 8000;
let activePlayerAutocomplete = null;

function rememberedCustomerLoadout(loadouts) {
  try {
    const lastLoadout = localStorage.getItem("fantasy-dashboard:last-loadout") || "";
    if (lastLoadout && loadouts[lastLoadout] && localStorage.getItem(`fantasy-dashboard:${lastLoadout}:access-code`)) {
      return lastLoadout;
    }
    const savedLoadouts = Object.keys(loadouts).filter((key) =>
      localStorage.getItem(`fantasy-dashboard:${key}:access-code`)
    );
    return savedLoadouts.length === 1 ? savedLoadouts[0] : "";
  } catch (error) {
    return "";
  }
}

function resolveAppConfig(config) {
  const params = new URLSearchParams(window.location.search);
  const loadouts = config.loadouts || {};
  const requestedLoadout = normalizeDashboardSlug(params.get("loadout") || params.get("customer") || params.get("dashboard") || "");
  const rememberedLoadout = requestedLoadout ? "" : rememberedCustomerLoadout(loadouts);
  const defaultLoadout = config.defaultLoadout && loadouts[config.defaultLoadout] ? config.defaultLoadout : "";
  const loadoutKey = requestedLoadout || rememberedLoadout || defaultLoadout;
  const loadoutConfig = loadoutKey && loadouts[loadoutKey] ? loadouts[loadoutKey] : {};
  const merged = { ...config, ...loadoutConfig, loadoutKey: loadoutKey || "default" };
  const customerDashboard = Boolean(loadoutKey);

  if (customerDashboard) {
    merged.isDemoPreview = loadoutConfig.isDemoPreview ?? false;
    merged.showSubscribeButton = loadoutConfig.showSubscribeButton ?? false;
    merged.draftCardLabel = loadoutConfig.draftCardLabel || "Customer Dashboard";
    merged.draftCardValue = loadoutConfig.draftCardValue || "Active";
    merged.draftCardNote = loadoutConfig.draftCardNote || "Configured for this ESPN league";
    merged.demoLabel = loadoutConfig.demoLabel || "Customer dashboard";
    merged.demoMessage = loadoutConfig.demoMessage || "Configured FantasyIQ command center.";
    merged.heroSubtitle =
      loadoutConfig.heroSubtitle ||
      "Your official FantasyIQ command center for live draft sync, player values, mock tracking, and trade discipline.";
  }

  if (params.get("name")) merged.customerName = params.get("name");
  if (params.get("teamName")) merged.customerTeamName = params.get("teamName");
  if (params.get("teamId")) merged.customerTeamId = params.get("teamId");

  return merged;
}

function normalizeDashboardSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function loadoutStorageKey(key) {
  return `fantasy-dashboard:${appConfig.loadoutKey || "default"}:${key}`;
}

function requiresCustomerAccess() {
  return Boolean(appConfig.loadoutKey && appConfig.loadoutKey !== "default");
}

function savedCustomerAccessCode() {
  return localStorage.getItem(loadoutStorageKey("access-code")) || "";
}

function setCustomerAccessCode(value) {
  localStorage.setItem(loadoutStorageKey("access-code"), value.trim());
  localStorage.setItem("fantasy-dashboard:last-loadout", appConfig.loadoutKey || "");
}

function clearCustomerAccessCode() {
  localStorage.removeItem(loadoutStorageKey("access-code"));
}

function apiUrl(path, params = {}) {
  const url = new URL(path, window.location.origin);
  if (appConfig.loadoutKey) {
    url.searchParams.set("customer", appConfig.loadoutKey);
  }
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== false && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return `${url.pathname}${url.search}`;
}

function apiHeaders(extra = {}) {
  const headers = { ...extra };
  const accessCode = savedCustomerAccessCode();
  if (requiresCustomerAccess() && accessCode) {
    headers["x-fantasyiq-access-code"] = accessCode;
  }
  return headers;
}

function customerAccessGate() {
  return document.querySelector("#customer-access-gate");
}

function removeCustomerAccessGate() {
  document.body.classList.remove("access-locked");
  customerAccessGate()?.remove();
  updateAccountControl();
}

function showCustomerAccessGate(message = "") {
  if (!requiresCustomerAccess() || customerAccessGate()) return;
  document.body.classList.add("access-locked");
  const customerLabel = appConfig.customerName || appConfig.customerTeamName || "your dashboard";
  const gate = document.createElement("section");
  gate.id = "customer-access-gate";
  gate.className = "access-gate";
  gate.innerHTML = `
    <form class="access-card">
      <p class="eyebrow">Customer Login</p>
      <h2>Open ${htmlEscape(customerLabel)}</h2>
      <p>Enter the dashboard access code from your FantasyIQ setup email.</p>
      <label>
        Access code
        <input id="customer-access-code" type="password" autocomplete="off" required />
      </label>
      <button type="submit" class="primary-action">Unlock Dashboard</button>
      <div class="access-message">${message ? htmlEscape(message) : ""}</div>
      <small>Need help? Email ${htmlEscape(appConfig.supportEmail || "support")}.</small>
    </form>
  `;
  document.body.appendChild(gate);
  const input = gate.querySelector("#customer-access-code");
  const output = gate.querySelector(".access-message");
  input?.focus();
  gate.querySelector("form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const code = input.value.trim();
    if (!code) return;
    output.textContent = "Checking access...";
    try {
      const response = await fetch(apiUrl("/api/customer-status", { v: Date.now() }), {
        cache: "no-store",
        headers: { "x-fantasyiq-access-code": code },
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok || payload.authenticated === false) {
        output.textContent = payload.message || "That access code did not work.";
        return;
      }
      setCustomerAccessCode(code);
      removeCustomerAccessGate();
      updateAccountControl();
      loadBoards();
      startLiveSync();
    } catch (error) {
      output.textContent = "Could not verify the code. Refresh and try again.";
    }
  });
}

function ensureCustomerAccess() {
  if (!requiresCustomerAccess()) return true;
  if (savedCustomerAccessCode()) return true;
  showCustomerAccessGate();
  return false;
}

function handleCustomerAccessFailure(message = "Enter the current customer access code.") {
  if (!requiresCustomerAccess()) return false;
  clearCustomerAccessCode();
  window.clearInterval(liveTimer);
  updateAccountControl();
  showCustomerAccessGate(message);
  if (liveStatus) liveStatus.innerHTML = "<strong>Customer login required.</strong>";
  return true;
}

function updateAccountControl() {
  if (!accountCard) return;
  const customerLabel = appConfig.customerName || appConfig.customerTeamName || appConfig.loadoutKey || "Dashboard";
  if (accountLabel) accountLabel.textContent = requiresCustomerAccess() ? customerLabel : "Public Demo";
  if (accountState) accountState.textContent = requiresCustomerAccess() ? (savedCustomerAccessCode() ? "Signed In" : "Signed Out") : "Preview";
  if (accountAction) {
    accountAction.textContent = requiresCustomerAccess() ? (savedCustomerAccessCode() ? "Sign Out" : "Sign In") : "Demo";
    accountAction.disabled = !requiresCustomerAccess();
  }
  accountCard.classList.toggle("signed-in", requiresCustomerAccess() && Boolean(savedCustomerAccessCode()));
  accountCard.classList.toggle("signed-out", requiresCustomerAccess() && !savedCustomerAccessCode());
}

function signOutCustomer() {
  clearCustomerAccessCode();
  window.clearInterval(liveTimer);
  liveTimer = null;
  updateAccountControl();
  if (requiresCustomerAccess()) {
    if (liveStatus) liveStatus.innerHTML = "<strong>Signed out.</strong> Sign in to reconnect live draft sync.";
    showCustomerAccessGate("Signed out. Enter your access code to unlock the dashboard.");
  }
}

async function jsonOrAccessError(response, fallbackMessage) {
  const data = await response.json().catch(() => null);
  if (response.status === 401) {
    handleCustomerAccessFailure(data?.error || data?.message || "Enter the current customer access code.");
    throw new Error("Customer login required.");
  }
  if (!response.ok) throw new Error(data?.error || data?.message || fallbackMessage || `HTTP ${response.status}`);
  return data;
}

function customerBrandSubtitle(fallbackLeagueName) {
  if (appConfig.customerName && appConfig.customerTeamName) {
    return `${appConfig.customerName} / ${appConfig.customerTeamName}`;
  }
  if (appConfig.customerName && fallbackLeagueName) {
    return `${appConfig.customerName} / ${fallbackLeagueName}`;
  }
  return appConfig.leagueSubtitle || "Configurable ESPN Fantasy Platform";
}

function applyAppConfig() {
  const siteName = appConfig.siteName || "FantasyIQ";
  document.title = siteName;

  const brandTitle = document.querySelector(".brand-lockup h1");
  const brandEyebrow = document.querySelector(".brand-lockup .eyebrow");
  const brandSubtitle = document.querySelector(".brand-lockup small");
  const logo = document.querySelector(".brand-lockup img");
  const draftCardLabel = document.querySelector(".draft-card span");
  const draftCardValue = document.querySelector(".draft-card strong");
  const draftCardNote = document.querySelector(".draft-card small");
  const subscribeButton = document.querySelector(".draft-card .subscribe-button");
  const heroTitle = document.querySelector(".command-hero h2");
  const heroSubtitle = document.querySelector(".command-hero p:not(.eyebrow)");
  const leftEndzone = document.querySelector(".field-endzone-left");
  const rightEndzone = document.querySelector(".field-endzone-right");
  const demoBanner = document.querySelector("[data-demo-banner]");
  const firstLeagueMetric = document.querySelector(".metric-grid .metric:first-child");

  if (brandTitle) brandTitle.textContent = siteName;
  if (brandEyebrow) brandEyebrow.textContent = appConfig.customerTeamName || appConfig.leagueName || "League Command Center";
  if (brandSubtitle) {
    brandSubtitle.textContent = customerBrandSubtitle(appConfig.leagueName);
  }
  if (logo && appConfig.logoUrl) logo.src = appConfig.logoUrl;
  if (logo) logo.alt = appConfig.logoAlt || `${siteName} league logo`;
  if (draftCardLabel) draftCardLabel.textContent = appConfig.draftCardLabel || "Subscription";
  if (draftCardValue) draftCardValue.textContent = appConfig.draftCardValue || "$25 / year";
  if (draftCardNote) draftCardNote.textContent = appConfig.draftCardNote || "Configured for your ESPN league";
  if (subscribeButton && appConfig.showSubscribeButton === false) {
    subscribeButton.remove();
  }
  if (heroTitle) heroTitle.textContent = appConfig.heroTitle || "Draft smarter. Trade cleaner. Win your league.";
  if (heroSubtitle) {
    heroSubtitle.textContent =
      appConfig.heroSubtitle ||
      "Draft prep, player values, mock tracking, live room sync, and trade discipline in one command center.";
  }
  if (leftEndzone) leftEndzone.textContent = appConfig.fieldLeftLabel || "Fantasy";
  if (rightEndzone) rightEndzone.textContent = appConfig.fieldRightLabel || "IQ";
  if (firstLeagueMetric && appConfig.customerTeamName) {
    const value = firstLeagueMetric.querySelector("strong");
    const note = firstLeagueMetric.querySelector("small");
    if (value) value.textContent = appConfig.customerTeamName;
    if (note) note.textContent = appConfig.leagueName || "ESPN league";
  }
  if (demoBanner && appConfig.isDemoPreview === false) {
    demoBanner.remove();
  } else if (demoBanner) {
    const label = demoBanner.querySelector("strong");
    const message = demoBanner.querySelector("span");
    if (label) label.textContent = appConfig.demoLabel || "Public demo preview";
    if (message) {
      message.textContent =
        appConfig.demoMessage ||
        "This dashboard is a working preview. Subscribe to get it configured for your ESPN league.";
    }
  }
}

applyAppConfig();
updateAccountControl();
ensureCustomerUrlContext();

function applyEspnLeagueBranding() {
  if (!appConfig.useEspnLeagueBranding || !liveDraft || liveDraft.demoMode) return;
  const brandEyebrow = document.querySelector(".brand-lockup .eyebrow");
  const brandSubtitle = document.querySelector(".brand-lockup small");
  const logo = document.querySelector(".brand-lockup img");

  if (brandEyebrow) brandEyebrow.textContent = appConfig.customerTeamName || liveDraft.leagueName || "League Command Center";
  if (brandSubtitle && liveDraft.leagueId) {
    brandSubtitle.textContent = appConfig.customerName
      ? customerBrandSubtitle(liveDraft.leagueName || "ESPN league")
      : `ESPN league ${liveDraft.leagueId} / season ${liveDraft.season || ""}`.trim();
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
  "Proj PPR Pts",
  "Last Year PPR",
  "Value Score",
  "Risk",
  "Action",
  "Bye",
  "Category",
];

const trendColumns = [
  "Trend",
  "Player",
  "Pos",
  "Team",
  "Proj PPR Pts",
  "Last Year PPR",
  "Board Rank",
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

function columnHeader(column) {
  if (column === "Tier") return "Pos Tier";
  if (column === "Proj PPR Pts") return "Proj PPR";
  if (column === "Last Year PPR") return "Last Yr PPR";
  return column;
}

function setActive(items, activeItem) {
  items.forEach((item) => item.classList.toggle("active", item === activeItem));
}

function dashboardUrlWithHash(hash = "") {
  return `${window.location.pathname}${window.location.search}${hash}`;
}

function ensureCustomerUrlContext() {
  if (!requiresCustomerAccess() || !savedCustomerAccessCode()) return;
  const params = new URLSearchParams(window.location.search);
  if (params.get("customer") || params.get("loadout") || params.get("dashboard")) return;
  params.set("customer", appConfig.loadoutKey);
  history.replaceState(null, "", `${window.location.pathname}?${params.toString()}${window.location.hash}`);
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
    history.replaceState(null, "", dashboardUrlWithHash(`#${section}`));
    setActive(navItems, button);
    panels.forEach((panel) => panel.classList.toggle("active", panel.id === section));
    scrollDashboardTop("smooth");
  });
});

function activateSection(section) {
  if (section === "mock") section = "simulator";
  if (section === "cheatcode") section = "live";
  const targetButton = Array.from(navItems).find((button) => button.dataset.section === section);
  if (!targetButton) return;
  history.replaceState(null, "", dashboardUrlWithHash(`#${section}`));
  setActive(navItems, targetButton);
  panels.forEach((panel) => panel.classList.toggle("active", panel.id === section));
  scrollDashboardTop("auto");
}

const hashValue = window.location.hash.replace("#", "");
const [initialSection, initialBoard] = hashValue.split("/");
if (initialSection) {
  activateSection(initialSection);
} else {
  scrollDashboardTop("auto");
}

window.addEventListener("load", () => scrollDashboardTop("auto"), { once: true });

tabs.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.board) {
      activeBoard = button.dataset.board;
      history.replaceState(null, "", dashboardUrlWithHash(`#workbooks/${activeBoard}`));
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
  const key = loadoutStorageKey(input.dataset.save);
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

function metricValue(value, fallback = "N/A") {
  return value === undefined || value === null || value === "" ? fallback : value;
}

function lastYearValue(row) {
  const value = row?.["Last Year PPR"];
  if (value === undefined || value === null || value === "" || value === "N/A") {
    return row?.Category === "Rookie" ? "Rookie" : "No 2025";
  }
  return value;
}

function compactText(value, limit = 170) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).replace(/\s+\S*$/, "")}.`;
}

function playerSynopsisText(row) {
  return row?.["Daily Synopsis"] || row?.["Player Outlook"] || row?.Analysis || "No player synopsis is available yet.";
}

function playerSynopsisBlock(row, options = {}) {
  const compact = options.compact ? " compact" : "";
  const latest = row?.["Latest News Date"] || "No dated update";
  const refreshed = row?.["Synopsis Updated"] || boardData?.updated || "Today";
  const source = row?.["News Status"] || row?.["Synopsis Source"] || "Refreshed from the current FantasyIQ board.";
  return `<article class="player-synopsis${compact}">
    <span>Daily Player Synopsis</span>
    <strong>Updated ${htmlEscape(refreshed)} / Latest note: ${htmlEscape(latest)}</strong>
    <p>${htmlEscape(options.compact ? compactText(playerSynopsisText(row)) : playerSynopsisText(row))}</p>
    ${options.compact ? "" : `<small>${htmlEscape(source)}</small>`}
  </article>`;
}

function playerFocusButton(row, className = "player-focus-button") {
  return `<button type="button" class="${className}" data-player-focus="${htmlEscape(row.Player)}">${htmlEscape(row.Player)}</button>`;
}

function filteredRows() {
  if (!boardData) return [];
  const query = boardSearch.value.trim().toLowerCase();
  const pos = positionFilter.value;
  const drafted = liveDraftedKeys();
  return boardData.boards[activeBoard].rows.filter((row) => {
    const matchesPosition = !pos || (pos === "FLEX" ? ["RB", "WR", "TE"].includes(row.Pos) : row.Pos === pos);
    const searchable = `${row.Player} ${row.Pos} ${row.Team} ${row.Category} ${row.Tier} ${row["Pos Tier"]} ${row.Action} ${row.Analysis} ${row["Daily Synopsis"]} ${row["Player Outlook"]} ${row["Risk Notes"]} ${row.Trend} ${row["Source Signal"]} ${row.Catalyst} ${row["Why Rising/Falling"]} ${row["Draft Action"]}`.toLowerCase();
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
    const updated = boardData.live
      ? ` Live ${boardData.source || "board"} synced ${formatSyncTime(boardData.syncedAt)}.`
      : boardData.updated
        ? ` Updated ${boardData.updated}.`
        : "";
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
  thead.innerHTML = `<tr>${columns.map((column) => `<th>${columnHeader(column)}</th>`).join("")}</tr>`;
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
              return `<td><span class="tier-pill">${htmlEscape(row["Pos Tier"] || cellValue(row, column))}</span></td>`;
            }
            if (column === "Last Year PPR") {
              return `<td class="number">${lastYearValue(row)}</td>`;
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

function playerAutocompleteRows(config = {}) {
  if (!boardData) return [];
  if (config.rows === "available") return availableRows();
  if (config.rows === "sim") return mockSim ? simAvailableRows() : availableRows();
  return boardData.boards?.combined?.rows || [];
}

function playerAutocompleteContext(input, mode = "single") {
  const value = input.value || "";
  const caret = input.selectionStart ?? value.length;
  if (mode === "single") {
    return { start: 0, end: value.length, query: value.trim() };
  }
  const lineStart = value.lastIndexOf("\n", Math.max(0, caret - 1)) + 1;
  const nextBreak = value.indexOf("\n", caret);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;
  let start = lineStart;
  if (mode === "mock-line") {
    const lineBeforeCaret = value.slice(lineStart, caret);
    const commaIndex = lineBeforeCaret.lastIndexOf(",");
    if (commaIndex !== -1) start = lineStart + commaIndex + 1;
  }
  return {
    start,
    end: lineEnd,
    query: value.slice(start, caret).trim(),
  };
}

function playerAutocompleteSuggestions(query, config = {}) {
  const clean = normalizePlayerName(query);
  if (clean.length < 2) return [];
  const seen = new Set();
  return playerAutocompleteRows(config)
    .map((row) => {
      const player = row.Player || "";
      const key = normalizePlayerName(player);
      if (!key || seen.has(key)) return null;
      seen.add(key);
      const words = player.split(/\s+/).map(normalizePlayerName);
      let score = null;
      if (key.startsWith(clean)) score = 0;
      else if (words.some((word) => word.startsWith(clean))) score = 1;
      else if (key.includes(clean)) score = 2;
      if (score === null) return null;
      return { row, score: score + Number(row.Rank || 999) / 1000 };
    })
    .filter(Boolean)
    .sort((a, b) => a.score - b.score)
    .slice(0, 7)
    .map((item) => item.row);
}

function setPlayerAutocompleteActive(config, index) {
  const buttons = Array.from(config.box?.querySelectorAll(".player-suggestion") || []);
  if (!buttons.length) return;
  config.activeIndex = Math.max(0, Math.min(index, buttons.length - 1));
  buttons.forEach((button, buttonIndex) => {
    button.classList.toggle("active", buttonIndex === config.activeIndex);
  });
}

function hidePlayerAutocomplete(config = activePlayerAutocomplete) {
  if (!config?.box) return;
  config.box.hidden = true;
  config.suggestions = [];
  config.activeIndex = 0;
  if (activePlayerAutocomplete === config) activePlayerAutocomplete = null;
}

function applyPlayerSuggestion(config, row) {
  const input = config.input;
  const context = playerAutocompleteContext(input, config.mode);
  const value = input.value || "";
  const before = value.slice(0, context.start);
  const after = value.slice(context.end);
  const needsSpace = before.endsWith(",") ? " " : "";
  const replacement = `${before}${needsSpace}${row.Player}${after}`;
  input.value = replacement;
  const cursor = before.length + needsSpace.length + row.Player.length;
  input.focus();
  input.setSelectionRange?.(cursor, cursor);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  hidePlayerAutocomplete(config);
}

function renderPlayerAutocomplete(config) {
  const input = config.input;
  const box = config.box;
  if (!input || !box || document.activeElement !== input) {
    hidePlayerAutocomplete(config);
    return;
  }
  const context = playerAutocompleteContext(input, config.mode);
  const clean = normalizePlayerName(context.query);
  if (clean.length < 2) {
    hidePlayerAutocomplete(config);
    return;
  }
  activePlayerAutocomplete = config;
  if (!boardData) {
    box.innerHTML = `<div class="player-suggestion-empty">Loading player board...</div>`;
    box.hidden = false;
    return;
  }
  const suggestions = playerAutocompleteSuggestions(context.query, config);
  config.suggestions = suggestions;
  config.activeIndex = 0;
  if (!suggestions.length) {
    box.innerHTML = `<div class="player-suggestion-empty">No player matches</div>`;
    box.hidden = false;
    return;
  }
  box.innerHTML = suggestions
    .map((row, index) => {
      const meta = `#${row.Rank} / ${row.Pos} / ${row.Team || "FA"} / Proj ${metricValue(row["Proj PPR Pts"])} / LY ${lastYearValue(row)}`;
      return `<button class="player-suggestion ${index === 0 ? "active" : ""}" type="button" data-index="${index}">
        <span><strong>${htmlEscape(row.Player)}</strong><small>${htmlEscape(meta)}</small></span>
        <em>${Number(row["Value Score"] || 0).toFixed(1)}</em>
      </button>`;
    })
    .join("");
  box.hidden = false;
  box.querySelectorAll(".player-suggestion").forEach((button) => {
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      const row = config.suggestions[Number(button.dataset.index)];
      if (row) applyPlayerSuggestion(config, row);
    });
  });
}

function refreshActivePlayerAutocomplete() {
  if (activePlayerAutocomplete) renderPlayerAutocomplete(activePlayerAutocomplete);
}

function setupPlayerAutocomplete() {
  const configs = [
    { input: tradeGive, mode: "line" },
    { input: tradeGet, mode: "line" },
    { input: tradeRoster, mode: "line" },
    { input: liveTierSearch, mode: "single", rows: "available" },
    { input: simSearch, mode: "single", rows: "sim" },
    { input: boardSearch, mode: "single" },
    { input: mockPaste, mode: "mock-line" },
  ].filter((config) => config.input);

  configs.forEach((config) => {
    if (config.input.dataset.playerAutocomplete === "true") return;
    config.input.dataset.playerAutocomplete = "true";
    config.input.autocomplete = "off";
    config.input.spellcheck = false;
    const box = document.createElement("div");
    box.className = "player-suggestions";
    box.hidden = true;
    box.setAttribute("role", "listbox");
    config.box = box;
    config.suggestions = [];
    config.activeIndex = 0;
    config.input.insertAdjacentElement("afterend", box);
    config.input.addEventListener("input", () => renderPlayerAutocomplete(config));
    config.input.addEventListener("focus", () => renderPlayerAutocomplete(config));
    config.input.addEventListener("click", () => renderPlayerAutocomplete(config));
    config.input.addEventListener("blur", () => {
      window.setTimeout(() => hidePlayerAutocomplete(config), 120);
    });
    config.input.addEventListener("keydown", (event) => {
      if (config.box.hidden || !config.suggestions.length) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setPlayerAutocompleteActive(config, (config.activeIndex || 0) + 1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setPlayerAutocompleteActive(config, (config.activeIndex || 0) - 1);
      } else if (event.key === "Enter") {
        event.preventDefault();
        const row = config.suggestions[config.activeIndex || 0];
        if (row) applyPlayerSuggestion(config, row);
      } else if (event.key === "Escape") {
        hidePlayerAutocomplete(config);
      }
    });
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
      <div class="analysis-chip"><span>Last Year</span><strong>${lastYearValue(row)}</strong></div>
      <div class="analysis-chip"><span>Value</span><strong>${row["Value Score"]}</strong></div>
      <div class="analysis-chip"><span>Risk</span><strong>${row.Risk}/10</strong></div>
      <div class="analysis-chip"><span>Volume</span><strong>${row.Volume}</strong></div>
      <div class="analysis-chip"><span>Upside</span><strong>${row.Upside}</strong></div>
      ${draftedChip}
    </div>
    ${playerSynopsisBlock(row)}
    <p><strong>${row.Action}</strong></p>
    <p><strong>Projection source:</strong> ${row["Projection Source"]}</p>
    ${row["Prior Year Source"] ? `<p><strong>Prior-year source:</strong> ${htmlEscape(row["Prior Year Source"])}</p>` : ""}
    ${row["Risk Notes"] ? `<p><strong>Risk read:</strong> ${htmlEscape(row["Risk Notes"])}</p>` : ""}
    <p>${row.Analysis}</p>
  `;
}

function showTrendAnalysis(row) {
  const trendClass = row.Trend === "Rising" ? "trend-riser" : row.Trend === "Falling" ? "trend-faller" : "watch";
  const trendLabel = row.Trend || "Watch";
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
      <div class="analysis-chip"><span>Last Year</span><strong>${lastYearValue(row)}</strong></div>
    </div>
    ${playerSynopsisBlock(row)}
    <p><strong>${row["Draft Action"]}</strong></p>
    <p><strong>Source signal:</strong> ${row["Source Signal"]}</p>
    <p><strong>Catalyst:</strong> ${row.Catalyst}</p>
    <p>${row["Why Rising/Falling"]}</p>
  `;
}

function openPlayerAnalysis(playerName) {
  const row = findPlayer(playerName);
  if (!row) return;
  activeBoard = "combined";
  selectedBoardPlayerKey = normalizePlayerName(row.Player);
  const combinedTab = document.querySelector('.workbook-tabs .tab[data-board="combined"]');
  if (combinedTab) {
    document.querySelectorAll(".workbook-tabs .tab").forEach((tab) => {
      tab.classList.toggle("active", tab === combinedTab);
    });
  }
  activateSection("workbooks");
  renderBoard();
  showAnalysis(row);
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-player-focus]");
  if (!button) return;
  event.preventDefault();
  openPlayerAnalysis(button.dataset.playerFocus);
});

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
  localStorage.setItem(loadoutStorageKey("mock-picks"), mockPaste.value);
}

function tradeSideValue(text) {
  return parseLines(text).map((name) => {
    const row = findPlayer(name);
    return {
      name,
      row,
      value: row ? Number(row["Value Score"] || 0) : 0,
      risk: row ? Number(row.Risk || 0) : 0,
      projection: row ? Number(row["Proj PPR Pts"] || 0) : 0,
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

function tradeTotals(players) {
  return {
    value: players.reduce((sum, item) => sum + item.value, 0),
    projection: players.reduce((sum, item) => sum + item.projection, 0),
    risk: players.length ? players.reduce((sum, item) => sum + item.risk, 0) / players.length : 0,
    best: players.reduce((best, item) => (!best || item.value > best.value ? item : best), null),
  };
}

function tradePositionSummary(players) {
  const counts = positionCounts(players);
  return ["QB", "RB", "WR", "TE", "DST", "K"]
    .filter((pos) => counts[pos])
    .map((pos) => `${pos} ${counts[pos]}`)
    .join(" / ") || "No matched positions";
}

function riskBand(risk) {
  if (!risk) {
    return {
      label: "Waiting on players",
      className: "watch",
      detail: "Incoming risk is the average volatility of the players you receive.",
    };
  }
  if (risk <= 3.5) {
    return {
      label: "Stable",
      className: "good",
      detail: "The incoming side is mostly predictable. That usually means safer weekly points and fewer panic decisions.",
    };
  }
  if (risk <= 5) {
    return {
      label: "Manageable",
      className: "good",
      detail: "This is normal fantasy uncertainty. Let the value edge and roster fit decide the deal.",
    };
  }
  if (risk <= 6.5) {
    return {
      label: "Volatile",
      className: "watch",
      detail: "The incoming side has more role, injury, age, or team-environment uncertainty. Upside is fine, but do not pay full price for it.",
    };
  }
  return {
    label: "High risk",
    className: "danger",
    detail: "The incoming side is fragile. You need a clear discount, major upside, or a roster emergency to justify it.",
  };
}

function tradeRiskRead(giveTotals, getTotals, get) {
  const band = riskBand(getTotals.risk);
  const riskDelta = getTotals.risk - giveTotals.risk;
  const comparison = !get.length
    ? "Add the players you would receive to get a risk read."
    : giveTotals.risk === 0
      ? "The number is a 1-10 average from the live board, where higher means less predictable."
      : riskDelta >= 2
        ? `That is ${riskDelta.toFixed(1)} points riskier than what you are sending.`
        : riskDelta <= -2
          ? `That is ${Math.abs(riskDelta).toFixed(1)} points safer than what you are sending.`
          : "That is close to the risk level you are sending away.";
  const riskyPlayers = get
    .filter((item) => item.row)
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 2)
    .map((item) => `${item.row.Player}: ${item.risk}/10${item.row.Action ? `, ${item.row.Action.toLowerCase()}` : ""}`);
  return {
    ...band,
    comparison,
    notes: riskyPlayers,
  };
}

function tradeDealShape(give, get, net, warnings, giveTotals, getTotals) {
  if (!give.length || !get.length) {
    return {
      label: "Waiting on both sides",
      detail: "Add at least one player to each side and FantasyIQ will read the structure of the offer.",
    };
  }
  const giveBest = giveTotals.best?.value || 0;
  const getBest = getTotals.best?.value || 0;
  const bestPlayerDelta = getBest - giveBest;
  const projectionDelta = getTotals.projection - giveTotals.projection;

  if (bestPlayerDelta <= -10) {
    return {
      label: "Star tax",
      detail: "You are probably giving up the best player. Make sure the total value and roster need are strong enough to cover that.",
    };
  }
  if (give.length > get.length && bestPlayerDelta >= 0) {
    return {
      label: "Consolidation win",
      detail: "You are turning multiple pieces into equal-or-better player quality. That is usually a clean trade shape.",
    };
  }
  if (get.length > give.length) {
    return {
      label: "Depth add",
      detail: "You are adding bodies. Useful if your bench is thin, but it can water down starter quality.",
    };
  }
  if (net >= 4 && warnings.length) {
    return {
      label: "Value with conditions",
      detail: "The math leans your way, but the warnings need a real answer before you accept.",
    };
  }
  if (Math.abs(net) <= 3 && Math.abs(projectionDelta) <= 10) {
    return {
      label: "Need-for-need",
      detail: "This is close enough that team context matters more than the raw score.",
    };
  }
  return {
    label: net >= 0 ? "Clean edge" : "Thin edge",
    detail: net >= 0
      ? "The incoming side gives you a measurable value edge. Check risk and lineup need, then negotiate from strength."
      : "You are giving up value on paper. Only do it if it fixes a real weekly lineup problem.",
  };
}

function renderTradePlayers(container, players, emptyMessage) {
  if (!container) return;
  if (!players.length) {
    container.textContent = emptyMessage;
    return;
  }
  container.innerHTML = players
    .map((item) => {
      if (!item.row) {
        return `<div class="trade-player-chip missing"><strong>${htmlEscape(item.name)}</strong><span>No board match</span><small>Check spelling or use full player name.</small></div>`;
      }
      return `<div class="trade-player-chip">
        ${playerFocusButton(item.row)}
        <span>${item.row.Pos}${item.row["Pos Rank"] || ""} / #${item.row.Rank} / ${htmlEscape(item.row["Pos Tier"] || item.row.Category || "Tier")}</span>
        <small>Value ${item.value.toFixed(1)} / Proj ${item.projection.toFixed(1)} / Risk ${item.risk}/10</small>
        ${playerSynopsisBlock(item.row, { compact: true })}
      </div>`;
    })
    .join("");
}

function renderRosterPills(roster) {
  if (!tradeRosterPills) return;
  if (!roster.length) {
    tradeRosterPills.textContent = "Add roster names to unlock fit warnings.";
    return;
  }
  const counts = positionCounts(roster);
  tradeRosterPills.innerHTML = ["QB", "RB", "WR", "TE", "DST", "K"]
    .map((pos) => `<span>${pos} ${counts[pos] || 0}</span>`)
    .join("");
}

function tradeFitWarnings(give, get, roster) {
  const warnings = [];
  const before = positionCounts(roster);
  const after = { ...before };
  give.forEach((item) => {
    if (item.row?.Pos && after[item.row.Pos] !== undefined) after[item.row.Pos] -= 1;
  });
  get.forEach((item) => {
    if (item.row?.Pos) after[item.row.Pos] = (after[item.row.Pos] || 0) + 1;
  });

  if (roster.length) {
    if ((after.RB || 0) < 3) warnings.push("RB room gets thin.");
    if ((after.WR || 0) < 4) warnings.push("WR room gets thin.");
    if ((after.TE || 0) < 1) warnings.push("No TE left after trade.");
    const giveCounts = positionCounts(give);
    const getCounts = positionCounts(get);
    ["RB", "WR", "TE", "QB"].forEach((pos) => {
      if ((giveCounts[pos] || 0) > (getCounts[pos] || 0) && (after[pos] || 0) <= 2 && ["RB", "WR"].includes(pos)) {
        warnings.push(`You are losing ${pos} depth.`);
      }
    });
  }

  const giveBest = tradeTotals(give).best;
  const getBest = tradeTotals(get).best;
  if (giveBest?.value && getBest?.value && giveBest.value - getBest.value >= 10) {
    warnings.push(`You are giving up the best player: ${giveBest.row?.Player || giveBest.name}.`);
  }
  if (tradeTotals(get).risk - tradeTotals(give).risk >= 2) {
    warnings.push("Incoming side carries meaningfully more risk.");
  }
  return warnings;
}

function renderTradeCalc() {
  if (!tradeOutput) return;
  if (!boardData) {
    tradeOutput.innerHTML = `
      <span class="trade-verdict-label">Trade verdict</span>
      <strong>Loading board</strong>
      <p>Live ESPN board values are still loading. Try again in a moment.</p>
    `;
    return;
  }
  const give = tradeSideValue(tradeGive?.value || "");
  const get = tradeSideValue(tradeGet?.value || "");
  const roster = tradeSideValue(tradeRoster?.value || "");
  const giveTotals = tradeTotals(give);
  const getTotals = tradeTotals(get);
  const giveTotal = giveTotals.value;
  const getTotal = getTotals.value;
  const net = getTotal - giveTotal;
  const projectionDelta = getTotals.projection - giveTotals.projection;
  const unknowns = [...give, ...get].filter((item) => !item.row).map((item) => item.name);
  const warnings = tradeFitWarnings(give, get, roster);
  const riskRead = tradeRiskRead(giveTotals, getTotals, get);
  const dealShape = tradeDealShape(give, get, net, warnings, giveTotals, getTotals);
  const verdict =
    !give.length || !get.length
      ? "Enter both sides"
      : unknowns.length
        ? "Fix unknown players"
        : net >= 10 && !warnings.length
          ? "Accept"
          : net >= 4
            ? "Lean accept"
            : net >= -3
              ? "Fair, negotiate"
              : net >= -9
                ? "Only for roster fit"
                : "Reject or counter";
  const verdictClass =
    verdict === "Accept" || verdict === "Lean accept"
      ? "good"
      : verdict === "Reject or counter" || verdict === "Fix unknown players"
        ? "danger"
        : "watch";
  const summary =
    !give.length || !get.length
      ? "Type one player per line on each side. The calculator updates from the live ESPN board."
      : `${net >= 0 ? "+" : ""}${net.toFixed(1)} net value, ${projectionDelta >= 0 ? "+" : ""}${projectionDelta.toFixed(1)} projected PPR. ${riskRead.label} incoming risk.`;

  if (tradeGiveTotal) tradeGiveTotal.textContent = giveTotal.toFixed(1);
  if (tradeGetTotal) tradeGetTotal.textContent = getTotal.toFixed(1);
  if (tradeRosterStatus) tradeRosterStatus.textContent = roster.length ? "Loaded" : "Optional";
  renderTradePlayers(tradeGiveList, give, "No outgoing players yet.");
  renderTradePlayers(tradeGetList, get, "No incoming players yet.");
  renderRosterPills(roster);

  tradeOutput.innerHTML = `
    <span class="trade-verdict-label">Trade verdict</span>
    <strong class="${verdictClass}">${verdict}</strong>
    <p>${htmlEscape(summary)}</p>
    <div class="trade-score-grid">
      <div><span>Net Value</span><strong>${net >= 0 ? "+" : ""}${net.toFixed(1)}</strong></div>
      <div><span>Projected PPR</span><strong>${projectionDelta >= 0 ? "+" : ""}${projectionDelta.toFixed(1)}</strong></div>
      <div><span>Incoming Risk</span><strong class="${riskRead.className}">${getTotals.risk.toFixed(1)}/10</strong><small>${htmlEscape(riskRead.label)}</small></div>
      <div><span>Roster Fit</span><strong>${roster.length ? "Active" : "Pending"}</strong></div>
    </div>
    <div class="trade-detail-grid">
      <article class="trade-risk-read ${riskRead.className}">
        <span>Incoming risk explained</span>
        <strong>${htmlEscape(riskRead.label)}</strong>
        <p>${htmlEscape(riskRead.detail)} ${htmlEscape(riskRead.comparison)}</p>
        ${riskRead.notes.length ? `<ul>${riskRead.notes.map((note) => `<li>${htmlEscape(note)}</li>`).join("")}</ul>` : ""}
      </article>
      <article class="trade-shape-read">
        <span>Deal shape</span>
        <strong>${htmlEscape(dealShape.label)}</strong>
        <p>${htmlEscape(dealShape.detail)}</p>
      </article>
    </div>
    <p><strong>Positions:</strong> Send ${tradePositionSummary(give)}. Receive ${tradePositionSummary(get)}.</p>
    ${warnings.length ? `<div class="trade-warning-list">${warnings.map((warning) => `<span>${htmlEscape(warning)}</span>`).join("")}</div>` : ""}
    ${unknowns.length ? `<p><strong>Unknown players:</strong> ${unknowns.map(htmlEscape).join(", ")}.</p>` : ""}
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
  return myTeamSelect?.value || appConfig.customerTeamId || "";
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
      ${playerFocusButton(row)}
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
    ${playerFocusButton(row)}
    <div class="rec-meta">
      <em>${decision.label}</em>
      <b class="${decision.survival.className}">${survivalText}</b>
      <b>${row["Pos Tier"] || row.Category}</b>
    </div>
    <small>${decision.reason} Proj PPR: ${row["Proj PPR Pts"]}. Value: ${row["Value Score"]}. ${decision.survival.detail}</small>
    ${playerSynopsisBlock(row, { compact: true })}
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
  const teamStorageKey = loadoutStorageKey("my-team");
  const saved = localStorage.getItem(teamStorageKey) || myTeamSelect.value || appConfig.customerTeamId || "";
  myTeamSelect.innerHTML = `<option value="">Choose your team</option>${liveDraft.teams
    .map((team) => `<option value="${htmlEscape(team.teamId)}">${htmlEscape(team.teamName)}${team.manager ? ` (${htmlEscape(team.manager)})` : ""}</option>`)
    .join("")}`;
  if (saved) myTeamSelect.value = saved;
  if (!localStorage.getItem(teamStorageKey) && appConfig.customerTeamId) {
    localStorage.setItem(teamStorageKey, appConfig.customerTeamId);
  }
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
        ${value?.row ? playerFocusButton(value.row) : `<strong>${htmlEscape(playerText)}</strong>`}
        ${valueLabel}
        <small>${htmlEscape(pick.fantasyTeam)}${pick.manager ? ` / ${htmlEscape(pick.manager)}` : ""}. ${htmlEscape(detail)}</small>
        ${value?.row ? playerSynopsisBlock(value.row, { compact: true }) : ""}
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
          ${row ? playerFocusButton(row) : `<strong>${htmlEscape(pick.player)}</strong>`}
          <em>${row?.Pos || pick.pos || "Player"}</em>
          <small>${row ? `Board rank ${row.Rank}. ${row.Action}` : "No board match yet."}</small>
          ${row ? playerSynopsisBlock(row, { compact: true }) : ""}
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

function cheatcodePlayerCard(row, label, detail = "") {
  if (!row) return `<div class="pick-card"><strong>Waiting</strong><small>No matching player yet.</small></div>`;
  return `<div class="pick-card cheatcode-player">
    <span>${htmlEscape(label)} / #${row.Rank} / ${row.Pos} / ${row.Team}</span>
    ${playerFocusButton(row)}
    <em>${htmlEscape(row["Pos Tier"] || row.Category || "Board value")}</em>
    <small>${htmlEscape(detail || row.Action || "Use as a tiebreaker.")}</small>
    ${playerSynopsisBlock(row, { compact: true })}
  </div>`;
}

function bestCheatcodeRows(counts) {
  const rows = availableRows();
  const ranked = rows
    .map((row) => ({ row, score: adjustedRecommendationScore(row, counts), decision: recommendationDecision(row, counts) }))
    .sort((a, b) => b.score - a.score);
  const usable = ranked.filter((item) => item.decision.label !== "Avoid");
  const bestNow = usable.find((item) => ["Pick now", "Target", "Controlled risk", "Board value"].includes(item.decision.label)) || usable[0];
  const bestValue = usable
    .filter((item) => !positionClosed(item.row, counts))
    .sort((a, b) => Number(b.row["Value Score"] || 0) - Number(a.row["Value Score"] || 0) || Number(a.row.Rank) - Number(b.row.Rank))[0];
  const safe = usable
    .filter((item) => Number(item.row.Risk || 0) <= 4 && !["DST", "K"].includes(item.row.Pos))
    .sort((a, b) => Number(a.row.Rank) - Number(b.row.Rank))[0];
  const upside = usable
    .filter((item) => ["RB", "WR", "TE"].includes(item.row.Pos) && Number(item.row.Upside || item.row.Ceiling || 0) >= 65)
    .sort((a, b) => Number(b.row.Upside || b.row.Ceiling || 0) - Number(a.row.Upside || a.row.Ceiling || 0))[0];
  return { ranked, usable, bestNow, bestValue, safe, upside };
}

function cheatcodeTierCliffs() {
  return ["RB", "WR", "TE", "QB"]
    .map((pos) => topTierInfo(pos))
    .filter((info) => info.rows.length)
    .sort((a, b) => a.count - b.count)
    .slice(0, 4);
}

function renderCheatcodeMode() {
  if (!cheatcodeStatus) return;
  if (!boardData) {
    cheatcodeStatus.textContent = "Loading player board and draft intelligence.";
    [cheatcodeHero, cheatcodeNow, cheatcodeValue, cheatcodeSafe, cheatcodeUpside, cheatcodeTier, cheatcodeWait, cheatcodeAvoid, cheatcodeRoom]
      .filter(Boolean)
      .forEach((node) => {
        node.textContent = "Waiting for board data.";
      });
    return;
  }

  const teamId = selectedTeamId();
  const hasLive = Boolean(liveDraft);
  const { counts } = teamId ? rosterCountsFor(teamId) : { counts: emptyPositionCounts() };
  const nextPick = teamId ? nextMyPick(teamId) : null;
  const until = nextPick ? picksUntil(nextPick) : null;
  const { bestNow, bestValue, safe, upside, ranked } = bestCheatcodeRows(counts);
  const nowDecision = bestNow ? recommendationDecision(bestNow.row, counts) : null;
  const bestPlayer = bestNow?.row || bestValue?.row || safe?.row || availableRows()[0];
  const heroState = !teamId
    ? "Choose your ESPN team to unlock the full cheatcode read."
    : !hasLive
      ? "Board intelligence is ready. Live draft sync is still connecting."
      : until === 0
        ? "You are on the clock. Take the highest-confidence edge."
        : `${until} picks until you. ${nowDecision?.label || "Target"}: ${bestPlayer?.Player || "best available"}.`;

  cheatcodeStatus.innerHTML = `<strong>${hasLive ? "Live intelligence ready" : "Board intelligence ready"}</strong>: ${htmlEscape(heroState)}`;
  if (cheatcodeHero) {
    cheatcodeHero.innerHTML = `
      <div>
        <span>Cheatcode read</span>
        <strong>${htmlEscape(bestPlayer?.Player || "Waiting for board")}</strong>
        <small>${bestPlayer ? htmlEscape(`${nowDecision?.label || "Best value"} / ${bestPlayer.Pos} / ${bestPlayer.Team} / ${bestPlayer["Pos Tier"] || bestPlayer.Category}`) : "No player selected yet."}</small>
      </div>
      <div>
        <span>Next pick</span>
        <strong>${nextPick ? `R${nextPick.round} P${nextPick.roundPick}` : teamId ? "Complete" : "Select team"}</strong>
        <small>${nextPick ? `Overall ${nextPick.overall}, ${until} picks away` : teamId ? "No remaining ESPN picks found" : "Use the team selector in Draft Room"}</small>
      </div>
      <div>
        <span>Roster shape</span>
        <strong>RB ${counts.RB} / WR ${counts.WR}</strong>
        <small>QB ${counts.QB}, TE ${counts.TE}, DST ${counts.DST}, K ${counts.K}</small>
      </div>
    `;
  }

  if (cheatcodeNow) {
    cheatcodeNow.innerHTML = bestNow
      ? renderRecommendationCard(bestNow.row, counts, 0)
      : "<p>No urgent pick yet. Let the room make the first mistake.</p>";
  }
  if (cheatcodeValue) {
    cheatcodeValue.innerHTML = cheatcodePlayerCard(
      bestValue?.row,
      "Best value",
      bestValue ? `Value score ${bestValue.row["Value Score"]}. ${bestValue.row.Action}` : "",
    );
  }
  if (cheatcodeSafe) {
    cheatcodeSafe.innerHTML = cheatcodePlayerCard(
      safe?.row,
      "Low-regret",
      safe ? `Risk ${safe.row.Risk}/10 with strong board rank for the current room.` : "",
    );
  }
  if (cheatcodeUpside) {
    cheatcodeUpside.innerHTML = cheatcodePlayerCard(
      upside?.row,
      "Upside swing",
      upside ? `Upside ${upside.row.Upside || upside.row.Ceiling}/100. Best used after the foundation is protected.` : "",
    );
  }

  if (cheatcodeTier) {
    const cliffs = cheatcodeTierCliffs();
    cheatcodeTier.innerHTML = cliffs.length
      ? cliffs
          .map((info) => {
            const severity = info.count <= 2 ? "danger" : info.count <= 4 ? "watch" : "good";
            const names = info.rows.slice(0, 3).map((row) => row.Player).join(", ");
            return `<div class="intel-card ${severity}">
              <strong>${info.pos}: ${info.count} left in ${htmlEscape(info.tier)}</strong>
              <small>${htmlEscape(names)}</small>
            </div>`;
          })
          .join("")
      : "<p>No tier cliff data yet.</p>";
  }

  if (cheatcodeWait) {
    const waitList = teamId
      ? ranked
          .filter((item) => recommendationDecision(item.row, counts).label === "Can wait")
          .slice(0, 3)
      : [];
    cheatcodeWait.innerHTML = waitList.length
      ? waitList.map((item) => renderRecommendationCard(item.row, counts)).join("")
      : "<p>Select your team during a live draft to see who can wait.</p>";
  }

  if (cheatcodeAvoid) {
    const avoids = teamId ? avoidRows(counts) : [];
    cheatcodeAvoid.innerHTML = avoids.length
      ? avoids.map((row) => renderRecommendationCard(row, counts)).join("")
      : "<p>No major avoid flags from roster and round logic.</p>";
  }

  if (cheatcodeRoom) {
    const recent = recentDraftedPicks(12);
    const countsByPos = recentPositionCounts(12);
    const leaders = Object.entries(countsByPos).sort((a, b) => b[1] - a[1]);
    const [runPos, runCount] = leaders[0] || ["None", 0];
    const severity = runCount >= 5 ? "danger" : runCount >= 3 ? "watch" : "good";
    cheatcodeRoom.innerHTML = recent.length
      ? `<div class="intel-card ${severity}">
          <strong>${runCount >= 3 ? `${runPos} pressure: ${runCount} of last ${recent.length}` : "Room is balanced"}</strong>
          <small>${runCount >= 3 ? "Check the tier cliff before reacting." : "Keep taking value. No panic adjustment needed."}</small>
        </div>
        <div class="intel-subgrid">
          <div><h4>Last 12</h4>${leaders.map(([pos, count]) => `<span>${pos} <b>${count}</b></span>`).join("")}</div>
        </div>`
      : "<p>Live picks have not started yet.</p>";
  }
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
        <span>${htmlEscape(pick.fantasyTeam)}</span>
        <small>${htmlEscape(pick.manager || "Manager TBD")}</small>
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
  const syncContext = liveDraft.demoMode
    ? " Public demo league is connected; subscribers get their ESPN league configured after checkout."
    : ` Auto sync checks ESPN every ${LIVE_SYNC_INTERVAL_MS / 1000} seconds.`;

  liveStatus.innerHTML = `<strong>${state}</strong>: ${completed}/${total || 192} picks completed.${syncContext}${stale}`;
  if (liveSyncStatus) {
    liveSyncStatus.textContent = liveDraft.demoMode ? "Demo league connected" : liveDraft.inProgress ? "Draft live" : "ESPN connected";
  }
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
  if (liveSource) liveSource.textContent = liveDraft.demoMode ? "ESPN public demo league" : liveDraft.source || "ESPN public league API";

  renderRecommendations();
  renderMyRoster();
  renderNextPickRadar();
  renderTierAlerts();
  renderRoomDetector();
  renderRiskMeter();
  renderCheatcodeMode();
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
  const selectedSlot = simSlot?.value || localStorage.getItem(loadoutStorageKey("sim-slot")) || "random";
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
  localStorage.setItem(loadoutStorageKey("sim-slot"), selectedSlot);
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
    ${playerFocusButton(row)}
    <div class="rec-meta">
      <em>${decision.label}</em>
      <b class="${decision.survival.className}">${survivalText}</b>
      <b>${htmlEscape(row["Pos Tier"] || row.Category)}</b>
    </div>
    <small>${htmlEscape(decision.reason)} Proj PPR: ${row["Proj PPR Pts"]}. Value: ${row["Value Score"]}. ${htmlEscape(decision.survival.detail)}</small>
    ${playerSynopsisBlock(row, { compact: true })}
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
      ${avoids.map((row) => `<div class="pick-card recommendation wait">${playerFocusButton(row)}<small>${row.Pos} is already filled or poorly timed for this roster.</small>${playerSynopsisBlock(row, { compact: true })}</div>`).join("") || "<p>No avoid flags yet.</p>"}
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
    ${team.picks.map((pick) => `<div class="pick-card made"><span>R${pick.round} P${pick.roundPick}</span>${playerFocusButton(pick.row)}<em>${pick.row.Pos}</em><small>Board rank ${pick.row.Rank}. ${htmlEscape(pick.row.Action)}</small>${playerSynopsisBlock(pick.row, { compact: true })}</div>`).join("") || "<p>No picks yet.</p>"}
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
    .map((pick) => `<div class="pick-card ${pick.pickedByUser ? "priority" : ""}"><span>R${pick.round} P${pick.roundPick} / Team ${pick.slot}</span>${playerFocusButton(pick.row)}<em>${pick.row.Pos}</em><small>${pick.pickedByUser ? "Your pick" : "Opponent pick"} / board rank ${pick.row.Rank}</small>${playerSynopsisBlock(pick.row, { compact: true })}</div>`)
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
  const subscribeUrl = "https://buy.stripe.com/eVq3cvdN71GX84E917efC00";
  if (error?.includes("FANTASY_IQ_LEAGUE_ID is not configured")) {
    if (liveStatus) {
      liveStatus.innerHTML = `
        <strong>Connect your ESPN league after subscribing.</strong>
        Live draft sync is configured for each paid league dashboard.
        <a class="inline-subscribe" href="${subscribeUrl}">Subscribe to connect a league</a>
      `;
    }
    if (liveSyncStatus) liveSyncStatus.textContent = "League setup required";
    return;
  }
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
  if (!ensureCustomerAccess()) return;
  fetch(apiUrl("/api/live-draft", { force: force ? 1 : "" }), { cache: "no-store", headers: apiHeaders() })
    .then((response) => jsonOrAccessError(response, `HTTP ${response.status}`))
    .then((data) => {
      if (!data) throw new Error("Live sync returned an empty response");
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
  if (!ensureCustomerAccess()) return;
  window.clearInterval(liveTimer);
  loadLiveDraft();
  liveTimer = window.setInterval(() => loadLiveDraft(), LIVE_SYNC_INTERVAL_MS);
}

function loadBoards() {
  if (!ensureCustomerAccess()) return;
  if (boardStatus) {
    boardStatus.textContent = "Loading live ESPN board...";
  }
  const liveBoardUrl = appConfig.liveBoardUrl || "/api/live-boards";
  const boardRequestUrl = liveBoardUrl.startsWith("/api/")
    ? apiUrl(liveBoardUrl, { v: Date.now() })
    : `${liveBoardUrl}${liveBoardUrl.includes("?") ? "&" : "?"}v=${Date.now()}`;
  fetch(boardRequestUrl, { cache: "no-store", headers: apiHeaders() })
    .then((response) => {
      if (!response.ok) throw new Error(`Live board returned HTTP ${response.status}`);
      return response.json();
    })
    .catch((error) => {
      console.warn("Live board unavailable, using bundled board.", error);
      if (boardStatus) {
        boardStatus.textContent = "Live board unavailable. Loading bundled board fallback...";
      }
      if (window.FANTASY_BOARDS) {
        return window.FANTASY_BOARDS;
      }
      return fetch(`./data/boards.json?v=${Date.now()}`, { cache: "no-store" }).then((response) => {
        if (!response.ok) throw new Error(`Bundled board returned HTTP ${response.status}`);
        return response.json();
      });
    })
    .then((data) => {
      boardData = data;
      renderBoard();
      renderCheatcodeMode();
      renderLiveDraft();
      renderLiveTierBoard();
      renderMockSimulator();
      renderTradeCalc();
      refreshActivePlayerAutocomplete();
    })
    .catch((error) => {
      if (boardStatus) {
        boardStatus.innerHTML =
          "<strong>Could not load player boards.</strong> Refresh the dashboard or try again shortly.";
      }
      console.error(error);
    });
}

if (boardTable) {
  loadBoards();
}

setupPlayerAutocomplete();

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

const savedSimSlot = localStorage.getItem(loadoutStorageKey("sim-slot"));
if (simSlot && savedSimSlot) {
  simSlot.value = savedSimSlot;
}
simSlot?.addEventListener("change", () => {
  localStorage.setItem(loadoutStorageKey("sim-slot"), simSlot.value);
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
  mockPaste.value = localStorage.getItem(loadoutStorageKey("mock-picks")) || "";
}
gradeMockPicks?.addEventListener("click", renderMockPickGrades);
calculateTrade?.addEventListener("click", renderTradeCalc);
tradeGive?.addEventListener("input", renderTradeCalc);
tradeGet?.addEventListener("input", renderTradeCalc);
tradeRoster?.addEventListener("input", renderTradeCalc);

const savedHideDrafted = localStorage.getItem(loadoutStorageKey("hide-drafted"));
const initialHideDrafted = savedHideDrafted === null ? true : savedHideDrafted === "true";
if (hideDrafted) hideDrafted.checked = initialHideDrafted;
if (hideDraftedBoard) hideDraftedBoard.checked = initialHideDrafted;

function setHideDrafted(value) {
  if (hideDrafted) hideDrafted.checked = value;
  if (hideDraftedBoard) hideDraftedBoard.checked = value;
  localStorage.setItem(loadoutStorageKey("hide-drafted"), String(value));
  renderBoard();
  renderRecommendations();
  renderCheatcodeMode();
  renderLiveTierBoard();
  renderNextPickRadar();
  renderTierAlerts();
  renderRoomDetector();
  renderRiskMeter();
}

hideDrafted?.addEventListener("change", () => setHideDrafted(hideDrafted.checked));
hideDraftedBoard?.addEventListener("change", () => setHideDrafted(hideDraftedBoard.checked));
myTeamSelect?.addEventListener("change", () => {
  localStorage.setItem(loadoutStorageKey("my-team"), myTeamSelect.value);
  renderLiveDraft();
  renderCheatcodeMode();
});
manualSync?.addEventListener("click", () => loadLiveDraft(true));
liveSyncToggle?.addEventListener("change", () => {
  localStorage.setItem(loadoutStorageKey("auto-sync"), String(liveSyncToggle.checked));
  if (liveSyncToggle.checked) {
    startLiveSync();
  } else {
    window.clearInterval(liveTimer);
    if (liveStatus) liveStatus.innerHTML = "<strong>Auto sync paused.</strong> Use Sync Now for a one-time ESPN refresh.";
  }
});

accountAction?.addEventListener("click", () => {
  if (!requiresCustomerAccess()) return;
  if (savedCustomerAccessCode()) {
    signOutCustomer();
  } else {
    showCustomerAccessGate();
  }
});

const savedAutoSync = localStorage.getItem(loadoutStorageKey("auto-sync"));
if (liveSyncToggle && savedAutoSync !== null) {
  liveSyncToggle.checked = savedAutoSync === "true";
}
startLiveSync();

