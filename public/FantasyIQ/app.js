const navItems = document.querySelectorAll(".nav-item");
const panels = document.querySelectorAll(".panel");
const tabs = document.querySelectorAll(".tab");
const plans = document.querySelectorAll(".plan");
const savedInputs = document.querySelectorAll("[data-save]");
const boardTable = document.querySelector("#board-table");
const boardSearch = document.querySelector("#board-search");
const positionFilter = document.querySelector("#position-filter");
const positionButtons = document.querySelectorAll(".position-toggle");
const analysisPane = document.querySelector("#analysis-pane");
const boardStatus = document.querySelector("#board-status");
const reloadBoards = document.querySelector("#reload-boards");
const navJumps = document.querySelectorAll(".nav-jump");
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
const tradeFinder = document.querySelector("#trade-finder");
const waiverAssistant = document.querySelector("#waiver-assistant");
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
const alphaCommandSignal = document.querySelector("#alpha-command-signal");
const alphaCommandMeta = document.querySelector("#alpha-command-meta");
const alphaCommandLeverage = document.querySelector("#alpha-command-leverage");
const alphaSignal = document.querySelector("#alpha-signal");
const alphaScarcity = document.querySelector("#alpha-scarcity");
const alphaMarket = document.querySelector("#alpha-market");
const alphaBuild = document.querySelector("#alpha-build");
const alphaLeverage = document.querySelector("#alpha-leverage");
const warRoomCommand = document.querySelector("#war-room-command");
const warRoomPlayer = document.querySelector("#war-room-player");
const warRoomAction = document.querySelector("#war-room-action");
const warRoomWhy = document.querySelector("#war-room-why");
const warRoomMarket = document.querySelector("#war-room-market");
const warRoomFit = document.querySelector("#war-room-fit");
const warRoomRisk = document.querySelector("#war-room-risk");
const warRoomSecondary = document.querySelector("#war-room-secondary");
const warRoomPlayerCard = document.querySelector("#war-room-player-card");
const warRoomBigBoard = document.querySelector("#war-room-big-board");
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
const postDraftPlan = document.querySelector("#post-draft-plan");
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
const leagueSwitcher = document.querySelector("#league-switcher");
const leagueSwitcherLabel = document.querySelector("#league-switcher-label");
const leagueSelect = document.querySelector("#league-select");
const addLeagueAction = document.querySelector("#add-league-action");
const leagueSlotNote = document.querySelector("#league-slot-note");
let addLeagueDialog = null;
const leagueTeamCount = document.querySelector("#league-team-count");
const leagueTypeNote = document.querySelector("#league-type-note");
const leagueStarters = document.querySelector("#league-starters");
const leagueLineupNote = document.querySelector("#league-lineup-note");
const leagueScoring = document.querySelector("#league-scoring");
const leagueScoringNote = document.querySelector("#league-scoring-note");
const leagueDraftRounds = document.querySelector("#league-draft-rounds");
const leagueDraftNote = document.querySelector("#league-draft-note");
const leagueProfileStrip = document.querySelector("#league-profile-strip");
const leagueRoomNote = document.querySelector("#league-room-note");
const leagueHealthPanel = document.querySelector("#league-health-panel");
const leagueHealthTitle = document.querySelector("#league-health-title");
const leagueHealthScore = document.querySelector("#league-health-score");
const leagueHealthGrid = document.querySelector("#league-health-grid");
const boardMethodNote = document.querySelector("#board-method-note");
const accountAddLeague = document.querySelector("#account-add-league");
const accountDashboardName = document.querySelector("#account-dashboard-name");
const accountDashboardStatus = document.querySelector("#account-dashboard-status");
const accountLeagueSlots = document.querySelector("#account-league-slots");
const accountLeagueSlotDetail = document.querySelector("#account-league-slot-detail");
const accountSupportEmail = document.querySelector("#account-support-email");
const accountLeagueList = document.querySelector("#account-league-list");

const DEFAULT_LINEUP_SLOTS = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 1,
  SUPERFLEX: 0,
  DST: 1,
  K: 1,
  BE: 7,
  IR: 1,
};
const DEFAULT_LEAGUE_SETTINGS = {
  teamCount: 12,
  scoringType: "ppr",
  scoringLabel: "Full PPR",
  receptionPoints: 1,
  lineupSlots: DEFAULT_LINEUP_SLOTS,
  draftRounds: 16,
  playoffTeams: 6,
  source: "FantasyIQ default profile",
};
const SCORING_LABELS = {
  ppr: "Full PPR",
  "half-ppr": "Half PPR",
  standard: "Standard",
  custom: "Custom",
};

function integerSetting(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
}

function normalizeScoringType(value = "ppr") {
  const clean = String(value || "ppr").trim().toLowerCase().replace(/\s+/g, "-");
  if (["half", "half-ppr", "halfppr", "0.5-ppr", "0.5ppr"].includes(clean)) return "half-ppr";
  if (["std", "standard", "non-ppr", "nonppr", "zero-ppr"].includes(clean)) return "standard";
  if (["ppr", "full-ppr", "fullppr", "1-ppr", "1ppr"].includes(clean)) return "ppr";
  return clean || "ppr";
}

function normalizeLineupSlots(slots = {}) {
  const merged = { ...DEFAULT_LINEUP_SLOTS, ...(slots || {}) };
  return Object.fromEntries(
    Object.keys(DEFAULT_LINEUP_SLOTS).map((key) => [key, integerSetting(merged[key], DEFAULT_LINEUP_SLOTS[key])]),
  );
}

function normalizeLeagueSettings(settings = {}) {
  const scoringType = normalizeScoringType(settings.scoringType || settings.scoring || DEFAULT_LEAGUE_SETTINGS.scoringType);
  const receptionPoints =
    settings.receptionPoints !== undefined
      ? Number(settings.receptionPoints)
      : scoringType === "standard"
        ? 0
        : scoringType === "half-ppr"
          ? 0.5
          : scoringType === "ppr"
            ? 1
            : null;
  const normalized = {
    ...DEFAULT_LEAGUE_SETTINGS,
    ...(settings || {}),
    teamCount: integerSetting(settings.teamCount || settings.teams, DEFAULT_LEAGUE_SETTINGS.teamCount),
    scoringType,
    scoringLabel: settings.scoringLabel || SCORING_LABELS[scoringType] || "Custom",
    receptionPoints,
    lineupSlots: normalizeLineupSlots(settings.lineupSlots || settings.roster || {}),
    draftRounds: integerSetting(settings.draftRounds || settings.rounds, DEFAULT_LEAGUE_SETTINGS.draftRounds),
    playoffTeams: integerSetting(settings.playoffTeams, DEFAULT_LEAGUE_SETTINGS.playoffTeams),
    source: settings.source || DEFAULT_LEAGUE_SETTINGS.source,
  };
  return normalized;
}

function leagueSettingsFromParams(params) {
  const lineupSlots = {};
  const overrides = {};
  const slotParams = {
    qb: "QB",
    rb: "RB",
    wr: "WR",
    te: "TE",
    flex: "FLEX",
    superflex: "SUPERFLEX",
    dst: "DST",
    k: "K",
    bench: "BE",
    ir: "IR",
  };
  if (params.get("teams") || params.get("teamCount")) overrides.teamCount = params.get("teams") || params.get("teamCount");
  if (params.get("scoring")) overrides.scoringType = params.get("scoring");
  if (params.get("rounds") || params.get("draftRounds")) overrides.draftRounds = params.get("rounds") || params.get("draftRounds");
  if (params.get("playoffTeams")) overrides.playoffTeams = params.get("playoffTeams");
  Object.entries(slotParams).forEach(([param, slot]) => {
    if (params.get(param) !== null) lineupSlots[slot] = params.get(param);
  });
  if (Object.keys(lineupSlots).length) overrides.lineupSlots = lineupSlots;
  return overrides;
}

function leagueSettingsFromProfile(profile = {}) {
  const rawSettings = profile.leagueSettings || profile.league_settings || {};
  const explicitSettings = rawSettings && typeof rawSettings === "object" && !Array.isArray(rawSettings) ? rawSettings : {};
  const directSettings = {};
  ["teamCount", "teams", "scoringType", "scoring", "scoringLabel", "receptionPoints", "draftRounds", "rounds", "playoffTeams", "source"].forEach(
    (key) => {
      if (profile[key] !== undefined && profile[key] !== null && profile[key] !== "") directSettings[key] = profile[key];
    },
  );
  const rawLineupSlots = profile.lineupSlots || profile.roster || {};
  const directLineupSlots = rawLineupSlots && typeof rawLineupSlots === "object" && !Array.isArray(rawLineupSlots) ? rawLineupSlots : {};
  const rawExplicitLineupSlots = explicitSettings.lineupSlots || {};
  const explicitLineupSlots =
    rawExplicitLineupSlots && typeof rawExplicitLineupSlots === "object" && !Array.isArray(rawExplicitLineupSlots)
      ? rawExplicitLineupSlots
      : {};
  const lineupSlots = {
    ...directLineupSlots,
    ...explicitLineupSlots,
  };
  const payload = {
    ...(explicitSettings || {}),
    ...directSettings,
    ...(Object.keys(lineupSlots).length ? { lineupSlots } : {}),
  };
  return Object.keys(payload).length ? normalizeLeagueSettings(payload) : {};
}

function normalizeLeagueProfiles(profiles = {}) {
  const source = Array.isArray(profiles)
    ? Object.fromEntries(
        profiles
          .filter((profile) => profile && typeof profile === "object")
          .map((profile, index) => [profile.key || profile.slug || profile.leagueKey || profile.leagueName || index, profile]),
      )
    : profiles || {};
  return Object.entries(source)
    .filter(([, profile]) => profile && typeof profile === "object")
    .map(([key, profile]) => {
      const leagueKey = normalizeDashboardSlug(profile.key || profile.slug || profile.leagueKey || key);
      return {
        ...profile,
        key: leagueKey,
        label: profile.label || profile.displayName || profile.leagueName || profile.league_name || leagueKey.replace(/-/g, " "),
        leagueName: profile.leagueName || profile.league_name || profile.label || "",
        customerTeamId: profile.customerTeamId || profile.teamId || profile.team_id || "",
        customerTeamName: profile.customerTeamName || profile.teamName || profile.team_name || "",
        leagueSettings: leagueSettingsFromProfile(profile),
      };
    })
    .filter((profile) => profile.key);
}

function rememberedLeagueKey(loadoutKey, leagues) {
  try {
    const saved = localStorage.getItem(`fantasy-dashboard:${loadoutKey || "default"}:last-league`) || "";
    return leagues.some((league) => league.key === saved) ? saved : "";
  } catch (error) {
    return "";
  }
}

function leagueStorageSegment() {
  return appConfig.leagueKey ? `:league:${appConfig.leagueKey}` : "";
}

const appConfig = resolveAppConfig(window.FANTASY_IQ_CONFIG || {});
window.FANTASY_IQ_ACTIVE_CONFIG = appConfig;

let boardData = null;
let activeBoard = "combined";
let liveDraft = null;
let liveTimer = null;
let mockSim = null;
let selectedBoardPlayerKey = null;
const LIVE_SYNC_INTERVAL_MS = 8000;
const INITIAL_BOARD_LIMIT = 180;
const CUSTOMER_SESSION_DAYS = 30;
let activePlayerAutocomplete = null;
let fullBoardLoadStarted = false;
let customerPasswordSession = false;
let customerBootStarted = false;
let lastLiveDraftRenderSignature = "";

function rememberedCustomerLoadout(loadouts) {
  try {
    const lastLoadout = localStorage.getItem("fantasy-dashboard:last-loadout") || "";
    if (lastLoadout && localStorage.getItem(`fantasy-dashboard:${lastLoadout}:access-code`)) {
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
  const requestedLeague = normalizeDashboardSlug(params.get("league") || params.get("leagueKey") || "");
  const leagueProfiles = normalizeLeagueProfiles(loadoutConfig.leagues || config.leagues || {});
  const rememberedLeague = requestedLeague ? "" : rememberedLeagueKey(loadoutKey || "default", leagueProfiles);
  const defaultLeague = normalizeDashboardSlug(loadoutConfig.defaultLeague || config.defaultLeague || "");
  const activeLeagueKey =
    requestedLeague ||
    rememberedLeague ||
    (leagueProfiles.some((league) => league.key === defaultLeague) ? defaultLeague : "") ||
    leagueProfiles[0]?.key ||
    "";
  const activeLeague = leagueProfiles.find((league) => league.key === activeLeagueKey) || null;
  const merged = { ...config, ...loadoutConfig, loadoutKey: loadoutKey || "default" };
  const paramLeagueSettings = leagueSettingsFromParams(params);
  if (activeLeague) {
    merged.leagueKey = activeLeague.key;
    merged.leagueName = activeLeague.leagueName || activeLeague.label || merged.leagueName;
    merged.customerTeamId = activeLeague.customerTeamId || merged.customerTeamId;
    merged.customerTeamName = activeLeague.customerTeamName || merged.customerTeamName;
    merged.draftCardNote = activeLeague.label || merged.draftCardNote;
  } else {
    merged.leagueKey = activeLeagueKey;
  }
  merged.leagues = leagueProfiles;
  merged.baseLeagueSettings = normalizeLeagueSettings({
    ...(config.leagueSettings || {}),
    ...(loadoutConfig.leagueSettings || {}),
    ...paramLeagueSettings,
    lineupSlots: {
      ...((config.leagueSettings || {}).lineupSlots || {}),
      ...((loadoutConfig.leagueSettings || {}).lineupSlots || {}),
      ...(paramLeagueSettings.lineupSlots || {}),
    },
  });
  merged.leagueSettings = normalizeLeagueSettings({
    ...(config.leagueSettings || {}),
    ...(loadoutConfig.leagueSettings || {}),
    ...((activeLeague || {}).leagueSettings || {}),
    ...paramLeagueSettings,
    lineupSlots: {
      ...((config.leagueSettings || {}).lineupSlots || {}),
      ...((loadoutConfig.leagueSettings || {}).lineupSlots || {}),
      ...(((activeLeague || {}).leagueSettings || {}).lineupSlots || {}),
      ...(paramLeagueSettings.lineupSlots || {}),
    },
  });
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
  const base = `fantasy-dashboard:${appConfig.loadoutKey || "default"}`;
  if (key === "access-code") return `${base}:${key}`;
  return `${base}${leagueStorageSegment()}:${key}`;
}

function requiresCustomerAccess() {
  return Boolean(appConfig.loadoutKey && appConfig.loadoutKey !== "default");
}

function loginRequested() {
  const params = new URLSearchParams(window.location.search);
  return params.has("login") || params.get("auth") === "login";
}

function savedCustomerAccessCode() {
  const key = loadoutStorageKey("access-code");
  const raw = localStorage.getItem(key) || "";
  if (!raw) return "";
  if (!raw.trim().startsWith("{")) return raw;
  try {
    const session = JSON.parse(raw);
    if (!session.code) return "";
    if (session.expiresAt && Date.now() > Number(session.expiresAt)) {
      localStorage.removeItem(key);
      return "";
    }
    return String(session.code || "");
  } catch (error) {
    return raw;
  }
}

function setCustomerAccessCode(value) {
  const now = Date.now();
  localStorage.setItem(
    loadoutStorageKey("access-code"),
    JSON.stringify({
      code: value.trim(),
      signedAt: now,
      expiresAt: now + CUSTOMER_SESSION_DAYS * 24 * 60 * 60 * 1000,
    }),
  );
  localStorage.setItem("fantasy-dashboard:last-loadout", appConfig.loadoutKey || "");
  if (appConfig.leagueKey) {
    localStorage.setItem(`fantasy-dashboard:${appConfig.loadoutKey || "default"}:last-league`, appConfig.leagueKey);
  }
}

function clearCustomerAccessCode() {
  localStorage.removeItem(loadoutStorageKey("access-code"));
}

function hasCustomerAccess() {
  return Boolean(savedCustomerAccessCode() || customerPasswordSession);
}

function rememberCustomerDashboard(customer = {}) {
  const slug = normalizeDashboardSlug(customer.customerSlug || appConfig.loadoutKey || "");
  const leagueKey = normalizeDashboardSlug(customer.leagueKey || appConfig.leagueKey || "");
  if (!slug || slug === "default") return;
  try {
    localStorage.setItem("fantasy-dashboard:last-loadout", slug);
    localStorage.setItem(`fantasy-dashboard:${slug}:password-session`, "true");
    if (leagueKey) {
      localStorage.setItem(`fantasy-dashboard:${slug}:last-league`, leagueKey);
    }
  } catch (error) {
    // Local storage is a convenience only; auth still works from the session cookie.
  }
}

function rememberedPasswordSession() {
  try {
    const slug = normalizeDashboardSlug(localStorage.getItem("fantasy-dashboard:last-loadout") || "");
    return Boolean(slug && localStorage.getItem(`fantasy-dashboard:${slug}:password-session`));
  } catch (error) {
    return false;
  }
}

function apiUrl(path, params = {}) {
  const url = new URL(path, window.location.origin);
  if (appConfig.loadoutKey) {
    url.searchParams.set("customer", appConfig.loadoutKey);
  }
  if (appConfig.leagueKey) {
    url.searchParams.set("league", appConfig.leagueKey);
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

function finishCustomerSignIn(payload, accessCode = "") {
  if (payload.customer?.customerSlug) {
    appConfig.loadoutKey = payload.customer.customerSlug;
  }
  customerPasswordSession = true;
  applyServerCustomerContext(payload.customer);
  rememberCustomerDashboard(payload.customer);
  if (accessCode) setCustomerAccessCode(accessCode);
  removeCustomerAccessGate();
  ensureCustomerUrlContext();
  applyAppConfig();
  updateAccountControl();
  loadBoards();
  startLiveSync();
}

function showCustomerAccessGate(message = "") {
  if (customerAccessGate()) return;
  document.body.classList.add("access-locked");
  const customerLabel = appConfig.customerName || appConfig.customerTeamName || "your dashboard";
  const needsIdentity = !requiresCustomerAccess();
  const gate = document.createElement("section");
  gate.id = "customer-access-gate";
  gate.className = "access-gate";
  gate.innerHTML = `
    <form class="access-card">
      <p class="eyebrow">Customer Login</p>
      <h2>${needsIdentity ? "Log in to your dashboard" : `Open ${htmlEscape(customerLabel)}`}</h2>
      <p>${needsIdentity ? "Use the email from checkout and your FantasyIQ password." : "Use your FantasyIQ password to open your saved leagues."}</p>
      <label ${needsIdentity ? "" : "hidden"}>
        Email or dashboard slug
        <input id="customer-login-identity" type="text" autocomplete="username" ${needsIdentity ? "required" : ""} />
      </label>
      <label>
        Password
        <input id="customer-login-password" type="password" autocomplete="current-password" />
      </label>
      <button type="button" class="access-forgot" id="customer-forgot-password">Forgot password?</button>
      <button type="submit" class="primary-action" id="customer-password-signin">Log in</button>
      <details class="access-recovery" ${message ? "open" : ""}>
        <summary>Setup code or password reset</summary>
        <label>
          Access code
          <input id="customer-access-code" type="password" autocomplete="off" />
        </label>
        <div class="access-grid">
          <label>
            New password
            <input id="customer-new-password" type="password" autocomplete="new-password" />
          </label>
          <label>
            Confirm
            <input id="customer-confirm-password" type="password" autocomplete="new-password" />
          </label>
        </div>
        <div class="access-actions">
          <button type="button" id="customer-code-unlock">Unlock With Code</button>
          <button type="button" id="customer-create-password">Create / Reset Password</button>
          <button type="button" id="customer-email-reset">Send Reset Email</button>
        </div>
      </details>
      <div class="access-message" role="status" aria-live="polite" data-state="${message ? "info" : "idle"}">${message ? htmlEscape(message) : ""}</div>
      <small>Need help? Email ${htmlEscape(appConfig.supportEmail || "support")}.</small>
    </form>
  `;
  document.body.appendChild(gate);
  const identityInput = gate.querySelector("#customer-login-identity");
  const passwordInput = gate.querySelector("#customer-login-password");
  const codeInput = gate.querySelector("#customer-access-code");
  const newPasswordInput = gate.querySelector("#customer-new-password");
  const confirmPasswordInput = gate.querySelector("#customer-confirm-password");
  const recoveryPanel = gate.querySelector(".access-recovery");
  const output = gate.querySelector(".access-message");
  const authButtons = Array.from(gate.querySelectorAll("button"));
  const identityValue = () => (needsIdentity ? identityInput.value.trim() : appConfig.loadoutKey);
  const passwordSetupMessage =
    "This account does not have a saved password yet. Use the access code from the setup email below, enter the password twice, then click Create / Reset Password. You can also click Unlock With Code for one-time access.";
  const friendlyAuthMessage = (message = "") => {
    if (/failed to fetch|networkerror|load failed|abort/i.test(message)) {
      return "Could not reach the FantasyIQ login service. Check your connection and try again.";
    }
    if (/create a password/i.test(message)) return passwordSetupMessage;
    if (/customer account was not found/i.test(message)) {
      return "We could not find that customer account. Use the exact email from checkout, or open the dashboard link from the setup email.";
    }
    if (/email or password/i.test(message)) return "That email and password did not match. Try again, or use your setup access code below to reset/create the password.";
    return message || "Could not sign in. Refresh and try again.";
  };
  const fetchJsonWithRetry = async (path, body, fallbackMessage, attempts = 2) => {
    let lastError = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(path, {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok || payload.authenticated === false) {
          throw new Error(payload.message || fallbackMessage);
        }
        return payload;
      } catch (error) {
        lastError = error;
        const message = String(error?.message || "");
        if (attempt >= attempts || !/failed to fetch|networkerror|load failed|abort/i.test(message)) {
          throw error;
        }
        showAuthMessage("Retrying the login service...", "info");
        await new Promise((resolve) => window.setTimeout(resolve, 900));
      } finally {
        window.clearTimeout(timeout);
      }
    }
    throw lastError || new Error(fallbackMessage);
  };
  const setAuthBusy = (busy) => {
    authButtons.forEach((button) => {
      button.disabled = busy;
      button.setAttribute("aria-busy", busy ? "true" : "false");
    });
  };
  const showAuthMessage = (text, state = "info") => {
    output.textContent = text;
    output.dataset.state = state;
    if (text) output.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  const customerBody = (extra = {}) => ({
    customer: identityValue(),
    league: appConfig.leagueKey || "",
    ...extra,
  });
  const requireIdentity = () => {
    if (!needsIdentity || identityValue()) return true;
    showAuthMessage("Enter the email from checkout or your dashboard slug.", "error");
    return false;
  };
  const postAuth = async (path, body) => {
    return fetchJsonWithRetry(path, body, "That sign in did not work.");
  };
  const sendPasswordReset = async () => {
    if (!requireIdentity()) return;
    showAuthMessage("Sending reset email...", "info");
    setAuthBusy(true);
    const progressTimer = window.setTimeout(() => {
      showAuthMessage("Still checking that account. Keep this window open for a moment.", "info");
    }, 8000);
    try {
      const payload = await fetchJsonWithRetry(
        "/api/customer-password-reset",
        customerBody(),
        "Could not send reset email.",
      );
      showAuthMessage(payload.message || "If that account exists, a password reset email is on the way.", "info");
    } catch (error) {
      showAuthMessage(friendlyAuthMessage(error.message || "Could not send reset email right now."), "error");
    } finally {
      window.clearTimeout(progressTimer);
      setAuthBusy(false);
    }
  };
  (needsIdentity ? identityInput : passwordInput)?.focus();
  gate.querySelector("form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = passwordInput.value.trim();
    if (!password) {
      showAuthMessage("Enter your password, or use the setup access code below to create one.", "error");
      return;
    }
    if (!requireIdentity()) return;
    showAuthMessage("Signing in...", "info");
    setAuthBusy(true);
    try {
      finishCustomerSignIn(await postAuth("/api/customer-login", customerBody({ password })));
    } catch (error) {
      const messageText = friendlyAuthMessage(error.message);
      showAuthMessage(messageText, "error");
      if (messageText === passwordSetupMessage) {
        recoveryPanel.open = true;
        codeInput.focus();
      }
    } finally {
      setAuthBusy(false);
    }
  });
  gate.querySelector("#customer-code-unlock")?.addEventListener("click", async () => {
    const code = codeInput.value.trim();
    if (!code) {
      showAuthMessage("Enter your FantasyIQ access code.", "error");
      return;
    }
    if (!requireIdentity()) return;
    showAuthMessage("Checking access...", "info");
    setAuthBusy(true);
    try {
      finishCustomerSignIn(await postAuth("/api/customer-login", customerBody({ accessCode: code })), code);
    } catch (error) {
      showAuthMessage(friendlyAuthMessage(error.message || "Could not verify the code. Refresh and try again."), "error");
    } finally {
      setAuthBusy(false);
    }
  });
  gate.querySelector("#customer-create-password")?.addEventListener("click", async () => {
    const code = codeInput.value.trim();
    const password = newPasswordInput.value.trim();
    const confirm = confirmPasswordInput.value.trim();
    if (!code) {
      showAuthMessage("Enter your setup access code first.", "error");
      return;
    }
    if (password !== confirm) {
      showAuthMessage("Those passwords do not match.", "error");
      return;
    }
    if (!requireIdentity()) return;
    showAuthMessage("Creating password...", "info");
    setAuthBusy(true);
    try {
      finishCustomerSignIn(await postAuth("/api/customer-password", customerBody({ accessCode: code, password })));
    } catch (error) {
      showAuthMessage(friendlyAuthMessage(error.message || "Could not create that password right now."), "error");
    } finally {
      setAuthBusy(false);
    }
  });
  gate.querySelector("#customer-forgot-password")?.addEventListener("click", sendPasswordReset);
  gate.querySelector("#customer-email-reset")?.addEventListener("click", sendPasswordReset);
}

function ensureCustomerAccess() {
  if (!requiresCustomerAccess()) return true;
  if (hasCustomerAccess()) return true;
  showCustomerAccessGate();
  return false;
}

function handleCustomerAccessFailure(message = "Enter the current customer access code.") {
  if (!requiresCustomerAccess()) return false;
  clearCustomerAccessCode();
  customerPasswordSession = false;
  window.clearInterval(liveTimer);
  updateAccountControl();
  showCustomerAccessGate(message);
  if (liveStatus) liveStatus.innerHTML = "<strong>Customer login required.</strong>";
  return true;
}

async function restoreCustomerSession() {
  if (hasCustomerAccess()) return false;
  if (!(requiresCustomerAccess() || loginRequested() || rememberedPasswordSession())) return false;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(apiUrl("/api/customer-session", { v: Date.now() }), {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok || payload.authenticated === false || !payload.customer) {
      return false;
    }
    customerPasswordSession = true;
    applyServerCustomerContext(payload.customer);
    rememberCustomerDashboard(payload.customer);
    removeCustomerAccessGate();
    ensureCustomerUrlContext();
    applyAppConfig();
    updateAccountControl();
    return true;
  } catch (error) {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function bootCustomerDashboard() {
  if (customerBootStarted) return;
  customerBootStarted = true;
  if (loginRequested() && !hasCustomerAccess()) {
    showCustomerAccessGate();
  }
  await restoreCustomerSession();
  if (loginRequested() && !hasCustomerAccess()) {
    showCustomerAccessGate();
  }
  loadBoards();
  startLiveSync();
}

function updateAccountControl() {
  if (!accountCard) return;
  const customerLabel = appConfig.customerName || appConfig.customerTeamName || appConfig.loadoutKey || "Dashboard";
  if (accountLabel) accountLabel.textContent = requiresCustomerAccess() ? customerLabel : "Public Demo";
  if (accountState) accountState.textContent = requiresCustomerAccess() ? (hasCustomerAccess() ? "Signed In" : "Signed Out") : "Preview";
  if (accountAction) {
    accountAction.textContent = requiresCustomerAccess() ? (hasCustomerAccess() ? "Sign Out" : "Sign In") : "Sign In";
    accountAction.disabled = false;
  }
  accountCard.classList.toggle("signed-in", requiresCustomerAccess() && hasCustomerAccess());
  accountCard.classList.toggle("signed-out", requiresCustomerAccess() && !hasCustomerAccess());
  renderAccountPanel();
}

async function signOutCustomer() {
  clearCustomerAccessCode();
  customerPasswordSession = false;
  fetch("/api/customer-session", { method: "DELETE", cache: "no-store", credentials: "same-origin" }).catch(() => {});
  window.clearInterval(liveTimer);
  liveTimer = null;
  updateAccountControl();
  if (requiresCustomerAccess()) {
    if (liveStatus) liveStatus.innerHTML = "<strong>Signed out.</strong> Sign in to reconnect live draft sync.";
    showCustomerAccessGate("Signed out. Use your password or setup access code to unlock the dashboard.");
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

  if (brandTitle) brandTitle.textContent = siteName;
  if (brandEyebrow) brandEyebrow.textContent = appConfig.customerTeamName || appConfig.leagueName || "League Command Center";
  if (brandSubtitle) {
    brandSubtitle.textContent = customerBrandSubtitle(appConfig.leagueName);
  }
  if (logo && appConfig.logoUrl) logo.src = appConfig.logoUrl;
  if (logo) logo.alt = appConfig.logoAlt || `${siteName} league logo`;
  if (draftCardLabel) draftCardLabel.textContent = appConfig.draftCardLabel || "Subscription";
  if (draftCardValue) draftCardValue.textContent = appConfig.draftCardValue || "$30 / year";
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
  renderLeagueProfile();
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

function mergeLeagueSettings(base, override = {}) {
  return normalizeLeagueSettings({
    ...(base || {}),
    ...(override || {}),
    lineupSlots: {
      ...((base || {}).lineupSlots || {}),
      ...((override || {}).lineupSlots || {}),
    },
  });
}

function activeLeagueSettings() {
  const liveSettings = liveDraft?.leagueSettings || liveDraft?.customer?.leagueSettings || boardData?.customer?.leagueSettings || {};
  return mergeLeagueSettings(appConfig.leagueSettings, liveSettings);
}

function leagueTeamTotal() {
  return Math.max(2, activeLeagueSettings().teamCount || DEFAULT_LEAGUE_SETTINGS.teamCount);
}

function activeLineupSlots() {
  return activeLeagueSettings().lineupSlots || DEFAULT_LINEUP_SLOTS;
}

function starterSlotTotal(settings = activeLeagueSettings()) {
  const slots = settings.lineupSlots || DEFAULT_LINEUP_SLOTS;
  return ["QB", "RB", "WR", "TE", "FLEX", "SUPERFLEX", "DST", "K"].reduce((sum, key) => sum + Number(slots[key] || 0), 0);
}

function draftRoundTotal(settings = activeLeagueSettings()) {
  const starters = starterSlotTotal(settings);
  const bench = Number(settings.lineupSlots?.BE || 0);
  return Math.max(settings.draftRounds || 0, starters + bench, 1);
}

function simTotalPicks() {
  return leagueTeamTotal() * draftRoundTotal();
}

function lineupSummary(settings = activeLeagueSettings()) {
  const slots = settings.lineupSlots || DEFAULT_LINEUP_SLOTS;
  const parts = ["QB", "RB", "WR", "TE"]
    .filter((key) => Number(slots[key] || 0) > 0)
    .map((key) => `${slots[key]} ${key}`);
  if (slots.FLEX) parts.push(`${slots.FLEX} FLEX`);
  if (slots.SUPERFLEX) parts.push(`${slots.SUPERFLEX} SFLEX`);
  if (slots.DST) parts.push(`${slots.DST} DST`);
  if (slots.K) parts.push(`${slots.K} K`);
  return parts.join(" / ");
}

function scoringProjectionLabel() {
  const settings = activeLeagueSettings();
  if (settings.scoringType === "half-ppr") return "Proj Half";
  if (settings.scoringType === "standard") return "Proj Std";
  if (settings.scoringType === "custom") return "Proj Custom";
  return "Proj PPR";
}

function lastYearScoringLabel() {
  const settings = activeLeagueSettings();
  if (settings.scoringType === "half-ppr") return "Last Yr Half";
  if (settings.scoringType === "standard") return "Last Yr Std";
  if (settings.scoringType === "custom") return "Last Yr Custom";
  return "Last Yr PPR";
}

function estimatedReceptions(row) {
  if (!row) return 0;
  const explicit = Number(row.Receptions || row["Projected Receptions"] || row.Rec || row.REC || 0);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  const text = `${row.Analysis || ""} ${row["Daily Synopsis"] || ""}`;
  const match = text.match(/([\d.]+)\s+rec\b/i);
  return match ? Number(match[1]) || 0 : 0;
}

function rowUsesNativeScoring(row) {
  return Boolean(row?.["Native Scoring"] || row?.["Native Projection"] || row?.["Scoring Type"]);
}

function projectionValue(row) {
  const base = Number(row?.["Native Projection"] || row?.["Proj PPR Pts"] || 0);
  if (!base) return 0;
  if (rowUsesNativeScoring(row)) return Math.max(0, base);
  const settings = activeLeagueSettings();
  const currentReceptionPoints =
    settings.receptionPoints === null || settings.receptionPoints === undefined ? 1 : Number(settings.receptionPoints);
  const receptionDelta = Math.max(0, 1 - currentReceptionPoints);
  const adjusted = base - estimatedReceptions(row) * receptionDelta;
  return Math.max(0, adjusted);
}

function projectionDisplay(row) {
  const value = projectionValue(row);
  return value ? value.toFixed(1) : "TBD";
}

function projectionEdgeDisplay(row) {
  const edge = Number(row?.["Projection Edge"] || 0);
  if (!Number.isFinite(edge) || Math.abs(edge) < 0.1) return "Even";
  return `${edge > 0 ? "+" : ""}${edge.toFixed(1)}`;
}

function leagueValueScore(row) {
  if (!row) return 0;
  const settings = activeLeagueSettings();
  const slots = settings.lineupSlots || DEFAULT_LINEUP_SLOTS;
  const teamCount = Number(settings.teamCount || 12);
  const base = Number(row["Value Score"] || 0);
  const posRank = Number(row["Pos Rank"] || 99);
  let score = base;

  if (!rowUsesNativeScoring(row)) {
    if (settings.scoringType === "half-ppr") score -= Math.min(4, estimatedReceptions(row) / 24);
    if (settings.scoringType === "standard") score -= Math.min(8, estimatedReceptions(row) / 12);
  }
  if (slots.SUPERFLEX && row.Pos === "QB") score += Math.max(8, 30 - posRank * 0.65);
  if (!slots.SUPERFLEX && row.Pos === "QB" && teamCount <= 10) score -= 3;
  if (slots.FLEX >= 2 && ["RB", "WR"].includes(row.Pos)) score += 4;
  if (slots.FLEX >= 2 && row.Pos === "TE") score += 1.5;
  if (teamCount >= 14 && ["RB", "WR"].includes(row.Pos)) score += 3;
  if (teamCount <= 10 && Number(row.Upside || row.Ceiling || 0) >= 65) score += 2;
  score += clampNumber(externalTrendScore(row) * 0.25, -5, 5);
  if ((row.Category === "Rookie" || row["Rookie Signal"]) && externalTrendScore(row) >= 7 && Number(row.Rank || 999) > 55) score += 2;
  if (!slots.K && row.Pos === "K") score -= 25;
  if (!slots.DST && row.Pos === "DST") score -= 25;
  return Math.round(score * 10) / 10;
}

function valueDisplay(row) {
  return leagueValueScore(row).toFixed(1);
}

function formatMarketCount(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "0";
  return number.toLocaleString();
}

function externalTrendScore(row) {
  const score = Number(row?.["External Trend Score"] || 0);
  return Number.isFinite(score) ? score : 0;
}

function sleeperMarketCounts(row) {
  const adds = Number(row?.["Sleeper Add Count"] || 0);
  const drops = Number(row?.["Sleeper Drop Count"] || 0);
  const net = Number(row?.["Sleeper Net Adds"] || adds - drops || 0);
  return {
    adds: Number.isFinite(adds) ? adds : 0,
    drops: Number.isFinite(drops) ? drops : 0,
    net: Number.isFinite(net) ? net : 0,
  };
}

function playerMarketMomentum(row) {
  const { adds, drops, net } = sleeperMarketCounts(row);
  const score = externalTrendScore(row);
  const hasSleeperSignal = adds > 0 || drops > 0;
  const rookie = row?.Category === "Rookie" || Boolean(row?.["Rookie Signal"]);
  if (hasSleeperSignal && (net >= 250 || score >= 7)) {
    return {
      label: `Market up ${formatMarketCount(net)}`,
      detail: `Sleeper add/drop pressure is positive: ${formatMarketCount(adds)} adds, ${formatMarketCount(drops)} drops.`,
      className: "good",
      score,
      rookie,
      hasSleeperSignal,
    };
  }
  if (hasSleeperSignal && (net <= -250 || score <= -7)) {
    return {
      label: `Market down ${formatMarketCount(Math.abs(net))}`,
      detail: `Sleeper add/drop pressure is negative: ${formatMarketCount(adds)} adds, ${formatMarketCount(drops)} drops.`,
      className: "danger",
      score,
      rookie,
      hasSleeperSignal,
    };
  }
  if (rookie && hasSleeperSignal) {
    return {
      label: "Rookie signal",
      detail: `Rookie profile with live Sleeper activity: net ${formatMarketCount(net)} over the lookback.`,
      className: score >= 0 ? "watch" : "danger",
      score,
      rookie,
      hasSleeperSignal,
    };
  }
  return {
    label: rookie ? "Rookie watch" : "Neutral signal",
    detail: hasSleeperSignal
      ? `Sleeper net ${formatMarketCount(net)} from ${formatMarketCount(adds)} adds and ${formatMarketCount(drops)} drops.`
      : "No live Sleeper add/drop signal matched yet.",
    className: score < 0 ? "danger" : "watch",
    score,
    rookie,
    hasSleeperSignal,
  };
}

function renderLeagueProfile() {
  const settings = activeLeagueSettings();
  const slots = settings.lineupSlots || DEFAULT_LINEUP_SLOTS;
  const starters = starterSlotTotal(settings);
  const rounds = draftRoundTotal(settings);
  const teamText = `${leagueTeamTotal()} teams`;
  const scoringText = settings.scoringLabel || SCORING_LABELS[settings.scoringType] || "Custom";
  const lineupText = lineupSummary(settings);
  const benchText = `${slots.BE || 0} bench${slots.IR ? ` / ${slots.IR} IR` : ""}`;
  const source = settings.source || "FantasyIQ league profile";

  if (leagueTeamCount) leagueTeamCount.textContent = teamText;
  if (leagueTypeNote) leagueTypeNote.textContent = `ESPN / ${scoringText} / redraft`;
  if (leagueStarters) leagueStarters.textContent = `${starters} starters`;
  if (leagueLineupNote) leagueLineupNote.textContent = `${lineupText} / ${benchText}`;
  if (leagueScoring) leagueScoring.textContent = scoringText;
  if (leagueScoringNote) {
    leagueScoringNote.textContent = "Raw-stat scoring when live board is loaded";
  }
  if (leagueDraftRounds) leagueDraftRounds.textContent = `${rounds} rounds`;
  if (leagueDraftNote) leagueDraftNote.textContent = `${settings.playoffTeams || 0} playoff teams`;
  if (leagueProfileStrip) {
    leagueProfileStrip.innerHTML = `<strong>League engine active</strong><span>${htmlEscape(teamText)} / ${htmlEscape(scoringText)} / ${htmlEscape(lineupText)}. Source: ${htmlEscape(source)}.</span>`;
  }
  if (leagueRoomNote) {
    leagueRoomNote.innerHTML = `<strong>${htmlEscape(scoringText)} league profile</strong><span>${htmlEscape(teamText)} with ${htmlEscape(lineupText)}. Recommendations, mocks, and trades are using this profile.</span>`;
  }
  if (boardMethodNote) {
    boardMethodNote.textContent = boardData?.scoringProfile
      ? "Source-backed raw-stat board with league-native scoring and live market signals"
      : "Source-backed board with league-profile adjustments";
  }
  renderLeagueHealth();
  document.querySelectorAll(".superflex-toggle").forEach((button) => {
    button.hidden = Number(slots.SUPERFLEX || 0) === 0;
  });
  populateSimSlotOptions();
  renderLeagueSwitcher();
  renderAccountPanel();
}

function populateSimSlotOptions() {
  if (!simSlot) return;
  const settings = activeLeagueSettings();
  const teamCount = Math.max(2, settings.teamCount || 12);
  const saved = localStorage.getItem(loadoutStorageKey("sim-slot")) || simSlot.value || "random";
  const currentValue = saved === "random" || Number(saved) <= teamCount ? saved : "random";
  simSlot.innerHTML = `<option value="random">Random</option>${Array.from({ length: teamCount }, (_, index) => {
    const slot = index + 1;
    return `<option value="${slot}">${slot}</option>`;
  }).join("")}`;
  simSlot.value = currentValue;
}

function currentLeagueOptions() {
  const serverLeagues = liveDraft?.customer?.leagues || boardData?.customer?.leagues || [];
  const options = normalizeLeagueProfiles(serverLeagues);
  return options.length ? options : appConfig.leagues || [];
}

function activeLeagueOption() {
  const options = currentLeagueOptions();
  return options.find((league) => league.key === appConfig.leagueKey) || options[0] || null;
}

function hasPrimaryLeagueProfile() {
  return Boolean(appConfig.leagueId || appConfig.customerTeamName);
}

function leagueHealthItems() {
  const settings = activeLeagueSettings();
  const teamId = String(appConfig.customerTeamId || "");
  const liveTeams = liveDraft?.teams || [];
  const matchedTeam = teamId ? liveTeams.find((team) => String(team.teamId) === teamId) : null;
  const publicSyncDetail = liveDraft?.staleError
    ? `Stale fallback: ${liveDraft.staleError}`
    : liveDraft
      ? `${liveDraft.demoMode ? "Demo league" : "Public ESPN league"} synced ${formatSyncTime(liveDraft.syncedAt)}`
      : appConfig.leagueId
        ? "Waiting for first ESPN sync"
        : requiresCustomerAccess()
          ? "League setup is still needed"
          : "Demo league will connect automatically";
  const draftState = liveDraft?.inProgress ? "Draft live" : liveDraft?.drafted ? "Draft complete" : liveDraft ? "Board loaded" : "Pending";
  return [
    {
      label: "Account",
      value: requiresCustomerAccess() ? (hasCustomerAccess() ? "Signed in" : "Sign in needed") : "Demo preview",
      detail: requiresCustomerAccess() ? (hasCustomerAccess() ? "Dashboard access is active on this device." : "Unlock to save and read paid league profiles.") : "Public preview with sample data.",
      state: requiresCustomerAccess() && !hasCustomerAccess() ? "warn" : "good",
    },
    {
      label: "ESPN Sync",
      value: liveDraft?.staleError ? "Needs review" : liveDraft ? "Connected" : appConfig.leagueId ? "Pending" : requiresCustomerAccess() ? "Setup needed" : "Demo pending",
      detail: publicSyncDetail,
      state: liveDraft?.staleError ? "danger" : liveDraft ? "good" : "warn",
    },
    {
      label: "Team Match",
      value: matchedTeam ? "Matched" : teamId ? "Configured" : "Select team",
      detail: matchedTeam
        ? `${matchedTeam.teamName || appConfig.customerTeamName || `Team ${teamId}`} is tied to recommendations.`
        : teamId
          ? `${appConfig.customerTeamName || `Team ${teamId}`} will match once ESPN teams load.`
          : "Choose your ESPN team for roster and next-pick pressure.",
      state: matchedTeam || teamId ? "good" : "warn",
    },
    {
      label: "Scoring",
      value: settings.scoringLabel || SCORING_LABELS[settings.scoringType] || "Custom",
      detail: `${leagueTeamTotal()} teams, ${lineupSummary(settings)}, ${draftRoundTotal(settings)} rounds.`,
      state: "good",
    },
    {
      label: "Draft State",
      value: draftState,
      detail: liveDraft ? `${Number(liveDraft.completedPicks || 0)}/${Number(liveDraft.totalPicks || 0) || leagueTeamTotal() * draftRoundTotal(settings)} picks complete.` : "Sync once before draft day.",
      state: liveDraft ? "good" : "warn",
    },
  ];
}

function renderLeagueHealth() {
  if (!leagueHealthGrid) return;
  const items = leagueHealthItems();
  const dangerCount = items.filter((item) => item.state === "danger").length;
  const warnCount = items.filter((item) => item.state === "warn").length;
  const title = dangerCount ? "Needs attention" : warnCount ? "Ready with checks" : "Ready for draft day";
  const score = dangerCount ? "Review" : warnCount ? `${items.length - warnCount}/${items.length} ready` : "All clear";
  if (leagueHealthTitle) leagueHealthTitle.textContent = title;
  if (leagueHealthScore) leagueHealthScore.textContent = score;
  if (leagueHealthPanel) {
    leagueHealthPanel.dataset.state = dangerCount ? "danger" : warnCount ? "warn" : "good";
  }
  leagueHealthGrid.innerHTML = items
    .map(
      (item) => `<article class="${item.state}">
        <span>${htmlEscape(item.label)}</span>
        <strong>${htmlEscape(item.value)}</strong>
        <small>${htmlEscape(item.detail)}</small>
      </article>`,
    )
    .join("");
}

function configuredLeagueCount(options = currentLeagueOptions()) {
  return Math.max(options.length, hasPrimaryLeagueProfile() ? 1 : 0);
}

function includedLeagueLimit() {
  return Number(appConfig.includedLeagueLimit || 3);
}

function additionalLeaguePaymentUrl() {
  return appConfig.additionalLeaguePaymentLinkUrl || "https://buy.stripe.com/dRmcN5aAV1GX0Cc7X3efC02";
}

function leagueSlotText(count = configuredLeagueCount()) {
  const limit = includedLeagueLimit();
  const price = appConfig.additionalLeaguePriceLabel || "$5 / year";
  if (count < limit) return `${count}/${limit} included leagues`;
  if (count === limit) return `${limit}/${limit} included / + extra ${price}`;
  return `${count} leagues / extras ${price} each`;
}

function accountStatusText() {
  if (!requiresCustomerAccess()) return "Public demo preview. Sign in with your checkout email and access code to open your account.";
  if (hasCustomerAccess()) return "Signed in. Refresh will keep this dashboard unlocked on this device.";
  return "Signed out. Use your password or setup access code to unlock saved leagues.";
}

function leagueSetupUrl(league = null) {
  const setupUrl = new URL("../setup.html", window.location.href);
  if (appConfig.loadoutKey && appConfig.loadoutKey !== "default") setupUrl.searchParams.set("customer", appConfig.loadoutKey);
  if (league?.key) setupUrl.searchParams.set("league", league.key);
  return `${setupUrl.pathname}${setupUrl.search}`;
}

function renderAccountPanel() {
  if (!accountLeagueList) return;
  const options = currentLeagueOptions();
  const count = configuredLeagueCount(options);
  const limit = includedLeagueLimit();
  const active = activeLeagueOption();
  const price = appConfig.additionalLeaguePriceLabel || "$5 / year";
  const support = appConfig.supportEmail || "support@myfantasyiq.com";

  if (accountDashboardName) accountDashboardName.textContent = appConfig.customerName || appConfig.loadoutKey || "FantasyIQ";
  if (accountDashboardStatus) accountDashboardStatus.textContent = accountStatusText();
  if (accountLeagueSlots) accountLeagueSlots.textContent = leagueSlotText(count);
  if (accountLeagueSlotDetail) {
    accountLeagueSlotDetail.textContent =
      count < limit
        ? `${Math.max(0, limit - count)} included ${limit - count === 1 ? "slot" : "slots"} available before an add-on is needed.`
        : `Additional league profiles are ${price} each after the included ${limit}.`;
  }
  if (accountSupportEmail) accountSupportEmail.textContent = support;
  if (accountAddLeague) accountAddLeague.textContent = addLeagueActionTitle(count);

  const leagues = options.length
    ? options
    : hasPrimaryLeagueProfile()
      ? [
        {
          key: appConfig.leagueKey || "current",
          label: currentLeagueDisplayLabel(),
          leagueName: appConfig.leagueName,
          leagueId: appConfig.leagueId,
          teamId: appConfig.customerTeamId,
          teamName: appConfig.customerTeamName,
          leagueSettings: appConfig.leagueSettings,
        },
      ]
      : [];

  const statusSteps = renderAccountProgress(count, limit);
  const leagueMarkup = leagues.length
    ? leagues
      .map((league) => {
        const settings = mergeLeagueSettings(appConfig.baseLeagueSettings || DEFAULT_LEAGUE_SETTINGS, league.leagueSettings || {});
        const isActive = active?.key === league.key || (!active && league.key === appConfig.leagueKey);
        return `<article class="${isActive ? "active" : ""}">
        <div>
          <span>${isActive ? "Active league" : "League profile"}</span>
          <strong>${htmlEscape(league.label || league.leagueName || league.key)}</strong>
          <p>${htmlEscape(league.leagueName || "ESPN league")} / Team ${htmlEscape(league.teamId || league.customerTeamId || "TBD")} / ${htmlEscape(settings.scoringLabel || "Scoring")}</p>
        </div>
        <div class="account-league-actions">
          <button type="button" data-account-switch="${htmlEscape(league.key)}" ${isActive ? "disabled" : ""}>${isActive ? "Active" : "Switch"}</button>
          <a href="${htmlEscape(leagueSetupUrl(league))}">Revalidate</a>
        </div>
      </article>`;
      })
      .join("")
    : requiresCustomerAccess()
    ? `<article class="setup-needed">
        <div>
          <span>League setup</span>
          <strong>Connect your ESPN league</strong>
          <p>Your account is active. Add your public ESPN league ID and team ID once so FantasyIQ can personalize every tool.</p>
        </div>
        <div class="account-league-actions">
          <a href="${htmlEscape(leagueSetupUrl())}" data-open-setup>Open setup</a>
        </div>
      </article>`
    : `<article>
        <div>
          <span>Preview mode</span>
          <strong>Public demo league</strong>
          <p>Subscribe to connect FantasyIQ to your own ESPN league profile.</p>
        </div>
      </article>`;
  accountLeagueList.innerHTML = `${statusSteps}${leagueMarkup}`;

  accountLeagueList.querySelectorAll("[data-account-switch]").forEach((button) => {
    button.addEventListener("click", () => setActiveLeague(button.dataset.accountSwitch));
  });
}

function renderAccountProgress(count, limit) {
  const signedIn = requiresCustomerAccess() && hasCustomerAccess();
  const hasLeague = count > 0 && (appConfig.leagueId || currentLeagueOptions().length || appConfig.customerTeamName);
  const hasIncludedRoom = count < limit;
  const steps = [
    ["Account access", signedIn ? "Ready" : "Needs sign in", signedIn],
    ["League profiles", hasLeague ? `${count} connected` : "Setup needed", hasLeague],
    ["Included slots", hasIncludedRoom ? `${limit - count} open` : "Included slots full", hasIncludedRoom],
    ["Draft room", hasLeague && signedIn ? "Personalized" : "Demo mode", hasLeague && signedIn],
  ];
  return `<section class="account-progress" aria-label="Account setup progress">
    ${steps
      .map(
        ([label, value, complete]) => `<article class="${complete ? "complete" : "pending"}">
          <span>${htmlEscape(label)}</span>
          <strong>${htmlEscape(value)}</strong>
        </article>`,
      )
      .join("")}
  </section>`;
}

function addLeagueActionTitle(count = configuredLeagueCount()) {
  const limit = includedLeagueLimit();
  const price = appConfig.additionalLeaguePriceLabel || "$5 / year";
  if (requiresCustomerAccess() && count <= 0) return "Finish league setup";
  return count < limit ? "Add included league" : `Add extra league (${price})`;
}

function currentLeagueDisplayLabel() {
  const active = activeLeagueOption();
  if (active) return active.label || active.leagueName || active.key;
  if (requiresCustomerAccess()) {
    if (appConfig.customerTeamName) return appConfig.customerTeamName;
    if (appConfig.leagueName && appConfig.leagueName !== "Public Demo League") return appConfig.leagueName;
    return "Finish league setup";
  }
  return appConfig.leagueName || "Public demo";
}

function applyLeagueOption(option) {
  if (!option) return;
  appConfig.leagueKey = option.key || appConfig.leagueKey || "";
  appConfig.leagueId = option.leagueId || option.espnLeagueId || appConfig.leagueId;
  appConfig.leagueName = option.leagueName || option.label || appConfig.leagueName;
  appConfig.customerTeamId = option.customerTeamId || appConfig.customerTeamId;
  appConfig.customerTeamName = option.customerTeamName || appConfig.customerTeamName;
  appConfig.leagueSettings = mergeLeagueSettings(appConfig.baseLeagueSettings || DEFAULT_LEAGUE_SETTINGS, option.leagueSettings || {});
}

function applyServerCustomerContext(customer = {}) {
  if (!customer || typeof customer !== "object") return;
  const serverLeagues = normalizeLeagueProfiles(customer.leagues || []);
  appConfig.leagues = serverLeagues;
  if (customer.customerSlug) appConfig.loadoutKey = normalizeDashboardSlug(customer.customerSlug);
  if (customer.customerName) appConfig.customerName = customer.customerName;
  if (customer.leagueKey) appConfig.leagueKey = normalizeDashboardSlug(customer.leagueKey);
  if (customer.leagueId) appConfig.leagueId = String(customer.leagueId);
  if (customer.leagueName) appConfig.leagueName = customer.leagueName;
  if (customer.customerTeamId) appConfig.customerTeamId = String(customer.customerTeamId);
  if (customer.customerTeamName) appConfig.customerTeamName = customer.customerTeamName;
  if (customer.includedLeagueLimit) appConfig.includedLeagueLimit = Number(customer.includedLeagueLimit);
  if (customer.additionalLeagueCount !== undefined) appConfig.additionalLeagueCount = Number(customer.additionalLeagueCount || 0);
  if (customer.leagueSettings) appConfig.leagueSettings = mergeLeagueSettings(appConfig.leagueSettings, customer.leagueSettings);
  if (!serverLeagues.length && !customer.leagueId) {
    appConfig.leagueId = "";
    appConfig.leagueKey = "";
    appConfig.customerTeamId = "";
    appConfig.customerTeamName = "";
    if (appConfig.leagueName === "Public Demo League") appConfig.leagueName = "";
  }
  applyLeagueOption(activeLeagueOption());
}

function renderLeagueSwitcher() {
  if (!leagueSwitcher || !leagueSelect) return;
  if (!requiresCustomerAccess()) {
    leagueSwitcher.hidden = true;
    return;
  }
  const options = currentLeagueOptions();
  const count = configuredLeagueCount(options);
  if (leagueSlotNote) leagueSlotNote.textContent = leagueSlotText(count);
  if (addLeagueAction) {
    addLeagueAction.textContent = requiresCustomerAccess() && count <= 0 ? "Set up" : "+";
    addLeagueAction.title = addLeagueActionTitle(count);
  }
  leagueSwitcher.classList.toggle("needs-setup", requiresCustomerAccess() && count <= 0);
  if (options.length <= 1) {
    leagueSelect.innerHTML = "";
    leagueSelect.hidden = true;
    if (leagueSwitcherLabel) leagueSwitcherLabel.textContent = currentLeagueDisplayLabel();
    leagueSwitcher.hidden = false;
    return;
  }
  const active = activeLeagueOption();
  leagueSelect.hidden = false;
  leagueSelect.innerHTML = options
    .map((league) => `<option value="${htmlEscape(league.key)}">${htmlEscape(league.label || league.leagueName || league.key)}</option>`)
    .join("");
  if (active?.key) leagueSelect.value = active.key;
  if (leagueSwitcherLabel) leagueSwitcherLabel.textContent = currentLeagueDisplayLabel();
  leagueSwitcher.hidden = false;
}

function setActiveLeague(leagueKey) {
  const next = currentLeagueOptions().find((league) => league.key === leagueKey);
  if (!next || next.key === appConfig.leagueKey) return;
  applyLeagueOption(next);
  localStorage.setItem(`fantasy-dashboard:${appConfig.loadoutKey || "default"}:last-league`, next.key);
  const params = new URLSearchParams(window.location.search);
  if (appConfig.loadoutKey && appConfig.loadoutKey !== "default" && !params.get("customer") && !params.get("loadout") && !params.get("dashboard")) {
    params.set("customer", appConfig.loadoutKey);
  }
  params.set("league", next.key);
  history.replaceState(null, "", `${window.location.pathname}?${params.toString()}${window.location.hash}`);
  liveDraft = null;
  lastLiveDraftRenderSignature = "";
  boardData = null;
  mockSim = null;
  selectedBoardPlayerKey = null;
  if (boardStatus) boardStatus.textContent = "Switching league profile...";
  if (liveStatus) liveStatus.textContent = "Connecting to selected ESPN league...";
  applyAppConfig();
  renderLeagueSwitcher();
  renderLeagueProfile();
  loadBoards();
  startLiveSync();
}

function closeAddLeagueDialog() {
  if (addLeagueDialog) addLeagueDialog.hidden = true;
}

function ensureAddLeagueDialog() {
  if (addLeagueDialog) return addLeagueDialog;
  const dialog = document.createElement("div");
  dialog.className = "add-league-dialog";
  dialog.hidden = true;
  dialog.innerHTML = `
    <div class="add-league-panel" role="dialog" aria-modal="true" aria-labelledby="add-league-title">
      <button class="add-league-close" type="button" aria-label="Close add league panel">x</button>
      <p class="eyebrow">League Manager</p>
      <h3 id="add-league-title">Add league</h3>
      <p id="add-league-message"></p>
      <div class="add-league-summary" id="add-league-summary"></div>
      <div class="add-league-actions">
        <button class="primary-action" id="add-league-primary" type="button"></button>
      </div>
    </div>
  `;
  document.body.append(dialog);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeAddLeagueDialog();
  });
  dialog.querySelector(".add-league-close")?.addEventListener("click", closeAddLeagueDialog);
  addLeagueDialog = dialog;
  return dialog;
}

function openAddLeagueDialog() {
  const dialog = ensureAddLeagueDialog();
  const count = configuredLeagueCount();
  const limit = includedLeagueLimit();
  const price = appConfig.additionalLeaguePriceLabel || "$5 / year";
  const includedRemaining = Math.max(0, limit - count);
  const needsPayment = count >= limit;
  const needsInitialSetup = requiresCustomerAccess() && count <= 0;
  const title = dialog.querySelector("#add-league-title");
  const message = dialog.querySelector("#add-league-message");
  const summary = dialog.querySelector("#add-league-summary");
  const primary = dialog.querySelector("#add-league-primary");

  if (title) title.textContent = needsInitialSetup ? "Finish League Setup" : needsPayment ? "Add Extra League" : "Add Included League";
  if (message) {
    message.textContent = needsInitialSetup
      ? "Your FantasyIQ account is active. Open setup once to save the ESPN league ID and team ID to this dashboard."
      : needsPayment
      ? `Your Season Pass includes ${limit} leagues. Extra league profiles are ${price} each and can be added after checkout.`
      : `You have ${includedRemaining} included league ${includedRemaining === 1 ? "slot" : "slots"} left in your Season Pass. Open the setup validator to confirm the public ESPN league ID and team ID.`;
  }
  if (summary) {
    summary.innerHTML = `
      <span>${count}/${limit} included leagues configured</span>
      <strong>${needsInitialSetup ? "Setup required before live sync" : needsPayment ? `Extra league add-on: ${htmlEscape(price)}` : "No extra payment needed yet"}</strong>
    `;
  }
  if (primary) {
    primary.textContent = needsPayment ? "Buy Extra League" : "Open Setup Page";
    primary.onclick = async () => {
      if (!requiresCustomerAccess()) {
        closeAddLeagueDialog();
        showCustomerAccessGate("Sign in first, then FantasyIQ can attach the new league to your account.");
        return;
      }
      if (!hasCustomerAccess()) {
        closeAddLeagueDialog();
        showCustomerAccessGate("Sign in before adding another league.");
        return;
      }
      primary.disabled = true;
      primary.textContent = "Preparing...";
      try {
        const response = await fetch(apiUrl("/api/add-league-checkout", { v: Date.now() }), {
          cache: "no-store",
          headers: apiHeaders(),
        });
        const payload = await jsonOrAccessError(response, "Could not prepare add-league checkout.");
        if (payload?.url) {
          window.location.href = payload.url;
        }
      } catch (error) {
        if (message) message.textContent = error.message || "Could not prepare add-league checkout.";
        primary.disabled = false;
        primary.textContent = needsPayment ? "Buy Extra League" : "Open Setup Page";
        return;
      }
      closeAddLeagueDialog();
    };
  }
  dialog.hidden = false;
}

const boardColumns = [
  "Rank",
  "Player",
  "Pos",
  "Team",
  "Proj PPR Pts",
  "Projection Edge",
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
  "Projection Edge",
  "Last Year PPR",
  "Board Rank",
  "Trend Score",
  "Sleeper Net Adds",
  "Confidence",
  "Draft Action",
  "Market Signal",
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
  if (column === "Proj PPR Pts") return scoringProjectionLabel();
  if (column === "Projection Edge") return "League Edge";
  if (column === "Last Year PPR") return lastYearScoringLabel();
  if (column === "Value Score") return "League Value";
  return column;
}

function setActive(items, activeItem) {
  items.forEach((item) => item.classList.toggle("active", item === activeItem));
}

function dashboardUrlWithHash(hash = "") {
  return `${window.location.pathname}${window.location.search}${hash}`;
}

function ensureCustomerUrlContext() {
  if (!requiresCustomerAccess() || !hasCustomerAccess()) return;
  const params = new URLSearchParams(window.location.search);
  let changed = false;
  if (params.has("login")) {
    params.delete("login");
    changed = true;
  }
  if (params.get("auth") === "login") {
    params.delete("auth");
    changed = true;
  }
  if (!params.get("customer") && !params.get("loadout") && !params.get("dashboard")) {
    params.set("customer", appConfig.loadoutKey);
    changed = true;
  }
  if (appConfig.leagueKey && !params.get("league")) {
    params.set("league", appConfig.leagueKey);
    changed = true;
  }
  if (changed) history.replaceState(null, "", `${window.location.pathname}?${params.toString()}${window.location.hash}`);
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

function cellValue(row, key) {
  if (key === "Proj PPR Pts") return projectionDisplay(row);
  if (key === "Projection Edge") return projectionEdgeDisplay(row);
  if (key === "Value Score") return valueDisplay(row);
  if (key === "Sleeper Net Adds") return formatMarketCount(row[key]);
  if (key === "Market Signal") return compactText(row[key], 90);
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

function riskPlainText(row) {
  const risk = Number(row?.Risk || 0);
  if (!risk) return "Risk is not scored yet.";
  if (risk >= 7) return `High risk (${risk}/10). Draft only when the upside fits your roster.`;
  if (risk >= 5) return `Medium risk (${risk}/10). Pair him with safer picks.`;
  if (risk <= 3) return `Lower risk (${risk}/10). Useful when you need stability.`;
  return `Manageable risk (${risk}/10).`;
}

function actionPlainText(row) {
  const action = String(row?.Action || row?.["Draft Action"] || "").trim();
  const lower = action.toLowerCase();
  if (!action) return "Use him as a tiebreaker against players in the same tier.";
  if (lower.includes("anchor")) return "Draft him at this tier if the position fits your build. Do not reach far above the tier.";
  if (lower.includes("discount")) return "Only draft him if he falls below the usual price.";
  if (lower.includes("wait")) return "Wait for the room to discount him before clicking.";
  if (lower.includes("golden-zone")) return "He has upside, but make sure your roster already has enough safe starters.";
  if (lower.includes("under-adp")) return "Target him when he is cheaper than the room expects.";
  if (lower.includes("value")) return "Treat him as a value target, not a must-pick.";
  if (lower.includes("upside")) return "Draft for upside after your core starters are protected.";
  return action;
}

function playerSynopsisParts(row) {
  if (!row) {
    return {
      bottomLine: "No player synopsis is available yet.",
      why: "FantasyIQ needs a board row before it can explain the player.",
      risk: "Risk is not scored yet.",
      move: "Check back after the board refreshes.",
    };
  }
  const rank = row.Rank ? `#${row.Rank} overall` : "unranked";
  const posRank = row["Pos Rank"] ? `${row.Pos}${row["Pos Rank"]}` : row.Pos || "player";
  const tier = row["Pos Tier"] || row.Category || "current tier";
  const projection = projectionDisplay(row);
  const lastYear = lastYearValue(row);
  const market = playerMarketMomentum(row);
  const bottomLine = `${row.Player} is a ${tier} ${row.Pos} for ${row.Team}. FantasyIQ has him ${rank} and ${posRank}.`;
  const why = `${scoringProjectionLabel()} ${projection}; last year: ${lastYear}. ${market.hasSleeperSignal ? market.label : "No strong live market move yet"}.`;
  return {
    bottomLine,
    why,
    risk: riskPlainText(row),
    move: actionPlainText(row),
  };
}

function playerSynopsisText(row) {
  const parts = playerSynopsisParts(row);
  return `${parts.bottomLine} ${parts.why} ${parts.risk} ${parts.move}`;
}

function playerSynopsisHtml(row, compact = false) {
  const parts = playerSynopsisParts(row);
  if (compact) return `<p>${htmlEscape(compactText(`${parts.bottomLine} ${parts.move}`, 155))}</p>`;
  return `<div class="player-synopsis-details">
    <p><strong>Bottom line:</strong> ${htmlEscape(parts.bottomLine)}</p>
    <p><strong>Why it matters:</strong> ${htmlEscape(parts.why)}</p>
    <p><strong>Risk:</strong> ${htmlEscape(parts.risk)}</p>
    <p><strong>Draft move:</strong> ${htmlEscape(parts.move)}</p>
  </div>`;
}

function fantasyIqReadHtml(row, decision = null) {
  const parts = playerSynopsisParts(row);
  const verdict = decision?.label ? `${decision.label}: ${decision.reason}` : parts.move;
  const fit = row ? `${row.Pos} in ${row["Pos Tier"] || row.Category || "current tier"} with league value ${valueDisplay(row)}.` : "No player fit available yet.";
  return `<div class="player-read-copy">
    <p><strong>Move:</strong> ${htmlEscape(verdict)}</p>
    <p><strong>Fit:</strong> ${htmlEscape(fit)}</p>
    <p><strong>Risk:</strong> ${htmlEscape(parts.risk)}</p>
    <p><strong>Plain English:</strong> ${htmlEscape(parts.why)}</p>
  </div>`;
}

function playerSynopsisBlock(row, options = {}) {
  const compact = options.compact ? " compact" : "";
  const latest = row?.["Latest News Date"] || "No dated update";
  const refreshed = row?.["Synopsis Updated"] || boardData?.updated || "Today";
  const source = row?.["News Status"] || row?.["Synopsis Source"] || "Refreshed from the current FantasyIQ board.";
  return `<article class="player-synopsis${compact}">
    <span>Daily Player Synopsis</span>
    <strong>Updated ${htmlEscape(refreshed)} / Latest note: ${htmlEscape(latest)}</strong>
    ${playerSynopsisHtml(row, Boolean(options.compact))}
    ${options.compact ? "" : `<small>${htmlEscape(source)}</small>`}
  </article>`;
}

function playerFocusButton(row, className = "player-focus-button") {
  return `<button type="button" class="${className}" data-player-focus="${htmlEscape(row.Player)}">${htmlEscape(row.Player)}</button>`;
}

function marketSignal(row) {
  if (!row) return { label: "Waiting", detail: "No market read yet.", className: "watch" };
  const momentum = playerMarketMomentum(row);
  if (momentum.hasSleeperSignal && momentum.className !== "watch") {
    return {
      label: momentum.label,
      detail: momentum.detail,
      className: momentum.className,
    };
  }
  const rank = Number(row.Rank || 999);
  const espnAdp = Number(row["ESPN ADP"] || 0);
  const adpValue = Number(row["ADP Value"] || 0);
  if (Number.isFinite(espnAdp) && espnAdp > 0) {
    const gap = espnAdp - rank;
    if (gap >= 12) {
      return {
        label: `Discount by ${Math.round(gap)} picks`,
        detail: `ESPN ADP is ${espnAdp.toFixed(1)} while FantasyIQ rank is ${rank}.`,
        className: "good",
      };
    }
    if (gap <= -10) {
      return {
        label: `Market tax ${Math.abs(Math.round(gap))} picks`,
        detail: `ESPN drafters are paying earlier than FantasyIQ rank.`,
        className: "danger",
      };
    }
    return {
      label: "Fair market",
      detail: `ESPN ADP ${espnAdp.toFixed(1)} is close to FantasyIQ rank ${rank}.`,
      className: "watch",
    };
  }
  if (adpValue >= 74) return { label: "Positive value", detail: `ADP value score ${adpValue}/100.`, className: "good" };
  if (adpValue <= 48) return { label: "Needs discount", detail: `ADP value score ${adpValue}/100.`, className: "danger" };
  return { label: "Neutral market", detail: `ADP value score ${adpValue || "TBD"}.`, className: "watch" };
}

function leagueFitSignal(row, counts = emptyPositionCounts()) {
  if (!row) return { label: "Waiting", detail: "No player selected.", className: "watch" };
  const settings = activeLeagueSettings();
  const scoring = settings.scoringLabel || SCORING_LABELS[settings.scoringType] || "Custom";
  const need = rosterNeed(row, counts);
  const starterText = need === "starter" ? "starter fit" : need === "depth" ? "depth fit" : "luxury fit";
  const className = need === "starter" ? "good" : need === "depth" ? "watch" : "danger";
  return {
    label: `${starterText} in ${scoring}`,
    detail: `${leagueTeamTotal()} teams / ${lineupSummary(settings)}.`,
    className,
  };
}

function riskSignal(row) {
  if (!row) return { label: "Waiting", detail: "No risk read yet.", className: "watch" };
  const risk = Number(row.Risk || 0);
  const floor = Number(row.Floor || 0);
  const upside = Number(row.Upside || row.Ceiling || 0);
  if (risk >= 7) return { label: `High risk ${risk}/10`, detail: `Upside ${upside || "TBD"} but fragile profile.`, className: "danger" };
  if (risk >= 5) return { label: `Volatile ${risk}/10`, detail: `Pair with stable picks. Floor ${floor || "TBD"}.`, className: "watch" };
  return { label: `Stable ${risk || "low"}/10`, detail: `Floor ${floor || "TBD"} / upside ${upside || "TBD"}.`, className: "good" };
}

function commandReason(row, decision, counts) {
  if (!row) return "Waiting for board data.";
  const fit = leagueFitSignal(row, counts);
  const market = marketSignal(row);
  return `${decision?.label || "Target"}: ${decision?.reason || recommendationReason(row, counts)} ${fit.detail} ${market.detail}`;
}

function filteredRows() {
  if (!boardData) return [];
  const query = boardSearch.value.trim().toLowerCase();
  const pos = positionFilter.value;
  const drafted = liveDraftedKeys();
  return boardData.boards[activeBoard].rows.filter((row) => {
    const matchesPosition = !pos || (pos === "FLEX" ? ["RB", "WR", "TE"].includes(row.Pos) : row.Pos === pos);
    const searchable = `${row.Player} ${row.Pos} ${row.Team} ${row.Category} ${row.Tier} ${row["Pos Tier"]} ${row.Action} ${row.Analysis} ${row["Projection Edge"]} ${row["Daily Synopsis"]} ${row["Player Outlook"]} ${row["Risk Notes"]} ${row.Trend} ${row["Source Signal"]} ${row["External Signal"]} ${row.Catalyst} ${row["Why Rising/Falling"]} ${row["Draft Action"]}`.toLowerCase();
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
      const meta = `#${row.Rank} / ${row.Pos} / ${row.Team || "FA"} / ${scoringProjectionLabel()} ${projectionDisplay(row)} / LY ${lastYearValue(row)}`;
      return `<button class="player-suggestion ${index === 0 ? "active" : ""}" type="button" data-index="${index}">
        <span><strong>${htmlEscape(row.Player)}</strong><small>${htmlEscape(meta)}</small></span>
        <em>${valueDisplay(row)}</em>
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
      <div class="analysis-chip"><span>${scoringProjectionLabel()}</span><strong>${projectionDisplay(row)}</strong></div>
      <div class="analysis-chip"><span>League Edge</span><strong>${projectionEdgeDisplay(row)}</strong></div>
      <div class="analysis-chip"><span>Last Year</span><strong>${lastYearValue(row)}</strong></div>
      <div class="analysis-chip"><span>League Value</span><strong>${valueDisplay(row)}</strong></div>
      <div class="analysis-chip"><span>Risk</span><strong>${row.Risk}/10</strong></div>
      <div class="analysis-chip"><span>Volume</span><strong>${row.Volume}</strong></div>
      <div class="analysis-chip"><span>Upside</span><strong>${row.Upside}</strong></div>
      ${draftedChip}
    </div>
    ${playerSynopsisBlock(row)}
    <p><strong>${row.Action}</strong></p>
    <p><strong>Projection source:</strong> ${row["Projection Source"]}</p>
    <p><strong>League profile:</strong> ${htmlEscape(activeLeagueSettings().scoringLabel)} / ${htmlEscape(lineupSummary())}. ${
      rowUsesNativeScoring(row)
        ? "Values are scored from raw ESPN stat projections for this format."
        : "Values are adjusted from the source board for this format."
    }</p>
    ${row["Prior Year Source"] ? `<p><strong>Prior-year source:</strong> ${htmlEscape(row["Prior Year Source"])}</p>` : ""}
    ${row["Risk Notes"] ? `<p><strong>Risk read:</strong> ${htmlEscape(row["Risk Notes"])}</p>` : ""}
    <h3>FantasyIQ Read</h3>
    ${fantasyIqReadHtml(row)}
  `;
}

function showTrendAnalysis(row) {
  const trendClass = row.Trend === "Rising" ? "trend-riser" : row.Trend === "Falling" ? "trend-faller" : "watch";
  const trendLabel = row.Trend || "Watch";
  const marketMomentum = playerMarketMomentum(row);
  const sleeperCounts = sleeperMarketCounts(row);
  analysisPane.innerHTML = `
    <p class="eyebrow">${row.Pos || "Watch"} / ${row.Team || "TBD"} / ${trendLabel}</p>
    <h3>${row.Player}</h3>
    <div class="analysis-grid">
      <div class="analysis-chip ${trendClass}"><span>Trend</span><strong>${row.Trend}</strong></div>
      <div class="analysis-chip"><span>Trend Score</span><strong>${row["Trend Score"]}</strong></div>
      <div class="analysis-chip ${marketMomentum.className}"><span>Sleeper Net</span><strong>${formatMarketCount(sleeperCounts.net)}</strong></div>
      <div class="analysis-chip"><span>Confidence</span><strong>${row.Confidence}</strong></div>
      <div class="analysis-chip"><span>Board Rank</span><strong>${row["Board Rank"] || "Watch"}</strong></div>
      <div class="analysis-chip"><span>Position Tier</span><strong>${row["Pos Tier"] || "Watch"}</strong></div>
      <div class="analysis-chip"><span>${scoringProjectionLabel()}</span><strong>${projectionDisplay(row)}</strong></div>
      <div class="analysis-chip"><span>League Edge</span><strong>${projectionEdgeDisplay(row)}</strong></div>
      <div class="analysis-chip"><span>Last Year</span><strong>${lastYearValue(row)}</strong></div>
    </div>
    ${playerSynopsisBlock(row)}
    <p><strong>${row["Draft Action"]}</strong></p>
    <p><strong>Source signal:</strong> ${htmlEscape(row["Source Signal"])}</p>
    ${row["External Signal"] ? `<p><strong>Live market:</strong> ${htmlEscape(row["External Signal"])}</p>` : ""}
    <p><strong>Catalyst:</strong> ${htmlEscape(row.Catalyst)}</p>
    <h3>FantasyIQ Read</h3>
    ${fantasyIqReadHtml(row)}
  `;
}

function closePlayerDrawer() {
  document.querySelector("#player-card-drawer")?.remove();
  document.body.classList.remove("player-drawer-open");
}

function playerDrawerMetrics(row) {
  const market = marketSignal(row);
  const teamId = selectedTeamId();
  const counts = teamId ? rosterCountsFor(teamId).counts : emptyPositionCounts();
  const fit = leagueFitSignal(row, counts);
  const risk = riskSignal(row);
  const decision = recommendationDecision(row, counts);
  const targetPick = recommendationTargetPick();
  const survival = targetPick ? survivalProjection(row, targetPick) : null;
  return { market, fit, risk, decision, survival, counts };
}

function playerDrawerStat(label, value, detail = "") {
  return `<article>
    <span>${htmlEscape(label)}</span>
    <strong>${htmlEscape(value)}</strong>
    ${detail ? `<small>${htmlEscape(detail)}</small>` : ""}
  </article>`;
}

function openPlayerDrawer(playerName) {
  const row = typeof playerName === "string" ? findPlayer(playerName) : playerName;
  if (!row) return;
  const { market, fit, risk, decision, survival, counts } = playerDrawerMetrics(row);
  const drafted = isDrafted(row);
  closePlayerDrawer();
  const drawer = document.createElement("aside");
  drawer.id = "player-card-drawer";
  drawer.className = "player-card-drawer";
  drawer.setAttribute("role", "dialog");
  drawer.setAttribute("aria-modal", "true");
  drawer.setAttribute("aria-label", `${row.Player} player card`);
  drawer.innerHTML = `
    <div class="player-drawer-scrim" data-close-player-drawer></div>
    <section class="player-drawer-panel">
      <button class="player-drawer-close" type="button" data-close-player-drawer aria-label="Close player card">x</button>
      <p class="eyebrow">${htmlEscape(row.Pos)} / ${htmlEscape(row.Team)} / Bye ${htmlEscape(row.Bye || "TBD")}</p>
      <h2>${htmlEscape(row.Player)}</h2>
      <div class="player-drawer-verdict ${drafted ? "danger" : decision.className}">
        <span>${drafted ? "Drafted" : htmlEscape(decision.label)}</span>
        <strong>${htmlEscape(decision.reason)}</strong>
      </div>
      <div class="player-drawer-grid">
        ${playerDrawerStat("Rank", `#${row.Rank}`, row["Pos Tier"] || row.Category || "")}
        ${playerDrawerStat(scoringProjectionLabel(), projectionDisplay(row), row["Projection Source"] || "")}
        ${playerDrawerStat("League Value", valueDisplay(row), projectionEdgeDisplay(row))}
        ${playerDrawerStat("Market", market.label, market.detail)}
        ${playerDrawerStat("League Fit", fit.label, fit.detail)}
        ${playerDrawerStat("Risk", risk.label, risk.detail)}
        ${playerDrawerStat("Make It Back", survival ? `${survival.pct}%` : "Select team", survival ? survival.detail : "Choose your ESPN team for survival odds.")}
        ${playerDrawerStat("Roster Need", rosterNeed(row, counts), lineupSummary())}
      </div>
      ${playerSynopsisBlock(row)}
      <div class="player-drawer-copy">
        <h3>FantasyIQ Read</h3>
        ${fantasyIqReadHtml(row, decision)}
      </div>
      <div class="player-drawer-actions">
        <button class="primary-action" type="button" data-player-focus-board="${htmlEscape(row.Player)}">Open In Big Board</button>
        <button class="secondary-action" type="button" data-close-player-drawer>Close</button>
      </div>
    </section>
  `;
  document.body.appendChild(drawer);
  document.body.classList.add("player-drawer-open");
  drawer.querySelector(".player-drawer-close")?.focus();
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
  const closeDrawer = event.target.closest("[data-close-player-drawer]");
  if (closeDrawer) {
    event.preventDefault();
    closePlayerDrawer();
    return;
  }
  const boardFocus = event.target.closest("[data-player-focus-board]");
  if (boardFocus) {
    event.preventDefault();
    closePlayerDrawer();
    openPlayerAnalysis(boardFocus.dataset.playerFocusBoard);
    return;
  }
  const button = event.target.closest("[data-player-focus]");
  if (!button) return;
  event.preventDefault();
  openPlayerDrawer(button.dataset.playerFocus);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closePlayerDrawer();
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

function tradeSideValue(text) {
  return parseLines(text).map((name) => {
    const row = findPlayer(name);
    return {
      name,
      row,
      value: row ? leagueValueScore(row) : 0,
      risk: row ? Number(row.Risk || 0) : 0,
      projection: row ? projectionValue(row) : 0,
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
        <small>League value ${item.value.toFixed(1)} / ${scoringProjectionLabel()} ${item.projection.toFixed(1)} / Risk ${item.risk}/10</small>
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
    const starters = starterTargetCounts();
    if ((after.RB || 0) < Math.max(2, starters.RB + 1)) warnings.push("RB room gets thin.");
    if ((after.WR || 0) < Math.max(3, starters.WR + 1)) warnings.push("WR room gets thin.");
    if ((after.TE || 0) < starters.TE) warnings.push("No starting TE left after trade.");
    if (activeLineupSlots().SUPERFLEX && (after.QB || 0) < starters.QB) warnings.push("Superflex QB room gets thin.");
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
      : `${net >= 0 ? "+" : ""}${net.toFixed(1)} net value, ${projectionDelta >= 0 ? "+" : ""}${projectionDelta.toFixed(1)} ${scoringProjectionLabel().toLowerCase()}. ${riskRead.label} incoming risk.`;

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
      <div><span>${scoringProjectionLabel()}</span><strong>${projectionDelta >= 0 ? "+" : ""}${projectionDelta.toFixed(1)}</strong></div>
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
  renderRosterEngines();
}

function gradeLetter(score) {
  if (score >= 93) return "A";
  if (score >= 88) return "A-";
  if (score >= 83) return "B+";
  if (score >= 78) return "B";
  if (score >= 73) return "B-";
  if (score >= 68) return "C+";
  if (score >= 62) return "C";
  if (score >= 55) return "D";
  return "F";
}

function rosterRowsFromText(text = "") {
  return tradeSideValue(text).filter((item) => item.row);
}

function emptyRosterSnapshot(source = "none") {
  return { source, teamId: "", counts: emptyPositionCounts(), picks: [], rows: [], players: [] };
}

function pastedRosterSnapshot() {
  const pasted = rosterRowsFromText(tradeRoster?.value || "");
  if (!pasted.length) return null;
  const rows = pasted.map((item) => item.row);
  return {
    source: "pasted",
    teamId: "",
    counts: positionCounts(pasted),
    picks: [],
    rows,
    players: pasted,
  };
}

function combinedBoardRows() {
  return boardData?.boards?.combined?.rows || [];
}

function liveLeagueTeams() {
  return Array.isArray(liveDraft?.teams) ? liveDraft.teams : [];
}

function liveLeagueHasRosters() {
  return liveLeagueTeams().some((team) => Array.isArray(team.roster) && team.roster.some((entry) => entry?.player));
}

function liveTeamById(teamId) {
  return liveLeagueTeams().find((team) => String(team.teamId) === String(teamId)) || null;
}

function rosterEntriesForTeam(teamOrId) {
  const team = typeof teamOrId === "object" ? teamOrId : liveTeamById(teamOrId);
  return Array.isArray(team?.roster) ? team.roster.filter((entry) => entry?.player) : [];
}

function rosterItemsFromEntries(entries) {
  return entries.map((entry) => {
    const row = findPlayer(entry.player);
    return {
      name: entry.player,
      row,
      entry,
      value: row ? leagueValueScore(row) : 0,
      risk: row ? Number(row.Risk || 0) : 0,
      projection: row ? projectionValue(row) : 0,
    };
  });
}

function countsFromRosterItems(items) {
  const counts = emptyPositionCounts();
  items.forEach((item) => {
    const pos = item.row?.Pos || item.entry?.pos;
    if (counts[pos] !== undefined) counts[pos] += 1;
  });
  return counts;
}

function draftRosterCountsFor(teamId) {
  const counts = emptyPositionCounts();
  const picks = (liveDraft?.picks || []).filter((pick) => String(pick.teamId) === String(teamId) && pick.status === "drafted");
  picks.forEach((pick) => {
    const row = pickBoardRow(pick);
    const pos = row?.Pos || pick.pos;
    if (counts[pos] !== undefined) counts[pos] += 1;
  });
  return { counts, picks, rows: picks.map((pick) => pickBoardRow(pick)).filter(Boolean), rosterEntries: [] };
}

function teamRosterSnapshot(teamOrId) {
  if (!boardData) return emptyRosterSnapshot("loading");
  const team = typeof teamOrId === "object" ? teamOrId : liveTeamById(teamOrId);
  const teamId = team?.teamId || teamOrId || "";
  const entries = rosterEntriesForTeam(team || teamId);
  if (entries.length) {
    const items = rosterItemsFromEntries(entries);
    const rows = items.map((item) => item.row).filter(Boolean);
    return {
      source: "espn",
      teamId: String(teamId),
      teamName: team?.teamName || `Team ${teamId}`,
      manager: team?.manager || "",
      counts: countsFromRosterItems(items),
      picks: [],
      rows,
      players: items.filter((item) => item.row),
      rosterEntries: entries,
      unmatched: items.filter((item) => !item.row),
    };
  }
  const fallback = draftRosterCountsFor(teamId);
  const players = fallback.rows.map((row) => ({
    name: row.Player,
    row,
    value: leagueValueScore(row),
    risk: Number(row.Risk || 0),
    projection: projectionValue(row),
  }));
  return {
    source: "espn",
    teamId: String(teamId),
    teamName: team?.teamName || `Team ${teamId}`,
    manager: team?.manager || "",
    counts: fallback.counts,
    picks: fallback.picks,
    rows: fallback.rows,
    players,
    rosterEntries: [],
    unmatched: [],
  };
}

function espnRosterSnapshot() {
  const teamId = selectedTeamId();
  if (!teamId) return null;
  return teamRosterSnapshot(teamId);
}

function activeRosterSnapshot({ preferPasted = false } = {}) {
  if (!boardData) {
    return emptyRosterSnapshot("loading");
  }
  const pasted = pastedRosterSnapshot();
  const espn = espnRosterSnapshot();
  return preferPasted ? pasted || espn || emptyRosterSnapshot() : espn || pasted || emptyRosterSnapshot();
}

function rosterWeaknesses(snapshot) {
  const counts = snapshot.counts || emptyPositionCounts();
  const starters = starterTargetCounts();
  const targets = draftTargetCounts();
  const positions = ["QB", "RB", "WR", "TE", "DST", "K"].filter((pos) => positionHasDraftSlot(pos));
  return positions
    .map((pos) => {
      const starterGap = Math.max(0, Number(starters[pos] || 0) - Number(counts[pos] || 0));
      const depthGap = Math.max(0, Number(targets[pos] || 0) - Number(counts[pos] || 0));
      const weight = starterGap * 10 + depthGap;
      return { pos, starterGap, depthGap, weight };
    })
    .filter((item) => item.weight > 0)
    .sort((a, b) => b.weight - a.weight);
}

function rosterStrengths(snapshot) {
  const counts = snapshot.counts || emptyPositionCounts();
  const targets = draftTargetCounts();
  return ["QB", "RB", "WR", "TE", "DST", "K"]
    .map((pos) => {
      const rows = snapshot.rows.filter((row) => row.Pos === pos).sort((a, b) => leagueValueScore(b) - leagueValueScore(a));
      const surplus = Math.max(0, Number(counts[pos] || 0) - Number(targets[pos] || 0));
      const topValue = rows[0] ? leagueValueScore(rows[0]) : 0;
      return { pos, surplus, rows, topValue };
    })
    .filter((item) => item.surplus > 0 || item.topValue >= 76)
    .sort((a, b) => b.surplus - a.surplus || b.topValue - a.topValue);
}

function postDraftGrade(snapshot) {
  if (!snapshot.rows.length) {
    return { score: 0, grade: "Pending", label: "Select roster", notes: ["Select your ESPN team or paste a roster to grade it."] };
  }
  const rows = snapshot.rows;
  const values = rows.map((row) => leagueValueScore(row));
  const avgValue = values.reduce((sum, value) => sum + value, 0) / values.length;
  const avgRisk = rows.reduce((sum, row) => sum + Number(row.Risk || 0), 0) / rows.length;
  const rbWr = Number(snapshot.counts.RB || 0) + Number(snapshot.counts.WR || 0);
  const weaknesses = rosterWeaknesses(snapshot);
  const starterGaps = weaknesses.reduce((sum, item) => sum + item.starterGap, 0);
  const depthGaps = weaknesses.reduce((sum, item) => sum + item.depthGap, 0);
  let score = 68 + (avgValue - 50) * 0.45;

  if (snapshot.picks.length) {
    const pickGrades = snapshot.picks.map((pick) => valueForPick(pick).label);
    score += pickGrades.filter((label) => label === "Steal").length * 3;
    score += pickGrades.filter((label) => label === "Good value").length * 2;
    score -= pickGrades.filter((label) => label === "Reach").length * 4;
  }
  score -= starterGaps * 8;
  score -= Math.max(0, depthGaps - starterGaps) * 1.5;
  if (rbWr >= Math.max(5, starterTargetCounts().RB + starterTargetCounts().WR + flexStarterTarget())) score += 4;
  if (avgRisk > 5.2) score -= 4;
  if (avgRisk < 3.2 && rows.length >= 7) score += 2;
  if (activeLineupSlots().SUPERFLEX && Number(snapshot.counts.QB || 0) < 2) score -= 8;
  score = Math.round(clampNumber(score, 45, 98));
  const notes = [
    `Average league value ${avgValue.toFixed(1)} with ${avgRisk.toFixed(1)}/10 average risk.`,
    weaknesses.length
      ? `Main need: ${weaknesses.slice(0, 2).map((item) => item.pos).join(" / ")}.`
      : "Starter and bench targets are mostly covered.",
  ];
  return { score, grade: `${gradeLetter(score)} (${score})`, label: score >= 83 ? "Contender build" : score >= 72 ? "Playable build" : "Needs work", notes };
}

function postDraftActions(snapshot) {
  if (!snapshot.rows.length) return ["Select your ESPN team or paste your roster to generate the plan."];
  const weaknesses = rosterWeaknesses(snapshot);
  const strengths = rosterStrengths(snapshot);
  const actions = [];
  const topNeed = weaknesses[0]?.pos;
  const topSurplus = strengths.find((item) => item.surplus > 0)?.pos;
  if (topNeed) actions.push(`Waiver priority: add ${topNeed} depth before chasing luxury bench points.`);
  if (topNeed && topSurplus) actions.push(`Trade lane: shop extra ${topSurplus} for a ${topNeed} upgrade.`);
  if (snapshot.rows.some((row) => Number(row.Risk || 0) >= 7)) actions.push("Stabilize the bench: pair high-risk upside with one safer weekly role.");
  if (!actions.length) actions.push("Hold the core. Your first move should be opportunistic, not forced.");
  actions.push("Watch injury/news changes before waivers lock; prioritize roles that can become weekly starters.");
  return actions.slice(0, 4);
}

function leagueTeamSnapshots() {
  return liveLeagueTeams()
    .map((team) => teamRosterSnapshot(team))
    .filter((snapshot) => snapshot.teamId && snapshot.rows.length);
}

function leagueRosteredKeys() {
  const keys = new Set();
  const addName = (name) => {
    if (!name) return;
    keys.add(normalizePlayerName(name));
    const row = findPlayer(name);
    if (row) keys.add(normalizePlayerName(row.Player));
  };
  (liveDraft?.rosteredNames || []).forEach(addName);
  liveLeagueTeams().forEach((team) => {
    rosterEntriesForTeam(team).forEach((entry) => addName(entry.player));
  });
  return keys;
}

function waiverPoolRows() {
  if (!boardData) return [];
  const rostered = leagueRosteredKeys();
  if (rostered.size) {
    return combinedBoardRows().filter((row) => !rostered.has(normalizePlayerName(row.Player)));
  }
  return availableRows();
}

function waiverPoolSourceLabel() {
  if (liveLeagueHasRosters()) return "Filtered against active ESPN rosters.";
  if (liveDraft?.draftedNames?.length) return "Filtered against the synced draft board.";
  return "Using the league-adjusted player board.";
}

function waiverCandidates(snapshot, limit = 6) {
  if (!boardData) return [];
  const needs = rosterWeaknesses(snapshot);
  const needWeights = needs.reduce((map, item) => {
    map[item.pos] = item.weight;
    return map;
  }, {});
  const rostered = new Set(snapshot.rows.map((row) => normalizePlayerName(row.Player)));
  return waiverPoolRows()
    .filter((row) => !rostered.has(normalizePlayerName(row.Player)))
    .filter((row) => positionHasDraftSlot(row.Pos) && !["K", "DST"].includes(row.Pos))
    .map((row) => {
      const score =
        leagueValueScore(row) +
        (needWeights[row.Pos] || 0) * 2.4 +
        Number(row.Upside || row.Ceiling || 0) * 0.08 -
        Number(row.Risk || 0) * 0.7 +
        (row.Category === "Sleeper" ? 6 : 0);
      return { row, score };
    })
    .sort((a, b) => b.score - a.score || Number(a.row.Rank) - Number(b.row.Rank))
    .slice(0, limit)
    .map((item) => item.row);
}

function tradeCorePositions() {
  return ["QB", "RB", "WR", "TE"].filter((pos) => positionHasDraftSlot(pos));
}

function tradeKeepCount(pos) {
  const starters = starterTargetCounts();
  const slots = activeLineupSlots();
  let keep = Math.max(1, Number(starters[pos] || 0));
  if (pos === "RB" || pos === "WR") keep += Number(slots.FLEX || 0) ? 1 : 0;
  if (pos === "TE" && Number(slots.FLEX || 0) >= 2) keep += 1;
  return keep;
}

function averageValue(rows) {
  return rows.length ? rows.reduce((sum, row) => sum + leagueValueScore(row), 0) / rows.length : 0;
}

function tradeNeedProfiles(snapshot) {
  const core = tradeCorePositions();
  const weaknesses = rosterWeaknesses(snapshot)
    .filter((item) => core.includes(item.pos))
    .map((item) => ({
      pos: item.pos,
      weight: item.weight,
      label: `${item.pos} need`,
      detail: item.starterGap
        ? `${item.starterGap} starter gap`
        : `${item.depthGap} depth gap`,
    }));
  if (weaknesses.length) return weaknesses;

  return core
    .map((pos) => {
      const rows = snapshot.rows
        .filter((row) => row.Pos === pos)
        .sort((a, b) => leagueValueScore(b) - leagueValueScore(a));
      const starterRows = rows.slice(0, tradeKeepCount(pos));
      const starterAvg = averageValue(starterRows);
      const thinPenalty = Math.max(0, tradeKeepCount(pos) - rows.length) * 12;
      return {
        pos,
        weight: Math.max(1, 76 - starterAvg + thinPenalty),
        label: `${pos} upgrade`,
        detail: starterRows.length ? `starter value ${starterAvg.toFixed(1)}` : "no matched starter",
      };
    })
    .filter((item) => item.weight > 2)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);
}

function tradeStrengthProfiles(snapshot) {
  return tradeCorePositions()
    .map((pos) => {
      const rows = snapshot.rows
        .filter((row) => row.Pos === pos)
        .sort((a, b) => leagueValueScore(b) - leagueValueScore(a));
      const movableRows = rows.slice(tradeKeepCount(pos));
      return {
        pos,
        rows: movableRows,
        surplus: movableRows.length,
        topValue: movableRows[0] ? leagueValueScore(movableRows[0]) : 0,
        detail: movableRows.length ? `${movableRows.length} movable ${pos}` : "",
      };
    })
    .filter((item) => item.rows.length)
    .sort((a, b) => b.surplus - a.surplus || b.topValue - a.topValue);
}

function bestTradePair(giveRows, getRows) {
  let best = null;
  giveRows.slice(0, 5).forEach((give) => {
    getRows.slice(0, 5).forEach((get) => {
      const diff = leagueValueScore(get) - leagueValueScore(give);
      if (diff > 16 || diff < -12) return;
      const projectionDiff = projectionValue(get) - projectionValue(give);
      const score =
        50 -
        Math.abs(diff) * 2 +
        (diff >= -2 ? 5 : 0) +
        Math.max(-4, Math.min(4, projectionDiff / 18));
      if (!best || score > best.score) best = { give, get, diff, score };
    });
  });
  return best;
}

function teamSnapshotLabel(snapshot) {
  if (!snapshot) return "Team";
  return `${snapshot.teamName || `Team ${snapshot.teamId}`}${snapshot.manager ? ` (${snapshot.manager})` : ""}`;
}

function leagueTradeIdeas(snapshot, limit = 6) {
  if (!snapshot?.teamId || !liveLeagueHasRosters()) return [];
  const myNeeds = tradeNeedProfiles(snapshot);
  const myStrengths = tradeStrengthProfiles(snapshot);
  if (!myNeeds.length || !myStrengths.length) return [];

  const ideas = [];
  leagueTeamSnapshots()
    .filter((other) => String(other.teamId) !== String(snapshot.teamId))
    .forEach((other) => {
      const theirNeeds = tradeNeedProfiles(other);
      const theirStrengths = tradeStrengthProfiles(other);
      const giveMatches = myStrengths.filter((strength) => theirNeeds.some((need) => need.pos === strength.pos));
      const getMatches = theirStrengths.filter((strength) => myNeeds.some((need) => need.pos === strength.pos));

      giveMatches.forEach((giveStrength) => {
        getMatches.forEach((getStrength) => {
          if (giveStrength.pos === getStrength.pos) return;
          const pair = bestTradePair(giveStrength.rows, getStrength.rows);
          if (!pair) return;
          const myNeed = myNeeds.find((need) => need.pos === getStrength.pos);
          const theirNeed = theirNeeds.find((need) => need.pos === giveStrength.pos);
          const score =
            pair.score +
            Number(myNeed?.weight || 0) * 0.7 +
            Number(theirNeed?.weight || 0) * 0.55 +
            Math.min(8, giveStrength.surplus + getStrength.surplus);
          ideas.push({
            team: other,
            give: pair.give,
            get: pair.get,
            diff: pair.diff,
            score,
            yourNeed: myNeed,
            theirNeed,
            giveStrength,
            getStrength,
          });
        });
      });
    });

  const seen = new Set();
  return ideas
    .sort((a, b) => b.score - a.score)
    .filter((idea) => {
      const key = `${idea.team.teamId}-${normalizePlayerName(idea.give.Player)}-${normalizePlayerName(idea.get.Player)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

function tradeAwayCandidates(snapshot, limit = 3) {
  const strengths = rosterStrengths(snapshot);
  const surplusPositions = new Set(strengths.filter((item) => item.surplus > 0).map((item) => item.pos));
  return snapshot.rows
    .filter((row) => surplusPositions.has(row.Pos) || Number(row.Risk || 0) >= 6 || marketSignal(row).className === "good")
    .sort((a, b) => {
      const surplusBonus = Number(surplusPositions.has(b.Pos)) - Number(surplusPositions.has(a.Pos));
      return surplusBonus || leagueValueScore(b) - leagueValueScore(a);
    })
    .slice(0, limit);
}

function tradeTargetCandidates(snapshot, limit = 5) {
  const needs = rosterWeaknesses(snapshot);
  const needPositions = needs.length ? new Set(needs.slice(0, 3).map((item) => item.pos)) : new Set(["RB", "WR", "TE"]);
  const rostered = new Set(snapshot.rows.map((row) => normalizePlayerName(row.Player)));
  const leagueTargets = leagueTeamSnapshots()
    .filter((team) => String(team.teamId) !== String(snapshot.teamId))
    .flatMap((team) =>
      team.rows
        .filter((row) => !rostered.has(normalizePlayerName(row.Player)) && needPositions.has(row.Pos))
        .map((row) => ({ pick: null, row, fantasyTeam: teamSnapshotLabel(team) })),
    );
  if (leagueTargets.length) {
    return leagueTargets
      .sort((a, b) => leagueValueScore(b.row) - leagueValueScore(a.row) || Number(a.row.Rank) - Number(b.row.Rank))
      .slice(0, limit);
  }
  const draftedTargets = (liveDraft?.picks || [])
    .map((pick) => ({ pick, row: pickBoardRow(pick) }))
    .filter((item) => item.row && !rostered.has(normalizePlayerName(item.row.Player)) && needPositions.has(item.row.Pos));
  const pool = draftedTargets.length
    ? draftedTargets
    : (boardData?.boards?.combined?.rows || [])
        .filter((row) => !rostered.has(normalizePlayerName(row.Player)) && needPositions.has(row.Pos))
        .map((row) => ({ pick: null, row }));
  return pool
    .sort((a, b) => leagueValueScore(b.row) - leagueValueScore(a.row) || Number(a.row.Rank) - Number(b.row.Rank))
    .slice(0, limit);
}

function renderPlayerMiniCard(row, label = "") {
  return `<div class="trade-player-chip">
    ${playerFocusButton(row)}
    <span>${htmlEscape(label || `${row.Pos}${row["Pos Rank"] || ""} / #${row.Rank}`)}</span>
    <small>Value ${valueDisplay(row)} / ${scoringProjectionLabel()} ${projectionDisplay(row)} / Risk ${row.Risk}/10</small>
  </div>`;
}

function renderTradeIdeaCard(idea) {
  const diff = Number(idea.diff || 0);
  const diffLabel = Math.abs(diff) < 1 ? "even value" : `${diff > 0 ? "+" : ""}${diff.toFixed(1)} value`;
  return `<article class="trade-idea-card">
    <div class="trade-idea-head">
      <span>${htmlEscape(teamSnapshotLabel(idea.team))}</span>
      <strong>Ask for ${htmlEscape(idea.get.Player)}</strong>
      <small>${htmlEscape(diffLabel)} on the FantasyIQ board</small>
    </div>
    <div class="trade-idea-flow">
      <section>
        <h4>You offer</h4>
        ${renderPlayerMiniCard(idea.give, `${idea.give.Pos} depth you can shop`)}
      </section>
      <section>
        <h4>You target</h4>
        ${renderPlayerMiniCard(idea.get, `${idea.get.Pos} fills your ${idea.yourNeed?.label || "need"}`)}
      </section>
    </div>
    <p>${htmlEscape(`Why it fits: you need ${idea.get.Pos}, and ${teamSnapshotLabel(idea.team)} needs ${idea.give.Pos}. This turns your surplus into a cleaner starter/depth lane.`)}</p>
  </article>`;
}

function renderPostDraftPlan(snapshot = activeRosterSnapshot()) {
  if (!postDraftPlan) return;
  if (!boardData) {
    postDraftPlan.textContent = "Waiting for board data.";
    return;
  }
  if (!snapshot.rows.length) {
    postDraftPlan.innerHTML = `
      <div class="post-draft-hero">
        <article>
          <span>Grade</span>
          <strong>Pending</strong>
          <small>Select your ESPN team</small>
        </article>
        <article>
          <span>Plan</span>
          <strong>Locked</strong>
          <small>Needs roster context</small>
        </article>
        <article>
          <span>Next Move</span>
          <strong>Connect</strong>
          <small>Use the team selector above</small>
        </article>
      </div>
      <div class="post-draft-grid">
        <section>
          <h4>What unlocks</h4>
          <p>Grade, roster needs, early waiver watchlist, and clean trade lanes.</p>
        </section>
        <section>
          <h4>Source</h4>
          <p>FantasyIQ uses the selected ESPN team first so the plan stays attached to the customer dashboard.</p>
        </section>
        <section>
          <h4>Manual fallback</h4>
          <p>You can paste a roster in the Trade Calculator when ESPN data is not available yet.</p>
        </section>
      </div>
    `;
    return;
  }
  const grade = postDraftGrade(snapshot);
  const actions = postDraftActions(snapshot);
  const weaknesses = rosterWeaknesses(snapshot);
  const strengths = rosterStrengths(snapshot);
  postDraftPlan.innerHTML = `
    <div class="post-draft-hero">
      <article>
        <span>Grade</span>
        <strong>${htmlEscape(grade.grade)}</strong>
        <small>${htmlEscape(grade.label)}</small>
      </article>
      <article>
        <span>Roster Source</span>
        <strong>${snapshot.source === "espn" ? "ESPN Team" : snapshot.source === "pasted" ? "Pasted Roster" : "Needed"}</strong>
        <small>${snapshot.rows.length} matched player${snapshot.rows.length === 1 ? "" : "s"}</small>
      </article>
      <article>
        <span>Main Need</span>
        <strong>${weaknesses[0]?.pos || "None"}</strong>
        <small>${weaknesses.length ? `${weaknesses[0].depthGap} target gap` : "No obvious gap"}</small>
      </article>
    </div>
    <div class="post-draft-grid">
      <section>
        <h4>Next 7 Days</h4>
        ${actions.map((item) => `<p>${htmlEscape(item)}</p>`).join("")}
      </section>
      <section>
        <h4>Strengths</h4>
        ${strengths.length ? strengths.slice(0, 3).map((item) => `<p>${item.pos}: ${item.rows.slice(0, 2).map((row) => htmlEscape(row.Player)).join(", ")}</p>`).join("") : "<p>No standout surplus yet.</p>"}
      </section>
      <section>
        <h4>Grade Notes</h4>
        ${grade.notes.map((item) => `<p>${htmlEscape(item)}</p>`).join("")}
      </section>
    </div>
  `;
}

function renderTradeFinder(snapshot = activeRosterSnapshot({ preferPasted: true })) {
  if (!tradeFinder) return;
  if (!boardData) {
    tradeFinder.textContent = "Waiting for board data.";
    return;
  }
  if (!snapshot.rows.length) {
    tradeFinder.textContent = "Select your ESPN team or paste your roster above to generate trade lanes.";
    return;
  }
  const away = tradeAwayCandidates(snapshot);
  const targets = tradeTargetCandidates(snapshot);
  const needs = rosterWeaknesses(snapshot);
  const topNeed = needs[0]?.pos || "starter upgrade";
  const leagueIdeas = snapshot.source === "espn" ? leagueTradeIdeas(snapshot) : [];
  if (leagueIdeas.length) {
    tradeFinder.innerHTML = `
      <div class="trade-lane-summary">
        <strong>${leagueIdeas.length} active-league trade idea${leagueIdeas.length === 1 ? "" : "s"}</strong>
        <span>FantasyIQ compared your strengths and needs against every roster in this league.</span>
      </div>
      <div class="trade-idea-list">
        ${leagueIdeas.map(renderTradeIdeaCard).join("")}
      </div>
    `;
    return;
  }
  tradeFinder.innerHTML = `
    <div class="trade-lane-summary">
      <strong>${away.length ? `Shop ${away[0].Pos} depth` : "Hold core"}</strong>
      <span>${
        liveLeagueHasRosters()
          ? "No clean team-to-team match yet. Use the lanes below as negotiation filters."
          : needs.length
            ? `Primary target lane: ${topNeed}`
            : "No forced target lane. Look for value discounts."
      }</span>
    </div>
    <div class="trade-finder-grid">
      <section>
        <h4>Shop</h4>
        ${away.length ? away.map((row) => renderPlayerMiniCard(row, marketSignal(row).label)).join("") : "<p>No obvious sell candidates. Do not force a trade.</p>"}
      </section>
      <section>
        <h4>Target</h4>
        ${targets.length ? targets.map((item) => renderPlayerMiniCard(item.row, item.fantasyTeam ? `Rostered by ${item.fantasyTeam}` : item.pick?.fantasyTeam ? `Rostered by ${item.pick.fantasyTeam}` : `${item.row.Pos} upgrade lane`)).join("") : "<p>No clean targets yet.</p>"}
      </section>
    </div>
  `;
}

function renderWaiverAssistant(snapshot = activeRosterSnapshot({ preferPasted: true })) {
  if (!waiverAssistant) return;
  if (!boardData) {
    waiverAssistant.textContent = "Waiting for board data.";
    return;
  }
  if (!snapshot.rows.length) {
    waiverAssistant.textContent = "Select your ESPN team or paste your roster above to generate a real waiver watchlist.";
    return;
  }
  const candidates = waiverCandidates(snapshot);
  waiverAssistant.innerHTML = candidates.length
    ? `<div class="trade-lane-summary waiver-summary"><strong>Best available adds</strong><span>${htmlEscape(waiverPoolSourceLabel())}</span></div><div class="waiver-list">${candidates.map((row) => renderPlayerMiniCard(row, leagueFitSignal(row, snapshot.counts).label)).join("")}</div>`
    : "<p>No strong waiver adds from the current board. Hold roster spots for news-driven role changes.</p>";
}

function renderRosterEngines() {
  renderPostDraftPlan(activeRosterSnapshot());
  const tradeSnapshot = activeRosterSnapshot({ preferPasted: true });
  renderTradeFinder(tradeSnapshot);
  renderWaiverAssistant(tradeSnapshot);
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
  const snapshot = teamRosterSnapshot(teamId);
  if (snapshot.rosterEntries?.length || snapshot.rows.length) {
    return {
      counts: snapshot.counts,
      picks: snapshot.picks || [],
      rows: snapshot.rows || [],
      rosterEntries: snapshot.rosterEntries || [],
      teamName: snapshot.teamName || "",
    };
  }
  return draftRosterCountsFor(teamId);
}

function selectedTeamId() {
  return myTeamSelect?.value || appConfig.customerTeamId || "";
}

function currentRound() {
  return Number(liveDraft?.currentPick?.round || Math.floor((liveDraft?.completedPicks || 0) / leagueTeamTotal()) + 1);
}

function currentOverallPick() {
  return Number(liveDraft?.currentPick?.overall || (liveDraft?.completedPicks || 0) + 1);
}

function starterTargetCounts() {
  const slots = activeLineupSlots();
  return {
    QB: Number(slots.QB || 0) + Number(slots.SUPERFLEX || 0),
    RB: Number(slots.RB || 0),
    WR: Number(slots.WR || 0),
    TE: Number(slots.TE || 0),
    DST: Number(slots.DST || 0),
    K: Number(slots.K || 0),
  };
}

function draftTargetCounts() {
  const settings = activeLeagueSettings();
  const slots = settings.lineupSlots || DEFAULT_LINEUP_SLOTS;
  const bench = Number(slots.BE || 0);
  const flex = Number(slots.FLEX || 0);
  const superflex = Number(slots.SUPERFLEX || 0);
  const teamCount = Number(settings.teamCount || 12);
  return {
    QB: Number(slots.QB || 0) + superflex + (superflex ? 1 : teamCount >= 14 ? 1 : 0),
    RB: Number(slots.RB || 0) + Math.ceil(flex * 0.6) + Math.max(2, Math.round(bench * 0.38)),
    WR: Number(slots.WR || 0) + Math.ceil(flex * 0.6) + Math.max(3, Math.round(bench * 0.45)),
    TE: Number(slots.TE || 0) + (flex >= 2 ? 1 : 0),
    DST: Number(slots.DST || 0) ? 1 : 0,
    K: Number(slots.K || 0) ? 1 : 0,
  };
}

function positionHasDraftSlot(pos) {
  const slots = activeLineupSlots();
  if (pos === "QB") return Number(slots.QB || 0) > 0 || Number(slots.SUPERFLEX || 0) > 0;
  if (["RB", "WR", "TE"].includes(pos)) return Number(slots[pos] || 0) > 0 || Number(slots.FLEX || 0) > 0 || Number(slots.SUPERFLEX || 0) > 0;
  if (pos === "DST") return Number(slots.DST || 0) > 0;
  if (pos === "K") return Number(slots.K || 0) > 0;
  return true;
}

function flexEligibleCount(counts) {
  return Number(counts.RB || 0) + Number(counts.WR || 0) + Number(counts.TE || 0);
}

function flexStarterTarget() {
  const slots = activeLineupSlots();
  return Number(slots.RB || 0) + Number(slots.WR || 0) + Number(slots.TE || 0) + Number(slots.FLEX || 0);
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

function recentDraftedPicks(limit = Math.min(12, leagueTeamTotal())) {
  return (liveDraft?.picks || [])
    .filter((pick) => pick.status === "drafted")
    .sort((a, b) => Number(b.overall || 0) - Number(a.overall || 0))
    .slice(0, limit);
}

function recentPositionCounts(limit = Math.min(12, leagueTeamTotal())) {
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
  if (shouldWaitOnSpecialTeams(row.Pos, currentRound())) pct += 22;
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
  if (!positionHasDraftSlot(row.Pos)) return "luxury";
  if (counts[row.Pos] < starters[row.Pos]) return "starter";
  if (["RB", "WR", "TE"].includes(row.Pos) && flexEligibleCount(counts) < flexStarterTarget()) return "starter";
  if (counts[row.Pos] < targets[row.Pos]) return "depth";
  return "luxury";
}

function positionClosed(row, counts) {
  if (!row) return false;
  if (!positionHasDraftSlot(row.Pos)) return true;
  const targets = draftTargetCounts();
  if (row.Pos === "QB" && counts.QB >= targets.QB) return true;
  if (row.Pos === "TE" && counts.TE >= targets.TE) return true;
  if (row.Pos === "DST" && counts.DST >= targets.DST) return true;
  if (row.Pos === "K" && counts.K >= targets.K) return true;
  return false;
}

function dstTargetRound() {
  return Math.max(1, draftRoundTotal() - 1);
}

function kickerTargetRound() {
  return Math.max(1, draftRoundTotal());
}

function shouldWaitOnSpecialTeams(pos, round) {
  if (pos === "DST") return round < dstTargetRound();
  if (pos === "K") return round < kickerTargetRound();
  return false;
}

function rosterNeedScoreAdjustment(row, counts, round) {
  const settings = activeLeagueSettings();
  const slots = settings.lineupSlots || DEFAULT_LINEUP_SLOTS;
  const targets = draftTargetCounts();
  const starters = starterTargetCounts();
  const need = rosterNeed(row, counts);
  let score = 0;

  if (need === "starter") score += 100;
  if (need === "depth") score += 28;
  if (row.Pos === "QB" && slots.SUPERFLEX) {
    if (counts.QB < starters.QB) score += 150;
    if (counts.QB < targets.QB && round >= 6) score += 55;
  }
  if (row.Pos === "QB" && !slots.SUPERFLEX) {
    if (counts.QB < starters.QB && round >= 5) score += 42;
    if (round < 5) score -= 65;
  }
  if (row.Pos === "TE") {
    if (counts.TE < starters.TE && round >= 3) score += 35;
    if (counts.TE >= starters.TE && counts.TE < targets.TE && round >= 10) score += 16;
  }
  if (["RB", "WR"].includes(row.Pos) && counts[row.Pos] < targets[row.Pos] && round >= 8) score += row.Pos === "RB" ? 60 : 50;
  if (row.Pos === "RB" && counts.RB < Math.min(targets.RB, starters.RB + 2) && round >= 10) score += 120;
  if (row.Pos !== "RB" && counts.RB < Math.min(targets.RB, starters.RB + 2) && round >= 12 && round < dstTargetRound()) score -= 180;
  if (shouldWaitOnSpecialTeams(row.Pos, round)) score -= 360;
  if (row.Pos === "DST" && counts.DST < targets.DST && round >= dstTargetRound()) score += 620;
  if (row.Pos === "K" && counts.K < targets.K && round >= kickerTargetRound()) score += 720;
  if (row.Pos !== "DST" && counts.DST < targets.DST && round >= dstTargetRound()) score -= 160;
  if (row.Pos !== "K" && counts.K < targets.K && round >= kickerTargetRound()) score -= 220;
  return score;
}

function recommendationDecision(row, counts) {
  const round = currentRound();
  const targetPick = recommendationTargetPick();
  const survival = survivalProjection(row, targetPick);
  const need = rosterNeed(row, counts);
  const momentum = playerMarketMomentum(row);
  const marketScore = momentum.score;

  if (!targetPick) {
    return { label: "Board value", className: "target", survival, reason: recommendationReason(row, counts) };
  }

  if (positionClosed(row, counts)) {
    const reason = positionHasDraftSlot(row.Pos)
      ? `You already filled your ${row.Pos} target for this league profile.`
      : `${row.Pos} is not part of this league's lineup settings.`;
    return { label: "Avoid", className: "wait", survival, reason };
  }
  if (shouldWaitOnSpecialTeams(row.Pos, round)) {
    return { label: "Wait", className: "wait", survival, reason: "K/DST are late-round tools unless the draft is already late." };
  }
  if (need === "starter" && survival.pct < 65) {
    return { label: "Pick now", className: "smash", survival, reason: `${row.Pos} starter slot is still open and this player may not return.` };
  }
  if (survival.pct < 35) {
    if (marketScore <= -12 && Number(row.Risk || 0) >= 5 && round <= 10) {
      return { label: "Controlled risk", className: "watch", survival, reason: "He may not return, but live add/drop pressure is negative. Take only at a discount." };
    }
    return { label: "Pick now", className: "smash", survival, reason: "Likely gone before your next pick." };
  }
  if (marketScore >= 12 && ["RB", "WR", "TE"].includes(row.Pos) && survival.pct < 60) {
    return { label: "Pick now", className: "smash", survival, reason: "Live add/drop momentum is strong and the make-it-back window is thin." };
  }
  if (momentum.rookie && marketScore >= 8 && round >= 7 && survival.pct < 65) {
    return { label: "Target", className: "target", survival, reason: "Rookie profile has positive live market momentum at a draftable stage." };
  }
  if (marketScore <= -14 && need !== "starter" && round <= 10) {
    return { label: "Can wait", className: "wait", survival, reason: "Faller signal is active. Make the room discount him first." };
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
  const value = leagueValueScore(row);
  const hasTeamContext = Boolean(selectedTeamId());
  const momentum = playerMarketMomentum(row);
  const marketAdjustment = clampNumber(momentum.score * (round >= 7 ? 3.8 : 2.2), -85, 95);
  let score = 2000 - rank * 5 + value * 0.5;

  if (!hasTeamContext) {
    return 2000 - rank * 10 + value * 0.1 + clampNumber(momentum.score * 2.2, -55, 65);
  }

  if (positionClosed(row, counts)) score -= 900;
  score += rosterNeedScoreAdjustment(row, counts, round);
  score += marketAdjustment;
  if (momentum.rookie && momentum.score >= 8 && round >= 7) score += 28;
  if (momentum.score <= -10 && Number(row.Risk || 0) >= 5) score -= 34;
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
  const starters = starterTargetCounts();
  const momentum = playerMarketMomentum(row);
  if (!positionHasDraftSlot(row.Pos)) return `${row.Pos} is not used in this league profile.`;
  if (shouldWaitOnSpecialTeams(row.Pos, currentRound())) return "Late only. Keep loading RB/WR upside first.";
  if (row.Pos === "DST" && counts.DST < starters.DST && currentRound() >= dstTargetRound()) return "Roster requirement. Take the best DST left.";
  if (row.Pos === "K" && counts.K < starters.K && currentRound() >= kickerTargetRound()) return "Roster requirement. Kicker should be last.";
  if (momentum.score <= -12) return "Faller signal. Treat him as a discounted value, not an auto-click.";
  if (momentum.rookie && momentum.score >= 8 && currentRound() >= 7) return "Rookie with live add/drop momentum and a draftable price.";
  if (momentum.score >= 12) return "Live add/drop momentum is pushing him up the queue.";
  if (row.Pos === "RB" && counts.RB < starters.RB) return "Fills a starting RB slot.";
  if (row.Pos === "WR" && counts.WR < starters.WR) return "Fills a starting WR slot.";
  if (row.Pos === "TE" && counts.TE < starters.TE) return "Fills TE if value is real.";
  if (row.Pos === "QB" && counts.QB < starters.QB) {
    return activeLineupSlots().SUPERFLEX ? "Superflex format keeps QB value elevated." : "QB value window if the board falls this way.";
  }
  if (["RB", "WR", "TE"].includes(row.Pos) && flexEligibleCount(counts) < flexStarterTarget()) return "Fills a FLEX starter lane.";
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
  if (pos === "SUPERFLEX") return ["QB", "RB", "WR", "TE"].includes(row.Pos);
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
  return `<div class="sim-player-row tier-player-row">
    <div>
      ${playerFocusButton(row)}
      <small>#${row.Rank} / ${row.Pos} / ${row.Team} / ${scoringProjectionLabel()} ${projectionDisplay(row)} / ${htmlEscape(row["Pos Tier"] || row.Category)}</small>
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
  const momentum = playerMarketMomentum(row);
  const priority = decision.label === "Pick now" || index < 3 ? "priority" : "";
  const survivalText = decision.survival.label === "Select team" ? "team needed" : `${decision.survival.pct}% back`;
  const proof = [
    scoringProjectionLabel(),
    `${leagueTeamTotal()} teams`,
    lineupSummary(),
    selectedTeamId() ? "selected roster" : "board value",
    liveDraft?.draftedNames?.length ? `${liveDraft.draftedNames.length} drafted filtered` : "draft board state",
  ];
  return `<div class="pick-card recommendation ${priority} ${decision.className}">
    <span>#${row.Rank} / ${row.Pos} / ${row.Team}</span>
    ${playerFocusButton(row)}
    <div class="rec-meta">
      <em>${decision.label}</em>
      <b class="${decision.survival.className}">${survivalText}</b>
      ${momentum.hasSleeperSignal ? `<b class="${momentum.className}">${htmlEscape(momentum.label)}</b>` : ""}
      <b>${row["Pos Tier"] || row.Category}</b>
    </div>
    <small>${decision.reason} ${scoringProjectionLabel()}: ${projectionDisplay(row)}. League value: ${valueDisplay(row)}. ${decision.survival.detail} ${momentum.hasSleeperSignal ? htmlEscape(momentum.detail) : ""}</small>
    <div class="recommendation-proof">Based on: ${proof.map(htmlEscape).join(" / ")}</div>
    ${playerSynopsisBlock(row, { compact: true })}
  </div>`;
}

function avoidRows(counts) {
  return availableRows()
    .filter((row) => {
      if (positionClosed(row, counts)) return true;
      if (shouldWaitOnSpecialTeams(row.Pos, currentRound())) return true;
      if (Number(row.Risk || 0) >= 7 && currentRound() <= 8) return true;
      if (playerMarketMomentum(row).score <= -14 && currentRound() <= 10) return true;
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
    ? ranked.filter((row) => !["Wait", "Can wait", "Avoid"].includes(recommendationDecision(row, counts).label)).slice(0, 3)
    : ranked.slice(0, 3);
  const waitList = teamId
    ? ranked.filter((row) => recommendationDecision(row, counts).label === "Can wait").slice(0, 2)
    : [];
  const avoids = teamId ? avoidRows(counts).slice(0, 2) : [];

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
  const roster = rosterCountsFor(teamId);
  const { counts, picks } = roster;
  const rosterEntries = roster.rosterEntries || [];
  if (!picks.length && !rosterEntries.length) {
    liveMyRoster.innerHTML = `
      <div class="roster-counts">
        <span>QB ${counts.QB}</span><span>RB ${counts.RB}</span><span>WR ${counts.WR}</span><span>TE ${counts.TE}</span><span>DST ${counts.DST}</span><span>K ${counts.K}</span>
      </div>
      <p>No picks for your team yet.</p>
    `;
    return;
  }
  if (rosterEntries.length) {
    liveMyRoster.innerHTML = `
      <div class="roster-counts">
        <span>QB ${counts.QB}</span><span>RB ${counts.RB}</span><span>WR ${counts.WR}</span><span>TE ${counts.TE}</span><span>DST ${counts.DST}</span><span>K ${counts.K}</span>
      </div>
      ${rosterEntries
        .map((entry) => {
          const row = findPlayer(entry.player);
          const slot = entry.lineupSlot ? `${entry.lineupSlot} / ` : "";
          return `<div class="pick-card made">
            <span>${htmlEscape(slot)}${htmlEscape(row?.Pos || entry.pos || "Player")}</span>
            ${row ? playerFocusButton(row) : `<strong>${htmlEscape(entry.player)}</strong>`}
            <em>${htmlEscape(row ? `#${row.Rank}` : entry.proTeam || "Roster")}</em>
            <small>${row ? `League value ${valueDisplay(row)}. ${row.Action}` : "Rostered in ESPN. No board match yet."}</small>
            ${row ? playerSynopsisBlock(row, { compact: true }) : ""}
          </div>`;
        })
        .join("")}
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
  const flexPositions = activeLineupSlots().SUPERFLEX ? ["QB", "RB", "WR", "TE"] : ["RB", "WR", "TE"];
  const flexRows = availableRows().filter((row) => flexPositions.includes(row.Pos)).slice(0, 12);
  const flexMix = flexRows.reduce((counts, row) => {
    counts[row.Pos] = (counts[row.Pos] || 0) + 1;
    return counts;
  }, {});
  cards.push(`<div class="intel-card ${flexRows.length < 8 ? "watch" : "good"}">
    <strong>${activeLineupSlots().SUPERFLEX ? "SUPERFLEX" : "FLEX"} pool: QB ${flexMix.QB || 0}, RB ${flexMix.RB || 0}, WR ${flexMix.WR || 0}, TE ${flexMix.TE || 0}</strong>
    <small>Top 12 eligible players left. Use this to avoid chasing a fake run.</small>
  </div>`);
  tierAlerts.innerHTML = cards.join("");
}

function renderRoomDetector() {
  if (!roomDetector) return;
  const windowSize = Math.min(12, leagueTeamTotal());
  const recent = recentDraftedPicks(windowSize);
  if (!recent.length) {
    roomDetector.innerHTML = `<div class="intel-card good"><strong>No run yet</strong><small>ESPN has not recorded any picks. Once the room starts drafting, this will spot panic pockets.</small></div>`;
    return;
  }
  const counts = recentPositionCounts(windowSize);
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
      <div><h4>Last ${windowSize}</h4>${leaders.map(([pos, count]) => `<span>${pos} <b>${count}</b></span>`).join("")}</div>
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
  const totalProj = rows.reduce((sum, row) => sum + projectionValue(row), 0);
  const rbWrCount = (counts.RB || 0) + (counts.WR || 0);
  const round = currentRound();
  const warnings = [];

  if (round >= 6 && rbWrCount < 4) warnings.push("RB/WR base is behind pace.");
  if (counts.QB > 1) warnings.push("Backup QB is blocking upside depth.");
  if (counts.TE > 1 && round < 12) warnings.push("Second TE needs a strong reason.");
  if (counts.DST > 0 && round < dstTargetRound()) warnings.push("DST was earlier than preferred.");
  if (counts.K > 0 && round < kickerTargetRound()) warnings.push("Kicker should usually be last.");

  const state =
    avgRisk >= 5 || highRisk >= Math.ceil(rows.length / 2)
      ? { label: "Too spicy", className: "danger" }
      : avgRisk <= 2.5 && rows.length >= 5
        ? { label: "Too safe", className: "watch" }
        : { label: "Golden zone", className: "good" };

  riskMeter.innerHTML = `
    <div class="intel-card ${state.className}">
      <strong>${state.label}</strong>
      <small>Average risk ${avgRisk.toFixed(1)}/10. High-risk picks ${highRisk}/${rows.length}. ${scoringProjectionLabel()} ${totalProj.toFixed(1)}.</small>
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
    .sort((a, b) => leagueValueScore(b.row) - leagueValueScore(a.row) || Number(a.row.Rank) - Number(b.row.Rank))[0];
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

function strongestRoomRun(limit = Math.min(12, leagueTeamTotal())) {
  const recent = recentDraftedPicks(limit);
  const counts = recentPositionCounts(limit);
  const [pos = "", count = 0] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || [];
  return { pos, count, recent: recent.length };
}

function alphaRosterBuild(counts = emptyPositionCounts()) {
  const starters = starterTargetCounts();
  const rbWr = Number(counts.RB || 0) + Number(counts.WR || 0);
  const starterNeeds = ["QB", "RB", "WR", "TE"].filter((pos) => Number(counts[pos] || 0) < Number(starters[pos] || 0));
  if (starterNeeds.length) return { label: "Fill starters", detail: `${starterNeeds.join(", ")} still open` };
  if (rbWr < 5 && currentRound() >= 6) return { label: "Build depth", detail: "RB/WR bench needs more weekly outs" };
  if (Number(counts.QB || 0) > 1 && !activeLeagueSettings().lineupSlots?.SUPERFLEX) {
    return { label: "Too much QB", detail: "Move capital back to RB/WR upside" };
  }
  return { label: "Balanced", detail: `RB/WR ${rbWr}, QB ${counts.QB || 0}, TE ${counts.TE || 0}` };
}

function alphaRead(counts = emptyPositionCounts(), picks = {}) {
  const cliffs = cheatcodeTierCliffs();
  const cliff = cliffs[0];
  const roomRun = strongestRoomRun();
  const build = alphaRosterBuild(counts);
  const best = picks.bestNow?.row || picks.bestValue?.row || picks.safe?.row || availableRows()[0];
  const survival = best ? survivalProjection(best, recommendationTargetPick()) : null;
  const decision = best ? recommendationDecision(best, counts) : null;
  const scarcityLabel = cliff ? `${cliff.pos}: ${cliff.count} left` : "No cliff";
  const marketLabel = roomRun.recent && roomRun.count >= 3 ? `${roomRun.pos} run` : "Balanced room";
  const pressure =
    (cliff?.count || 99) <= 2 || (roomRun.count >= 4 && cliff?.pos === roomRun.pos) || survival?.pct < 35;
  const leverage = pressure
    ? "Attack"
    : decision?.label === "Can wait" || survival?.pct >= 70
      ? "Wait"
      : build.label === "Fill starters"
        ? "Stabilize"
        : "Exploit value";
  return {
    signal: best ? `${best.Player}` : "Loading",
    signalMeta: best
      ? `${decision?.label || "Board value"} / ${best.Pos} / ${best["Pos Tier"] || best.Category || "Tier"}`
      : "Waiting for board data",
    scarcity: scarcityLabel,
    scarcityMeta: cliff ? `${cliff.tier}` : "No urgent tier pressure",
    market: marketLabel,
    marketMeta: roomRun.recent ? `${roomRun.count || 0} of last ${roomRun.recent} picks` : "Draft not moving yet",
    build: build.label,
    buildMeta: build.detail,
    leverage,
  };
}

function setAlphaText(node, value) {
  if (node) node.textContent = value;
}

function renderAlphaLayer(counts = emptyPositionCounts(), picks = {}) {
  const alpha = boardData ? alphaRead(counts, picks) : {
    signal: "Loading",
    signalMeta: "Waiting for board data",
    scarcity: "Loading",
    scarcityMeta: "Tier pressure",
    market: "Loading",
    marketMeta: "Room behavior",
    build: "Loading",
    buildMeta: "Roster posture",
    leverage: "Calibrating",
  };
  setAlphaText(alphaCommandSignal, alpha.signal);
  setAlphaText(alphaCommandMeta, alpha.signalMeta);
  setAlphaText(alphaCommandLeverage, alpha.leverage);
  setAlphaText(alphaSignal, alpha.signal);
  setAlphaText(alphaSignal?.nextElementSibling, alpha.signalMeta);
  setAlphaText(alphaScarcity, alpha.scarcity);
  setAlphaText(alphaScarcity?.nextElementSibling, alpha.scarcityMeta);
  setAlphaText(alphaMarket, alpha.market);
  setAlphaText(alphaMarket?.nextElementSibling, alpha.marketMeta);
  setAlphaText(alphaBuild, alpha.build);
  setAlphaText(alphaBuild?.nextElementSibling, alpha.buildMeta);
  setAlphaText(alphaLeverage, alpha.leverage);
}

function setWarRoomText(node, value) {
  if (node) node.textContent = value;
}

function renderWarRoomCommand(counts = emptyPositionCounts(), picks = {}) {
  if (!warRoomCommand) return;
  if (!boardData) {
    setWarRoomText(warRoomPlayer, "Loading best move");
    setWarRoomText(warRoomAction, "FantasyIQ is connecting board value, roster build, market signal, and league settings.");
    setWarRoomText(warRoomWhy, "Waiting");
    setWarRoomText(warRoomMarket, "Waiting");
    setWarRoomText(warRoomFit, "Waiting");
    setWarRoomText(warRoomRisk, "Waiting");
    setWarRoomText(warRoomSecondary, "Select your ESPN team to unlock next-pick survival and roster-build pressure.");
    if (warRoomPlayerCard) warRoomPlayerCard.disabled = true;
    return;
  }

  const teamId = selectedTeamId();
  const best = picks.bestNow?.row || picks.bestValue?.row || picks.safe?.row || availableRows()[0];
  if (!best) return;
  const decision = recommendationDecision(best, counts);
  const market = marketSignal(best);
  const fit = leagueFitSignal(best, counts);
  const risk = riskSignal(best);
  const targetPick = recommendationTargetPick();
  const survival = targetPick ? survivalProjection(best, targetPick) : null;
  const nextPick = teamId ? nextMyPick(teamId) : null;

  setWarRoomText(warRoomPlayer, best.Player);
  setWarRoomText(
    warRoomAction,
    `${decision.label}: ${decision.reason} ${scoringProjectionLabel()} ${projectionDisplay(best)} / value ${valueDisplay(best)} / ${best.Pos} ${best["Pos Tier"] || best.Category}.`,
  );
  setWarRoomText(warRoomWhy, commandReason(best, decision, counts));
  setWarRoomText(warRoomMarket, market.label);
  setWarRoomText(warRoomFit, fit.label);
  setWarRoomText(warRoomRisk, risk.label);
  setWarRoomText(
    warRoomSecondary,
    teamId && nextPick
      ? `Next pick: R${nextPick.round} P${nextPick.roundPick}, overall ${nextPick.overall}. ${survival ? `${best.Player} has a ${survival.pct}% make-it-back read.` : ""} ${market.detail}`
      : `League-aware board is active for ${leagueTeamTotal()} teams, ${activeLeagueSettings().scoringLabel || "custom scoring"}, ${lineupSummary()}. Select your ESPN team for survival odds.`,
  );
  if (warRoomPlayerCard) {
    warRoomPlayerCard.disabled = false;
    warRoomPlayerCard.dataset.playerFocus = best.Player;
  }
  if (warRoomBigBoard) {
    warRoomBigBoard.dataset.playerFocusBoard = best.Player;
  }
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
    renderAlphaLayer();
    renderWarRoomCommand();
    return;
  }

  const teamId = selectedTeamId();
  const hasLive = Boolean(liveDraft);
  const { counts } = teamId ? rosterCountsFor(teamId) : { counts: emptyPositionCounts() };
  const nextPick = teamId ? nextMyPick(teamId) : null;
  const until = nextPick ? picksUntil(nextPick) : null;
  const { bestNow, bestValue, safe, upside, ranked } = bestCheatcodeRows(counts);
  renderAlphaLayer(counts, { bestNow, bestValue, safe, upside });
  renderWarRoomCommand(counts, { bestNow, bestValue, safe, upside });
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
      bestValue ? `League value ${valueDisplay(bestValue.row)}. ${bestValue.row.Action}` : "",
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
    const windowSize = Math.min(12, leagueTeamTotal());
    const recent = recentDraftedPicks(windowSize);
    const countsByPos = recentPositionCounts(windowSize);
    const leaders = Object.entries(countsByPos).sort((a, b) => b[1] - a[1]);
    const [runPos, runCount] = leaders[0] || ["None", 0];
    const severity = runCount >= 5 ? "danger" : runCount >= 3 ? "watch" : "good";
    cheatcodeRoom.innerHTML = recent.length
      ? `<div class="intel-card ${severity}">
          <strong>${runCount >= 3 ? `${runPos} pressure: ${runCount} of last ${recent.length}` : "Room is balanced"}</strong>
          <small>${runCount >= 3 ? "Check the tier cliff before reacting." : "Keep taking value. No panic adjustment needed."}</small>
        </div>
        <div class="intel-subgrid">
          <div><h4>Last ${windowSize}</h4>${leaders.map(([pos, count]) => `<span>${pos} <b>${count}</b></span>`).join("")}</div>
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

function liveDraftRenderSignature(data = liveDraft) {
  if (!data) return "";
  const current = data.currentPick || {};
  const recent = data.recentPicks || [];
  const next = data.nextPicks || [];
  const draftOrder = data.draftOrder || [];
  return JSON.stringify({
    completed: Number(data.completedPicks || 0),
    total: Number(data.totalPicks || 0),
    drafted: Boolean(data.drafted),
    inProgress: Boolean(data.inProgress),
    currentOverall: Number(current.overall || 0),
    currentTeam: current.fantasyTeam || "",
    currentManager: current.manager || "",
    draftedCount: (data.draftedNames || []).length,
    teams: (data.teams || []).length,
    teamNames: (data.teams || []).map((team) => team.name || team.fantasyTeam || "").join("|"),
    recent: recent.map((pick) => `${pick.overall || ""}:${pick.player || pick.playerName || ""}`).join("|"),
    next: next.map((pick) => `${pick.overall || ""}:${pick.fantasyTeam || ""}`).join("|"),
    draftOrder: draftOrder.map((pick) => `${pick.overall || ""}:${pick.roundPick || ""}:${pick.fantasyTeam || ""}`).join("|"),
    staleError: data.staleError || "",
  });
}

function renderLiveDraftSummary() {
  if (!liveStatus) return;
  if (!liveDraft) {
    liveStatus.textContent = "Connecting to ESPN public draft sync...";
    return;
  }

  const current = liveDraft.currentPick;
  const completed = Number(liveDraft.completedPicks || 0);
  const total = Number(liveDraft.totalPicks || 0);
  const totalFallback = leagueTeamTotal() * draftRoundTotal();
  const pct = total || totalFallback ? Math.round((completed / (total || totalFallback)) * 100) : 0;
  const stale = liveDraft.staleError ? ` Stale fallback shown because ESPN sync errored: ${liveDraft.staleError}` : "";
  const state = liveDraft.inProgress ? "Draft live" : liveDraft.drafted ? "Draft complete" : "Draft board loaded";
  const syncContext = liveDraft.demoMode
    ? " Public demo league is connected; subscribers get their ESPN league configured after checkout."
    : ` Auto sync checks ESPN every ${LIVE_SYNC_INTERVAL_MS / 1000} seconds.`;

  liveStatus.innerHTML = `<strong>${state}</strong>: ${completed}/${total || totalFallback} picks completed.${syncContext}${stale}`;
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
  if (liveTotal) liveTotal.textContent = `of ${total || totalFallback}`;
  if (liveProgressBar) liveProgressBar.style.width = `${pct}%`;
  if (liveLastSync) liveLastSync.textContent = formatSyncTime(liveDraft.syncedAt);
  if (liveSource) liveSource.textContent = liveDraft.demoMode ? "ESPN public demo league" : liveDraft.source || "ESPN public league API";
  renderLeagueHealth();
}

function renderLiveDraft(options = {}) {
  if (!liveStatus) return;
  if (!liveDraft) {
    renderLiveDraftSummary();
    return;
  }

  renderLiveDraftSummary();
  if (options.full === false) return;

  applyServerCustomerContext(liveDraft.customer);
  renderTeamOptions();
  applyEspnLeagueBranding();
  renderLeagueProfile();

  renderRecommendations();
  renderMyRoster();
  renderNextPickRadar();
  renderTierAlerts();
  renderRoomDetector();
  renderRiskMeter();
  renderRosterEngines();
  renderCheatcodeMode();
  renderPickCards(liveRecentPicks, liveDraft.recentPicks, "No picks have been made yet.");
  renderPickCards(liveNextPicks, liveDraft.nextPicks, "No upcoming picks found.");
  renderLiveTierBoard();
  renderDraftOrder();
  renderBoard();
  lastLiveDraftRenderSignature = liveDraftRenderSignature();
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
  return Math.floor((Number(overall) - 1) / leagueTeamTotal()) + 1;
}

function simSlotFromOverall(overall) {
  const teamCount = leagueTeamTotal();
  const round = simRound(overall);
  const pickInRound = ((Number(overall) - 1) % teamCount) + 1;
  return round % 2 === 1 ? pickInRound : teamCount + 1 - pickInRound;
}

function simRoundPick(overall) {
  return ((Number(overall) - 1) % leagueTeamTotal()) + 1;
}

function simTeam(slot) {
  return mockSim?.teams?.[slot];
}

function simAvailableRows() {
  if (!boardData || !mockSim) return [];
  return (boardData.boards?.combined?.rows || []).filter((row) => !mockSim.drafted.has(normalizePlayerName(row.Player)));
}

function simRecentPicks(limit = Math.min(12, leagueTeamTotal())) {
  return (mockSim?.picks || []).slice(-limit).reverse();
}

function simRecentPositionCounts(limit = Math.min(10, leagueTeamTotal())) {
  const counts = {};
  simRecentPicks(limit).forEach((pick) => {
    counts[pick.row.Pos] = (counts[pick.row.Pos] || 0) + 1;
  });
  return counts;
}

const SIM_MANAGER_PERSONAS = [
  { name: "Value Hawk", rank: 7.2, need: 1.05, value: 1.45, scarcity: 0.9, market: 1.0, upside: 0.7, riskPenalty: 0.9 },
  { name: "Roster Architect", rank: 6.2, need: 1.45, value: 1.05, scarcity: 0.75, market: 0.65, upside: 0.55, riskPenalty: 1.0 },
  { name: "Tier Bully", rank: 6.6, need: 1.05, value: 1.0, scarcity: 1.55, market: 0.8, upside: 0.75, riskPenalty: 0.85 },
  { name: "Market Chaser", rank: 6.4, need: 1.0, value: 0.95, scarcity: 0.95, market: 1.65, upside: 0.9, riskPenalty: 0.7 },
  { name: "Upside Drafter", rank: 6.0, need: 0.95, value: 0.85, scarcity: 0.95, market: 1.05, upside: 1.6, riskPenalty: 0.55 },
  { name: "Floor Manager", rank: 7.0, need: 1.2, value: 1.15, scarcity: 0.75, market: 0.65, upside: 0.45, riskPenalty: 1.55 },
];

function simManagerProfile(slot) {
  return mockSim?.profiles?.[slot] || SIM_MANAGER_PERSONAS[(slot - 1) % SIM_MANAGER_PERSONAS.length];
}

function simFutureUserPicks() {
  if (!mockSim) return [];
  const picks = [];
  for (let overall = mockSim.currentOverall; overall <= simTotalPicks(); overall += 1) {
    if (simSlotFromOverall(overall) === mockSim.userSlot) {
      picks.push(overall);
    }
  }
  return picks;
}

function simFuturePicksForSlot(slot, fromOverall = mockSim?.currentOverall || 1) {
  if (!mockSim) return [];
  const picks = [];
  for (let overall = fromOverall; overall <= simTotalPicks(); overall += 1) {
    if (simSlotFromOverall(overall) === slot) picks.push(overall);
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
  if (shouldWaitOnSpecialTeams(row.Pos, simRound())) pct += 22;
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
  const momentum = playerMarketMomentum(row);

  if (positionClosed(row, counts)) {
    const reason = positionHasDraftSlot(row.Pos)
      ? `You already filled your ${row.Pos} target for this league profile.`
      : `${row.Pos} is not part of this mock league setup.`;
    return { label: "Avoid", className: "wait", survival, reason };
  }
  if (shouldWaitOnSpecialTeams(row.Pos, round)) {
    return { label: "Wait", className: "wait", survival, reason: "K/DST are final-round tools." };
  }
  if (need === "starter" && survival.pct < 65) {
    return { label: "Pick now", className: "smash", survival, reason: `${row.Pos} starter slot is open and he may not return.` };
  }
  if (survival.pct < 35) {
    if (momentum.score <= -12 && Number(row.Risk || 0) >= 5 && round <= 10) {
      return { label: "Controlled risk", className: "watch", survival, reason: "He may not return, but the live market is fading." };
    }
    return { label: "Pick now", className: "smash", survival, reason: "Likely gone before your next turn." };
  }
  if (momentum.score >= 12 && ["RB", "WR", "TE"].includes(row.Pos) && survival.pct < 60) {
    return { label: "Pick now", className: "smash", survival, reason: "Live add/drop momentum is strong and the turn is thin." };
  }
  if (momentum.rookie && momentum.score >= 8 && round >= 7 && survival.pct < 65) {
    return { label: "Target", className: "target", survival, reason: "Rookie profile has positive live market momentum." };
  }
  if (momentum.score <= -14 && need !== "starter" && round <= 10) {
    return { label: "Can wait", className: "wait", survival, reason: "Faller signal is active. Let the room discount him." };
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
  const value = leagueValueScore(row);
  const momentum = playerMarketMomentum(row);
  let score = 2000 - rank * 5 + value * 0.5;

  if (positionClosed(row, counts)) score -= 900;
  score += rosterNeedScoreAdjustment(row, counts, round);
  score += clampNumber(momentum.score * (round >= 7 ? 3.8 : 2.2), -85, 95);
  if (momentum.rookie && momentum.score >= 8 && round >= 7) score += 28;
  if (momentum.score <= -10 && Number(row.Risk || 0) >= 5) score -= 34;
  if (Number(row.Risk || 0) >= 6 && round <= 8) score -= 18;
  if (decision.survival.pct < 20) score += 80;
  else if (decision.survival.pct < 35) score += 45;
  if (decision.survival.pct >= 75) score -= 28;
  if (decision.label === "Pick now") score += 38;
  if (decision.label === "Wait") score -= 34;
  if (simTopTierInfo(row.Pos).count <= 2 && !["DST", "K"].includes(row.Pos)) score += 24;
  return score;
}

function simBotSurvivalPressure(row, slot) {
  const upcoming = simFuturePicksForSlot(slot, (mockSim?.currentOverall || 1) + 1);
  const next = upcoming[0];
  if (!next) return 0;
  const gap = Number(row.Rank || 999) - next;
  if (gap <= -24) return 95;
  if (gap <= -12) return 60;
  if (gap <= 0) return 35;
  if (gap >= 18) return -25;
  return 8;
}

function simBotRunPressure(row) {
  const recent = simRecentPositionCounts(Math.min(10, leagueTeamTotal()));
  const count = Number(recent[row.Pos] || 0);
  if (count >= 5) return 65;
  if (count >= 3) return 34;
  return 0;
}

function simBotScore(row, counts, slot) {
  const round = simRound();
  const profile = simManagerProfile(slot);
  const momentum = playerMarketMomentum(row);
  const tier = simTopTierInfo(row.Pos);
  const rank = Number(row.Rank || 999);
  const value = leagueValueScore(row);
  const upside = Number(row.Upside || row.Ceiling || 0);
  const risk = Number(row.Risk || 0);
  const needScore = rosterNeedScoreAdjustment(row, counts, round);
  let score = 1900 - rank * profile.rank + value * 8 * profile.value;

  score += needScore * profile.need;
  score += clampNumber(momentum.score * 7 * profile.market, -120, 145);
  score += simBotSurvivalPressure(row, slot) * profile.scarcity;
  score += simBotRunPressure(row) * profile.scarcity;
  if (tier.count <= 2 && (row["Pos Tier"] || row.Category) === tier.tier && !["DST", "K"].includes(row.Pos)) score += 56 * profile.scarcity;
  if (["RB", "WR", "TE"].includes(row.Pos)) score += clampNumber((upside - 55) * 2.8 * profile.upside, -25, 95);
  if (risk >= 6 && round <= 8) score -= 24 * profile.riskPenalty;
  if (momentum.score <= -12 && risk >= 5) score -= 30 * profile.riskPenalty;
  if (positionClosed(row, counts)) score -= 950;
  if (shouldWaitOnSpecialTeams(row.Pos, round)) score -= 560;
  if (row.Pos === "QB" && !activeLineupSlots().SUPERFLEX && counts.QB && round < 10) score -= 210;
  const wobble = Math.sin((mockSim.currentOverall + 1) * (slot + 3) * (rank + 11)) * 7;
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
  if (!mockSim || mockSim.currentOverall > simTotalPicks()) return;
  const slot = simSlotFromOverall(mockSim.currentOverall);
  const team = simTeam(slot);
  const candidates = simAvailableRows().slice(0, Math.min(140, Math.max(70, leagueTeamTotal() * 11)));
  const row = candidates.sort((a, b) => simBotScore(b, team.counts, slot) - simBotScore(a, team.counts, slot))[0];
  if (!row) {
    mockSim.currentOverall = simTotalPicks() + 1;
    return;
  }
  simAddPick(slot, row, false);
}

function simAdvanceToUserPick() {
  if (!mockSim) return;
  while (mockSim.currentOverall <= simTotalPicks() && simSlotFromOverall(mockSim.currentOverall) !== mockSim.userSlot) {
    simOpponentPick();
  }
}

function simStartDraft() {
  if (!boardData) {
    if (simStatus) simStatus.innerHTML = "<strong>Board data is still loading.</strong> Try again in a second.";
    return;
  }
  const selectedSlot = simSlot?.value || localStorage.getItem(loadoutStorageKey("sim-slot")) || "random";
  const teamCount = leagueTeamTotal();
  const slot = selectedSlot === "random" ? Math.floor(Math.random() * teamCount) + 1 : Number(selectedSlot || 1);
  const teams = {};
  const profiles = {};
  for (let teamSlot = 1; teamSlot <= teamCount; teamSlot += 1) {
    teams[teamSlot] = { counts: emptyPositionCounts(), picks: [] };
    profiles[teamSlot] = SIM_MANAGER_PERSONAS[(teamSlot + slot - 2) % SIM_MANAGER_PERSONAS.length];
  }
  mockSim = {
    active: true,
    userSlot: slot,
    currentOverall: 1,
    drafted: new Set(),
    picks: [],
    teams,
    profiles,
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
  if (!mockSim || mockSim.currentOverall > simTotalPicks()) return;
  if (simSlotFromOverall(mockSim.currentOverall) !== mockSim.userSlot) return;
  const row = simAvailableRows().find((candidate) => normalizePlayerName(candidate.Player) === playerKey);
  if (!row) return;
  simAddPick(mockSim.userSlot, row, true);
  simAdvanceToUserPick();
  renderMockSimulator();
}

function simGradePenaltyWindow(deadlineRound) {
  if (!mockSim) return 0;
  const round = Math.min(draftRoundTotal(), simRound(Math.min(mockSim.currentOverall, simTotalPicks())));
  if (round < deadlineRound) return 0;
  return round >= draftRoundTotal() ? 1 : 0.55;
}

function simGradeRoster() {
  if (!mockSim) return { grade: "Pending", detail: "Start a mock." };
  const team = simTeam(mockSim.userSlot);
  const counts = team.counts;
  const targets = draftTargetCounts();
  const starters = starterTargetCounts();
  const slots = activeLineupSlots();
  let score = 100;
  const notes = [];
  const pickCount = team.picks.length;
  const complete = mockSim.currentOverall > simTotalPicks();
  const completion = Math.min(1, pickCount / Math.max(1, draftRoundTotal()));
  const pickGrades = team.picks.map((pick) => ({ ...gradePick(pick.round, pick.overall, pick.row), pick }));
  const reaches = pickGrades.filter((item) => item.label === "Reach");
  const majorReaches = reaches.filter((item) => Number(item.pick.overall || 0) + 16 < expectedPickFor(item.pick.row));
  const steals = pickGrades.filter((item) => item.label === "Steal" || item.label === "Good value");
  const skillRows = team.picks.filter((pick) => ["QB", "RB", "WR", "TE"].includes(pick.row.Pos)).map((pick) => pick.row);
  const avgRisk = skillRows.length ? skillRows.reduce((sum, row) => sum + Number(row.Risk || 0), 0) / skillRows.length : 0;
  const highRiskEarly = team.picks.filter((pick) => pick.round <= 7 && Number(pick.row.Risk || 0) >= 7).length;
  const rbWr = Number(counts.RB || 0) + Number(counts.WR || 0);
  const flexEligible = flexEligibleCount(counts);
  const starterMissing = {
    QB: Math.max(0, Number(starters.QB || 0) - Number(counts.QB || 0)),
    RB: Math.max(0, Number(starters.RB || 0) - Number(counts.RB || 0)),
    WR: Math.max(0, Number(starters.WR || 0) - Number(counts.WR || 0)),
    TE: Math.max(0, Number(starters.TE || 0) - Number(counts.TE || 0)),
  };

  if (counts.RB < Math.min(targets.RB, starters.RB + 2)) {
    score -= Math.round(18 * Math.max(0.35, completion));
    notes.push("RB depth thin");
  }
  if (counts.WR < Math.min(targets.WR, starters.WR + 3)) {
    score -= Math.round(18 * Math.max(0.35, completion));
    notes.push("WR depth thin");
  }
  if (starterMissing.RB && simGradePenaltyWindow(4)) {
    score -= Math.round(14 * starterMissing.RB * simGradePenaltyWindow(4));
    notes.push("starting RB not solved");
  }
  if (starterMissing.WR && simGradePenaltyWindow(5)) {
    score -= Math.round(14 * starterMissing.WR * simGradePenaltyWindow(5));
    notes.push("starting WR not solved");
  }
  if (starterMissing.QB && simGradePenaltyWindow(slots.SUPERFLEX ? 7 : 10)) {
    score -= Math.round((slots.SUPERFLEX ? 18 : 10) * starterMissing.QB * simGradePenaltyWindow(slots.SUPERFLEX ? 7 : 10));
    notes.push(slots.SUPERFLEX ? "superflex QB pressure" : "QB slot open late");
  }
  if (starterMissing.TE && simGradePenaltyWindow(10)) {
    score -= Math.round(9 * starterMissing.TE * simGradePenaltyWindow(10));
    notes.push("TE slot open late");
  }
  if (flexEligible < flexStarterTarget() && simGradePenaltyWindow(7)) {
    score -= Math.round(10 * simGradePenaltyWindow(7));
    notes.push("FLEX starter thin");
  }
  if (counts.QB > targets.QB) {
    score -= 12;
    notes.push("extra QB");
  }
  if (counts.TE > targets.TE) {
    score -= 10;
    notes.push("extra TE");
  }
  if (counts.DST > targets.DST || counts.K > targets.K) {
    score -= 10;
    notes.push("extra DST/K");
  }
  const dstPick = team.picks.find((pick) => pick.row.Pos === "DST");
  const kPick = team.picks.find((pick) => pick.row.Pos === "K");
  if (dstPick && dstPick.round < dstTargetRound()) {
    score -= 10;
    notes.push("early DST");
  }
  if (kPick && kPick.round < kickerTargetRound()) {
    score -= 12;
    notes.push("early K");
  }
  if (reaches.length) {
    score -= reaches.length * 4 + majorReaches.length * 4;
    notes.push(`${reaches.length} reach${reaches.length === 1 ? "" : "es"}`);
  }
  if (steals.length >= 2) {
    score += Math.min(8, steals.length * 2);
    notes.push(`${steals.length} value pick${steals.length === 1 ? "" : "s"}`);
  }
  if (highRiskEarly) {
    score -= highRiskEarly * 5;
    notes.push("early risk stack");
  }
  if (avgRisk >= 6 && pickCount >= 5) {
    score -= 7;
    notes.push("volatile build");
  }
  if (rbWr < Math.min(7, Math.round(draftRoundTotal() * 0.45)) && completion >= 0.75) {
    score -= 10;
    notes.push("RB/WR volume low");
  }
  if (team.picks.slice(0, 6).filter((pick) => ["RB", "WR"].includes(pick.row.Pos)).length < 4 && pickCount >= 6) {
    score -= 8;
    notes.push("foundation light on RB/WR");
  }

  score = Math.round(clampNumber(score, 0, 100));
  const grade = score >= 93 ? "A" : score >= 86 ? "B+" : score >= 80 ? "B" : score >= 73 ? "C+" : score >= 67 ? "C" : score >= 58 ? "D" : "F";
  return {
    grade: pickCount ? `${grade} (${score})` : "Pending",
    detail: notes.length
      ? notes.slice(0, 5).join(", ")
      : pickCount
        ? complete
          ? "Clean build with value discipline."
          : "Shape is clean so far."
        : "Grade appears after picks.",
  };
}

function renderSimRecommendationCard(item, index = 0) {
  const { row, decision } = item;
  const momentum = playerMarketMomentum(row);
  const survivalText = decision.survival.pct ? `${decision.survival.pct}% back` : "no turn";
  return `<div class="pick-card recommendation ${index < 3 ? "priority" : ""} ${decision.className}">
    <span>#${row.Rank} / ${row.Pos} / ${row.Team}</span>
    ${playerFocusButton(row)}
    <div class="rec-meta">
      <em>${decision.label}</em>
      <b class="${decision.survival.className}">${survivalText}</b>
      ${momentum.hasSleeperSignal ? `<b class="${momentum.className}">${htmlEscape(momentum.label)}</b>` : ""}
      <b>${htmlEscape(row["Pos Tier"] || row.Category)}</b>
    </div>
    <small>${htmlEscape(decision.reason)} ${scoringProjectionLabel()}: ${projectionDisplay(row)}. League value: ${valueDisplay(row)}. ${htmlEscape(decision.survival.detail)} ${momentum.hasSleeperSignal ? htmlEscape(momentum.detail) : ""}</small>
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
  if (mockSim.currentOverall > simTotalPicks()) {
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
    .filter((row) => simDecision(row, simTeam(mockSim.userSlot).counts).label === "Avoid" || (playerMarketMomentum(row).score <= -14 && simRound() <= 10))
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
    const windowSize = Math.min(12, leagueTeamTotal());
    const counts = simRecentPositionCounts(windowSize);
    const leaders = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const [runPos, runCount] = leaders[0] || ["None", 0];
    simRoomDetector.innerHTML = `<div class="intel-card ${runCount >= 5 ? "danger" : runCount >= 3 ? "watch" : "good"}"><strong>${runCount ? `${runPos} pressure: ${runCount} of last ${windowSize}` : "No run yet"}</strong><small>${runCount >= 3 ? "Check tier cliffs before reacting." : "Keep taking value."}</small></div>`;
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
  const totalPicks = simTotalPicks();
  const completed = active ? Math.min(mockSim.currentOverall - 1, totalPicks) : 0;
  const pct = Math.round((completed / totalPicks) * 100);
  const userPick = active && mockSim.currentOverall <= totalPicks && simSlotFromOverall(mockSim.currentOverall) === mockSim.userSlot;
  const grade = simGradeRoster();
  const team = active ? simTeam(mockSim.userSlot) : { counts: emptyPositionCounts(), picks: [] };
  const currentSlot = active && mockSim.currentOverall <= totalPicks ? simSlotFromOverall(mockSim.currentOverall) : null;
  const currentManager = currentSlot ? simManagerProfile(currentSlot) : null;

  simStatus.innerHTML = active
    ? `<strong>${userPick ? "You are on the clock." : "Mock in progress."}</strong> Slot ${mockSim.userSlot}, ${completed}/${totalPicks} picks complete. CPU managers now draft with value, scarcity, market, and roster-build profiles.`
    : "Start a mock, then practice making picks while the room auto-drafts around you.";
  if (simCurrentPick) simCurrentPick.textContent = active && mockSim.currentOverall <= totalPicks ? `Round ${simRound()}, Pick ${simRoundPick(mockSim.currentOverall)}` : active ? "Mock complete" : "No mock started";
  if (simCurrentTeam) simCurrentTeam.textContent = active && mockSim.currentOverall <= totalPicks ? `Overall ${mockSim.currentOverall}: Team ${currentSlot}${userPick ? " (you)" : currentManager ? ` / ${currentManager.name}` : ""}` : "Choose a slot and start.";
  if (simCompleted) simCompleted.textContent = String(completed);
  if (simTotal) simTotal.textContent = `of ${totalPicks}`;
  if (simProgressBar) simProgressBar.style.width = `${pct}%`;
  if (simShape) simShape.textContent = `${team.picks.length} players`;
  if (simShapeDetail) simShapeDetail.textContent = `QB ${team.counts.QB} / RB ${team.counts.RB} / WR ${team.counts.WR} / TE ${team.counts.TE} / DST ${team.counts.DST} / K ${team.counts.K}`;
  if (simGrade) simGrade.textContent = grade.grade;
  if (simGradeDetail) simGradeDetail.textContent = grade.detail;
  if (simAuto) simAuto.disabled = !active || mockSim.currentOverall > totalPicks || userPick;

  renderSimIntel();
  renderSimRecommendations();
  renderSimAvailable();
  renderSimRoster();
  renderSimLog();
}

function liveServerHelp(error) {
  const subscribeUrl = appConfig.paymentLinkUrl || "https://buy.stripe.com/00wdR9dN7gBRacMb9fefC01";
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
  renderLeagueHealth();
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
      const nextSignature = liveDraftRenderSignature(liveDraft);
      const unchanged = !force && lastLiveDraftRenderSignature && nextSignature === lastLiveDraftRenderSignature;
      renderLiveDraft({ full: !unchanged });
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

function liveBoardRequestUrl(limit = "") {
  const liveBoardUrl = appConfig.liveBoardUrl || "/api/live-boards";
  if (liveBoardUrl.startsWith("/api/")) {
    return apiUrl(liveBoardUrl, { v: Date.now(), limit });
  }
  const params = new URLSearchParams({ v: String(Date.now()) });
  if (limit) params.set("limit", String(limit));
  return `${liveBoardUrl}${liveBoardUrl.includes("?") ? "&" : "?"}${params.toString()}`;
}

function applyBoardPayload(data) {
  boardData = data;
  applyServerCustomerContext(data.customer);
  renderLeagueProfile();
  renderBoard();
  renderCheatcodeMode();
  renderLiveDraft();
  renderLiveTierBoard();
  renderMockSimulator();
  renderTradeCalc();
  renderRosterEngines();
  refreshActivePlayerAutocomplete();
}

function combinedBoardCount(data = boardData) {
  return data?.boards?.combined?.rows?.length || 0;
}

function loadFullBoardInBackground() {
  if (fullBoardLoadStarted || !(appConfig.liveBoardUrl || "/api/live-boards").startsWith("/api/")) return;
  fullBoardLoadStarted = true;
  fetch(liveBoardRequestUrl(), { cache: "no-store", headers: apiHeaders() })
    .then((response) => {
      if (!response.ok) throw new Error(`Full board returned HTTP ${response.status}`);
      return response.json();
    })
    .then((data) => {
      if (combinedBoardCount(data) <= combinedBoardCount()) return;
      applyBoardPayload(data);
      if (boardStatus) {
        boardStatus.textContent = `Full board loaded: ${combinedBoardCount(data)} players with live league scoring.`;
      }
    })
    .catch((error) => {
      console.warn("Full board background load failed.", error);
    });
}

function loadBoards() {
  if (!ensureCustomerAccess()) return;
  fullBoardLoadStarted = false;
  if (boardStatus) {
    boardStatus.textContent = "Loading starter ESPN board...";
  }
  fetch(liveBoardRequestUrl(INITIAL_BOARD_LIMIT), { cache: "no-store", headers: apiHeaders() })
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
      applyBoardPayload(data);
      if (combinedBoardCount(data) >= INITIAL_BOARD_LIMIT) {
        if (boardStatus) {
          boardStatus.textContent = `Starter board loaded: ${combinedBoardCount(data)} players. Loading full board quietly...`;
        }
        loadFullBoardInBackground();
      }
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
  bootCustomerDashboard();
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
  renderRosterEngines();
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
  if (hasCustomerAccess()) {
    signOutCustomer();
  } else {
    showCustomerAccessGate();
  }
});
leagueSelect?.addEventListener("change", () => setActiveLeague(leagueSelect.value));
addLeagueAction?.addEventListener("click", openAddLeagueDialog);
accountAddLeague?.addEventListener("click", openAddLeagueDialog);

const savedAutoSync = localStorage.getItem(loadoutStorageKey("auto-sync"));
if (liveSyncToggle && savedAutoSync !== null) {
  liveSyncToggle.checked = savedAutoSync === "true";
}

