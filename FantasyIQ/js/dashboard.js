function activeLeagueSettings() {
  const liveSettings =
    liveDraft?.leagueSettings || liveDraft?.customer?.leagueSettings || boardData?.customer?.leagueSettings || {};
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
  return ["QB", "RB", "WR", "TE", "FLEX", "SUPERFLEX", "DST", "K"].reduce(
    (sum, key) => sum + Number(slots[key] || 0),
    0,
  );
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
  score += clampNumber(udkSignalScore(row), -4, 5);
  if (
    (row.Category === "Rookie" || row["Rookie Signal"]) &&
    externalTrendScore(row) >= 7 &&
    Number(row.Rank || 999) > 55
  )
    score += 2;
  if (!slots.K && row.Pos === "K") score -= 25;
  if (!slots.DST && row.Pos === "DST") score -= 25;
  return Math.round(score * 10) / 10;
}

function valueDisplay(row) {
  return leagueValueScore(row).toFixed(1);
}

function normalizeFantasyCalcMarket(payload) {
  const players = Array.isArray(payload?.players) ? payload.players : [];
  const maxValue = Number(payload?.maxValue || Math.max(...players.map((player) => Number(player.value || 0)), 0));
  const playersByKey = new Map();
  players.forEach((player) => {
    const key = normalizePlayerName(player.name || "");
    if (!key) return;
    const value = Number(player.value || 0);
    const marketScore = maxValue > 0 ? Math.round((value / maxValue) * 1000) / 10 : 0;
    playersByKey.set(key, { ...player, marketScore });
    if (player.espnId) playersByKey.set(`espn:${player.espnId}`, { ...player, marketScore });
  });
  return {
    ok: Boolean(payload?.ok),
    source: payload?.source || "FantasyCalc trade-value market",
    sourceUrl: payload?.sourceUrl || "https://fantasycalc.com/trade-value-chart",
    databaseUrl: payload?.databaseUrl || "https://fantasycalc.com/database",
    tradeCount: payload?.tradeCount || null,
    syncedAt: payload?.syncedAt || "",
    settings: payload?.settings || {},
    maxValue,
    playersByKey,
    playerCount: players.length,
  };
}

function normalizeFantasyCalcTradeDatabase(payload) {
  const mostTraded = Array.isArray(payload?.mostTraded) ? payload.mostTraded : [];
  const mostTradedById = new Map();
  const mostTradedByKey = new Map();
  mostTraded.forEach((item) => {
    const player = item?.player || {};
    const id = String(player.id || item.id || "").trim();
    const key = normalizePlayerName(player.name || item.name || "");
    const normalized = {
      id,
      name: player.name || item.name || "",
      position: player.position || item.position || "",
      team: player.maybeTeam || item.team || "",
      espnId: player.espnId || "",
      activity: Number(item.value || item.tradeCount || item.count || 0),
    };
    if (id) mostTradedById.set(id, normalized);
    if (key) mostTradedByKey.set(key, normalized);
    if (normalized.espnId) mostTradedById.set(`espn:${normalized.espnId}`, normalized);
  });
  return {
    ok: Boolean(payload?.ok),
    source: payload?.source || "FantasyCalc real-trade database",
    sourceUrl: payload?.sourceUrl || "https://fantasycalc.com/database",
    syncedAt: payload?.syncedAt || "",
    tradeCount: payload?.tradeCount || null,
    settings: payload?.settings || {},
    mostTraded,
    mostTradedById,
    mostTradedByKey,
  };
}

function fantasyCalcPlayer(row) {
  if (!row || !fantasyCalcMarket?.playersByKey) return null;
  const espnId = row.PlayerId || row.EspnId || row.ESPNID || "";
  if (espnId && fantasyCalcMarket.playersByKey.has(`espn:${espnId}`)) {
    return fantasyCalcMarket.playersByKey.get(`espn:${espnId}`);
  }
  const key = normalizePlayerName(row.Player || "");
  if (fantasyCalcMarket.playersByKey.has(key)) return fantasyCalcMarket.playersByKey.get(key);
  return null;
}

function fantasyCalcPlayerId(row) {
  const market = fantasyCalcPlayer(row);
  const id = market?.id || row?.FantasyCalcId || row?.fantasyCalcId || "";
  return String(id || "").trim();
}

function fantasyCalcTradeDatabasePlayer(row) {
  if (!row || !fantasyCalcTradeDatabase?.ok) return null;
  const id = fantasyCalcPlayerId(row);
  if (id && fantasyCalcTradeDatabase.mostTradedById?.has(id)) return fantasyCalcTradeDatabase.mostTradedById.get(id);
  const espnId = row.PlayerId || row.EspnId || row.ESPNID || fantasyCalcPlayer(row)?.espnId || "";
  if (espnId && fantasyCalcTradeDatabase.mostTradedById?.has(`espn:${espnId}`))
    return fantasyCalcTradeDatabase.mostTradedById.get(`espn:${espnId}`);
  const mostTraded = fantasyCalcTradeDatabase.mostTradedByKey?.get(normalizePlayerName(row.Player || ""));
  if (mostTraded) return mostTraded;
  const market = fantasyCalcPlayer(row);
  return market?.id
    ? { id: String(market.id), name: market.name || row.Player || "", activity: 0, sampleRequired: true }
    : null;
}

function fantasyCalcTradeDatabaseReady() {
  return Boolean(
    fantasyCalcMarket?.ok &&
    fantasyCalcMarket.playerCount &&
    fantasyCalcTradeDatabase?.ok &&
    fantasyCalcTradeDatabase.tradeCount &&
    fantasyCalcTradeDatabase.mostTradedByKey?.size,
  );
}

function fantasyCalcPlayerByName(name) {
  if (!fantasyCalcMarket?.playersByKey) return null;
  return fantasyCalcMarket.playersByKey.get(normalizePlayerName(name || "")) || null;
}

function fantasyCalcMarketScore(row) {
  const market = fantasyCalcPlayer(row);
  return Number.isFinite(Number(market?.marketScore)) ? Number(market.marketScore) : null;
}

function fantasyCalcMarketOnlyRow(market) {
  if (!market) return null;
  const volatility = Number(market.volatility || 0);
  return {
    Player: market.name,
    Pos: market.position || "",
    Team: market.team || "",
    Rank: market.overallRank || 999,
    "Pos Rank": market.positionRank || "",
    "Value Score": Number(market.marketScore || 0),
    "Pos Tier": market.tier ? `Market T${market.tier}` : "Market",
    Category: "Market",
    Risk: clampNumber(4.5 + volatility * 0.25, 2.5, 8),
    Action: "Market-only player",
    Analysis: "FantasyCalc market match. Full FantasyIQ board context will fill in when the complete board is loaded.",
    MarketOnly: true,
  };
}

function tradeAssetValue(row) {
  const local = leagueValueScore(row);
  const market = fantasyCalcMarketScore(row);
  if (!Number.isFinite(Number(market))) return local;
  return Math.round((local * 0.58 + Number(market) * 0.42) * 10) / 10;
}

function tradeValueDisplay(row) {
  return tradeAssetValue(row).toFixed(1);
}

function tradeMarketSourceLabel() {
  if (fantasyCalcTradeDatabaseReady()) {
    const count = Number(fantasyCalcTradeDatabase.tradeCount || fantasyCalcMarket.tradeCount || 0).toLocaleString();
    return `Fantasy IQ Data from ${count} accepted trades`;
  }
  if (fantasyCalcTradeDatabaseLoading || fantasyCalcMarketLoading) {
    return "Fantasy IQ Data loading";
  }
  if (fantasyCalcMarket?.ok && fantasyCalcMarket.playerCount) {
    return "Fantasy IQ Data value chart loaded; accepted-trade database pending";
  }
  return "Fantasy IQ Data unavailable";
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

function hasUdkSignal(row) {
  return Boolean(row?.["UDK Matched"] || row?.["UDK Alignment"]);
}

function udkDeltaValue(row) {
  const delta = Number(row?.["UDK Delta"]);
  return Number.isFinite(delta) ? delta : null;
}

function udkDeltaDisplay(row) {
  const delta = udkDeltaValue(row);
  if (delta === null) return "";
  if (delta === 0) return "Even";
  return `${delta > 0 ? "+" : ""}${Math.round(delta)}`;
}

function udkAlignmentSignal(row) {
  if (!hasUdkSignal(row)) {
    return {
      label: "No UDK match",
      detail: "Private UDK+ CSV signal is not available for this player.",
      className: "neutral",
      score: 0,
    };
  }
  const alignment = row["UDK Alignment"] || "UDK matched";
  const delta = udkDeltaValue(row);
  const detail = row["UDK Signal"] || "Private UDK+ CSV matched this player.";
  if (alignment === "Consensus") {
    return { label: "UDK agrees", detail, className: "good", score: 3.5 };
  }
  if (alignment === "UDK higher") {
    return {
      label: "UDK higher",
      detail,
      className: "good",
      score: delta !== null ? clampNumber(Math.abs(delta) / 6, 1, 5) : 2,
    };
  }
  if (alignment === "FantasyIQ higher") {
    return {
      label: "UDK lower",
      detail,
      className: "watch",
      score: delta !== null ? -clampNumber(delta / 8, 1, 4) : -1.5,
    };
  }
  return { label: alignment, detail, className: "watch", score: 1 };
}

function udkSignalScore(row) {
  return udkAlignmentSignal(row).score || 0;
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
    leagueScoringNote.textContent = "Raw-stat scoring when the board is loaded";
  }
  if (leagueDraftRounds) leagueDraftRounds.textContent = `${rounds} rounds`;
  if (leagueDraftNote) leagueDraftNote.textContent = `${settings.playoffTeams || 0} playoff teams`;
  if (leagueProfileStrip) {
    const draftOverride = activeDraftLeagueOverride();
    const overrideText = draftOverride?.leagueId ? ` Draft league override: ESPN league ${draftOverride.leagueId}.` : "";
    leagueProfileStrip.innerHTML = `<strong>League engine active</strong><span>${htmlEscape(teamText)} / ${htmlEscape(scoringText)} / ${htmlEscape(lineupText)}. Source: ${htmlEscape(source)}.${htmlEscape(overrideText)}</span>`;
  }
  if (leagueRoomNote) {
    const draftOverride = activeDraftLeagueOverride();
    const roomLeague = draftOverride?.leagueId ? `ESPN league ${draftOverride.leagueId}` : "saved ESPN league";
    leagueRoomNote.innerHTML = `<strong>${htmlEscape(scoringText)} league profile</strong><span>${htmlEscape(teamText)} with ${htmlEscape(lineupText)}. ESPN refresh uses the ${htmlEscape(roomLeague)}.</span>`;
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
      ? `${liveDraft.demoMode ? "Demo league" : "Public ESPN league"} checked ${formatSyncTime(liveDraft.syncedAt)}`
      : liveSyncInFlight
        ? "Checking the selected ESPN league now"
        : appConfig.leagueId
          ? "Waiting for first ESPN refresh"
          : requiresCustomerAccess()
            ? "League setup is still needed"
            : "Demo profile is ready to check";
  const draftState = liveDraft?.inProgress
    ? "Draft started"
    : liveDraft?.drafted
      ? "Draft complete"
      : isPreDraftLeague()
        ? "Pre-draft ready"
        : liveDraft
          ? "Board loaded"
            : "Awaiting check";
  return [
    {
      label: "Account",
      value: requiresCustomerAccess() ? (hasCustomerAccess() ? "Signed in" : "Sign in needed") : "Demo preview",
      detail: requiresCustomerAccess()
        ? hasCustomerAccess()
          ? "Dashboard access is active on this device."
          : "Unlock to save and read paid league profiles."
        : "Public preview with sample data.",
      state: requiresCustomerAccess() && !hasCustomerAccess() ? "warn" : "good",
    },
    {
      label: "ESPN Access",
      value: liveDraft?.staleError
        ? "Needs review"
        : liveDraft
          ? "Checked"
          : liveSyncInFlight
            ? "Checking"
            : appConfig.leagueId
              ? "Awaiting check"
              : requiresCustomerAccess()
                ? "Setup needed"
                : "Demo ready",
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
      detail: isPreDraftLeague()
        ? `${(liveDraft?.draftOrder || []).length || leagueTeamTotal()} draft slots loaded; 0 picks made.`
        : liveDraft
          ? `${Number(liveDraft.completedPicks || 0)}/${Number(liveDraft.totalPicks || 0) || leagueTeamTotal() * draftRoundTotal(settings)} picks complete.`
          : "Run Refresh ESPN before draft day.",
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
  const price = appConfig.additionalLeaguePriceLabel || "$5/year";
  if (count < limit) return `${count}/${limit} included leagues`;
  if (count === limit) return `${limit}/${limit} included / + extra ${price}`;
  return `${count} leagues / extras ${price} each`;
}

function accountStatusText() {
  if (!requiresCustomerAccess()) return "Demo Mode: sample league only. No customer account is loaded.";
  if (hasCustomerAccess()) return "Signed in. Refresh will keep this dashboard unlocked on this device.";
  return "Signed out. Use your password or setup access code to unlock saved leagues.";
}

function accountFreshnessTime(value) {
  if (!value) return "Waiting";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recorded";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function accountFreshnessLabel(row) {
  const source = String(row?.source || "").toLowerCase();
  if (source.includes("fantasycalc")) return "Fantasy IQ Data";
  if (source === "live-boards") return "Player board";
  if (source === "daily-cron" || source === "fantasyiq-cron") return "Daily refresh";
  return "Data refresh";
}

function accountFreshnessDetail(row) {
  const warning = String(row?.warning || "").trim();
  if (warning) return warning;
  const source = String(row?.source || "").toLowerCase();
  const scope = String(row?.source_scope || "").toLowerCase();
  if (source.includes("fantasycalc") || scope.includes("fantasycalc")) return "Player values and trade signals";
  if (source === "live-boards") return "Player board and league scoring";
  if (source === "daily-cron" || source === "fantasyiq-cron") return "Scheduled production refresh";
  return "Latest successful update";
}

function accountFreshnessPriority(row) {
  const source = String(row?.source || "").toLowerCase();
  if (source.includes("fantasycalc")) return 1;
  if (source === "live-boards") return 2;
  if (source === "daily-cron" || source === "fantasyiq-cron") return 3;
  return 4;
}

function accountFreshnessDateValue(row) {
  const date = new Date(row?.last_success_at || row?.last_attempt_at || 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function accountFreshnessCards(rows) {
  const grouped = new Map();
  rows
    .filter((row) => row?.source)
    .forEach((row) => {
      const label = accountFreshnessLabel(row);
      const existing = grouped.get(label);
      if (!existing || accountFreshnessDateValue(row) > accountFreshnessDateValue(existing)) {
        grouped.set(label, { ...row, is_stale: Boolean(row.is_stale || existing?.is_stale) });
      } else if (existing && row.is_stale) {
        existing.is_stale = true;
      }
    });
  return Array.from(grouped.values())
    .sort((left, right) => accountFreshnessPriority(left) - accountFreshnessPriority(right))
    .slice(0, 4);
}

function skeletonCards(count = 3) {
  return Array.from(
    { length: count },
    () => `<article class="pending skeleton-card" aria-hidden="true">
      <span class="skeleton-line short"></span>
      <strong class="skeleton-line"></strong>
      <small class="skeleton-line long"></small>
    </article>`,
  ).join("");
}

function renderDataFreshnessPanel() {
  if (!dataFreshness) {
    return `<section class="account-progress" aria-label="Data freshness" aria-busy="true">${skeletonCards(3)}</section>`;
  }
  const rows = Array.isArray(dataFreshness.freshness) ? dataFreshness.freshness : [];
  if (!dataFreshness.ok) {
    return `<section class="account-progress" aria-label="Data freshness">
      <article class="pending"><span>Daily data</span><strong>Unavailable</strong></article>
      <article class="pending"><span>Status</span><strong>${htmlEscape(dataFreshness.error || "Retry later")}</strong></article>
    </section>`;
  }
  const important = accountFreshnessCards(rows);
  const cards = important.length
    ? important
        .map((row) => {
          const stale = Boolean(row.is_stale);
          return `<article class="${stale ? "pending" : "complete"}">
        <span>${htmlEscape(accountFreshnessLabel(row))}</span>
        <strong>${htmlEscape(stale ? "Needs retry" : accountFreshnessTime(row.last_success_at || row.last_attempt_at))}</strong>
        <small>${htmlEscape(accountFreshnessDetail(row))}</small>
      </article>`;
        })
        .join("")
    : `<article class="pending"><span>Daily data</span><strong>Ready after first cron</strong><small>${htmlEscape(dataFreshness.message || "Production cron will record status.")}</small></article>`;
  return `<section class="account-progress" aria-label="Data freshness">${cards}</section>`;
}

function leagueSetupUrl(league = null) {
  const setupUrl = new URL("../setup.html", window.location.href);
  if (appConfig.loadoutKey && appConfig.loadoutKey !== "default")
    setupUrl.searchParams.set("customer", appConfig.loadoutKey);
  if (league?.key) setupUrl.searchParams.set("league", league.key);
  return `${setupUrl.pathname}${setupUrl.search}`;
}

function renderAccountPanel() {
  if (!accountLeagueList) return;
  const options = currentLeagueOptions();
  const count = configuredLeagueCount(options);
  const limit = includedLeagueLimit();
  const active = activeLeagueOption();
  const price = appConfig.additionalLeaguePriceLabel || "$5/year";
  const support = appConfig.supportEmail || "support@myfantasyiq.com";

  if (accountDashboardName)
    accountDashboardName.textContent = appConfig.customerName || appConfig.loadoutKey || "MyFantasyIQ";
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
          const settings = mergeLeagueSettings(
            appConfig.baseLeagueSettings || DEFAULT_LEAGUE_SETTINGS,
            league.leagueSettings || {},
          );
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
          <strong>Validate your ESPN league</strong>
          <p>Your account is active. Add your public ESPN league ID and team ID once so FantasyIQ can personalize every tool.</p>
        </div>
        <div class="account-league-actions">
          <a href="${htmlEscape(leagueSetupUrl())}" data-open-setup>Open setup</a>
        </div>
      </article>`
      : `<article>
        <div>
          <span>Preview mode</span>
          <strong>Demo League</strong>
          <p>Subscribe to connect FantasyIQ to your own ESPN league profile.</p>
        </div>
      </article>`;
  accountLeagueList.innerHTML = `${statusSteps}${renderDataFreshnessPanel()}${leagueMarkup}`;

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
  const price = appConfig.additionalLeaguePriceLabel || "$5/year";
  if (requiresCustomerAccess() && count <= 0) return "Finish league setup";
  return count < limit ? "Add included league" : `Add extra league (${price})`;
}

async function openBillingPortal() {
  if (!hasCustomerAccess()) {
    showCustomerAccessGate("Sign in with your checkout email and password before managing billing.");
    return;
  }
  const originalText = accountManageBilling?.textContent || "Manage Billing";
  if (accountManageBilling) {
    accountManageBilling.disabled = true;
    accountManageBilling.textContent = "Opening...";
  }
  try {
    const response = await fetch("/api/customer-portal", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok || !payload.url) {
      throw new Error(payload.message || "Could not open billing portal.");
    }
    window.location.href = payload.url;
  } catch (error) {
    if (accountDashboardStatus) {
      accountDashboardStatus.textContent = error.message || "Could not open billing portal. Contact support.";
    }
    if (accountManageBilling) {
      accountManageBilling.disabled = false;
      accountManageBilling.textContent = originalText;
    }
  }
}

function currentLeagueDisplayLabel() {
  const active = activeLeagueOption();
  if (active) return active.label || active.leagueName || active.key;
  if (requiresCustomerAccess()) {
    if (appConfig.customerTeamName) return appConfig.customerTeamName;
    if (appConfig.leagueName && appConfig.leagueName !== "Public Demo League") return appConfig.leagueName;
    return "Finish league setup";
  }
  return appConfig.leagueName || "Demo League";
}

function applyLeagueOption(option) {
  if (!option) return;
  appConfig.leagueKey = option.key || appConfig.leagueKey || "";
  appConfig.leagueId = String(option.leagueId || option.espnLeagueId || "");
  appConfig.leagueName = option.leagueName || option.label || appConfig.leagueName;
  appConfig.customerTeamId = String(option.customerTeamId || option.teamId || option.team_id || "");
  appConfig.customerTeamName = option.customerTeamName || option.teamName || option.team_name || "";
  appConfig.leagueSettings = mergeLeagueSettings(
    appConfig.baseLeagueSettings || DEFAULT_LEAGUE_SETTINGS,
    option.leagueSettings || {},
  );
}

function inactiveSubscriptionStatus(customer = {}) {
  const status = String(customer.status || "")
    .trim()
    .toLowerCase();
  const subscriptionStatus = String(customer.subscriptionStatus || "")
    .trim()
    .toLowerCase();
  const blocked = new Set(["canceled", "cancelled", "expired", "suspended", "unpaid", "incomplete_expired"]);
  return blocked.has(status) || blocked.has(subscriptionStatus);
}

function applyCustomerDashboardChrome(customer = {}) {
  const slug = normalizeDashboardSlug(customer.customerSlug || appConfig.loadoutKey || "");
  if (!slug || slug === "default" || customer.demoMode === true) return false;
  const leagueName = customer.leagueName || appConfig.leagueName || currentLeagueDisplayLabel();
  const limit = Number(customer.includedLeagueLimit || appConfig.includedLeagueLimit || 3);
  const leagueOptions = normalizeLeagueProfiles(customer.leagues || appConfig.leagues || []);
  const count = configuredLeagueCount(leagueOptions) || configuredLeagueCount();
  const slotText = count ? `${Math.min(count, limit)}/${limit} included leagues` : `Up to ${limit} included leagues`;
  appConfig.isDemoPreview = false;
  appConfig.showSubscribeButton = false;
  appConfig.draftCardLabel = "Season Pass";
  appConfig.draftCardValue = inactiveSubscriptionStatus(customer) ? "Billing Review" : "Active";
  appConfig.draftCardNote = leagueName ? `${leagueName} / ${slotText}` : slotText;
  appConfig.demoLabel = "Customer Dashboard";
  appConfig.demoMessage = "Signed-in customer league loaded.";
  return true;
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
  if (customer.additionalLeagueCount !== undefined)
    appConfig.additionalLeagueCount = Number(customer.additionalLeagueCount || 0);
  if (customer.leagueSettings)
    appConfig.leagueSettings = mergeLeagueSettings(appConfig.leagueSettings, customer.leagueSettings);
  if (!serverLeagues.length && !customer.leagueId) {
    appConfig.leagueId = "";
    appConfig.leagueKey = "";
    appConfig.customerTeamId = "";
    appConfig.customerTeamName = "";
    if (appConfig.leagueName === "Public Demo League") appConfig.leagueName = "";
  }
  applyLeagueOption(activeLeagueOption());
  const chromeChanged = applyCustomerDashboardChrome(customer);
  if (chromeChanged) {
    applyAppConfig();
    updateAccountControl();
  }
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
  if (removeLeagueAction) {
    removeLeagueAction.hidden = count <= 0;
    removeLeagueAction.disabled = count <= 1;
    removeLeagueAction.title = count <= 1 ? "Keep at least one active league" : "Remove selected league";
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
    .map(
      (league) =>
        `<option value="${htmlEscape(league.key)}">${htmlEscape(league.label || league.leagueName || league.key)}</option>`,
    )
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
  if (
    appConfig.loadoutKey &&
    appConfig.loadoutKey !== "default" &&
    !params.get("customer") &&
    !params.get("loadout") &&
    !params.get("dashboard")
  ) {
    params.set("customer", appConfig.loadoutKey);
  }
  params.set("league", next.key);
  history.replaceState(null, "", `${window.location.pathname}?${params.toString()}${window.location.hash}`);
  liveDraft = null;
  lastLiveDraftRenderSignature = "";
  draftLeagueOverrideState = loadDraftLeagueOverride();
  manualDraftOverrides = loadManualDraftOverrides();
  boardData = null;
  clearSimAutoAdvance();
  mockSim = null;
  selectedBoardPlayerKey = null;
  if (myTeamSelect) myTeamSelect.value = appConfig.customerTeamId || "";
  if (boardStatus) boardStatus.textContent = "Switching league profile...";
  if (liveStatus) {
    const draftOverride = activeDraftLeagueOverride();
    liveStatus.textContent = draftOverride?.leagueId
      ? `Connecting to ESPN draft override ${draftOverride.leagueId} for this league profile...`
      : "Connecting to selected ESPN league...";
  }
  applyAppConfig();
  renderLeagueSwitcher();
  renderLeagueProfile();
  renderDraftLeagueOverrideControls();
  pingDraftCompanion();
  loadBoards();
  startLiveSync();
}

async function removeActiveLeague() {
  const active = activeLeagueOption();
  const count = configuredLeagueCount();
  if (!active || count <= 1) return;
  const label = active.label || active.leagueName || active.key;
  const confirmed = window.confirm(
    `Remove ${label} from this FantasyIQ account? This archives the league profile and switches you to another saved league.`,
  );
  if (!confirmed) return;
  if (!hasCustomerAccess()) {
    showCustomerAccessGate("Sign in before removing a league profile.");
    return;
  }
  if (removeLeagueAction) {
    removeLeagueAction.disabled = true;
    removeLeagueAction.textContent = "...";
  }
  try {
    const response = await fetch(apiUrl("/api/remove-league", { v: Date.now() }), {
      method: "POST",
      cache: "no-store",
      headers: apiHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ leagueKey: active.key }),
    });
    const payload = await jsonOrAccessError(response, "Could not remove league profile.");
    if (payload.customer) {
      applyServerCustomerContext(payload.customer);
    }
    const nextKey = payload.nextLeagueKey || activeLeagueOption()?.key || "";
    if (nextKey && nextKey !== appConfig.leagueKey) {
      setActiveLeague(nextKey);
    } else {
      renderLeagueSwitcher();
      loadBoards();
    }
  } catch (error) {
    window.alert(error.message || "Could not remove league profile.");
    renderLeagueSwitcher();
  } finally {
    if (removeLeagueAction) removeLeagueAction.textContent = "-";
  }
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
  const price = appConfig.additionalLeaguePriceLabel || "$5/year";
  const includedRemaining = Math.max(0, limit - count);
  const needsPayment = count >= limit;
  const needsInitialSetup = requiresCustomerAccess() && count <= 0;
  const title = dialog.querySelector("#add-league-title");
  const message = dialog.querySelector("#add-league-message");
  const summary = dialog.querySelector("#add-league-summary");
  const primary = dialog.querySelector("#add-league-primary");

  if (title)
    title.textContent = needsInitialSetup
      ? "Finish League Setup"
      : needsPayment
        ? "Add Extra League"
        : "Add Included League";
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
      <strong>${needsInitialSetup ? "Setup required before ESPN refresh" : needsPayment ? `Extra league add-on: ${htmlEscape(price)}` : "No extra payment needed yet"}</strong>
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
  "True ADP",
  "Player",
  "Pos",
  "Team",
  "Tier",
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

const udkColumns = [
  "UDK View",
  "Player",
  "Pos",
  "Team",
  "Rank",
  "UDK Rank",
  "UDK Delta",
  "UDK Tier",
  "UDK Signal",
  "Value Score",
  "Risk",
  "Action",
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
  [
    ...(liveDraft?.draftedNames || []),
    ...(liveDraft?.rosteredNames || []),
    ...manualDraftOverrides.map((pick) => pick.player),
  ].forEach((name) => {
    keys.add(normalizePlayerName(name));
    const row = findPlayer(name);
    if (row) keys.add(normalizePlayerName(row.Player));
  });
  return keys;
}

function manualDraftStorageKey() {
  const segment =
    normalizeDashboardSlug(appConfig.leagueKey || "") || numericText(appConfig.leagueId || "") || "default";
  return loadoutStorageKey(`manual-draft-overrides:${segment}`);
}

function legacyManualDraftStorageKey() {
  return loadoutStorageKey("manual-draft-overrides");
}

function loadManualDraftOverrides() {
  try {
    const storageKey = manualDraftStorageKey();
    const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (Array.isArray(saved) && saved.length) return saved.filter((pick) => pick?.player);
    const legacySaved = JSON.parse(localStorage.getItem(legacyManualDraftStorageKey()) || "[]");
    if (!Array.isArray(legacySaved) || !legacySaved.length) return [];
    if (currentLeagueOptions().length <= 1) {
      const cleaned = legacySaved.filter((pick) => pick?.player);
      localStorage.setItem(storageKey, JSON.stringify(cleaned.slice(-260)));
      localStorage.removeItem(legacyManualDraftStorageKey());
      return cleaned;
    }
    localStorage.removeItem(legacyManualDraftStorageKey());
    return [];
  } catch (error) {
    return [];
  }
}

function saveManualDraftOverrides() {
  try {
    localStorage.setItem(manualDraftStorageKey(), JSON.stringify(manualDraftOverrides.slice(-260)));
  } catch (error) {
    // Draft-day fallback should never block the dashboard.
  }
}

function liveDraftServerNameKeys(data = liveDraft) {
  const keys = new Set();
  [...(data?.draftedNames || []), ...(data?.rosteredNames || [])].forEach((name) => {
    if (name) keys.add(normalizePlayerName(name));
  });
  return keys;
}

function applyManualDraftOverrides(data = liveDraft) {
  if (!data || !manualDraftOverrides.length) return data;
  const picks = Array.isArray(data.picks) ? data.picks : [];
  const serverKeys = liveDraftServerNameKeys(data);
  manualDraftOverrides
    .filter((override) => override?.player && !serverKeys.has(normalizePlayerName(override.player)))
    .forEach((override) => {
      const alreadyApplied = picks.some(
        (pick) =>
          pick?.status === "drafted" && normalizePlayerName(pick.player) === normalizePlayerName(override.player),
      );
      if (alreadyApplied) return;
      const matchingPick = picks.find(
        (pick) => Number(pick.overall || 0) === Number(override.overall || 0) && pick.status !== "drafted",
      );
      const targetPick = matchingPick || picks.find((pick) => pick.status !== "drafted");
      if (!targetPick) return;
      targetPick.playerId = Number(override.playerId || -1);
      targetPick.player = override.player;
      targetPick.pos = override.pos || "";
      targetPick.proTeam = override.proTeam || "";
      targetPick.status = "drafted";
      targetPick.syncSource = "manual";
    });
  rebuildLiveDraftPickState(data);
  return data;
}

function manualOverrideForRow(row) {
  const nextPick = (liveDraft?.picks || []).find((pick) => pick.status !== "drafted") || {};
  return {
    player: row.Player,
    pos: row.Pos,
    proTeam: row.Team,
    playerId: Number(row.PlayerId || row.playerId || -1),
    overall: nextPick.overall || "",
    round: nextPick.round || "",
    roundPick: nextPick.roundPick || "",
    teamId: nextPick.teamId || "",
    fantasyTeam: nextPick.fantasyTeam || "",
    createdAt: Date.now(),
  };
}

function addManualDraftedRow(row) {
  if (!row) return false;
  const key = normalizePlayerName(row.Player);
  if (!key || liveDraftedKeys().has(key)) return false;
  manualDraftOverrides.push(manualOverrideForRow(row));
  return true;
}

function rebuildLiveDraftPickState(data = liveDraft) {
  if (!data) return;
  const picks = Array.isArray(data.picks) ? data.picks : [];
  const completed = picks.filter((pick) => pick.status === "drafted");
  const pending = picks.filter((pick) => pick.status !== "drafted");
  data.completedPicks = completed.length;
  data.currentPick = pending[0] || null;
  data.nextPicks = pending.slice(0, 12);
  data.recentPicks = completed.slice(-12).reverse();
  data.draftedNames = Array.from(new Set(completed.map((pick) => pick.player).filter(Boolean)));
  data.draftedPlayerIds = completed.map((pick) => Number(pick.playerId || -1)).filter((id) => id > 0);
  data.drafted = Boolean(picks.length && completed.length >= picks.length);
  data.inProgress = !data.drafted && (Boolean(data.inProgress) || completed.length > 0);
  if (manualDraftOverrides.length) {
    data.draftSyncMode = data.draftSyncMode === "rosterFallback" ? "rosterFallback" : "manualOverlay";
    const manualWarning = "Manual draft tracker is active for picks ESPN has not exposed yet.";
    data.fallbackStates = Array.from(new Set([...(data.fallbackStates || []), manualWarning]));
  }
}

function markManualDrafted(playerName) {
  const row = findPlayer(playerName);
  if (!addManualDraftedRow(row)) return;
  saveManualDraftOverrides();
  applyManualDraftOverrides();
  renderLiveDraft({ full: true });
  renderBoard();
}

function importDraftedPlayersFromText() {
  const raw = draftPasteInput?.value || "";
  if (!raw.trim()) {
    if (liveStatus) liveStatus.innerHTML = "<strong>Paste ESPN drafted-player text first.</strong>";
    draftPasteInput?.focus();
    return;
  }
  if (!boardData) {
    if (liveStatus)
      liveStatus.innerHTML = "<strong>Player board is still loading.</strong> Try again in a few seconds.";
    return;
  }
  const normalizedText = normalizePlayerName(raw);
  const matches = combinedBoardRows()
    .map((row) => ({ row, index: normalizedText.indexOf(normalizePlayerName(row.Player)) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index || Number(a.row.Rank || 999) - Number(b.row.Rank || 999));
  let imported = 0;
  matches.forEach(({ row }) => {
    if (addManualDraftedRow(row)) imported += 1;
  });
  saveManualDraftOverrides();
  applyManualDraftOverrides();
  renderLiveDraft({ full: true });
  renderBoard();
  if (liveStatus) {
    liveStatus.innerHTML = imported
      ? `<strong>Imported ${imported} drafted player${imported === 1 ? "" : "s"}.</strong> Recommendations and the pick grid are refreshed from the manual ESPN paste.`
      : "<strong>No new drafted players found.</strong> Paste only the ESPN draft board/recent-picks text, not the available-player list.";
  }
}

function clearManualDraftOverrides() {
  manualDraftOverrides = [];
  saveManualDraftOverrides();
  if (liveStatus)
    liveStatus.innerHTML = "<strong>Manual draft tracker cleared.</strong> Pulling a fresh ESPN refresh now.";
  loadLiveDraft(true);
}

function isDrafted(row) {
  if (!row || (!liveDraft && !manualDraftOverrides.length)) return false;
  return liveDraftedKeys().has(normalizePlayerName(row.Player));
}

function isTrendBoard() {
  return activeBoard === "trends";
}

function isUdkBoard() {
  return activeBoard === "udk";
}

function visibleBoardColumns() {
  const columns = isTrendBoard() ? [...trendColumns] : isUdkBoard() ? [...udkColumns] : [...boardColumns];
  if (positionFilter?.value && !columns.includes("Tier")) {
    const insertAt = isTrendBoard() ? 5 : 6;
    columns.splice(insertAt, 0, "Tier");
  }
  return columns;
}

function columnHeader(column) {
  if (column === "Rank" && !isTrendBoard() && !isUdkBoard()) return "ADP Rank";
  if (column === "True ADP") return "ESPN ADP";
  if (column === "Tier") return "Tier";
  if (column === "Proj PPR Pts") return scoringProjectionLabel();
  if (column === "Projection Edge") return "League Edge";
  if (column === "Last Year PPR") return lastYearScoringLabel();
  if (column === "Value Score") return "League Value";
  return column;
}

let precisionTierCacheKey = "";
let precisionTierCache = null;

function boardAdpValue(row) {
  const adp = Number(row?.["True ADP"] || row?.["ESPN ADP"] || row?.Rank || 9999);
  return Number.isFinite(adp) && adp > 0 ? adp : 9999;
}

function boardAdpCompare(a, b) {
  return (
    boardAdpValue(a) - boardAdpValue(b) ||
    Number(a?.Rank || 9999) - Number(b?.Rank || 9999) ||
    String(a?.Player || "").localeCompare(String(b?.Player || ""))
  );
}

function simplifiedPositionTier(pos, posRank) {
  const rank = Number(posRank || 999);
  if (pos === "QB") {
    if (rank <= 6) return "QB Elite";
    if (rank <= 12) return "QB Starter";
    if (rank <= 24) return "QB Bench";
    return "QB Deep";
  }
  if (pos === "RB") {
    if (rank <= 12) return "RB Elite";
    if (rank <= 24) return "RB Starter";
    if (rank <= 36) return "RB Flex";
    if (rank <= 50) return "RB Bench";
    return "RB Deep";
  }
  if (pos === "WR") {
    if (rank <= 12) return "WR Elite";
    if (rank <= 24) return "WR Starter";
    if (rank <= 36) return "WR Flex";
    if (rank <= 60) return "WR Bench";
    return "WR Deep";
  }
  if (pos === "TE") {
    if (rank <= 6) return "TE Elite";
    if (rank <= 12) return "TE Starter";
    if (rank <= 24) return "TE Bench";
    return "TE Deep";
  }
  if (pos === "DST") return "DST Stream";
  if (pos === "K") return "K Stream";
  return "Watch";
}

function assignPrecisionTiers(rows, mode, pos = "") {
  const sorted = rows
    .filter((row) => row && row.Player)
    .slice()
    .sort(boardAdpCompare);
  const map = new Map();

  sorted.forEach((row, index) => {
    const label = simplifiedPositionTier(row.Pos || pos, row["Pos Rank"] || index + 1);
    map.set(normalizePlayerName(row.Player), {
      label,
      tier: Math.ceil((index + 1) / 12),
      range: `${index + 1}`,
      score: boardAdpValue(row),
    });
  });
  return map;
}

function precisionTierMaps() {
  const rows = boardData?.boards?.combined?.rows || [];
  const settings = activeLeagueSettings();
  const cacheKey = [
    boardData?.syncedAt || boardData?.updated || "",
    rows.length,
    settings.scoringType,
    settings.teamCount,
    JSON.stringify(settings.lineupSlots || {}),
  ].join("|");
  if (precisionTierCache && precisionTierCacheKey === cacheKey) return precisionTierCache;
  const overall = assignPrecisionTiers(rows, "overall");
  const positions = {};
  ["QB", "RB", "WR", "TE", "DST", "K"].forEach((pos) => {
    positions[pos] = assignPrecisionTiers(
      rows.filter((row) => row.Pos === pos),
      "position",
      pos,
    );
  });
  precisionTierCacheKey = cacheKey;
  precisionTierCache = { overall, positions };
  return precisionTierCache;
}

function preciseTierInfo(row) {
  if (!row) return null;
  const key = normalizePlayerName(row.Player);
  const maps = precisionTierMaps();
  const overall = maps.overall.get(key);
  const position = maps.positions[row.Pos]?.get(key);
  const fallback = simplifiedPositionTier(row.Pos, row["Pos Rank"]);
  return {
    overall,
    position,
    display: position?.label || overall?.label || fallback || row["Pos Tier"] || row.Category || "Tier",
  };
}

function preciseTierDisplay(row, pos = "") {
  const info = preciseTierInfo(row);
  if (!info) return row?.["Pos Tier"] || row?.Category || "Tier";
  if (pos && pos !== "FLEX" && pos !== "SUPERFLEX") return info.position?.label || info.display;
  if (pos === "FLEX" && row?.Pos) return info.position?.label || info.display;
  return info.display;
}

function fallbackSleeperRows() {
  const rows = boardData?.boards?.combined?.rows || [];
  return rows
    .filter((row) => {
      const rank = Number(row.Rank || 999);
      const value = Number(row["Value Score"] || 0);
      const sleeperActivity = Number(row["Sleeper Add Count"] || 0) + Number(row["Sleeper Drop Count"] || 0);
      const sleeperNet = Number(row["Sleeper Net Adds"] || 0);
      const trendScore = Number(row["External Trend Score"] || 0);
      return (
        row.Pos !== "K" &&
        row.Pos !== "DST" &&
        (row.Category === "Sleeper" ||
          (value >= 52 && rank > 55) ||
          (rank > 45 && sleeperActivity > 0 && sleeperNet >= 0) ||
          (rank > 80 && trendScore >= 4))
      );
    })
    .sort((a, b) => {
      const categoryDelta = (a.Category === "Sleeper" ? 0 : 1) - (b.Category === "Sleeper" ? 0 : 1);
      if (categoryDelta) return categoryDelta;
      return (
        Number(b["External Trend Score"] || 0) - Number(a["External Trend Score"] || 0) ||
        leagueValueScore(b) - leagueValueScore(a) ||
        Number(a.Rank || 999) - Number(b.Rank || 999)
      );
    })
    .slice(0, 45);
}

function activeBoardPayload() {
  const board = boardData?.boards?.[activeBoard] || boardData?.boards?.combined || { rows: [] };
  if (activeBoard === "sleepers" && !(board.rows || []).length) {
    return { ...board, title: board.title || "Live Sleeper Board", rows: fallbackSleeperRows() };
  }
  return board;
}

function setActive(items, activeItem) {
  items.forEach((item) => item.classList.toggle("active", item === activeItem));
}

function dashboardUrlWithHash(hash = "") {
  return `${window.location.pathname}${window.location.search}${hash}`;
}

function dashboardHomeUrl() {
  const currentParams = new URLSearchParams(window.location.search);
  const params = new URLSearchParams();
  const customerSlug =
    appConfig.loadoutKey && appConfig.loadoutKey !== "default"
      ? appConfig.loadoutKey
      : normalizeDashboardSlug(
          currentParams.get("customer") || currentParams.get("loadout") || currentParams.get("dashboard") || "",
        );
  const leagueSlug =
    appConfig.leagueKey || normalizeDashboardSlug(currentParams.get("league") || currentParams.get("leagueKey") || "");
  if (customerSlug) {
    params.set("customer", customerSlug);
  }
  if (leagueSlug) {
    params.set("league", leagueSlug);
  }
  const query = params.toString();
  return `${window.location.pathname}${query ? `?${query}` : ""}`;
}

function shouldUseCustomerDashboardHome() {
  return requiresCustomerAccess() && (hasCustomerAccess() || rememberedPasswordSession());
}

function updateBrandHomeLink() {
  if (!brandHomeLink) return;
  const useDashboardHome = shouldUseCustomerDashboardHome();
  brandHomeLink.href = useDashboardHome ? dashboardHomeUrl() : "/";
  brandHomeLink.setAttribute(
    "aria-label",
    useDashboardHome ? "Go to your FantasyIQ dashboard home" : "Go to MyFantasyIQ home",
  );
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
  if (changed)
    history.replaceState(null, "", `${window.location.pathname}?${params.toString()}${window.location.hash}`);
  updateBrandHomeLink();
}

function scrollDashboardTop(behavior = "auto") {
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const requestedBehavior = reducedMotion ? "auto" : behavior;
  const snapTop = () => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  };
  if (requestedBehavior === "smooth") {
    window.scrollTo({ top: 0, left: 0, behavior: requestedBehavior });
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
    if (button.classList.contains("active") && document.querySelector(`#${section}.panel.active`)) return;
    history.replaceState(null, "", dashboardUrlWithHash(`#${section}`));
    setActive(navItems, button);
    panels.forEach((panel) => panel.classList.toggle("active", panel.id === section));
    if (typeof renderBoardDependentSection === "function") {
      renderBoardDependentSection(section, { userActivated: true });
    }
    scrollDashboardTop("smooth");
  });
});

if (brandHomeLink) {
  brandHomeLink.addEventListener("click", (event) => {
    updateBrandHomeLink();
    if (!shouldUseCustomerDashboardHome()) return;
    event.preventDefault();
    ensureCustomerUrlContext();
    const commandButton = Array.from(navItems).find((button) => button.dataset.section === "command");
    if (commandButton) setActive(navItems, commandButton);
    panels.forEach((panel) => panel.classList.toggle("active", panel.id === "command"));
    if (typeof renderBoardDependentSection === "function") {
      renderBoardDependentSection("command", { userActivated: true });
    }
    history.replaceState(null, "", dashboardHomeUrl());
    scrollDashboardTop("smooth");
  });
}

function activateSection(section) {
  if (section === "mock") section = "simulator";
  if (section === "cheatcode") section = "live";
  const targetButton = Array.from(navItems).find((button) => button.dataset.section === section);
  if (!targetButton) return;
  history.replaceState(null, "", dashboardUrlWithHash(`#${section}`));
  setActive(navItems, targetButton);
  panels.forEach((panel) => panel.classList.toggle("active", panel.id === section));
  if (typeof renderBoardDependentSection === "function") {
    renderBoardDependentSection(section, { userActivated: true });
  }
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
  if (key === "Tier") return preciseTierDisplay(row, positionFilter?.value || "");
  if (key === "Proj PPR Pts") return projectionDisplay(row);
  if (key === "Projection Edge") return projectionEdgeDisplay(row);
  if (key === "True ADP") return row[key] ? Number(row[key]).toFixed(1) : "N/A";
  if (key === "Value Score") return valueDisplay(row);
  if (key === "Sleeper Net Adds") return formatMarketCount(row[key]);
  if (key === "Market Signal") return compactText(row[key], 90);
  if (key === "UDK Delta") return udkDeltaDisplay(row);
  if (key === "UDK Signal") return compactText(row[key], 96);
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
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
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
  if (lower.includes("anchor"))
    return "Draft him at this tier if the position fits your build. Do not reach far above the tier.";
  if (lower.includes("discount")) return "Only draft him if he falls below the usual price.";
  if (lower.includes("wait")) return "Wait for the room to discount him before clicking.";
  if (lower.includes("golden-zone"))
    return "He has upside, but make sure your roster already has enough safe starters.";
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
  const fit = row
    ? `${row.Pos} in ${row["Pos Tier"] || row.Category || "current tier"} with league value ${valueDisplay(row)}.`
    : "No player fit available yet.";
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
  if (adpValue <= 48)
    return { label: "Needs discount", detail: `ADP value score ${adpValue}/100.`, className: "danger" };
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
  if (risk >= 7)
    return {
      label: `High risk ${risk}/10`,
      detail: `Upside ${upside || "TBD"} but fragile profile.`,
      className: "danger",
    };
  if (risk >= 5)
    return {
      label: `Volatile ${risk}/10`,
      detail: `Pair with stable picks. Floor ${floor || "TBD"}.`,
      className: "watch",
    };
  return {
    label: `Stable ${risk || "low"}/10`,
    detail: `Floor ${floor || "TBD"} / upside ${upside || "TBD"}.`,
    className: "good",
  };
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
  const board = activeBoardPayload();
  const rows = (board.rows || []).filter((row) => {
    const matchesPosition = !pos || (pos === "FLEX" ? ["RB", "WR", "TE"].includes(row.Pos) : row.Pos === pos);
    const searchable =
      `${row.Player} ${row.Pos} ${row.Team} ${row.Category} ${row.Tier} ${row["Pos Tier"]} ${row.Action} ${row.Analysis} ${row["Projection Edge"]} ${row["Daily Synopsis"]} ${row["Player Outlook"]} ${row["Risk Notes"]} ${row.Trend} ${row["Source Signal"]} ${row["External Signal"]} ${row.Catalyst} ${row["Why Rising/Falling"]} ${row["Draft Action"]} ${row["UDK Alignment"]} ${row["UDK Signal"]} ${row["UDK Tier"]}`.toLowerCase();
    const matchesDraftStatus = !hideDraftedEnabled() || !drafted.has(normalizePlayerName(row.Player));
    return matchesPosition && matchesDraftStatus && (!query || searchable.includes(query));
  });

  if (isTrendBoard() || isUdkBoard()) return rows;
  return rows.sort(boardAdpCompare);
}

function renderBoard() {
  if (!boardData || !boardTable) return;
  syncUdkTabVisibility();
  if (boardCount) {
    const total = boardData.boards?.combined?.rows?.length || 0;
    boardCount.textContent = `${total} players`;
  }
  const rows = filteredRows();
  if (boardStatus) {
    const title = activeBoardPayload()?.title || "Board";
    const updated = boardData.live
      ? ` ${boardData.source || "Board"} refreshed ${formatSyncTime(boardData.syncedAt)}.`
      : boardData.updated
        ? ` Updated ${boardData.updated}.`
        : "";
    const rosteredCount = Number(liveDraft?.rosteredNames?.length || 0);
    const drafted = liveDraft?.completedPicks
      ? ` ESPN public draft data has ${liveDraft.completedPicks} drafted players.`
      : rosteredCount
        ? ` ESPN roster data is filtering ${rosteredCount} rostered players.`
        : "";
    const tierHint = positionFilter?.value ? " Tier dividers are grouped by simplified position tiers." : "";
    boardStatus.innerHTML = `<strong>${title}</strong>: showing ${rows.length} players in ESPN ADP order. Click any player name for analysis.${tierHint}${updated}${drafted}`;
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
      const divider =
        showTierDividers && currentTier !== previousTier
          ? `<tr class="board-tier-divider-row"><td colspan="${columns.length}">${renderTierDivider(currentTier, boardTierCounts[currentTier])}</td></tr>`
          : "";
      if (currentTier) previousTier = currentTier;
      const color = /^[0-9a-f]{3,6}$/i.test(String(boardData.positionColors[row.Pos] || ""))
        ? boardData.positionColors[row.Pos]
        : "6ee3a3";
      const tierClass = positionFilter?.value ? `tier-${row["Tier Sort"] || 99}` : "";
      const draftedClass = isDrafted(row) ? "drafted-row" : "";
      const selectedClass = selectedBoardPlayerKey === normalizePlayerName(row.Player) ? "selected-row" : "";
      const draftedBadge = draftedClass ? `<span class="drafted-badge">Drafted</span>` : "";
      return `${divider}<tr class="${tierClass} ${draftedClass} ${selectedClass}" style="--board-position-color:#${color}" data-pos="${htmlEscape(row.Pos || "")}" data-index="${index}">
        ${columns
          .map((column) => {
            if (column === "Player") {
              return `<td><button class="player-link" data-index="${index}">${htmlEscape(row.Player)}</button>${draftedBadge}</td>`;
            }
            if (column === "Rank" && !isTrendBoard() && !isUdkBoard()) {
              return `<td class="number">${row.Rank || index + 1}</td>`;
            }
            if (column === "Tier") {
              return `<td><span class="tier-pill precise-tier-pill">${htmlEscape(cellValue(row, column))}</span></td>`;
            }
            if (column === "Last Year PPR") {
              return `<td class="number">${lastYearValue(row)}</td>`;
            }
            const numberClass = typeof row[column] === "number" ? ' class="number"' : "";
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
      tbody.querySelectorAll("tr.selected-row").forEach((item) => item.classList.remove("selected-row"));
      button.closest("tr")?.classList.add("selected-row");
    });
  });

  const selectedRow = rows.find((row) => normalizePlayerName(row.Player) === selectedBoardPlayerKey);
  if (selectedRow || rows[0]) {
    showAnalysis(selectedRow || rows[0]);
  } else {
    analysisPane.innerHTML = `<p class="eyebrow">Player Analysis</p><h3>No results</h3><p>Try clearing the search or position filter.</p>`;
  }
}

function syncUdkTabVisibility() {
  const udkTab = document.querySelector('.workbook-tabs .tab[data-board="udk"]');
  if (!udkTab || !boardData) return;
  const available = Boolean(boardData.externalSignals?.udk?.available || boardData.boards?.udk?.rows?.length);
  udkTab.hidden = !available;
  if (!available && activeBoard === "udk") {
    activeBoard = "combined";
    const combinedTab = document.querySelector('.workbook-tabs .tab[data-board="combined"]');
    document.querySelectorAll(".workbook-tabs .tab").forEach((tab) => {
      tab.classList.toggle("active", tab === combinedTab);
    });
  }
}

let playerIndexCacheData = null;
let playerIndexCache = null;

function playerIndex() {
  if (playerIndexCacheData === boardData && playerIndexCache) return playerIndexCache;
  const rows = boardData?.boards?.combined?.rows || [];
  const index = new Map();
  rows.forEach((row) => index.set(normalizePlayerName(row.Player), row));
  playerIndexCacheData = boardData;
  playerIndexCache = index;
  return index;
}

function findPlayer(name) {
  const clean = normalizePlayerName(name);
  if (!clean || !boardData) return null;
  const index = playerIndex();
  if (index.has(clean)) return index.get(clean);
  const dstClean = clean.replace(/dst$/, "");
  return (boardData.boards.combined.rows || []).find((row) => {
    const rowName = normalizePlayerName(row.Player);
    if (row.Pos === "DST") {
      const dstRowName = rowName.replace(/dst$/, "");
      if (dstRowName.includes(dstClean) || dstClean.includes(dstRowName)) return true;
    }
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
    ...Array.from(tradeGiveSlots || []).map((input) => ({ input, mode: "single" })),
    ...Array.from(tradeGetSlots || []).map((input) => ({ input, mode: "single" })),
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
  const udk = udkAlignmentSignal(row);
  const udkChip = hasUdkSignal(row)
    ? `<div class="analysis-chip ${udk.className}"><span>UDK View</span><strong>${htmlEscape(udk.label)}</strong></div>`
    : "";
  analysisPane.innerHTML = `
    <p class="eyebrow">${row.Pos} / ${row.Team} / Bye ${row.Bye}</p>
    <h3>${row.Player}</h3>
    <div class="analysis-grid">
      <div class="analysis-chip"><span>Rank</span><strong>${row.Rank}</strong></div>
      <div class="analysis-chip"><span>Precise Tier</span><strong>${htmlEscape(preciseTierDisplay(row))}</strong></div>
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
      ${udkChip}
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
    ${hasUdkSignal(row) ? `<p><strong>UDK+ second opinion:</strong> ${htmlEscape(udk.detail)}</p>` : ""}
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
      <div class="analysis-chip"><span>Precise Tier</span><strong>${htmlEscape(preciseTierDisplay(row))}</strong></div>
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
  const udk = udkAlignmentSignal(row);
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
        ${hasUdkSignal(row) ? playerDrawerStat("UDK View", udk.label, udk.detail) : ""}
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
        <button class="secondary-action" type="button" data-manual-draft-player="${htmlEscape(row.Player)}">Mark Drafted</button>
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
  const manualDraftButton = event.target.closest("[data-manual-draft-player]");
  if (manualDraftButton) {
    event.preventDefault();
    markManualDrafted(manualDraftButton.dataset.manualDraftPlayer);
    closePlayerDrawer();
    return;
  }
  const clearManualButton = event.target.closest("[data-clear-manual-draft]");
  if (clearManualButton) {
    event.preventDefault();
    clearManualDraftOverrides();
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
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function tradeSideValue(text) {
  return parseLines(text).map((name) => {
    const foundRow = findPlayer(name);
    const market = foundRow ? fantasyCalcPlayer(foundRow) : fantasyCalcPlayerByName(name);
    const row = foundRow || fantasyCalcMarketOnlyRow(market);
    return {
      name,
      row,
      value: row ? tradeAssetValue(row) : 0,
      fantasyIqValue: row ? leagueValueScore(row) : 0,
      marketValue: market ? Number(market.marketScore || 0) : null,
      rawMarketValue: market ? Number(market.value || 0) : null,
      marketRank: market?.overallRank || null,
      marketTrend: market?.trend30Day ?? null,
      marketVolatility: market?.volatility ?? null,
      risk: row ? Number(row.Risk || 0) : 0,
      projection: row ? projectionValue(row) : 0,
    };
  });
}
