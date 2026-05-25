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
const tradeGiveSlots = document.querySelectorAll("[data-trade-side='give']");
const tradeGetSlots = document.querySelectorAll("[data-trade-side='get']");
const tradePackageButtons = document.querySelectorAll("[data-trade-package]");
const tradePackageLabel = document.querySelector("#trade-package-label");
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
const tradeModeButtons = document.querySelectorAll(".trade-mode-toggle");
const tradeSaveNote = document.querySelector("#trade-save-note");
const tradeSavedNotes = document.querySelector("#trade-saved-notes");
const waiverAssistant = document.querySelector("#waiver-assistant");
const waiverIqHero = document.querySelector("#waiver-iq-hero");
const waiverIqSupportingReasons = document.querySelector("#waiver-iq-supporting-reasons");
const waiverIqRiskWarning = document.querySelector("#waiver-iq-risk-warning");
const waiverIqAlternativePath = document.querySelector("#waiver-iq-alternative-path");
const waiverIqWatchlist = document.querySelector("#waiver-iq-watchlist");
const waiverIqDrops = document.querySelector("#waiver-iq-drops");
const waiverIqPlan = document.querySelector("#waiver-iq-plan");
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
const intelligencePanel = document.querySelector("#intelligence-os-panel");
const intelligenceMainMove = document.querySelector("#intelligence-main-move");
const intelligenceFreshness = document.querySelector("#intelligence-freshness");
const intelligenceRefresh = document.querySelector("#intelligence-refresh");
const commandRefresh = document.querySelector("#command-refresh");
const commandMainMoveCard = document.querySelector("#command-main-move-card");
const commandMainMove = document.querySelector("#command-main-move");
const commandMainReason = document.querySelector("#command-main-reason");
const commandFantasyIqScore = document.querySelector("#command-fantasyiq-score");
const commandScoreDetail = document.querySelector("#command-score-detail");
const commandRosterWeakness = document.querySelector("#command-roster-weakness");
const commandWeaknessDetail = document.querySelector("#command-weakness-detail");
const commandConfidence = document.querySelector("#command-confidence");
const commandConfidenceDetail = document.querySelector("#command-confidence-detail");
const commandSupportingReasons = document.querySelector("#command-supporting-reasons");
const commandRiskWarning = document.querySelector("#command-risk-warning");
const commandAlternativePath = document.querySelector("#command-alternative-path");
const intelligenceMainCard = document.querySelector("#intelligence-main-card");
const intelligenceReasons = document.querySelector("#intelligence-reasons");
const intelligenceGrid = document.querySelector("#intelligence-grid");
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
const liveMySlot = document.querySelector("#live-my-slot");
const liveMySlotNote = document.querySelector("#live-my-slot-note");
const myTeamSelect = document.querySelector("#my-team-select");
const hideDrafted = document.querySelector("#hide-drafted");
const hideDraftedBoard = document.querySelector("#hide-drafted-board");
const liveRecommendations = document.querySelector("#live-recommendations");
const liveTierSearch = document.querySelector("#live-tier-search");
const liveTierBoard = document.querySelector("#live-tier-board");
const liveTierButtons = document.querySelectorAll(".live-tier-toggle");
const liveMyRoster = document.querySelector("#live-my-roster");
const postDraftPlan = document.querySelector("#post-draft-plan");
const myTeamHero = document.querySelector("#my-team-hero");
const myTeamPositionGrid = document.querySelector("#my-team-position-grid");
const myTeamStarters = document.querySelector("#my-team-starters");
const myTeamBench = document.querySelector("#my-team-bench");
const myTeamActions = document.querySelector("#my-team-actions");
const liveRecentPicks = document.querySelector("#live-recent-picks");
const liveNextPicks = document.querySelector("#live-next-picks");
const draftOrderGrid = document.querySelector("#draft-order-grid");
const allTeamsDraftBoard = document.querySelector("#all-teams-draft-board");
const allTeamsDraftSummary = document.querySelector("#all-teams-draft-summary");
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
const externalMockPicks = document.querySelector("#external-mock-picks");
const externalMockScoring = document.querySelector("#external-mock-scoring");
const externalMockTeams = document.querySelector("#external-mock-teams");
const externalMockSlot = document.querySelector("#external-mock-slot");
const externalMockSuperflex = document.querySelector("#external-mock-superflex");
const externalMockDoubleFlex = document.querySelector("#external-mock-double-flex");
const externalMockGrade = document.querySelector("#external-mock-grade");
const externalMockClear = document.querySelector("#external-mock-clear");
const externalMockOutput = document.querySelector("#external-mock-output");
const accountCard = document.querySelector("#account-card");
const accountLabel = document.querySelector("#account-label");
const accountState = document.querySelector("#account-state");
const accountAction = document.querySelector("#account-action");
const brandHomeLink = document.querySelector(".brand-lockup");
const leagueSwitcher = document.querySelector("#league-switcher");
const leagueSwitcherLabel = document.querySelector("#league-switcher-label");
const leagueSelect = document.querySelector("#league-select");
const addLeagueAction = document.querySelector("#add-league-action");
const removeLeagueAction = document.querySelector("#remove-league-action");
const leagueSlotNote = document.querySelector("#league-slot-note");
const draftLeagueOverride = document.querySelector("#draft-league-override");
const draftLeagueInput = document.querySelector("#draft-league-input");
const draftTeamInput = document.querySelector("#draft-team-input");
const draftLeagueApply = document.querySelector("#draft-league-apply");
const draftLeagueClear = document.querySelector("#draft-league-clear");
const draftPasteSync = document.querySelector("#draft-paste-sync");
const draftPasteInput = document.querySelector("#draft-paste-input");
const draftPasteApply = document.querySelector("#draft-paste-apply");
const draftBridgeSync = document.querySelector("#draft-bridge-sync");
const draftBridgeOpen = document.querySelector("#draft-bridge-open");
const draftBridgeCopy = document.querySelector("#draft-bridge-copy");
const draftBridgeStatus = document.querySelector("#draft-bridge-status");
const draftCompanionInstall = document.querySelector("#draft-companion-install");
let addLeagueDialog = null;
let sosRuntimeReady = false;
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
const preDraftPanel = document.querySelector("#pre-draft-panel");
const draftPrepScore = document.querySelector("#draft-prep-score");
const draftPrepScoreNote = document.querySelector("#draft-prep-score-note");
const draftPrepReadiness = document.querySelector("#draft-prep-readiness");
const draftPrepSlot = document.querySelector("#draft-prep-slot");
const draftPrepSettings = document.querySelector("#draft-prep-settings");
const draftPrepTiers = document.querySelector("#draft-prep-tiers");
const draftPrepValues = document.querySelector("#draft-prep-values");
const draftBuildPlan = document.querySelector("#draft-build-plan");
const draftPrepAvoid = document.querySelector("#draft-prep-avoid");
const draftPrepBench = document.querySelector("#draft-prep-bench");
const draftBuildButtons = document.querySelectorAll(".draft-build-toggle");
const draftWatchlistType = document.querySelector("#draft-watchlist-type");
const draftWatchlistInput = document.querySelector("#draft-watchlist-input");
const draftWatchlistAdd = document.querySelector("#draft-watchlist-add");
const draftWatchlistList = document.querySelector("#draft-watchlist-list");
const sosPosition = document.querySelector("#sos-position");
const sosView = document.querySelector("#sos-view");
const sosPlayerSearch = document.querySelector("#sos-player-search");
const sosRange = document.querySelector("#sos-range");
const sosWeekToggles = document.querySelector("#sos-week-toggles");
const sosTableHead = document.querySelector("#sos-table-head");
const sosTableBody = document.querySelector("#sos-table-body");
const sosSelectedSummary = document.querySelector("#sos-selected-summary");
const sosBestStretch = document.querySelector("#sos-best-stretch");
const sosBrutalStretch = document.querySelector("#sos-brutal-stretch");
const sosPlayoffEdge = document.querySelector("#sos-playoff-edge");
const sosMarketStatus = document.querySelector("#sos-market-status");
const sosMarketDetail = document.querySelector("#sos-market-detail");
const sosInsights = document.querySelector("#sos-insights");
const leagueHealthPanel = document.querySelector("#league-health-panel");
const leagueHealthTitle = document.querySelector("#league-health-title");
const leagueHealthScore = document.querySelector("#league-health-score");
const leagueHealthGrid = document.querySelector("#league-health-grid");
const boardMethodNote = document.querySelector("#board-method-note");
const accountAddLeague = document.querySelector("#account-add-league");
const accountManageBilling = document.querySelector("#account-manage-billing");
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


function rememberedCustomerLoadout(loadouts) {
  try {
    const lastLoadout = localStorage.getItem("fantasy-dashboard:last-loadout") || "";
    if (lastLoadout && localStorage.getItem(`fantasy-dashboard:${lastLoadout}:password-session`)) {
      return lastLoadout;
    }
    const savedLoadouts = Object.keys(loadouts).filter((key) =>
      localStorage.getItem(`fantasy-dashboard:${key}:password-session`)
    );
    return savedLoadouts.length === 1 ? savedLoadouts[0] : "";
  } catch (error) {
    return "";
  }
}


