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
    merged.demoMessage = loadoutConfig.demoMessage || "Signed-in customer league loaded.";
    merged.heroSubtitle =
      loadoutConfig.heroSubtitle ||
      "Your official FantasyIQ command center for the Main Move, FantasyIQ Score, roster weakness, confidence, and risk.";
  }

  if (params.get("name")) merged.customerName = params.get("name");
  if (params.get("teamName")) merged.customerTeamName = params.get("teamName");
  if (params.get("teamId")) merged.customerTeamId = params.get("teamId");

  return merged;
}

const appConfig = resolveAppConfig(window.FANTASY_IQ_CONFIG || {});
window.FANTASY_IQ_ACTIVE_CONFIG = appConfig;

let boardData = null;
let activeBoard = "combined";
let liveDraft = null;
let fantasyCalcMarket = null;
let fantasyCalcMarketKey = "";
let fantasyCalcMarketLoading = false;
let fantasyCalcTradeDatabase = null;
let fantasyCalcTradeDatabaseKey = "";
let fantasyCalcTradeDatabaseLoading = false;
let fantasyCalcTradeSamples = { bySideKey: new Map(), loadingKeys: new Set() };
let dataFreshness = null;
let dataFreshnessLoading = false;
let intelligenceData = null;
let intelligenceInFlight = false;
let liveTimer = null;
let mockSim = null;
let simAutoAdvanceTimer = null;
let simAutoAdvanceActive = false;
let selectedBoardPlayerKey = null;
const LIVE_SYNC_DRAFT_INTERVAL_MS = 2500;
const LIVE_SYNC_PREDRAFT_INTERVAL_MS = 10000;
const LIVE_SYNC_COMPLETE_INTERVAL_MS = 30000;
const LIVE_SYNC_ERROR_INTERVAL_MS = 15000;
const INITIAL_BOARD_LIMIT = 180;
const CUSTOMER_SESSION_DAYS = 30;
let activePlayerAutocomplete = null;
let fullBoardLoadStarted = false;
let customerPasswordSession = false;
let customerBootStarted = false;
let dashboardOpenTracked = false;
let liveSyncInFlight = false;
let liveSyncFailureCount = 0;
let lastLiveDraftRenderSignature = "";
let manualDraftOverrides = [];
let draftLeagueOverrideState = null;
let draftCompanionInstalled = false;

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
  try {
    localStorage.removeItem(loadoutStorageKey("access-code"));
  } catch (error) {
    // Legacy access-code cleanup is best effort; auth now relies on HttpOnly session cookies.
  }
  return "";
}

function setCustomerAccessCode(value) {
  try {
    localStorage.removeItem(loadoutStorageKey("access-code"));
    localStorage.setItem("fantasy-dashboard:last-loadout", appConfig.loadoutKey || "");
    if (appConfig.leagueKey) {
      localStorage.setItem(`fantasy-dashboard:${appConfig.loadoutKey || "default"}:last-league`, appConfig.leagueKey);
    }
  } catch (error) {
    // Session persistence is handled by the server cookie.
  }
}

function clearCustomerAccessCode() {
  localStorage.removeItem(loadoutStorageKey("access-code"));
}

function hasCustomerAccess() {
  return Boolean(customerPasswordSession);
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

function clearRememberedPasswordSession(slug = appConfig.loadoutKey) {
  const normalizedSlug = normalizeDashboardSlug(slug || "");
  if (!normalizedSlug) return;
  try {
    localStorage.removeItem(`fantasy-dashboard:${normalizedSlug}:password-session`);
    if (normalizeDashboardSlug(localStorage.getItem("fantasy-dashboard:last-loadout") || "") === normalizedSlug) {
      localStorage.removeItem("fantasy-dashboard:last-loadout");
    }
  } catch (error) {
    // Session cleanup is best effort; server-side logout still clears the cookie.
  }
}

function apiUrl(path, params = {}) {
  const url = new URL(path, window.location.origin);
  if (appConfig.loadoutKey && appConfig.loadoutKey !== "default") {
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
  const draftOverride = activeDraftLeagueOverride();
  if (path === "/api/live-draft" && draftOverride?.leagueId) {
    url.searchParams.set("draftLeagueId", draftOverride.leagueId);
    if (draftOverride.teamId) url.searchParams.set("draftTeamId", draftOverride.teamId);
    if (draftOverride.season) url.searchParams.set("draftSeason", draftOverride.season);
  }
  return `${url.pathname}${url.search}`;
}

function apiHeaders(extra = {}) {
  return { ...extra };
}

function draftLeagueOverrideStorageKey(leagueKey = appConfig.leagueKey, leagueId = appConfig.leagueId) {
  const segment = normalizeDashboardSlug(leagueKey || "") || numericText(leagueId || "") || "default";
  return loadoutStorageKey(`draft-league-override:${segment}`);
}

function legacyDraftLeagueOverrideStorageKey() {
  return loadoutStorageKey("draft-league-override");
}

function activeConfiguredLeagueId() {
  return numericText(appConfig.leagueId || activeLeagueOption()?.leagueId || "");
}

function draftOverrideMatchesActiveLeague(value) {
  if (!value?.leagueId) return false;
  const activeLeagueId = activeConfiguredLeagueId();
  return value.allowCrossLeague === true || Boolean(activeLeagueId && String(value.leagueId) === activeLeagueId);
}

function activeDraftLeagueOverride() {
  if (!draftOverrideMatchesActiveLeague(draftLeagueOverrideState)) return null;
  return draftLeagueOverrideState;
}

function numericText(value = "") {
  return String(value || "").replace(/\D/g, "");
}

function extractLeagueId(value = "") {
  const text = String(value || "").trim();
  const fromParam = text.match(/[?&]leagueId=(\d+)/i);
  if (fromParam) return fromParam[1];
  const fromPath = text.match(/\/leagues?\/(\d+)/i);
  if (fromPath) return fromPath[1];
  const digits = numericText(text);
  return digits.length >= 4 ? digits : "";
}

function extractTeamId(value = "") {
  const text = String(value || "").trim();
  const fromParam = text.match(/[?&]teamId=(\d+)/i);
  return fromParam ? fromParam[1] : "";
}

function extractSeasonId(value = "") {
  const text = String(value || "").trim();
  const fromParam = text.match(/[?&]seasonId=(\d+)/i) || text.match(/[?&]season=(\d+)/i);
  return fromParam ? fromParam[1] : "";
}

function extractMemberId(value = "") {
  const text = String(value || "").trim();
  const fromParam = text.match(/[?&]memberId=([^&#]+)/i);
  if (!fromParam) return "";
  try {
    return decodeURIComponent(fromParam[1]);
  } catch (error) {
    return fromParam[1];
  }
}

function extractDraftUrl(value = "") {
  const text = String(value || "").trim();
  return /^https:\/\/fantasy\.espn\.com\/football\/draft/i.test(text) ? text : "";
}

function loadDraftLeagueOverride() {
  const params = new URLSearchParams(window.location.search);
  const queryLeagueId = extractLeagueId(params.get("draftLeagueId") || params.get("liveLeagueId") || "");
  const queryTeamId = numericText(params.get("draftTeamId") || params.get("liveTeamId") || params.get("teamId") || "");
  if (queryLeagueId) {
    const queryOverride = {
      leagueId: queryLeagueId,
      teamId: queryTeamId,
      season: params.get("season") || params.get("draftSeason") || "2026",
      memberId: params.get("memberId") || "",
      allowCrossLeague: params.get("allowDraftOverride") === "1",
    };
    return draftOverrideMatchesActiveLeague(queryOverride) ? queryOverride : null;
  }
  try {
    const storageKey = draftLeagueOverrideStorageKey();
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (saved?.leagueId) {
      if (draftOverrideMatchesActiveLeague(saved)) return saved;
      localStorage.removeItem(storageKey);
    }
    const legacySaved = JSON.parse(localStorage.getItem(legacyDraftLeagueOverrideStorageKey()) || "null");
    const activeLeagueId = activeConfiguredLeagueId();
    if (
      legacySaved?.leagueId &&
      (String(legacySaved.leagueId) === activeLeagueId || (!activeLeagueId && currentLeagueOptions().length <= 1))
    ) {
      localStorage.setItem(storageKey, JSON.stringify(legacySaved));
      localStorage.removeItem(legacyDraftLeagueOverrideStorageKey());
      return legacySaved;
    }
    if (legacySaved?.leagueId && activeLeagueId && String(legacySaved.leagueId) !== activeLeagueId) {
      localStorage.removeItem(legacyDraftLeagueOverrideStorageKey());
    }
    return null;
  } catch (error) {
    return null;
  }
}

function saveDraftLeagueOverride(value) {
  draftLeagueOverrideState = value?.leagueId ? { ...value, activeLeagueId: activeConfiguredLeagueId() } : null;
  try {
    if (draftLeagueOverrideState) {
      localStorage.setItem(draftLeagueOverrideStorageKey(), JSON.stringify(draftLeagueOverrideState));
    } else {
      localStorage.removeItem(draftLeagueOverrideStorageKey());
    }
  } catch (error) {
    // Local storage is best effort; the current page still keeps the override in memory.
  }
}

function setDraftOverrideUrlState() {
  const params = new URLSearchParams(window.location.search);
  params.delete("draftLeagueId");
  params.delete("draftTeamId");
  params.delete("draftSeason");
  params.delete("allowDraftOverride");
  const draftOverride = activeDraftLeagueOverride();
  if (draftOverride?.leagueId) {
    params.set("draftLeagueId", draftOverride.leagueId);
    if (draftOverride.teamId) params.set("draftTeamId", draftOverride.teamId);
    if (draftOverride.season) params.set("draftSeason", draftOverride.season);
    if (draftOverride.allowCrossLeague) params.set("allowDraftOverride", "1");
  }
  const query = params.toString();
  history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
}

function renderDraftLeagueOverrideControls() {
  if (!draftLeagueOverride) return;
  const draftOverride = activeDraftLeagueOverride();
  if (draftLeagueInput && draftOverride?.leagueId) {
    draftLeagueInput.value = draftOverride.draftUrl || draftOverride.leagueId;
  }
  if (draftTeamInput && draftOverride?.teamId) draftTeamInput.value = draftOverride.teamId;
  draftLeagueOverride.classList.toggle("active", Boolean(draftOverride?.leagueId));
  draftLeagueOverride.dataset.active = draftOverride?.leagueId ? "true" : "false";
  const bridgeReady = Boolean(draftOverride?.leagueId && draftBridgeTeamId());
  draftLeagueOverride.dataset.bridgeReady = bridgeReady ? "true" : "false";
  if (draftBridgeSync) draftBridgeSync.classList.toggle("active", Boolean(draftOverride?.leagueId));
  if (draftBridgeOpen) draftBridgeOpen.disabled = !bridgeReady;
  if (draftBridgeCopy) draftBridgeCopy.disabled = !bridgeReady;
  if (draftCompanionInstall) {
    draftCompanionInstall.dataset.installed = draftCompanionInstalled ? "true" : "false";
    draftCompanionInstall.textContent = draftCompanionInstalled ? "Companion Installed" : "Install Companion";
  }
  if (draftBridgeStatus) {
    draftBridgeStatus.textContent = bridgeReady
      ? draftOverride?.memberId
        ? draftCompanionInstalled
          ? "Experimental companion ready. Verify picks with the manual importer."
          : "Companion bridge is experimental. Use the manual importer as the source of truth."
        : draftCompanionInstalled
          ? "Experimental companion ready. It may infer memberId from ESPN."
          : "Companion bridge is experimental and may not work for every ESPN room."
      : draftOverride?.leagueId
        ? "Add your ESPN teamId if you want to test the experimental companion."
        : "Paste an ESPN draft URL or leagueId above only if you need a separate draft profile.";
  }
}

function applyDraftLeagueOverrideFromInputs() {
  const rawInput = draftLeagueInput?.value || "";
  const leagueId = extractLeagueId(rawInput);
  const teamId = numericText(draftTeamInput?.value || "") || extractTeamId(rawInput);
  const season = extractSeasonId(rawInput) || "2026";
  const memberId = extractMemberId(rawInput);
  const draftUrl = extractDraftUrl(rawInput);
  if (!leagueId) {
    if (liveStatus) liveStatus.innerHTML = "<strong>Paste the ESPN draft URL or leagueId first.</strong>";
    draftLeagueInput?.focus();
    return;
  }
  saveDraftLeagueOverride({ leagueId, teamId, season, memberId, draftUrl, label: "Draft room override" });
  setDraftOverrideUrlState();
  manualDraftOverrides = [];
  saveManualDraftOverrides();
  liveDraft = null;
  lastLiveDraftRenderSignature = "";
  if (myTeamSelect) myTeamSelect.value = teamId || "";
  renderDraftLeagueOverrideControls();
  if (liveStatus) liveStatus.innerHTML = `<strong>Connecting to ESPN league ${htmlEscape(leagueId)}.</strong>`;
  loadLiveDraft(true);
}

function clearDraftLeagueOverride() {
  saveDraftLeagueOverride(null);
  setDraftOverrideUrlState();
  liveDraft = null;
  lastLiveDraftRenderSignature = "";
  if (draftLeagueInput) draftLeagueInput.value = "";
  if (draftTeamInput) draftTeamInput.value = "";
  renderDraftLeagueOverrideControls();
  if (liveStatus) liveStatus.innerHTML = "<strong>Back to saved league.</strong> Pulling a fresh ESPN refresh now.";
  loadLiveDraft(true);
}

function randomDraftBridgeKey() {
  const bytes = new Uint8Array(24);
  if (window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function draftBridgeTeamId() {
  return activeDraftLeagueOverride()?.teamId || selectedTeamId() || appConfig.customerTeamId || "";
}

function espnDraftRoomUrl() {
  const draftOverride = activeDraftLeagueOverride();
  const leagueId = draftOverride?.leagueId || "";
  const season = draftOverride?.season || "2026";
  const teamId = draftBridgeTeamId();
  const memberId = draftOverride?.memberId || "";
  if (!leagueId || !teamId) return "";
  if (draftOverride?.draftUrl) {
    try {
      const url = new URL(draftOverride.draftUrl);
      if (!url.searchParams.get("leagueId")) url.searchParams.set("leagueId", leagueId);
      if (!url.searchParams.get("seasonId")) url.searchParams.set("seasonId", season);
      if (!url.searchParams.get("teamId")) url.searchParams.set("teamId", teamId);
      if (memberId && !url.searchParams.get("memberId")) url.searchParams.set("memberId", memberId);
      return url.toString();
    } catch (error) {
      // Fall through to a clean ESPN draft URL.
    }
  }
  const url = new URL("https://fantasy.espn.com/football/draft");
  url.searchParams.set("leagueId", leagueId);
  url.searchParams.set("seasonId", season);
  url.searchParams.set("teamId", teamId);
  if (memberId) url.searchParams.set("memberId", memberId);
  return url.toString();
}

function draftBridgeConfigPayload() {
  const draftOverride = activeDraftLeagueOverride();
  return {
    leagueId: draftOverride?.leagueId || "",
    season: draftOverride?.season || "2026",
    teamId: draftBridgeTeamId(),
    memberId: draftOverride?.memberId || "",
    bridgeKey: draftOverride?.bridgeKey || "",
    endpoint: `${window.location.origin}/api/draft-bridge`,
    draftUrl: espnDraftRoomUrl(),
    players: combinedBoardRows()
      .slice(0, 320)
      .map((row) => ({
        player: row.Player,
        playerId: Number(row.PlayerId || row.playerId || -1),
      }))
      .filter((row) => row.player),
  };
}

function sendDraftBridgeConfigToCompanion() {
  window.postMessage(
    {
      type: "FANTASYIQ_DRAFT_BRIDGE_CONFIG",
      config: draftBridgeConfigPayload(),
    },
    window.location.origin
  );
}

function pingDraftCompanion() {
  window.postMessage({ type: "FANTASYIQ_DRAFT_COMPANION_PING" }, window.location.origin);
}

async function registerDraftBridgeSession() {
  const draftOverride = activeDraftLeagueOverride();
  if (!draftOverride?.leagueId || !draftBridgeTeamId()) {
    throw new Error("Paste the ESPN draft URL or leagueId and teamId first.");
  }
  const bridgeKey = draftOverride.bridgeKey || randomDraftBridgeKey();
  saveDraftLeagueOverride({ ...draftOverride, bridgeKey });
  const response = await fetch(apiUrl("/api/draft-bridge"), {
    method: "POST",
    cache: "no-store",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      action: "register",
      leagueId: draftOverride.leagueId,
      season: draftOverride.season || "2026",
      bridgeKey,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || `Bridge register HTTP ${response.status}`);
  }
  return bridgeKey;
}

function buildEspnDraftBridgeScript() {
  const config = draftBridgeConfigPayload();
  return `(() => {
  const cfg = ${JSON.stringify(config)};
  const picks = [];
  let postTimer = null;
  let heartbeatTimer = null;
  let pingTimer = null;
  let eventCount = 0;
  const log = (message) => console.log("[FantasyIQ bridge] " + message);
  const normalizeName = (value = "") => String(value || "").toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const decode = async (data) => {
    if (typeof data === "string") return data;
    if (data instanceof ArrayBuffer) return new TextDecoder().decode(data).replace(/\\0+$/g, "");
    if (data instanceof Blob) return (await data.text()).replace(/\\0+$/g, "");
    return String(data || "");
  };
  const post = (reason = "pick") => {
    window.clearTimeout(postTimer);
    postTimer = window.setTimeout(() => {
      fetch(cfg.endpoint, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leagueId: cfg.leagueId, season: cfg.season, bridgeKey: cfg.bridgeKey, source: "espnDraftRoomBridge", reason, picks })
      }).then((response) => response.json()).then((payload) => {
        log("posted " + payload.pickCount + " pick event(s) to MyFantasyIQ");
      }).catch((error) => log("post failed: " + error.message));
    }, 250);
  };
  const remember = (event, teamId, playerId, slotId, playerName = "") => {
    teamId = Number(teamId);
    playerId = Number(playerId);
    slotId = Number(slotId);
    playerName = String(playerName || "").trim();
    if ((!playerId && !playerName) || picks.some((pick) => (playerId && pick.playerId === playerId) || (playerName && normalizeName(pick.playerName || pick.player) === normalizeName(playerName)))) return;
    const pick = { event, pickNumber: picks.length + 1 };
    if (teamId) pick.teamId = teamId;
    if (playerId) pick.playerId = playerId;
    if (playerName) pick.playerName = playerName;
    if (Number.isFinite(slotId)) pick.slotId = slotId;
    picks.push(pick);
    eventCount += 1;
    log(event + " " + (playerName || ("player " + playerId)));
    post();
  };
  const parseLine = (line) => {
    const parts = String(line || "").trim().split(/\\s+/);
    if (!parts[0]) return;
    if (parts[0] === "SELECTED") remember("SELECTED", parts[1], parts[2], parts[3]);
    if (parts[0] === "SOLD") remember("SOLD", parts[1], parts[2], parts[3]);
    if (parts[0] === "UNDONE") {
      const keep = Math.max(0, Number(parts[1]) || 0);
      picks.splice(keep);
      post("undo");
    }
    if (parts[0] === "INIT") log("received ESPN draft init state");
    if (parts[0] === "PONG") log("heartbeat acknowledged");
  };
  const startVisiblePageScan = () => {
    const candidates = (cfg.players || []).map((player) => ({ player: String(player.player || "").trim(), playerId: Number(player.playerId || -1), key: normalizeName(player.player) })).filter((player) => player.player && player.key.length >= 5).sort((a, b) => b.key.length - a.key.length);
    if (!candidates.length) return;
    const scan = () => {
      const text = normalizeName(document.body && document.body.innerText || "");
      if (!text) return;
      candidates.forEach((player) => {
        if (text.includes(player.key)) remember("VISIBLE", "", player.playerId > 0 ? player.playerId : "", "", player.player);
      });
    };
    scan();
    window.setInterval(scan, 3000);
    log("visible draft-room scanner active");
  };
  const securityToken = async () => {
    const url = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/" + cfg.season + "/segments/0/leagues/" + cfg.leagueId + "/teams/" + cfg.teamId + "/draftSecurity";
    const response = await fetch(url, { credentials: "include", headers: { Accept: "application/json", "X-Fantasy-Source": "kona" } });
    const text = await response.text();
    if (!response.ok) throw new Error("draftSecurity HTTP " + response.status + " " + text.slice(0, 80));
    try {
      const parsed = JSON.parse(text);
      return String(typeof parsed === "string" ? parsed : parsed.token || parsed.draftToken || parsed.securityToken || text).replace(/^"|"$/g, "");
    } catch (error) {
      return String(text).replace(/^"|"$/g, "");
    }
  };
  const inferMemberId = async () => {
    if (cfg.memberId) return cfg.memberId;
    const url = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/" + cfg.season + "/segments/0/leagues/" + cfg.leagueId + "?view=mTeam";
    const response = await fetch(url, { credentials: "include", headers: { Accept: "application/json", "X-Fantasy-Source": "kona" } });
    const text = await response.text();
    if (!response.ok) throw new Error("member lookup HTTP " + response.status + " " + text.slice(0, 80));
    const league = JSON.parse(text);
    const team = (league.teams || []).find((item) => String(item.id) === String(cfg.teamId));
    const owner = team && (team.primaryOwner || (team.owners || [])[0]);
    if (!owner) throw new Error("Could not infer ESPN memberId for this team.");
    cfg.memberId = owner;
    return owner;
  };
  const joinUrl = (base, draftToken) => {
    return base + "/JOIN?1=ffl&2=" + encodeURIComponent(cfg.leagueId) + "&3=" + encodeURIComponent(cfg.teamId) + "&4=" + encodeURIComponent(cfg.memberId) + "&5=" + encodeURIComponent(draftToken) + "&6=false&7=false&8=KONA&nocache=" + Math.floor(Math.random() * 1000000);
  };
  const startHeartbeat = (transport) => {
    window.clearInterval(heartbeatTimer);
    window.clearInterval(pingTimer);
    post("heartbeat");
    heartbeatTimer = window.setInterval(() => post("heartbeat"), 15000);
    pingTimer = window.setInterval(() => {
      try {
        if (transport && transport.readyState === WebSocket.OPEN) transport.send("PING\\n");
      } catch (error) {
        log("ping failed: " + error.message);
      }
    }, 12000);
  };
  const connectSse = (draftToken) => {
    const url = joinUrl("https://fantasydraft.espn.com/game-ffl/league-" + cfg.leagueId + "/sse", draftToken);
    const source = new EventSource(url);
    source.onopen = () => {
      log("connected via ESPN SSE fallback. Leave this draft tab open.");
      startHeartbeat(null);
    };
    source.onerror = () => log("SSE connection issue. ESPN may retry automatically.");
    source.onmessage = (event) => String(event.data || "").split(/\\r?\\n/).forEach(parseLine);
    window.__fantasyIQEspnBridge = { source, picks, post };
  };
  const connectWebSocket = (draftToken) => {
    const url = joinUrl("wss://fantasydraft.espn.com/game-ffl/league-" + cfg.leagueId, draftToken);
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    ws.onopen = () => {
      log("connected via ESPN WebSocket. Leave this draft tab open.");
      startHeartbeat(ws);
      try { ws.send("PING\\n"); } catch (error) {}
    };
    ws.onerror = () => log("socket error. Confirm you are logged into ESPN and inside the draft room.");
    ws.onclose = () => {
      window.clearInterval(pingTimer);
      log("socket closed. Trying ESPN SSE fallback.");
      connectSse(draftToken);
    };
    ws.onmessage = async (event) => {
      const text = await decode(event.data);
      text.split(/\\r?\\n/).forEach(parseLine);
    };
    window.__fantasyIQEspnBridge = { ws, picks, post };
  };
  const connect = (token) => {
    const draftToken = ["ffl", cfg.leagueId, cfg.teamId, cfg.memberId, token].join(":");
    connectWebSocket(draftToken);
  };
  if (!cfg.leagueId || !cfg.teamId || !cfg.bridgeKey) {
    alert("FantasyIQ bridge needs leagueId, teamId, and a registered bridge session.");
    return;
  }
  startVisiblePageScan();
  inferMemberId().then(securityToken).then(connect).catch((error) => {
    log("ESPN socket failed; visible scanner remains active. " + error.message);
  });
})();`;
}

function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "readonly");
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  textArea.remove();
  return Promise.resolve();
}

function copyEspnDraftBridgeScript() {
  const draftOverride = activeDraftLeagueOverride();
  if (!draftOverride?.leagueId || !draftBridgeTeamId()) {
    if (draftBridgeStatus) draftBridgeStatus.textContent = "Paste the ESPN draft URL or leagueId, enter teamId, then click Use Draft League.";
    draftLeagueInput?.focus();
    return;
  }
  const bridgeKey = draftOverride.bridgeKey || randomDraftBridgeKey();
  saveDraftLeagueOverride({ ...draftOverride, bridgeKey });
  if (draftBridgeStatus) draftBridgeStatus.textContent = "Copying bridge and registering secure session...";
  copyTextToClipboard(buildEspnDraftBridgeScript())
    .then(() => registerDraftBridgeSession())
    .then(() => {
      if (draftBridgeStatus) {
        draftBridgeStatus.textContent = "Copied. In the ESPN draft room, open DevTools Console, paste it, and press Enter.";
      }
    })
    .catch((error) => {
      if (draftBridgeStatus) draftBridgeStatus.textContent = `Bridge copy failed: ${error.message}`;
    });
}

function openEspnDraftRoomWithCompanion() {
  const draftOverride = activeDraftLeagueOverride();
  if (!draftOverride?.leagueId || !draftBridgeTeamId()) {
    if (draftBridgeStatus) draftBridgeStatus.textContent = "Paste the ESPN draft URL or leagueId, enter teamId, then click Use Draft League.";
    draftLeagueInput?.focus();
    return;
  }
  const bridgeKey = draftOverride.bridgeKey || randomDraftBridgeKey();
  saveDraftLeagueOverride({ ...draftOverride, bridgeKey });
  sendDraftBridgeConfigToCompanion();
  if (draftBridgeStatus) {
    draftBridgeStatus.textContent = draftCompanionInstalled
      ? "Opening ESPN. Verify picks with the manual importer."
      : "Opening ESPN. Companion bridge is experimental; manual import remains the source of truth.";
  }
  const draftUrl = espnDraftRoomUrl();
  const draftWindow = draftUrl ? window.open("about:blank", "_blank") : null;
  registerDraftBridgeSession()
    .then(() => {
      sendDraftBridgeConfigToCompanion();
      if (draftWindow && draftUrl) {
        draftWindow.location.href = draftUrl;
      } else if (draftUrl) {
        window.open(draftUrl, "_blank");
      }
      loadLiveDraft(true);
    })
    .catch((error) => {
      try {
        draftWindow?.close();
      } catch (closeError) {
        // Browser-managed popup cleanup is best effort.
      }
      if (draftBridgeStatus) draftBridgeStatus.textContent = `Companion setup failed: ${error.message}`;
    });
}

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) return;
  const message = event.data || {};
  if (message.type !== "FANTASYIQ_DRAFT_COMPANION_STATUS") return;
  draftCompanionInstalled = Boolean(message.installed);
  if (draftBridgeStatus && message.reason === "configured") {
    draftBridgeStatus.textContent = "Companion configured for testing. Verify picks with the manual importer.";
  }
  renderDraftLeagueOverrideControls();
});

function trackDashboardEvent(eventType, payload = {}) {
  if (["127.0.0.1", "localhost"].includes(window.location.hostname)) return;
  const body = JSON.stringify({
    eventType,
    source: "dashboard",
    customer: appConfig.loadoutKey && appConfig.loadoutKey !== "default" ? appConfig.loadoutKey : "",
    league: appConfig.leagueKey || "",
    path: window.location.pathname,
    authenticated: hasCustomerAccess() ? "1" : "0",
    demoMode: requiresCustomerAccess() ? "0" : "1",
    ...payload,
  });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track-event", new Blob([body], { type: "application/json" }));
      return;
    }
  } catch (error) {
    // Tracking should never block dashboard use.
  }
  fetch("/api/track-event", {
    method: "POST",
    cache: "no-store",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body,
  }).catch(() => {});
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
