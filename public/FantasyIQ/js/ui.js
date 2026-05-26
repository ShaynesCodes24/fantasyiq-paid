applyAppConfig();
updateAccountControl();
ensureCustomerUrlContext();

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

function stopLiveSyncTimer() {
  window.clearTimeout(liveTimer);
  liveTimer = null;
}

function scheduleNextLiveSync() {
  stopLiveSyncTimer();
  if (liveSyncToggle && !liveSyncToggle.checked) return;
  if (requiresCustomerAccess() && !hasCustomerAccess()) return;
  liveTimer = window.setTimeout(() => loadLiveDraft(), liveSyncIntervalMs());
}

function setLiveSyncPhase(phase = "idle") {
  const livePanel = document.querySelector("#live");
  const commandPanel = document.querySelector("#command");
  const busy = !["idle", "error"].includes(phase);
  if (livePanel) {
    livePanel.dataset.syncPhase = phase;
    livePanel.setAttribute("aria-busy", busy ? "true" : "false");
  }
  if (commandPanel) {
    commandPanel.dataset.syncPhase = phase;
    commandPanel.setAttribute("aria-busy", busy ? "true" : "false");
  }
  if (manualSync) manualSync.disabled = busy;
  if (liveSyncStatus && phase === "fetching") liveSyncStatus.textContent = "Syncing ESPN";
  if (liveSyncStatus && phase === "rendering") liveSyncStatus.textContent = "Building IQ brief";
}

function loadLiveDraft(force = false) {
  if (!ensureCustomerAccess()) return Promise.resolve();
  if (liveSyncInFlight) {
    return Promise.resolve();
  }
  liveSyncInFlight = true;
  setLiveSyncPhase("fetching");
  if (force) stopLiveSyncTimer();
  return fetch(apiUrl("/api/live-draft", { force: force ? 1 : "" }), { cache: "no-store", headers: apiHeaders() })
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
      applyManualDraftOverrides(liveDraft);
      liveSyncFailureCount = 0;
      const nextSignature = liveDraftRenderSignature(liveDraft);
      const unchanged = !force && lastLiveDraftRenderSignature && nextSignature === lastLiveDraftRenderSignature;
      setLiveSyncPhase("rendering");
      renderLiveDraft({ full: !unchanged });
    })
    .catch((error) => {
      liveSyncFailureCount += 1;
      setLiveSyncPhase("error");
      liveServerHelp(error.message);
    })
    .finally(() => {
      liveSyncInFlight = false;
      setLiveSyncPhase("idle");
      scheduleNextLiveSync();
    });
}

function startLiveSync() {
  if (!ensureCustomerAccess()) return;
  stopLiveSyncTimer();
  loadLiveDraft();
}

function scheduleIdleTask(callback, timeout = 1200) {
  if (typeof callback !== "function") return;
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(callback, { timeout });
    return;
  }
  window.setTimeout(callback, timeout);
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

const BUNDLED_BOARD_VERSION = "20260525_boot_speed_1";
let deferredDashboardRenderQueued = false;

function activeDashboardSection() {
  return document.querySelector(".panel.active")?.id || "command";
}

function renderBoardDependentSection(section = activeDashboardSection(), options = {}) {
  if (!boardData) return;
  const activated = Boolean(options.userActivated);
  if (section === "command") {
    renderLeagueHealth();
    renderIntelligenceOS();
    return;
  }
  if (section === "workbooks") {
    renderBoard();
    refreshActivePlayerAutocomplete();
    return;
  }
  if (section === "draft") {
    renderDraftPrep();
    return;
  }
  if (section === "live") {
    renderSosHeatMap();
    if (activated && sosRuntimeReady) loadSosHeatMap();
    renderCheatcodeMode();
    renderLiveDraft();
    renderLiveTierBoard();
    return;
  }
  if (section === "simulator") {
    renderMockSimulator();
    gradeExternalMockDraft();
    return;
  }
  if (section === "trade") {
    renderTradeCalc();
    renderRosterEngines();
    return;
  }
  if (section === "my-team" || section === "waivers") {
    renderRosterEngines();
    return;
  }
  if (section === "account") {
    renderAccountPanel();
  }
}

function renderDeferredDashboardSections() {
  if (!boardData) return;
  renderBoard();
  renderDraftPrep();
  renderSosHeatMap();
  renderCheatcodeMode();
  renderLiveDraft();
  renderLiveTierBoard();
  renderMockSimulator();
  gradeExternalMockDraft();
  renderTradeCalc();
  renderRosterEngines();
  refreshActivePlayerAutocomplete();
}

function scheduleDeferredDashboardSections() {
  if (deferredDashboardRenderQueued) return;
  deferredDashboardRenderQueued = true;
  scheduleIdleTask(() => {
    deferredDashboardRenderQueued = false;
    renderDeferredDashboardSections();
  }, 900);
}

function applyBoardPayload(data) {
  boardData = data;
  applyServerCustomerContext(data.customer);
  renderLeagueProfile();
  renderBoardDependentSection(activeDashboardSection());
  loadIntelligence(false);
  scheduleDeferredDashboardSections();
  scheduleIdleTask(() => {
    loadFantasyCalcMarket();
    loadFantasyCalcTradeDatabase();
  }, 1800);
}

function fantasyCalcMarketRequestUrl() {
  const settings = activeLeagueSettings();
  const slots = settings.lineupSlots || {};
  const ppr =
    settings.scoringType === "standard"
      ? 0
      : settings.scoringType === "half-ppr"
        ? 0.5
        : Number(settings.receptionPoints ?? 1);
  return apiUrl("/api/fantasycalc-market", {
    v: Date.now(),
    isDynasty: settings.leagueType === "dynasty" || settings.isDynasty ? "true" : "false",
    numQbs: Number(slots.SUPERFLEX || 0) > 0 ? 2 : 1,
    numTeams: settings.teamCount || 12,
    ppr,
  });
}

function fantasyCalcTradeDatabaseRequestUrl() {
  const settings = activeLeagueSettings();
  const slots = settings.lineupSlots || {};
  const ppr =
    settings.scoringType === "standard"
      ? 0
      : settings.scoringType === "half-ppr"
        ? 0.5
        : Number(settings.receptionPoints ?? 1);
  return apiUrl("/api/fantasycalc-trades", {
    v: Date.now(),
    isDynasty: settings.leagueType === "dynasty" || settings.isDynasty ? "true" : "false",
    numQbs: Number(slots.SUPERFLEX || 0) > 0 ? 2 : 1,
    numTeams: settings.teamCount || 12,
    ppr,
  });
}

function loadFantasyCalcMarket() {
  const settings = activeLeagueSettings();
  const slots = settings.lineupSlots || {};
  const key = [
    settings.leagueType === "dynasty" || settings.isDynasty ? "dynasty" : "redraft",
    Number(slots.SUPERFLEX || 0) > 0 ? 2 : 1,
    settings.teamCount || 12,
    settings.scoringType || settings.receptionPoints || "ppr",
  ].join("|");
  if (fantasyCalcMarketLoading || fantasyCalcMarketKey === key) return;
  fantasyCalcMarketLoading = true;
  fantasyCalcMarketKey = key;
  fetch(fantasyCalcMarketRequestUrl(), { cache: "no-store", headers: apiHeaders() })
    .then((response) => {
      if (!response.ok) throw new Error(`FantasyCalc market returned HTTP ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      fantasyCalcMarket = normalizeFantasyCalcMarket(payload);
      renderTradeCalc();
      renderRosterEngines();
    })
    .catch((error) => {
      fantasyCalcMarket = { ok: false, playersByKey: new Map(), error: error.message, source: "FantasyIQ fallback" };
      fantasyCalcMarketKey = "";
      console.warn("FantasyCalc market unavailable; Trade IQ is using FantasyIQ values only.", error);
      renderTradeCalc();
      renderRosterEngines();
    })
    .finally(() => {
      fantasyCalcMarketLoading = false;
    });
}

function loadFantasyCalcTradeDatabase() {
  const settings = activeLeagueSettings();
  const slots = settings.lineupSlots || {};
  const key = [
    settings.leagueType === "dynasty" || settings.isDynasty ? "dynasty" : "redraft",
    Number(slots.SUPERFLEX || 0) > 0 ? 2 : 1,
    settings.teamCount || 12,
    settings.scoringType || settings.receptionPoints || "ppr",
  ].join("|");
  if (fantasyCalcTradeDatabaseLoading || fantasyCalcTradeDatabaseKey === key) return;
  fantasyCalcTradeDatabaseLoading = true;
  fantasyCalcTradeDatabaseKey = key;
  fetch(fantasyCalcTradeDatabaseRequestUrl(), { cache: "no-store", headers: apiHeaders() })
    .then((response) => {
      if (!response.ok) throw new Error(`FantasyCalc trade database returned HTTP ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      fantasyCalcTradeDatabase = normalizeFantasyCalcTradeDatabase(payload);
      renderRosterEngines();
      loadIntelligence(false);
    })
    .catch((error) => {
      fantasyCalcTradeDatabase = {
        ok: false,
        mostTradedById: new Map(),
        mostTradedByKey: new Map(),
        error: error.message,
      };
      fantasyCalcTradeDatabaseKey = "";
      console.warn("FantasyCalc trade database unavailable; Trade IQ package ideas are disabled.", error);
      renderRosterEngines();
    })
    .finally(() => {
      fantasyCalcTradeDatabaseLoading = false;
    });
}

function loadDataFreshness() {
  if (dataFreshnessLoading) return Promise.resolve(dataFreshness);
  dataFreshnessLoading = true;
  return fetch(apiUrl("/api/data-freshness", { v: Date.now() }), { cache: "no-store", headers: apiHeaders() })
    .then((response) => {
      if (!response.ok) throw new Error(`Freshness check returned HTTP ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      dataFreshness = payload;
      renderAccountPanel();
      return payload;
    })
    .catch((error) => {
      dataFreshness = { ok: false, rows: [], error: error.message };
      renderAccountPanel();
      return dataFreshness;
    })
    .finally(() => {
      dataFreshnessLoading = false;
    });
}

function combinedBoardCount(data = boardData) {
  return data?.boards?.combined?.rows?.length || 0;
}

function loadFullBoardInBackground() {
  if (fullBoardLoadStarted || !(appConfig.liveBoardUrl || "/api/live-boards").startsWith("/api/")) return;
  fullBoardLoadStarted = true;
  scheduleIdleTask(() => {
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
  }, 2400);
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
      return fetch(`./data/boards.json?v=${BUNDLED_BOARD_VERSION}`).then((response) => {
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

draftLeagueOverrideState = loadDraftLeagueOverride();
manualDraftOverrides = loadManualDraftOverrides();
renderDraftLeagueOverrideControls();
pingDraftCompanion();
window.setTimeout(pingDraftCompanion, 800);

if (boardTable) {
  bootCustomerDashboard();
  scheduleIdleTask(loadDataFreshness, 3000);
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
removeLeagueAction?.addEventListener("click", removeActiveLeague);
navJumps.forEach((button) => {
  button.addEventListener("click", () => activateSection(button.dataset.jump));
});

draftBuildButtons.forEach((button) => {
  button.addEventListener("click", () => {
    localStorage.setItem(draftPrepStorageKey("build"), button.dataset.draftBuild || "balanced");
    renderDraftPrep();
  });
});
draftWatchlistAdd?.addEventListener("click", addDraftWatchlistItem);
draftWatchlistInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addDraftWatchlistItem();
  }
});

liveTierSearch?.addEventListener("input", renderLiveTierBoard);
liveTierButtons.forEach((button) => {
  button.addEventListener("click", () => {
    liveTierButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderLiveTierBoard();
  });
});

[sosPosition, sosView, sosPlayerSearch, sosRange].forEach((control) => {
  control?.addEventListener("input", renderSosHeatMap);
  control?.addEventListener("change", renderSosHeatMap);
});
sosWeekToggles?.querySelectorAll("button").forEach((button) => {
  button.addEventListener("click", () => {
    button.classList.toggle("active");
    if (sosRange) sosRange.value = "custom";
    renderSosHeatMap();
  });
});
sosTableHead?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-sos-sort]");
  if (!button) return;
  const key = button.dataset.sosSort || "avg";
  const descendingDefault = ["tough", "easy"].includes(key);
  sosSort = {
    key,
    direction:
      sosSort.key === key ? (sosSort.direction === "asc" ? "desc" : "asc") : descendingDefault ? "desc" : "asc",
  };
  renderSosHeatMap();
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
externalMockGrade?.addEventListener("click", gradeExternalMockDraft);
externalMockClear?.addEventListener("click", clearExternalMockDraft);
externalMockPicks?.addEventListener("input", () => {
  if ((externalMockPicks.value || "").trim()) gradeExternalMockDraft();
});
[externalMockScoring, externalMockSlot, externalMockSuperflex, externalMockDoubleFlex].forEach((control) => {
  control?.addEventListener("change", gradeExternalMockDraft);
});
externalMockTeams?.addEventListener("change", () => {
  syncExternalMockSlots();
  gradeExternalMockDraft();
});
syncExternalMockSlots();
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
tradeGiveSlots.forEach((input) => input.addEventListener("input", renderTradeCalc));
tradeGetSlots.forEach((input) => input.addEventListener("input", renderTradeCalc));
tradePackageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    applyTradePackageShape(button.dataset.tradePackage || "1-1");
    renderTradeCalc();
  });
});
tradeRoster?.addEventListener("input", renderTradeCalc);
tradeModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    localStorage.setItem(tradeDeskStorageKey("mode"), button.dataset.tradeMode || "balanced");
    renderTradeCalc();
  });
});
tradeSaveNote?.addEventListener("click", saveCurrentTradeNote);
intelligenceRefresh?.addEventListener("click", () => loadIntelligence(true));
commandRefresh?.addEventListener("click", () => loadIntelligence(true));

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
  renderLiveDraftSlot();
  renderDraftPrep();
  renderLiveDraft();
  renderCheatcodeMode();
  renderRosterEngines();
});
manualSync?.addEventListener("click", () => loadLiveDraft(true));
draftLeagueApply?.addEventListener("click", applyDraftLeagueOverrideFromInputs);
draftLeagueClear?.addEventListener("click", clearDraftLeagueOverride);
draftLeagueInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    applyDraftLeagueOverrideFromInputs();
  }
});
draftTeamInput?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    applyDraftLeagueOverrideFromInputs();
  }
});
draftPasteApply?.addEventListener("click", importDraftedPlayersFromText);
draftBridgeOpen?.addEventListener("click", openEspnDraftRoomWithCompanion);
draftBridgeCopy?.addEventListener("click", copyEspnDraftBridgeScript);
liveSyncToggle?.addEventListener("change", () => {
  localStorage.setItem(loadoutStorageKey("auto-sync"), String(liveSyncToggle.checked));
  if (liveSyncToggle.checked) {
    startLiveSync();
  } else {
    stopLiveSyncTimer();
    if (liveStatus)
      liveStatus.innerHTML = "<strong>Auto sync paused.</strong> Use Sync Now for a one-time ESPN refresh.";
  }
});

accountAction?.addEventListener("click", () => {
  if (hasCustomerAccess()) {
    signOutCustomer();
  } else {
    showCustomerAccessGate();
  }
});
document.addEventListener("click", (event) => {
  const link = event.target.closest('a[href*="buy.stripe.com"]');
  if (!link) return;
  trackDashboardEvent("checkout.started", {
    checkoutType: link.href.includes("dRmcN5aAV1GX0Cc7X3efC02") ? "additional_league" : "season_pass",
    target: link.href,
  });
});
leagueSelect?.addEventListener("change", () => setActiveLeague(leagueSelect.value));
addLeagueAction?.addEventListener("click", openAddLeagueDialog);
accountAddLeague?.addEventListener("click", openAddLeagueDialog);
accountManageBilling?.addEventListener("click", openBillingPortal);

const savedAutoSync = localStorage.getItem(loadoutStorageKey("auto-sync"));
if (liveSyncToggle && savedAutoSync !== null) {
  liveSyncToggle.checked = savedAutoSync === "true";
}
