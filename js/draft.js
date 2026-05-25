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

function consensusProjectionScore(row) {
  const projection = Number(projectionValue(row) || row?.["Proj PPR Pts"] || 0);
  if (!projection) return 55;
  const peers = (boardData?.boards?.combined?.rows || [])
    .filter((peer) => peer?.Pos === row?.Pos)
    .map((peer) => Number(projectionValue(peer) || peer?.["Proj PPR Pts"] || 0))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => b - a);
  if (peers.length < 2) return clampNumber(projection / 3.4, 45, 92);
  const betterCount = peers.filter((value) => value > projection).length;
  const percentile = 1 - betterCount / Math.max(1, peers.length - 1);
  return clampNumber(45 + percentile * 50, 45, 95);
}

function consensusPlayerScore(row) {
  if (!row) return 0;
  const boardValue = Number(row["Value Score"] || 0);
  const leagueValue = Number(leagueValueScore(row) || boardValue || 0);
  const rank = Number(row.Rank || 999);
  const posRank = Number(row["Pos Rank"] || 99);
  const rankScore = rank < 999 ? clampNumber(100 - (rank - 1) * 0.55, 22, 98) : leagueValue || 55;
  const posMultiplier = row.Pos === "QB" || row.Pos === "TE" ? 2.2 : row.Pos === "DST" || row.Pos === "K" ? 4 : 1.45;
  const posRankScore = posRank < 99 ? clampNumber(101 - posRank * posMultiplier, 25, 96) : leagueValue || 55;
  const projectionScore = consensusProjectionScore(row);
  const stability = Number(row.Stability || row.Floor || 55);
  const market = Number(fantasyCalcMarketScore(row));
  const riskPenalty = clampNumber((Number(row.Risk || 4.5) - 5) * 1.2, -2, 4);
  let score =
    (boardValue || leagueValue) * 0.46 +
    leagueValue * 0.2 +
    rankScore * 0.14 +
    posRankScore * 0.08 +
    projectionScore * 0.08 +
    stability * 0.04 -
    riskPenalty;
  if (Number.isFinite(market) && market > 0) {
    score = score * 0.86 + market * 0.14;
  }
  return Math.round(clampNumber(score, 28, 99) * 10) / 10;
}

function averageConsensusScore(rows) {
  return rows.length ? rows.reduce((sum, row) => sum + consensusPlayerScore(row), 0) / rows.length : 0;
}

function consensusRosterBreakdown(snapshot) {
  const rows = snapshot.rows || [];
  const slots = activeLineupSlots();
  const starterLimit = Math.max(
    1,
    starterSlotTotal() - Number(slots.DST || 0) - Number(slots.K || 0),
  );
  const fantasyRows = rows
    .filter((row) => !["DST", "K"].includes(row.Pos))
    .sort((a, b) => consensusPlayerScore(b) - consensusPlayerScore(a));
  const starterRows = fantasyRows.slice(0, Math.min(starterLimit, fantasyRows.length));
  const depthRows = fantasyRows.slice(starterRows.length);
  const starterAvg = averageConsensusScore(starterRows) || averageConsensusScore(fantasyRows);
  const depthAvg = averageConsensusScore(depthRows);
  const rosterAvg = averageConsensusScore(fantasyRows.length ? fantasyRows : rows);
  const coverage = Math.min(1, starterRows.length / starterLimit);
  return { starterAvg, depthAvg, rosterAvg, coverage, starterLimit, starterRows, depthRows };
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
  const consensus = consensusRosterBreakdown(snapshot);
  const avgValue = consensus.rosterAvg || averageConsensusScore(rows);
  const avgRisk = rows.reduce((sum, row) => sum + Number(row.Risk || 0), 0) / rows.length;
  const rbWr = Number(snapshot.counts.RB || 0) + Number(snapshot.counts.WR || 0);
  const weaknesses = rosterWeaknesses(snapshot);
  const starterGaps = weaknesses.reduce((sum, item) => sum + item.starterGap, 0);
  const depthGaps = weaknesses.reduce((sum, item) => sum + item.depthGap, 0);
  let score =
    66 +
    (consensus.starterAvg - 58) * 0.44 +
    (consensus.depthAvg ? (consensus.depthAvg - 52) * 0.12 : 0) +
    (avgValue - 55) * 0.08 +
    consensus.coverage * 5;

  if (snapshot.picks.length) {
    const pickGrades = snapshot.picks.map((pick) => valueForPick(pick).label);
    score += pickGrades.filter((label) => label === "Steal").length * 1.5;
    score += pickGrades.filter((label) => label === "Good value").length;
    score -= pickGrades.filter((label) => label === "Reach").length * 2;
  }
  score -= starterGaps * 2.25;
  score -= Math.max(0, depthGaps - starterGaps) * 0.45;
  if (rbWr >= Math.max(5, starterTargetCounts().RB + starterTargetCounts().WR + flexStarterTarget())) score += 2;
  if (avgRisk > 5.8) score -= 1.5;
  if (avgRisk < 3.2 && rows.length >= 7) score += 1;
  if (activeLineupSlots().SUPERFLEX && Number(snapshot.counts.QB || 0) < 2) score -= 3;
  score = Math.round(clampNumber(score, 58, 98));
  const notes = [
    `Consensus score ${avgValue.toFixed(1)} using board value, projections, rank, and market support.`,
    weaknesses.length
      ? `Main need: ${weaknesses.slice(0, 2).map((item) => item.pos).join(" / ")}.`
      : "Starter and bench targets are mostly covered.",
    `${consensus.starterRows.length}/${consensus.starterLimit} consensus-weighted starter slots matched.`,
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

function waiverPoolIsReliable() {
  return liveLeagueHasRosters() || Boolean(liveDraft?.draftedNames?.length) || Boolean(liveDraft?.rosteredNames?.length);
}

function waiverPoolSourceLabel() {
  if (liveLeagueHasRosters()) return "Filtered against active ESPN rosters.";
  if (liveDraft?.draftedNames?.length) return "Filtered against the synced draft board.";
  if (liveDraft?.rosteredNames?.length) return "Filtered against synced league rosters.";
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
    .filter((row) => waiverPoolIsReliable() || Number(row.Rank || 999) > 90 || row.Category === "Sleeper")
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
      if (!fantasyCalcTradeDatabasePlayer(give) || !fantasyCalcTradeDatabasePlayer(get)) return;
      const diff = tradeAssetValue(get) - tradeAssetValue(give);
      const marketGive = fantasyCalcMarketScore(give);
      const marketGet = fantasyCalcMarketScore(get);
      if (!Number.isFinite(Number(marketGive)) || !Number.isFinite(Number(marketGet))) return;
      const marketDiff = Number(marketGet) - Number(marketGive);
      const projectionDiff = projectionValue(get) - projectionValue(give);
      if (!tradePackageMakesSense([1, 1], diff, marketDiff, tradeAssetValue(get) - tradeAssetValue(give), projectionDiff, { weight: 8 })) return;
      const evidence = tradePackageEvidence([give], [get]);
      if (!fantasyCalcTradeDatabaseReady()) return;
      const score =
        58 -
        Math.abs(diff) * 1.15 -
        Math.max(0, marketDiff) * 1.1 +
        Math.min(5, Math.max(0, marketDiff + 2)) +
        Math.min(5, tradePackageMarketActivity([give]) / 400) +
        Math.min(5, tradePackageMarketActivity([get]) / 400) +
        evidence.score +
        tradeMarketEdgeScore([1, 1], marketDiff, diff) +
        Math.max(-4, Math.min(4, projectionDiff / 18));
      if (!best || score > best.score) {
        best = {
          give,
          get,
          diff,
          marketDiff,
          score,
          databaseSampleCount: evidence.exactCount,
          databaseEvidence: evidence.tier,
          databaseActivity: evidence.activity,
        };
      }
    });
  });
  return best;
}

function uniqueTradeRows(rows) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = normalizePlayerName(row?.Player || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function tradePackageCombinations(rows, count, limit = 10) {
  const pool = uniqueTradeRows(rows)
    .sort((a, b) => tradeAssetValue(b) - tradeAssetValue(a))
    .slice(0, 8);
  if (count <= 1) return pool.map((row) => [row]).slice(0, limit);
  const combos = [];
  for (let left = 0; left < pool.length; left += 1) {
    for (let right = left + 1; right < pool.length; right += 1) {
      combos.push([pool[left], pool[right]]);
    }
  }
  return combos
    .sort((a, b) => tradePackageValue(b) - tradePackageValue(a))
    .slice(0, limit);
}

function tradePackageValue(rows) {
  return rows.reduce((sum, row) => sum + tradeAssetValue(row), 0);
}

function tradePackageMarketValue(rows) {
  const values = rows.map((row) => fantasyCalcMarketScore(row));
  return values.every((value) => Number.isFinite(Number(value)))
    ? values.reduce((sum, value) => sum + Number(value), 0)
    : null;
}

function tradePackageHasDatabaseCoverage(rows) {
  return rows.every((row) => fantasyCalcPlayer(row) && fantasyCalcTradeDatabasePlayer(row));
}

function tradePackageProjection(rows) {
  return rows.reduce((sum, row) => sum + projectionValue(row), 0);
}

function tradePackageBestValue(rows) {
  return rows.reduce((best, row) => Math.max(best, tradeAssetValue(row)), 0);
}

function tradePackageKey(rows) {
  return rows.map((row) => normalizePlayerName(row.Player)).sort().join("+");
}

function tradePackageMarketActivity(rows) {
  return rows.reduce((sum, row) => sum + Number(fantasyCalcTradeDatabasePlayer(row)?.activity || 0), 0);
}

function tradePackageDatabaseIds(rows) {
  return rows
    .map((row) => fantasyCalcPlayerId(row))
    .filter(Boolean)
    .sort();
}

function tradePackageDatabaseKey(rows) {
  const ids = tradePackageDatabaseIds(rows);
  return ids.length === rows.length ? ids.join("+") : "";
}

function tradeDatabaseSampleKey(giveRows, getRows = []) {
  const giveKey = tradePackageDatabaseKey(giveRows);
  const getKey = tradePackageDatabaseKey(getRows);
  return giveKey && (!getRows.length || getKey) ? `${giveKey}=>${getKey || "*"}` : "";
}

function tradeDatabaseSamplesRequestUrl(giveRows, getRows = []) {
  const giveIds = tradePackageDatabaseIds(giveRows);
  const getIds = tradePackageDatabaseIds(getRows);
  const settings = activeLeagueSettings();
  const slots = settings.lineupSlots || {};
  const ppr = settings.scoringType === "standard" ? 0 : settings.scoringType === "half-ppr" ? 0.5 : Number(settings.receptionPoints ?? 1);
  const totalPlayers = giveRows.length + getRows.length;
  const params = {
    v: Date.now(),
    isDynasty: settings.leagueType === "dynasty" || settings.isDynasty ? "true" : "false",
    numQbs: Number(slots.SUPERFLEX || 0) > 0 ? 2 : 1,
    numTeams: settings.teamCount || 12,
    ppr,
    minPlayers: Math.max(2, totalPlayers),
    maxPlayers: Math.max(2, totalPlayers),
  };
  const url = new URL(apiUrl("/api/fantasycalc-trades", params), window.location.origin);
  giveIds.forEach((id) => url.searchParams.append("side1", id));
  getIds.forEach((id) => url.searchParams.append("side2", id));
  return `${url.pathname}${url.search}`;
}

function requestTradeDatabaseSamples(giveRows, getRows = []) {
  const key = tradeDatabaseSampleKey(giveRows, getRows);
  if (!key || fantasyCalcTradeSamples.bySideKey.has(key) || fantasyCalcTradeSamples.loadingKeys.has(key)) return;
  if (fantasyCalcTradeSamples.loadingKeys.size >= 36) return;
  fantasyCalcTradeSamples.loadingKeys.add(key);
  fetch(tradeDatabaseSamplesRequestUrl(giveRows, getRows), { cache: "no-store", headers: apiHeaders() })
    .then((response) => {
      if (!response.ok) throw new Error(`Trade sample lookup returned HTTP ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      fantasyCalcTradeSamples.bySideKey.set(key, Array.isArray(payload?.trades) ? payload.trades : []);
    })
    .catch((error) => {
      fantasyCalcTradeSamples.bySideKey.set(key, []);
      console.warn("FantasyCalc trade sample lookup failed.", error);
    })
    .finally(() => {
      fantasyCalcTradeSamples.loadingKeys.delete(key);
      renderRosterEngines();
      loadIntelligence(false);
    });
}

function queueTradeDatabaseSamplesForSnapshot(snapshot) {
  if (!snapshot?.rows?.length || !liveLeagueHasRosters() || !fantasyCalcTradeDatabaseReady()) return;
  const rows = uniqueTradeRows(tradeStrengthProfiles(snapshot).flatMap((strength) => strength.rows))
    .filter((row) => fantasyCalcPlayer(row) && fantasyCalcTradeDatabasePlayer(row))
    .sort((a, b) => tradeAssetValue(b) - tradeAssetValue(a))
    .slice(0, 6);
  tradePackageCombinations(rows, 1, 5).forEach((givePackage) => requestTradeDatabaseSamples(givePackage));
  tradePackageCombinations(rows, 2, 6).forEach((givePackage) => requestTradeDatabaseSamples(givePackage));
}

function tradeSideAssetKeys(side) {
  const ids = new Set();
  const names = new Set();
  (Array.isArray(side) ? side : []).forEach((asset) => {
    if (typeof asset === "string" || typeof asset === "number") {
      const value = String(asset || "").trim();
      if (value) ids.add(value);
      return;
    }
    const player = asset?.player || asset?.Player || asset || {};
    const id = String(player.id || player.playerId || asset?.id || asset?.playerId || "").trim();
    const espnId = String(player.espnId || asset?.espnId || "").trim();
    const name = normalizePlayerName(player.name || player.fullName || asset?.name || asset?.playerName || "");
    if (id) ids.add(id);
    if (espnId) ids.add(`espn:${espnId}`);
    if (name) names.add(name);
  });
  return { ids, names };
}

function tradeSideContainsRows(side, rows) {
  const keys = tradeSideAssetKeys(side);
  return rows.every((row) => {
    const id = fantasyCalcPlayerId(row);
    const espnId = row.PlayerId || row.EspnId || row.ESPNID || fantasyCalcPlayer(row)?.espnId || "";
    const name = normalizePlayerName(row.Player || "");
    return (id && keys.ids.has(id)) || (espnId && keys.ids.has(`espn:${espnId}`)) || (name && keys.names.has(name));
  });
}

function tradeDatabaseExactSupport(givePackage, getPackage) {
  const key = tradeDatabaseSampleKey(givePackage, getPackage);
  if (!key || !fantasyCalcTradeSamples.bySideKey.has(key)) return { ready: false, count: 0 };
  const trades = fantasyCalcTradeSamples.bySideKey.get(key) || [];
  const count = trades.filter((trade) => {
    const side1 = Array.isArray(trade.side1) ? trade.side1 : [];
    const side2 = Array.isArray(trade.side2) ? trade.side2 : [];
    return (
      side1.length === givePackage.length &&
      side2.length === getPackage.length &&
      tradeSideContainsRows(side1, givePackage) &&
      tradeSideContainsRows(side2, getPackage)
    );
  }).length;
  return { ready: true, count };
}

function tradePackageNeed(needs, rows) {
  const positions = new Set(rows.map((row) => row.Pos));
  return needs
    .filter((need) => positions.has(need.pos))
    .sort((a, b) => Number(b.weight || 0) - Number(a.weight || 0))[0] || null;
}

function tradePackageName(rows) {
  return rows.map((row) => row.Player).join(" + ");
}

function tradeShapeLabel(giveCount, getCount) {
  return `${giveCount}-for-${getCount}`;
}

function tradePackageMakesSense(shape, diff, marketDiff, bestDelta, projectionDiff, yourNeed) {
  const [giveCount, getCount] = shape;
  if (!Number.isFinite(Number(marketDiff))) return false;
  if (giveCount === 1 && getCount === 1) {
    return diff >= -2 && diff <= 6.5 && marketDiff >= -2.5 && marketDiff <= 4.5 && projectionDiff >= -10;
  }
  if (giveCount === 2 && getCount === 1) {
    return bestDelta >= 1 && diff >= -36 && diff <= 5 && marketDiff >= -12 && marketDiff <= 4.5 && projectionDiff >= -190;
  }
  return false;
}

function tradeMarketEdgeScore(shape, marketDiff, bestDelta = 0) {
  const diff = Number(marketDiff);
  if (!Number.isFinite(diff)) return -20;
  const [giveCount, getCount] = shape;
  if (giveCount === 1 && getCount === 1) {
    return Math.max(-8, 8 - Math.abs(diff - 1.4) * 2.2);
  }
  if (giveCount === 2 && getCount === 1) {
    return Math.max(-8, 8 - Math.abs(diff - 1.5) * 1.2 + Math.min(4, Math.max(0, Number(bestDelta || 0)) * 0.3));
  }
  return 0;
}

function tradePackageEvidence(givePackage, getPackage, requestExact = false) {
  const databaseSupport = tradeDatabaseExactSupport(givePackage, getPackage);
  if (!databaseSupport.ready && requestExact) requestTradeDatabaseSamples(givePackage, getPackage);
  const exactCount = databaseSupport.ready ? Number(databaseSupport.count || 0) : 0;
  const activity = tradePackageMarketActivity(givePackage) + tradePackageMarketActivity(getPackage);
  return {
    exactCount,
    activity,
    tier: exactCount > 0 ? "exact" : "market",
    score: exactCount > 0
      ? 7 + Math.min(8, exactCount * 1.6)
      : Math.min(4, activity / 450),
  };
}

function queueExactSamplesForTradeIdeas(ideas) {
  ideas.forEach((idea) => {
    const givePackage = idea.givePackage || [idea.give];
    const getPackage = idea.getPackage || [idea.get];
    tradePackageEvidence(givePackage, getPackage, true);
  });
}

function bestTradePackage(giveRows, getRows, shape, myNeeds, theirNeeds) {
  const [giveCount, getCount] = shape;
  const givePackages = tradePackageCombinations(giveRows, giveCount);
  const getPackages = tradePackageCombinations(getRows, getCount);
  let best = null;

  givePackages.forEach((givePackage) => {
    getPackages.forEach((getPackage) => {
      if (!tradePackageHasDatabaseCoverage(givePackage) || !tradePackageHasDatabaseCoverage(getPackage)) return;
      const giveValue = tradePackageValue(givePackage);
      const getValue = tradePackageValue(getPackage);
      const diff = getValue - giveValue;
      const marketGive = tradePackageMarketValue(givePackage);
      const marketGet = tradePackageMarketValue(getPackage);
      if (marketGive === null || marketGet === null) return;
      const marketDiff = marketGet - marketGive;
      const projectionDiff = tradePackageProjection(getPackage) - tradePackageProjection(givePackage);
      const bestDelta = tradePackageBestValue(getPackage) - tradePackageBestValue(givePackage);
      const yourNeed = tradePackageNeed(myNeeds, getPackage);
      const theirNeed = tradePackageNeed(theirNeeds, givePackage);
      if (!yourNeed || !theirNeed) return;
      if (!tradePackageMakesSense(shape, diff, marketDiff, bestDelta, projectionDiff, yourNeed)) return;
      const evidence = tradePackageEvidence(givePackage, getPackage);
      if (!fantasyCalcTradeDatabaseReady()) return;

      const shapeBonus =
        giveCount > getCount
          ? Math.max(-2, Math.min(9, bestDelta * 0.55 + 4))
          : 3;
      const score =
        58 -
        Math.abs(diff) * (giveCount > getCount ? 0.55 : 1.15) -
        Math.max(0, marketDiff) * 1.1 +
        Math.min(5, Math.max(0, marketDiff + 2)) +
        Number(yourNeed.weight || 0) * 0.7 +
        Number(theirNeed.weight || 0) * 0.55 +
        Math.min(5, tradePackageMarketActivity(givePackage) / 400) +
        Math.min(5, tradePackageMarketActivity(getPackage) / 400) +
        evidence.score +
        tradeMarketEdgeScore(shape, marketDiff, bestDelta) +
        shapeBonus +
        Math.max(-4, Math.min(4, projectionDiff / 18));
      if (!best || score > best.score) {
        best = {
          give: givePackage[0],
          get: getPackage[0],
          givePackage,
          getPackage,
          diff,
          marketDiff,
          projectionDiff,
          bestDelta,
          score,
          shape: tradeShapeLabel(giveCount, getCount),
          yourNeed,
          theirNeed,
          databaseSampleCount: evidence.exactCount,
          databaseEvidence: evidence.tier,
          databaseActivity: evidence.activity,
        };
      }
    });
  });

  return best;
}

function teamSnapshotLabel(snapshot) {
  if (!snapshot) return "Team";
  return `${snapshot.teamName || `Team ${snapshot.teamId}`}${snapshot.manager ? ` (${snapshot.manager})` : ""}`;
}

function finalizeLeagueTradeIdeas(ideas, limit) {
  const seen = new Set();
  const selected = [];
  const repeats = [];
  const usedGive = new Set();
  const usedGet = new Set();
  ideas
    .sort((a, b) => b.score - a.score)
    .forEach((idea) => {
      const givePackage = idea.givePackage || [idea.give];
      const getPackage = idea.getPackage || [idea.get];
      const key = `${idea.team.teamId}-${idea.shape || "1-for-1"}-${tradePackageKey(givePackage)}-${tradePackageKey(getPackage)}`;
      if (seen.has(key)) return;
      seen.add(key);
      const giveKey = tradePackageKey(givePackage);
      const getKey = tradePackageKey(getPackage);
      const repeatedPlayer = giveKey.split("+").some((item) => usedGive.has(item)) || getKey.split("+").some((item) => usedGet.has(item));
      if (repeatedPlayer) {
        repeats.push(idea);
        return;
      }
      selected.push(idea);
      giveKey.split("+").filter(Boolean).forEach((item) => usedGive.add(item));
      getKey.split("+").filter(Boolean).forEach((item) => usedGet.add(item));
    });

  repeats.forEach((idea) => {
    if (selected.length >= limit) return;
    selected.push(idea);
  });
  const finalIdeas = selected.slice(0, limit);
  queueExactSamplesForTradeIdeas(finalIdeas);
  return finalIdeas;
}

function leagueTradeIdeas(snapshot, limit = 3) {
  if (!snapshot?.teamId || !liveLeagueHasRosters()) return [];
  if (!fantasyCalcTradeDatabaseReady()) return [];
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
      const givePool = uniqueTradeRows(giveMatches.flatMap((strength) => strength.rows));
      const getConsolidationPool = uniqueTradeRows(getMatches.flatMap((strength) => {
        const keep = tradeKeepCount(strength.pos);
        return other.rows
          .filter((row) => row.Pos === strength.pos)
          .sort((a, b) => tradeAssetValue(b) - tradeAssetValue(a))
          .slice(Math.max(0, keep - 3), keep + 3);
      }));

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
            Math.min(8, giveStrength.surplus + getStrength.surplus) -
            Math.max(0, pair.diff) * 0.9;
          ideas.push({
            team: other,
            give: pair.give,
            get: pair.get,
            diff: pair.diff,
            marketDiff: pair.marketDiff,
            score,
            shape: "1-for-1",
            databaseSampleCount: pair.databaseSampleCount,
            yourNeed: myNeed,
            theirNeed,
            giveStrength,
            getStrength,
          });
        });
      });

      [
        { shape: [2, 1], sourcePool: givePool, targetPool: getConsolidationPool },
      ].forEach(({ shape, sourcePool, targetPool }) => {
        if (sourcePool.length < shape[0] || targetPool.length < shape[1]) return;
        const tradePackage = bestTradePackage(sourcePool, targetPool, shape, myNeeds, theirNeeds);
        if (!tradePackage) return;
        ideas.push({
          team: other,
          ...tradePackage,
          giveStrength: giveMatches[0],
          getStrength: getMatches[0],
        });
      });
    });

  return finalizeLeagueTradeIdeas(ideas, limit);
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
      .sort((a, b) => tradeAssetValue(b.row) - tradeAssetValue(a.row) || Number(a.row.Rank) - Number(b.row.Rank))
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
    .sort((a, b) => tradeAssetValue(b.row) - tradeAssetValue(a.row) || Number(a.row.Rank) - Number(b.row.Rank))
    .slice(0, limit);
}

function renderPlayerMiniCard(row, label = "") {
  return `<div class="trade-player-chip">
    ${playerFocusButton(row)}
    <span>${htmlEscape(label || `${row.Pos}${row["Pos Rank"] || ""} / #${row.Rank}`)}</span>
    <small>Trade value ${tradeValueDisplay(row)} / ${scoringProjectionLabel()} ${projectionDisplay(row)} / Risk ${row.Risk}/10</small>
  </div>`;
}

function renderTradePackageMiniCards(rows, label = "") {
  return rows.map((row) => renderPlayerMiniCard(row, label)).join("");
}

function tradeIdeaEvidenceLabel(idea) {
  const samples = Number(idea.databaseSampleCount || 0);
  if (samples > 0) return `${samples} exact accepted sample${samples === 1 ? "" : "s"}`;
  const activity = Number(idea.databaseActivity || 0);
  if (activity > 0) return `market-backed / ${Math.round(activity).toLocaleString()} player activity`;
  return "market-backed by Fantasy IQ Data";
}

function tradeIdeaEvidenceDetail(idea, shape) {
  if (Number(idea.databaseSampleCount || 0) > 0) {
    return `found this exact ${shape} in accepted-trade database samples`;
  }
  return "matched FantasyCalc.com market values, accepted-trade activity, and both rosters' needs";
}

function renderTradeIdeaCard(idea) {
  const givePackage = idea.givePackage || [idea.give];
  const getPackage = idea.getPackage || [idea.get];
  const diff = Number(idea.diff || 0);
  const diffLabel = Math.abs(diff) < 1 ? "even value" : `${diff > 0 ? "+" : ""}${diff.toFixed(1)} value`;
  const marketDiff = Number(idea.marketDiff || 0);
  const marketLabel = Math.abs(marketDiff) < 1 ? "market even" : `${marketDiff > 0 ? "+" : ""}${marketDiff.toFixed(1)} market`;
  const shape = idea.shape || tradeShapeLabel(givePackage.length, getPackage.length);
  return `<article class="trade-idea-card">
    <div class="trade-idea-head">
      <span>${htmlEscape(teamSnapshotLabel(idea.team))}</span>
      <strong>${htmlEscape(tradePackageName(givePackage))} for ${htmlEscape(tradePackageName(getPackage))}</strong>
      <small>${htmlEscape(shape)} / ${htmlEscape(diffLabel)} / ${htmlEscape(marketLabel)} / ${htmlEscape(tradeIdeaEvidenceLabel(idea))}</small>
    </div>
    <div class="trade-idea-flow">
      <section>
        <h4>You offer</h4>
        ${renderTradePackageMiniCards(givePackage, `${idea.theirNeed?.pos || idea.give.Pos} need for them`)}
      </section>
      <section>
        <h4>You target</h4>
        ${renderTradePackageMiniCards(getPackage, `${idea.yourNeed?.pos || idea.get.Pos} fills your need`)}
      </section>
    </div>
    <p>${htmlEscape(`Why it fits: you need ${idea.yourNeed?.pos || idea.get.Pos}, and ${teamSnapshotLabel(idea.team)} needs ${idea.theirNeed?.pos || idea.give.Pos}. FantasyIQ ${tradeIdeaEvidenceDetail(idea, shape)}, then checked for a slight value edge before showing it.`)}</p>
  </article>`;
}

function myTeamSourceLabel(snapshot) {
  if (snapshot?.source === "espn") return "ESPN Team";
  if (snapshot?.source === "pasted") return "Pasted Roster";
  if (snapshot?.source === "loading") return "Loading";
  return "Needed";
}

function myTeamPositionState(count, starterTarget, depthTarget) {
  if (count < starterTarget) return "danger";
  if (count < depthTarget) return "warn";
  return "good";
}

function renderMyTeamEmpty(message = "Select your ESPN team or paste a roster in Trade IQ.") {
  if (myTeamHero) {
    myTeamHero.innerHTML = `
      <article>
        <span>Roster IQ</span>
        <strong>Pending</strong>
        <small>${htmlEscape(message)}</small>
      </article>
      <article>
        <span>Biggest Weakness</span>
        <strong>Unknown</strong>
        <small>Needs roster context</small>
      </article>
      <article>
        <span>Next Move</span>
        <strong>Connect</strong>
        <small>Roster unlocks the move</small>
      </article>
    `;
  }
  if (myTeamPositionGrid) {
    myTeamPositionGrid.innerHTML = ["QB", "RB", "WR", "TE", "DST", "K"]
      .filter((pos) => positionHasDraftSlot(pos))
      .map((pos) => `<article class="my-team-position-card"><span>${pos}</span><strong>--</strong><small>Waiting</small></article>`)
      .join("");
  }
  if (myTeamStarters) myTeamStarters.textContent = message;
  if (myTeamBench) myTeamBench.textContent = "Bench depth appears after FantasyIQ has a matched roster.";
  if (myTeamActions) myTeamActions.textContent = "FantasyIQ needs a roster before it can call out the next move.";
}

function renderMyTeamLineup(lineup) {
  if (!lineup.length) return "<p>No lineup slots found for this league profile.</p>";
  return lineup
    .map(
      (item) => `<article class="my-team-lineup-row">
        <span>${htmlEscape(item.slot)}</span>
        <strong>${item.row ? htmlEscape(item.row.Player) : "Open slot"}</strong>
        <small>${item.row ? `${htmlEscape(item.row.Pos)} / value ${valueDisplay(item.row)} / ${scoringProjectionLabel()} ${projectionDisplay(item.row)}` : "Starter gap"}</small>
      </article>`,
    )
    .join("");
}

function rosterEntryName(entry) {
  return String(entry?.player || entry?.name || "").trim();
}

function rosterEntryPosition(entry) {
  return String(entry?.pos || entry?.row?.Pos || "Player").trim();
}

function rosterEntrySlot(entry) {
  return String(entry?.lineupSlot || "").trim();
}

function rosterEntryDetail(entry) {
  const bits = [rosterEntryPosition(entry), entry?.proTeam, rosterEntrySlot(entry)].filter(Boolean);
  return bits.length ? bits.join(" / ") : "ESPN roster";
}

function renderRosterEntryRows(entries) {
  if (!entries.length) return "<p>No ESPN roster players found for this group.</p>";
  return entries
    .map((entry) => {
      const name = rosterEntryName(entry) || "Roster player";
      return `<article class="my-team-lineup-row">
        <span>${htmlEscape(rosterEntrySlot(entry) || rosterEntryPosition(entry))}</span>
        <strong>${htmlEscape(name)}</strong>
        <small>${htmlEscape(rosterEntryDetail(entry))}</small>
      </article>`;
    })
    .join("");
}

function renderMyTeam(snapshot = activeRosterSnapshot({ preferPasted: false })) {
  if (!myTeamHero && !myTeamPositionGrid && !myTeamStarters && !myTeamBench && !myTeamActions) return;
  if (!boardData) {
    renderMyTeamEmpty("Waiting for board data.");
    return;
  }
  const rosterEntries = Array.isArray(snapshot?.rosterEntries) ? snapshot.rosterEntries.filter((entry) => rosterEntryName(entry)) : [];
  const matchedRows = snapshot?.rows || [];
  const hasRosterContext = matchedRows.length || rosterEntries.length;
  if (!hasRosterContext) {
    renderMyTeamEmpty(isPreDraftLeague() ? "Draft or paste players to build My Team." : "Select your ESPN team or paste a roster in Trade IQ.");
    return;
  }

  const grade = postDraftGrade(snapshot);
  const actions = postDraftActions(snapshot);
  const weaknesses = rosterWeaknesses(snapshot);
  const strengths = rosterStrengths(snapshot);
  const topNeed = weaknesses[0] || null;
  const topStrength = strengths[0] || null;
  const cleanStrength = strengths.find((item) => item.pos !== topNeed?.pos && item.surplus > 0) || strengths.find((item) => item.pos !== topNeed?.pos) || null;
  const sourceLabel = myTeamSourceLabel(snapshot);
  const starterTargets = starterTargetCounts();
  const depthTargets = draftTargetCounts();
  const nextMove = topNeed
    ? topStrength?.surplus > 0
      ? `Shop ${topStrength.pos} depth for ${topNeed.pos}`
      : `Add ${topNeed.pos} depth`
    : "Hold the core";
  const matchedRoster = Boolean(matchedRows.length);
  const entryCount = rosterEntries.length || snapshot.players?.length || matchedRows.length;

  if (myTeamHero) {
    myTeamHero.innerHTML = `
      <article>
        <span>Roster IQ</span>
        <strong>${htmlEscape(matchedRoster ? grade.grade : "Synced")}</strong>
        <small>${htmlEscape(matchedRoster ? `${grade.label} / ${matchedRows.length} matched / ${sourceLabel}` : `${entryCount} ESPN players / value matching pending`)}</small>
      </article>
      <article>
        <span>Biggest Weakness</span>
        <strong>${htmlEscape(topNeed?.pos || "Balanced")}</strong>
        <small>${htmlEscape(topNeed ? `${topNeed.starterGap} starter gap / ${topNeed.depthGap} depth gap` : "No forced roster gap")}</small>
      </article>
      <article>
        <span>Next Move</span>
        <strong>${htmlEscape(matchedRoster ? nextMove : topNeed ? `Review ${topNeed.pos}` : "Review roster")}</strong>
        <small>${htmlEscape(matchedRoster ? (cleanStrength ? `Best clean strength: ${cleanStrength.pos}` : topNeed && topStrength?.pos === topNeed.pos ? `${topNeed.pos} starters are strong; depth is still short` : "No obvious surplus") : "ESPN roster is loaded; board values need a match")}</small>
      </article>
    `;
  }

  if (myTeamPositionGrid) {
    myTeamPositionGrid.innerHTML = ["QB", "RB", "WR", "TE", "DST", "K"]
      .filter((pos) => positionHasDraftSlot(pos))
      .map((pos) => {
        const count = Number(snapshot.counts?.[pos] || 0);
        const starterTarget = Number(starterTargets[pos] || 0);
        const depthTarget = Number(depthTargets[pos] || 0);
        const state = myTeamPositionState(count, starterTarget, depthTarget);
        const topRows = snapshot.rows
          .filter((row) => row.Pos === pos)
          .sort((a, b) => leagueValueScore(b) - leagueValueScore(a))
          .slice(0, 2)
          .map((row) => row.Player)
          .join(", ");
        const topEntries = rosterEntries
          .filter((entry) => rosterEntryPosition(entry) === pos)
          .slice(0, 2)
          .map(rosterEntryName)
          .join(", ");
        return `<article class="my-team-position-card ${state}">
          <span>${pos}</span>
          <strong>${count}/${depthTarget || starterTarget || 1}</strong>
          <small>${htmlEscape(topRows || topEntries || "Open slot")}</small>
        </article>`;
      })
      .join("");
  }

  const lineup = typeof fillLineup === "function" ? fillLineup(snapshot.rows) : [];
  const starterKeys = new Set(lineup.filter((item) => item.row).map((item) => normalizePlayerName(item.row.Player)));
  const benchRows = snapshot.rows
    .filter((row) => !starterKeys.has(normalizePlayerName(row.Player)))
    .sort((a, b) => leagueValueScore(b) - leagueValueScore(a));
  const rosterStarters = rosterEntries.filter((entry) => !["BE", "IR"].includes(rosterEntrySlot(entry)));
  const rosterBench = rosterEntries.filter((entry) => ["BE", "IR"].includes(rosterEntrySlot(entry)));

  if (myTeamStarters) {
    myTeamStarters.innerHTML = matchedRoster ? renderMyTeamLineup(lineup) : renderRosterEntryRows(rosterStarters.length ? rosterStarters : rosterEntries);
  }
  if (myTeamBench) {
    if (matchedRoster) {
      myTeamBench.innerHTML = benchRows.length
        ? benchRows.map((row) => renderPlayerMiniCard(row, `${row.Pos} depth / ${marketSignal(row).label}`)).join("")
        : "<p>No bench players outside the current starter build.</p>";
    } else {
      myTeamBench.innerHTML = renderRosterEntryRows(rosterBench);
    }
  }
  if (myTeamActions) {
    if (!matchedRoster) {
      myTeamActions.innerHTML = `
        <div class="trade-lane-summary">
          <strong>${htmlEscape(`${entryCount} ESPN players synced`)}</strong>
          <span>${htmlEscape("FantasyIQ can read roster construction now; value grading will improve as player matching completes.")}</span>
        </div>
        <p>${htmlEscape(topNeed ? `Primary count gap: ${topNeed.pos} needs ${topNeed.depthGap} more depth slot(s).` : "Roster counts do not show a forced positional gap.")}</p>
        <p>Open Trade IQ to paste the roster if you want immediate value matching for unmatched ESPN names.</p>
      `;
      return;
    }
    myTeamActions.innerHTML = `
      <div class="trade-lane-summary">
        <strong>${htmlEscape(nextMove)}</strong>
        <span>${htmlEscape(grade.notes[0] || "Roster score is based on value, risk, and construction.")}</span>
      </div>
      ${actions.map((item) => `<p>${htmlEscape(item)}</p>`).join("")}
      <p><strong>Risk:</strong> ${htmlEscape(topNeed ? `Do not overpay for ${topNeed.pos}; fix the gap through value first.` : "No forced move means patience is part of the edge.")}</p>
      <p><strong>Alternative:</strong> ${htmlEscape(topNeed ? "Use Trade IQ if the waiver pool does not clear replacement value." : "Watch waivers for news-driven role changes.")}</p>
    `;
  }
}

function renderPostDraftPlan(snapshot = activeRosterSnapshot()) {
  if (!postDraftPlan) return;
  if (!boardData) {
    postDraftPlan.textContent = "Waiting for board data.";
    return;
  }
  if (!snapshot.rows.length) {
    if (isPreDraftLeague()) {
      postDraftPlan.innerHTML = `
        <div class="post-draft-hero">
          <article>
            <span>Grade</span>
            <strong>Armed</strong>
            <small>Starts after picks</small>
          </article>
          <article>
            <span>Plan</span>
            <strong>Ready</strong>
            <small>${htmlEscape(selectedTeamId() ? preDraftSlotSummary() : "Select team")}</small>
          </article>
          <article>
            <span>Next Move</span>
            <strong>Draft</strong>
            <small>Roster plan updates live</small>
          </article>
        </div>
        <div class="post-draft-grid">
          <section>
            <h4>Before pick 1</h4>
            <p>FantasyIQ has the league settings, board tiers, and draft order ready.</p>
          </section>
          <section>
            <h4>During the draft</h4>
            <p>Your grade and roster needs will update as ESPN records each selection.</p>
          </section>
          <section>
            <h4>After the draft</h4>
            <p>This panel becomes the waiver watchlist, roster gaps, and trade-lane plan.</p>
          </section>
        </div>
      `;
      return;
    }
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
          <h4>Backup setup</h4>
          <p>You can paste a roster in the Trade IQ when ESPN data is not available yet.</p>
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
  const hasVerifiedTradeData = fantasyCalcTradeDatabaseReady() && !fantasyCalcTradeSamples.loadingKeys?.size;
  const databaseStatus = fantasyCalcTradeDatabaseReady()
    ? fantasyCalcTradeSamples.loadingKeys?.size
      ? "Fantasy IQ Data is validating exact 1-for-1 and 2-for-1 accepted-trade samples while market-backed ideas stay available."
      : "No package cleared the FantasyCalc.com market value, accepted-trade activity, and roster-fit filters."
    : fantasyCalcTradeDatabaseLoading || fantasyCalcMarketLoading
      ? "Fantasy IQ Data is still loading accepted-trade context. Package ideas will appear only after the real-trade database is ready."
      : "Fantasy IQ Data is unavailable, so package ideas are disabled instead of guessing from local roster values.";
  if (leagueIdeas.length) {
    tradeFinder.innerHTML = `
      <div class="trade-lane-summary">
        <strong>${leagueIdeas.length} active-league trade idea${leagueIdeas.length === 1 ? "" : "s"}</strong>
        <span>${htmlEscape(tradeMarketSourceLabel())}. FantasyIQ shows the best realistic 1-for-1 and 2-for-1 ideas after FantasyCalc.com value, trade activity, and both-team roster fit clear the filters.</span>
      </div>
      <div class="trade-idea-list">
        ${leagueIdeas.map(renderTradeIdeaCard).join("")}
      </div>
    `;
    return;
  }
  if (liveLeagueHasRosters() && hasVerifiedTradeData) {
    tradeFinder.innerHTML = `
      <div class="trade-lane-summary">
        <strong>No verified Fantasy IQ Data trade ideas yet</strong>
        <span>${htmlEscape(databaseStatus)} FantasyIQ is holding back trade suggestions instead of showing loose or unrealistic offers.</span>
      </div>
      <div class="trade-empty-state">
        <p>For this roster, Fantasy IQ Data did not find three clean 1-for-1 or 2-for-1 ideas that help both managers.</p>
        <p>Use the manual trade checker for a specific offer, or check back after rosters/trade market data move.</p>
      </div>
    `;
    return;
  }
  tradeFinder.innerHTML = `
    <div class="trade-lane-summary">
      <strong>${away.length ? `Shop ${away[0].Pos} depth` : "Hold core"}</strong>
      <span>${
        liveLeagueHasRosters()
          ? databaseStatus
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

function waiverClaimBidRange(row, dropRow, gain) {
  if (!row) return null;
  const risk = Number(row.Risk || 0);
  const upside = Number(row.Upside || row.Ceiling || 0);
  const needBoost = dropRow && row.Pos === dropRow.Pos ? 1 : 0;
  let min = gain >= 10 ? 10 : gain >= 6 ? 6 : gain >= 3 ? 3 : 0;
  let max = gain >= 10 ? 18 : gain >= 6 ? 12 : gain >= 3 ? 7 : 3;
  if (upside >= 70) max += 3;
  if (risk >= 7) max -= 3;
  min += needBoost;
  max += needBoost;
  return {
    min: Math.max(0, Math.round(min)),
    max: Math.max(0, Math.round(Math.max(min, max))),
  };
}

function waiverConfidence(row, dropRow, gain, snapshot) {
  if (!row) return 0;
  const fit = leagueFitSignal(row, snapshot.counts || emptyPositionCounts());
  const fitBoost = fit.className === "good" ? 10 : fit.className === "watch" ? 4 : -6;
  const riskPenalty = Number(row.Risk || 0) * 2;
  const trendBoost = clampNumber(externalTrendScore(row) * 1.3, -8, 10);
  const dropBoost = dropRow ? clampNumber(gain * 2.2, -8, 18) : -8;
  return Math.round(clampNumber(58 + fitBoost + dropBoost + trendBoost - riskPenalty, 34, 91));
}

function waiverActionLabel(gain, confidence) {
  if (gain >= 8 && confidence >= 70) return "Claim aggressively";
  if (gain >= 3 && confidence >= 58) return "Claim at fair price";
  if (gain > 0) return "Watchlist";
  return "Hold";
}

function waiverClaimProfile(row, snapshot) {
  const dropRow = weakestRosterRow(snapshot, row.Pos) || weakestRosterRow(snapshot);
  const gain = dropRow ? rosterValueDelta(row, dropRow) : 0;
  const confidence = waiverConfidence(row, dropRow, gain, snapshot);
  const bid = waiverClaimBidRange(row, dropRow, gain);
  return {
    row,
    dropRow,
    gain,
    confidence,
    bid,
    action: waiverActionLabel(gain, confidence),
  };
}

function waiverClaimCard(profile) {
  const row = profile.row;
  const dropText = profile.dropRow ? `Drop ${profile.dropRow.Player}` : "No clean drop";
  const gainText = profile.dropRow ? `${profile.gain > 0 ? "+" : ""}${profile.gain.toFixed(1)} value` : "Needs roster";
  const faab = profile.bid ? `FAAB ${profile.bid.min}-${profile.bid.max}%` : "FAAB TBD";
  const fit = leagueFitSignal(row, activeRosterSnapshot({ preferPasted: true }).counts || emptyPositionCounts());
  return `<article class="waiver-claim-card">
    <div class="waiver-claim-head">
      <span>${htmlEscape(profile.action)}</span>
      <strong>${playerFocusButton(row)}</strong>
      <small>${htmlEscape(`${row.Pos} / ${gainText} / ${faab}`)}</small>
    </div>
    <div class="waiver-claim-meta">
      <span>${htmlEscape(dropText)}</span>
      <span>${htmlEscape(`${profile.confidence}% confidence`)}</span>
      <span>${htmlEscape(fit.label)}</span>
    </div>
  </article>`;
}

function renderWaiversIqEmpty(message) {
  if (waiverIqHero) {
    waiverIqHero.innerHTML = `
      <article>
        <span>Main Claim</span>
        <strong>Waiting</strong>
        <small>${htmlEscape(message)}</small>
      </article>
      <article>
        <span>Drop Candidate</span>
        <strong>Pending</strong>
        <small>Needs roster context</small>
      </article>
      <article>
        <span>Confidence</span>
        <strong>--</strong>
        <small>Updates after sync</small>
      </article>
    `;
  }
  if (waiverIqSupportingReasons) waiverIqSupportingReasons.innerHTML = `<p>${htmlEscape(message)}</p>`;
  if (waiverIqRiskWarning) waiverIqRiskWarning.textContent = "FantasyIQ will not recommend a claim until the add clears the replacement-value threshold.";
  if (waiverIqAlternativePath) waiverIqAlternativePath.textContent = "Connect an ESPN team, paste a roster in Trade IQ, or use the Big Board as a temporary watchlist.";
  if (waiverIqWatchlist) waiverIqWatchlist.textContent = "Waiting for waiver pool.";
  if (waiverIqDrops) waiverIqDrops.textContent = "Waiting for roster.";
  if (waiverIqPlan) waiverIqPlan.textContent = "No claim plan yet.";
}

function renderWaiversIQ(snapshot = activeRosterSnapshot({ preferPasted: true })) {
  if (!waiverIqHero && !waiverIqWatchlist && !waiverIqPlan) return;
  if (!boardData) {
    renderWaiversIqEmpty("Waiting for board data.");
    return;
  }
  if (!snapshot.rows.length) {
    renderWaiversIqEmpty("Select your ESPN team or paste your roster in Trade IQ to generate real waiver claims.");
    return;
  }

  const profiles = waiverCandidates(snapshot, 8).map((row) => waiverClaimProfile(row, snapshot));
  const top = profiles[0] || null;
  const topNeed = rosterWeaknesses(snapshot)[0] || null;
  const dropCandidates = snapshot.rows
    .slice()
    .sort((a, b) => leagueValueScore(a) - leagueValueScore(b) || Number(b.Risk || 0) - Number(a.Risk || 0))
    .slice(0, 5);

  if (!top) {
    renderWaiversIqEmpty("No available player clears FantasyIQ's waiver threshold right now.");
    return;
  }

  const faab = top.bid ? `${top.bid.min}-${top.bid.max}%` : "TBD";
  const dropLabel = top.dropRow ? top.dropRow.Player : "Hold roster spot";
  const gainLabel = top.dropRow ? `${top.gain > 0 ? "+" : ""}${top.gain.toFixed(1)} roster value` : "No clean drop";
  const fit = leagueFitSignal(top.row, snapshot.counts);
  const risk = riskSignal(top.row);
  const market = marketSignal(top.row);
  const claimReasons = [
    `${top.row.Player} is the top available add after roster need, league value, upside, and risk are weighted.`,
    top.dropRow ? `The claim projects ${gainLabel} versus ${top.dropRow.Player}.` : "FantasyIQ does not see a clean cut yet, so treat this as a watchlist add.",
    topNeed ? `${top.row.Pos} is measured against your top roster gap: ${topNeed.pos}.` : "Your roster has no forced gap, so waiver action must beat replacement value.",
    `${waiverPoolSourceLabel()} ${fit.detail}`,
  ];

  if (waiverIqHero) {
    waiverIqHero.innerHTML = `
      <article>
        <span>Main Claim</span>
        <strong>Add ${htmlEscape(top.row.Player)}</strong>
        <small>${htmlEscape(`${top.action} / ${top.row.Pos} / ${gainLabel}`)}</small>
      </article>
      <article>
        <span>Drop Candidate</span>
        <strong>${htmlEscape(dropLabel)}</strong>
        <small>${htmlEscape(top.dropRow ? `${top.dropRow.Pos} / value ${valueDisplay(top.dropRow)} / risk ${top.dropRow.Risk}/10` : "Hold if price climbs")}</small>
      </article>
      <article>
        <span>Confidence</span>
        <strong>${top.confidence}%</strong>
        <small>${htmlEscape(`Suggested FAAB ${faab}`)}</small>
      </article>
    `;
  }

  if (waiverIqSupportingReasons) {
    waiverIqSupportingReasons.innerHTML = claimReasons.map((reason) => `<p>${htmlEscape(reason)}</p>`).join("");
  }
  if (waiverIqRiskWarning) {
    waiverIqRiskWarning.textContent =
      Number(top.row.Risk || 0) >= 6
        ? `${risk.label}. Keep the bid under ${faab} unless late news confirms the role.`
        : `${risk.label}. Waiver value still depends on role/news before claims process.`;
  }
  if (waiverIqAlternativePath) {
    waiverIqAlternativePath.textContent =
      top.gain >= 3 ? `If ${top.row.Player} is claimed, pivot to ${profiles[1]?.row?.Player || "the next same-position value"} or hold priority.` : "Hold priority and monitor news-driven roles.";
  }
  if (waiverIqWatchlist) {
    waiverIqWatchlist.innerHTML = profiles.length
      ? profiles.map(waiverClaimCard).join("")
      : "<p>No priority claims right now.</p>";
  }
  if (waiverIqDrops) {
    waiverIqDrops.innerHTML = dropCandidates.length
      ? dropCandidates.map((row) => renderPlayerMiniCard(row, `Cut line / ${row.Pos} / value ${valueDisplay(row)}`)).join("")
      : "<p>No cut candidates found.</p>";
  }
  if (waiverIqPlan) {
    waiverIqPlan.innerHTML = `
      <div class="trade-lane-summary waiver-summary">
        <strong>${htmlEscape(top.action)}</strong>
        <span>${htmlEscape(`Add ${top.row.Player}. Suggested FAAB ${faab}. ${market.label}.`)}</span>
      </div>
      <p><strong>Claim:</strong> Add ${htmlEscape(top.row.Player)}${top.dropRow ? `, drop ${htmlEscape(top.dropRow.Player)}` : ""}.</p>
      <p><strong>Bid:</strong> ${htmlEscape(faab)}. Do not chase past the top of the range without confirmed role news.</p>
      <p><strong>Fallback:</strong> ${htmlEscape(profiles[1]?.row ? `Pivot to ${profiles[1].row.Player}` : "Hold the roster spot for the next news cycle")}.</p>
    `;
  }
}

function phaseSummaryLabel(phase) {
  if (!phase) return "Waiting";
  return phase.action ? `${phase.action}: ${phase.mainMove || "Ready"}` : phase.mainMove || "Ready";
}

function commandScoreFromData(data, rec, snapshot) {
  const rosterScore = snapshot?.rows?.length ? postDraftGrade(snapshot).score : null;
  const backendScore = Number(data?.engine?.fantasyIqScore);
  if (Number.isFinite(rosterScore) && rosterScore > 0) {
    let score = rosterScore;
    if (Number.isFinite(backendScore) && backendScore > 20) {
      score = Math.max(rosterScore - 3, rosterScore * 0.86 + backendScore * 0.14);
    } else {
      const confidence = Number(rec?.confidenceScore);
      if (Number.isFinite(confidence)) score = Math.max(rosterScore - 2, rosterScore * 0.88 + confidence * 0.12);
    }
    if (rec?.action === "WAIT") score += 1;
    if (rec?.action === "ACT_NOW") score -= 1;
    return Math.round(clampNumber(score, 1, 99));
  }
  if (Number.isFinite(backendScore) && backendScore > 20) return Math.round(clampNumber(backendScore, 1, 99));
  const confidence = Number(rec?.confidenceScore);
  if (Number.isFinite(confidence)) {
    const actionAdjustment = rec.action === "WAIT" ? 4 : rec.action === "ACT_NOW" ? -1 : 0;
    return Math.round(clampNumber(confidence + actionAdjustment, 1, 99));
  }
  if (snapshot?.rows?.length) return 64;
  return null;
}

function commandWeaknessFromData(data, snapshot) {
  const clientWeakness = snapshot?.rows?.length ? rosterWeaknesses(snapshot)[0] : null;
  if (clientWeakness) {
    return {
      label: clientWeakness.pos || "Roster",
      detail: clientWeakness.detail || `${clientWeakness.pos} is the first roster-fit concern.`,
    };
  }
  const backendWeakness = (data?.engine?.rosterWeakness || [])[0];
  if (backendWeakness?.pos) {
    return {
      label: backendWeakness.pos,
      detail: backendWeakness.detail || `${backendWeakness.pos} needs the most attention.`,
    };
  }
  if (boardData) {
    return {
      label: "Draft context",
      detail: "Roster weakness needs ESPN team or pasted roster data.",
    };
  }
  return {
    label: "Needs data",
    detail: "Load a roster, draft board, or ESPN sync to identify the weak spot.",
  };
}

function commandScoreDetailText(score, data, snapshot) {
  if (!score) return "Needs roster or board context";
  if (snapshot?.rows?.length) {
    const consensus = consensusRosterBreakdown(snapshot);
    return `Consensus starters ${consensus.starterAvg.toFixed(1)} / roster ${consensus.rosterAvg.toFixed(1)}`;
  }
  const strength = Number(data?.engine?.teamStrength);
  const starterQuality = Number(data?.engine?.starterQuality);
  if (Number.isFinite(strength) && strength > 0) return `Team strength ${strength.toFixed(1)} / starter quality ${starterQuality.toFixed(1)}`;
  return "Draft-board score until roster sync is available";
}

function renderCommandDecision(data = null) {
  const rec = data?.recommendation || {};
  const snapshot = activeRosterSnapshot({ preferPasted: true });
  const score = commandScoreFromData(data, rec, snapshot);
  const weakness = commandWeaknessFromData(data, snapshot);
  const reasons = rec.supportingQuantitativeReasons || [];
  const action = rec.action || (intelligenceInFlight ? "RUNNING" : "WAIT");
  const mainMove = rec.mainMove || (intelligenceInFlight ? "Calculating best move" : "Waiting for recommendation sync");

  if (commandMainMoveCard) commandMainMoveCard.dataset.action = action.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  if (commandMainMove) commandMainMove.textContent = mainMove;
  if (commandMainReason) {
    commandMainReason.textContent =
      reasons[0] || (intelligenceInFlight ? "FantasyIQ is checking roster, board, schedule, trade, and waiver signals." : "Refresh to compare action against doing nothing.");
  }
  if (commandFantasyIqScore) commandFantasyIqScore.textContent = score ? String(score) : "--";
  if (commandScoreDetail) commandScoreDetail.textContent = commandScoreDetailText(score, data, snapshot);
  if (commandRosterWeakness) commandRosterWeakness.textContent = weakness.label;
  if (commandWeaknessDetail) commandWeaknessDetail.textContent = weakness.detail;
  if (commandConfidence) commandConfidence.textContent = rec.confidenceScore ? `${rec.confidenceScore}%` : "Pending";
  if (commandConfidenceDetail) {
    commandConfidenceDetail.textContent = rec.dataFreshnessStatus || (data?.syncedAt ? `Synced ${formatSyncTime(data.syncedAt)}` : "No recommendation run yet");
  }
  if (commandSupportingReasons) {
    commandSupportingReasons.innerHTML = reasons.length
      ? reasons.slice(0, 3).map((reason) => `<p>${htmlEscape(reason)}</p>`).join("")
      : "<p>FantasyIQ needs a roster, board, or ESPN sync before it can explain the move.</p>";
  }
  if (commandRiskWarning) commandRiskWarning.textContent = rec.riskWarning || "No risk warning yet.";
  if (commandAlternativePath) commandAlternativePath.textContent = rec.alternativePath || "Refresh after ESPN sync or board changes.";
}

function compactIntelligenceRow(row) {
  if (!row) return null;
  return `${row.Player} (${row.Pos}, ${row.Team || "FA"})`;
}

function compactTradeIdeaSide(idea, side) {
  const rows = side === "give" ? idea?.givePackage || [idea?.give] : idea?.getPackage || [idea?.get];
  return rows.filter(Boolean).map(compactIntelligenceRow).filter(Boolean).join(" + ");
}

function actionFromDecision(decision) {
  const label = decision?.label || "";
  if (["Pick now", "Target", "Board value"].includes(label)) return "ACT_NOW";
  if (label === "Controlled risk") return "WAIT";
  if (label === "Avoid") return "AVOID";
  return "WAIT";
}

function rosterValueDelta(addRow, dropRow) {
  return Math.round((leagueValueScore(addRow) - leagueValueScore(dropRow)) * 10) / 10;
}

function weakestRosterRow(snapshot, pos = "") {
  const candidates = (snapshot?.rows || [])
    .filter((row) => !pos || row.Pos === pos)
    .filter((row) => !["QB", "TE"].includes(row.Pos) || (snapshot.counts?.[row.Pos] || 0) > (starterTargetCounts()[row.Pos] || 1))
    .sort((a, b) => leagueValueScore(a) - leagueValueScore(b) || Number(b.Risk || 0) - Number(a.Risk || 0));
  return candidates[0] || (snapshot?.rows || []).slice().sort((a, b) => leagueValueScore(a) - leagueValueScore(b))[0] || null;
}

function buildClientIntelligenceData(serverData = {}) {
  const snapshot = activeRosterSnapshot({ preferPasted: true });
  const counts = snapshot.counts || emptyPositionCounts();
  const weaknesses = snapshot.rows.length ? rosterWeaknesses(snapshot) : [];
  const strengths = snapshot.rows.length ? rosterStrengths(snapshot) : [];
  const available = boardData ? availableRows() : [];
  const picks = boardData ? bestCheatcodeRows(counts) : {};
  const topDraft = picks.bestNow?.row || picks.bestValue?.row || available[0] || null;
  const draftDecision = topDraft ? recommendationDecision(topDraft, counts) : null;
  const topWaiver = snapshot.rows.length ? waiverCandidates(snapshot, 1)[0] : null;
  const waiverDrop = topWaiver ? weakestRosterRow(snapshot, topWaiver.Pos) : null;
  const waiverGain = topWaiver && waiverDrop ? rosterValueDelta(topWaiver, waiverDrop) : 0;
  const tradeIdea = snapshot.rows.length ? leagueTradeIdeas(snapshot, 1)[0] : null;
  const topNeed = weaknesses[0];
  const topStrength = strengths[0];
  const boardFreshness = liveDraft?.syncedAt || boardData?.syncedAt || boardData?.updated || serverData.syncedAt || "";
  const staleWarnings = [];
  if (!snapshot.rows.length) staleWarnings.push("No selected ESPN roster or pasted roster, so roster-specific weekly logic is limited.");
  if (!liveLeagueHasRosters()) staleWarnings.push("Opponent roster intelligence is limited until ESPN roster sync is available.");
  if (!boardData) staleWarnings.push("Player board data is not loaded yet.");

  let recommendation = serverData.recommendation || {};
  const waiverIsActionable = topWaiver && waiverDrop && waiverGain >= 3;
  const tradeIsActionable = tradeIdea && tradeIdea.score >= 56;

  if (waiverIsActionable) {
    recommendation = {
      action: "ACT_NOW",
      mainMove: `Add ${compactIntelligenceRow(topWaiver)} and drop ${compactIntelligenceRow(waiverDrop)}`,
      confidenceScore: Math.round(clampNumber(66 + waiverGain * 1.2 - Number(topWaiver.Risk || 0), 52, 88)),
      supportingQuantitativeReasons: [
        `Projected roster VOR gain is ${waiverGain > 0 ? "+" : ""}${waiverGain.toFixed(1)} versus the best drop candidate.`,
        topNeed ? `${topWaiver.Pos} maps to your top roster need: ${topNeed.starterGap} starter gap and ${topNeed.depthGap} depth gap.` : `${topWaiver.Pos} adds usable depth without forcing a lineup downgrade.`,
        `League-adjusted value is ${valueDisplay(topWaiver)} with projection ${projectionDisplay(topWaiver)} in ${activeLeagueSettings().scoringLabel}.`,
      ],
      riskWarning: Number(topWaiver.Risk || 0) >= 6 ? `Risk is elevated at ${topWaiver.Risk}/10, so do not overpay FAAB.` : "Waiver value can evaporate quickly if role/news changes before claims process.",
      alternativePath: tradeIsActionable
        ? `Instead, shop ${compactTradeIdeaSide(tradeIdea, "give")} for ${compactTradeIdeaSide(tradeIdea, "get")}.`
        : "Hold waiver priority/FAAB if news flow weakens the role before lock.",
      dataFreshnessStatus: `Client synthesis from dashboard data. Board synced ${formatSyncTime(boardFreshness)}.`,
    };
  } else if (tradeIsActionable) {
    const givePackage = tradeIdea.givePackage || [tradeIdea.give];
    const getPackage = tradeIdea.getPackage || [tradeIdea.get];
    const gain = Math.round((tradePackageValue(getPackage) - tradePackageValue(givePackage)) * 10) / 10;
    const incomingRisk = getPackage.reduce((max, row) => Math.max(max, Number(row?.Risk || 0)), 0);
    recommendation = {
      action: "ACT_NOW",
      mainMove: `Offer ${compactTradeIdeaSide(tradeIdea, "give")} for ${compactTradeIdeaSide(tradeIdea, "get")}`,
      confidenceScore: Math.round(clampNumber(61 + tradeIdea.score / 5 + Math.max(0, gain), 50, 84)),
      supportingQuantitativeReasons: [
        `User value delta is ${gain > 0 ? "+" : ""}${gain.toFixed(1)} before roster-fit adjustment.`,
        tradeIdea.yourNeed ? `Incoming player attacks your ${tradeIdea.yourNeed.pos} need: ${tradeIdea.yourNeed.detail}.` : "Incoming player improves the highest available lineup lane.",
        tradeIdea.theirNeed ? `Opponent acceptance angle: your outgoing player fills their ${tradeIdea.theirNeed.pos} need.` : "Trade shape is built around surplus for need rather than raw rank swapping.",
      ],
      riskWarning: incomingRisk >= 6 ? `Incoming risk peaks at ${incomingRisk}/10, so keep the ask flexible.` : "Trade acceptance depends on opponent preference and recent news.",
      alternativePath: topWaiver ? `Fallback waiver path: add ${compactIntelligenceRow(topWaiver)} if the manager declines.` : "Fallback path is to hold and wait for waiver or injury leverage.",
      dataFreshnessStatus: `Client synthesis from ESPN roster context. Synced ${formatSyncTime(boardFreshness)}.`,
    };
  } else if (topDraft && available.length) {
    recommendation = {
      action: actionFromDecision(draftDecision),
      mainMove: `${draftDecision?.label || "Target"} ${compactIntelligenceRow(topDraft)}`,
      confidenceScore: Math.round(clampNumber(58 + leagueValueScore(topDraft) / 6 - Number(topDraft.Risk || 0), 42, 86)),
      supportingQuantitativeReasons: [
        `League-adjusted value score is ${valueDisplay(topDraft)} with projection ${projectionDisplay(topDraft)}.`,
        draftDecision?.survival ? `Estimated return probability is ${draftDecision.survival.pct}% before your next relevant pick.` : commandReason(topDraft, draftDecision, counts),
        topNeed ? `Roster context still shows ${topNeed.pos} as the highest weighted need.` : "Roster construction does not force a lower-value position.",
      ],
      riskWarning: riskSignal(topDraft).detail,
      alternativePath: picks.bestValue?.row && picks.bestValue.row !== topDraft ? `Alternative: ${compactIntelligenceRow(picks.bestValue.row)} as the pure value play.` : "Hold if the room pushes better tier value to you.",
      dataFreshnessStatus: `Client synthesis from live draft board. Board synced ${formatSyncTime(boardFreshness)}.`,
    };
  } else {
    recommendation = {
      action: "WAIT",
      mainMove: "Do Nothing",
      confidenceScore: snapshot.rows.length ? 72 : 40,
      supportingQuantitativeReasons: [
        snapshot.rows.length ? "No waiver add clears the replacement-value threshold by 3.0 points." : "Roster-specific evaluation needs an ESPN team selection or pasted roster.",
        topStrength ? `Current roster strength is ${topStrength.pos} with top value ${topStrength.topValue.toFixed(1)}.` : "No position has enough surplus to force a consolidation trade.",
        "Preserving FAAB, waiver priority, and flexibility beats a low-edge move right now.",
      ],
      riskWarning: snapshot.rows.length ? "Standing still can miss late injury/news leverage, so rerun after major news." : "Recommendation quality is limited until roster context is present.",
      alternativePath: topWaiver ? `Monitor ${compactIntelligenceRow(topWaiver)} as the top watchlist add.` : "Refresh after the next ESPN sync or roster update.",
      dataFreshnessStatus: `Client synthesis from available dashboard context. Synced ${formatSyncTime(boardFreshness)}.`,
    };
  }

  return {
    ...serverData,
    ok: true,
    syncedAt: serverData.syncedAt || new Date().toISOString(),
    teamName: snapshot.teamName || serverData.teamName || "",
    recommendation,
    phases: {
      ...(serverData.phases || {}),
      liveDraftRoom: {
        action: topDraft ? actionFromDecision(draftDecision) : "WAIT",
        mainMove: topDraft ? compactIntelligenceRow(topDraft) : "Waiting for board data",
        supportingQuantitativeReasons: topDraft ? [`Value ${valueDisplay(topDraft)} / projection ${projectionDisplay(topDraft)}.`] : ["No live board row available."],
      },
      weeklyCommandCenter: {
        action: recommendation.mainMove === "Do Nothing" ? "WAIT" : recommendation.action,
        mainMove: recommendation.mainMove || "Do Nothing",
        supportingQuantitativeReasons: recommendation.supportingQuantitativeReasons || [],
      },
      waiverSniper: {
        action: waiverIsActionable ? "ACT_NOW" : "WAIT",
        mainMove: topWaiver ? `Add ${compactIntelligenceRow(topWaiver)}` : "No priority add",
        faabBidRange: topWaiver ? { min: waiverGain >= 8 ? 8 : 2, max: waiverGain >= 8 ? 16 : 6 } : null,
      },
      tradeFinder: {
        action: tradeIsActionable ? "ACT_NOW" : "WAIT",
        mainMove: tradeIdea ? `Offer ${compactTradeIdeaSide(tradeIdea, "give")} for ${compactTradeIdeaSide(tradeIdea, "get")}` : "No clean trade lane",
        opponentTeam: tradeIdea ? teamSnapshotLabel(tradeIdea.team) : "",
      },
      opponentIntelligence: {
        strongestSignals: liveLeagueTeams().slice(0, 4).map((team) => ({
          teamId: team.teamId,
          primaryPersona: rosterEntriesForTeam(team).length ? "Roster-aware manager" : "Sync-limited manager",
        })),
      },
    },
    missingDataWarnings: [...(serverData.missingDataWarnings || []), ...staleWarnings].slice(0, 4),
    fallbackLogicUsed: [
      ...(serverData.fallbackLogicUsed || []),
      "Client-side dashboard synthesis ranked hold, waiver, trade, and draft actions against doing nothing.",
    ],
  };
}

function renderIntelligenceOS() {
  if (!intelligencePanel) return;
  if (!intelligenceData) {
    renderCommandDecision();
    if (intelligenceMainMove) intelligenceMainMove.textContent = intelligenceInFlight ? "Running league-aware engine" : "Intelligence engine ready";
    if (intelligenceFreshness) intelligenceFreshness.textContent = intelligenceInFlight ? "Syncing ESPN and board context." : "Refresh to scan draft, weekly, waiver, trade, and opponent context.";
    if (intelligenceMainCard) {
      intelligenceMainCard.innerHTML = `<strong>Main move</strong><span>${intelligenceInFlight ? "Calculating..." : "Waiting for sync."}</span>`;
    }
    if (intelligenceReasons) intelligenceReasons.innerHTML = "<p>FantasyIQ compares every action against doing nothing once data loads.</p>";
    return;
  }
  const rec = intelligenceData.recommendation || {};
  const phases = intelligenceData.phases || {};
  const warnings = intelligenceData.missingDataWarnings || [];
  const fallback = intelligenceData.fallbackLogicUsed || [];
  renderCommandDecision(intelligenceData);
  if (intelligenceMainMove) intelligenceMainMove.textContent = rec.mainMove || "No forced move";
  if (intelligenceFreshness) {
    intelligenceFreshness.textContent = rec.dataFreshnessStatus || `Synced ${formatSyncTime(intelligenceData.syncedAt)}.`;
  }
  if (intelligenceMainCard) {
    const action = rec.action || "WAIT";
    const confidence = rec.confidenceScore || "TBD";
    intelligenceMainCard.innerHTML = `
      <strong>${htmlEscape(action)}</strong>
      <span>${htmlEscape(rec.mainMove || "No forced move")}</span>
      <small>Confidence ${htmlEscape(String(confidence))}${intelligenceData.teamName ? ` / ${htmlEscape(intelligenceData.teamName)}` : ""}</small>
    `;
  }
  const reasons = rec.supportingQuantitativeReasons || [];
  if (intelligenceReasons) {
    intelligenceReasons.innerHTML = `
      ${reasons.slice(0, 3).map((reason) => `<p>${htmlEscape(reason)}</p>`).join("") || "<p>No quantitative reasons available yet.</p>"}
      <p><strong>Risk:</strong> ${htmlEscape(rec.riskWarning || "Normal fantasy variance applies.")}</p>
      <p><strong>Backup:</strong> ${htmlEscape(rec.alternativePath || "Wait for cleaner data or rerun sync.")}</p>
      ${warnings.length ? `<p><strong>Missing:</strong> ${htmlEscape(warnings.slice(0, 2).join(" "))}</p>` : ""}
      ${fallback.length ? `<p><strong>Fallback:</strong> ${htmlEscape(fallback.slice(0, 2).join(" "))}</p>` : ""}
    `;
  }
  if (intelligenceGrid) {
    const opponentCount = phases.opponentIntelligence?.managerProfiles?.length || phases.opponentIntelligence?.strongestSignals?.length || 0;
    intelligenceGrid.innerHTML = `
      <article>
        <span>Roster IQ</span>
        <strong>${htmlEscape(phaseSummaryLabel(phases.weeklyCommandCenter))}</strong>
        <small>${htmlEscape((phases.weeklyCommandCenter?.supportingQuantitativeReasons || [])[0] || "Lineup and hold logic")}</small>
      </article>
      <article>
        <span>Waiver IQ</span>
        <strong>${htmlEscape(phaseSummaryLabel(phases.waiverSniper))}</strong>
        <small>${htmlEscape(phases.waiverSniper?.faabBidRange ? `FAAB ${phases.waiverSniper.faabBidRange.min}-${phases.waiverSniper.faabBidRange.max}` : "Add/drop scan")}</small>
      </article>
      <article>
        <span>Trade IQ</span>
        <strong>${htmlEscape(phaseSummaryLabel(phases.tradeFinder))}</strong>
        <small>${htmlEscape(phases.tradeFinder?.opponentTeam ? `Partner: ${phases.tradeFinder.opponentTeam}` : "Generated proposal lane")}</small>
      </article>
      <article>
        <span>League IQ</span>
        <strong>${opponentCount} profile${opponentCount === 1 ? "" : "s"}</strong>
        <small>${htmlEscape((phases.opponentIntelligence?.strongestSignals || [])[0]?.primaryPersona || "Persona tracking")}</small>
      </article>
    `;
  }
}

function loadIntelligence(force = false) {
  if (!intelligencePanel || intelligenceInFlight) return Promise.resolve();
  if (requiresCustomerAccess() && !hasCustomerAccess()) {
    intelligenceData = null;
    renderIntelligenceOS();
    return Promise.resolve();
  }
  intelligenceInFlight = true;
  renderIntelligenceOS();
  return fetch(apiUrl("/api/intelligence", { force: force ? 1 : "" }), { cache: "no-store", headers: apiHeaders() })
    .then((response) => jsonOrAccessError(response, `HTTP ${response.status}`))
    .then((data) => {
      if (!data?.ok) throw new Error(data?.error || "Intelligence API returned no recommendation");
      intelligenceData = buildClientIntelligenceData(data);
      renderIntelligenceOS();
    })
    .catch((error) => {
      intelligenceData = buildClientIntelligenceData({
        recommendation: {
          action: "WAIT",
          mainMove: "Intelligence sync unavailable",
          confidenceScore: 20,
          supportingQuantitativeReasons: ["The dashboard is still usable.", "Live boards and draft room can continue independently.", "Retry after ESPN/API sync recovers."],
          riskWarning: error.message || "Unknown intelligence API error.",
          alternativePath: "Use Schedule IQ, Waiver IQ, and Trade IQ manually for now.",
          dataFreshnessStatus: "Intelligence API unavailable.",
        },
        phases: {},
        missingDataWarnings: [error.message || "Unknown intelligence API error."],
        fallbackLogicUsed: ["Client-side intelligence fallback."],
      });
      renderIntelligenceOS();
    })
    .finally(() => {
      intelligenceInFlight = false;
      renderIntelligenceOS();
    });
}

function renderRosterEngines() {
  renderMyTeam(activeRosterSnapshot({ preferPasted: false }));
  renderPostDraftPlan(activeRosterSnapshot());
  const tradeSnapshot = activeRosterSnapshot({ preferPasted: true });
  renderTradeFinder(tradeSnapshot);
  renderWaiverAssistant(tradeSnapshot);
  renderWaiversIQ(tradeSnapshot);
  renderIntelligenceOS();
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
  return myTeamSelect?.value || activeDraftLeagueOverride()?.teamId || appConfig.customerTeamId || "";
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
  const tier = typeof preciseTierDisplay === "function" ? preciseTierDisplay(row, pos) : row["Pos Tier"] || row.Category || "Tier";
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

function isPreDraftLeague(data = liveDraft) {
  return Boolean(data && !data.inProgress && !data.drafted && Number(data.completedPicks || 0) === 0);
}

function selectedEspnTeam() {
  const teamId = selectedTeamId();
  if (!teamId) return null;
  return (liveDraft?.teams || []).find((team) => String(team.teamId) === String(teamId)) || null;
}

function firstRoundPickForTeam(teamId = selectedTeamId()) {
  if (!teamId) return null;
  return (liveDraft?.draftOrder || liveDraft?.picks || [])
    .filter((pick) => String(pick.teamId) === String(teamId))
    .sort((a, b) => Number(a.overall || 999) - Number(b.overall || 999))[0] || null;
}

function liveDraftSlotStorageKey(teamId) {
  return loadoutStorageKey(`live-draft-slot:${teamId || "unknown"}`);
}

function liveDraftSlotChangeNote(teamId, firstPick) {
  if (!teamId || !firstPick?.roundPick) return "";
  const key = liveDraftSlotStorageKey(teamId);
  const current = String(firstPick.roundPick);
  try {
    const previous = localStorage.getItem(key) || "";
    localStorage.setItem(key, current);
    if (previous && previous !== current) {
      return ` Updated from ESPN: you moved from pick ${previous} to pick ${current}.`;
    }
  } catch (error) {
    // Slot memory is only used to explain ESPN reshuffles.
  }
  return "";
}

function preDraftSlotSummary(teamId = selectedTeamId()) {
  const pick = firstRoundPickForTeam(teamId);
  if (!pick) return "Choose your ESPN team; FantasyIQ will keep your slot synced to ESPN.";
  return `Live ESPN slot: Round ${pick.round}, Pick ${pick.roundPick}, Overall ${pick.overall}.`;
}

function draftScheduleDate() {
  const iso = liveDraft?.draftScheduledAt || liveDraft?.draftAvailableAt || "";
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function draftScheduleValue() {
  const date = draftScheduleDate();
  if (!date) return "Pending";
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function draftScheduleDetail() {
  const date = draftScheduleDate();
  if (!date) return liveDraft ? "ESPN has not published a scheduled draft time yet." : "Sync ESPN to detect the scheduled draft.";
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  const seconds = Number(liveDraft?.draftTimePerSelection || 0);
  const perPick = seconds ? ` / ${seconds} sec per pick` : "";
  const draftType = liveDraft?.draftType ? ` / ${String(liveDraft.draftType).toLowerCase()} draft` : "";
  return `${time}${perPick}${draftType}`;
}

function draftPositionValue(firstPick = firstRoundPickForTeam()) {
  return firstPick ? `Pick ${firstPick.roundPick}` : "Pending";
}

function draftPositionDetail(firstPick = firstRoundPickForTeam()) {
  if (!firstPick) return selectedTeamId() ? "ESPN has not published your draft order yet." : "Choose your ESPN team to lock the slot.";
  const team = selectedEspnTeam();
  const teamText = team?.teamName ? `${team.teamName} / ` : "";
  return `${teamText}Round 1 / Overall ${firstPick.overall}`;
}

function emptyStateHtml(title, detail, items = [], tone = "neutral") {
  return `<div class="pre-draft-empty ${tone}">
    <strong>${htmlEscape(title)}</strong>
    <p>${htmlEscape(detail)}</p>
    ${items.length ? `<ul>${items.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>` : ""}
  </div>`;
}

function topTierNames(pos, limit = 3) {
  return topAvailableByPosition(pos)
    .slice(0, limit)
    .map((row) => row.Player)
    .join(", ");
}

function draftPrepStorageKey(key) {
  return loadoutStorageKey(`draft-prep-${key}`);
}

function selectedDraftBuild() {
  return localStorage.getItem(draftPrepStorageKey("build")) || "balanced";
}

function draftWatchlistItems() {
  try {
    const parsed = JSON.parse(localStorage.getItem(draftPrepStorageKey("watchlist")) || "[]");
    return Array.isArray(parsed) ? parsed.slice(0, 24) : [];
  } catch {
    return [];
  }
}

function saveDraftWatchlist(items) {
  localStorage.setItem(draftPrepStorageKey("watchlist"), JSON.stringify(items.slice(0, 24)));
}

function slotBand(firstPick) {
  const pick = Number(firstPick?.roundPick || firstPick?.overall || 0);
  if (!pick) return "unknown";
  if (pick <= 4) return "early";
  if (pick <= 8) return "middle";
  return "late";
}

function slotPlan(firstPick) {
  const band = slotBand(firstPick);
  if (band === "early") {
    return {
      title: "Early slot: protect the anchor",
      detail: "Take the clean elite player first, then use rounds 2-4 to balance RB/WR before chasing luxury edges.",
      bullets: ["Do not pass a true tier-one player for uniqueness.", "Your return pick should solve roster structure, not force a stack.", "QB/TE only if the board creates a real discount."],
    };
  }
  if (band === "middle") {
    return {
      title: "Middle slot: win the tier break",
      detail: "Let the room choose first, then take the last player in a real tier before the next shelf drops.",
      bullets: ["Stay open across RB/WR in round 1.", "Use round 2 to punish any slide from the early turn.", "Be ready to pivot if QB/TE value falls into round 5-7."],
    };
  }
  if (band === "late") {
    return {
      title: "Late slot: build through the turn",
      detail: "Pair two players with weekly ceiling and avoid spending both turn picks on fragile profiles.",
      bullets: ["WR/WR or WR/RB is the default unless RB value is obvious.", "Do not leave the 3/4 turn with a luxury-heavy roster.", "Use the long wait to prioritize players unlikely to return."],
    };
  }
  return {
    title: "Pick slot needed",
    detail: "Use Schedule IQ with mock practice so FantasyIQ can pair value with schedule leverage.",
    bullets: ["Enter the ESPN draft room before trusting the slot.", "Click Sync Now after ESPN publishes order.", "If ESPN reshuffles, FantasyIQ updates the slot from live draft order."],
  };
}

function settingsDraftIntel(settings = activeLeagueSettings()) {
  const slots = settings.lineupSlots || DEFAULT_LINEUP_SLOTS;
  const notes = [];
  if (settings.scoringType === "ppr") notes.push("Full PPR rewards target volume and pass-catching RBs.");
  if (settings.scoringType === "half-ppr") notes.push("Half PPR keeps RB touchdown and carry equity closer to WR volume.");
  if (settings.scoringType === "standard") notes.push("Standard scoring pushes TD equity and early-down RB roles up.");
  if (Number(slots.SUPERFLEX || 0) > 0) notes.push("Superflex changes the board: QB becomes a premium starter slot.");
  if (Number(slots.FLEX || 0) >= 2) notes.push("Extra flex depth makes WR/RB bench upside more valuable than backup comfort.");
  if (Number(slots.BE || 0) >= 7) notes.push("Deep benches reward handcuff-plus RBs and breakout WRs.");
  if (leagueTeamTotal() >= 14) notes.push("Larger rooms dry up QB/TE depth faster; do not assume streamers stay clean.");
  return notes.slice(0, 4);
}

function tierPressureItems() {
  return ["RB", "WR", "TE", "QB"]
    .map((pos) => topTierInfo(pos))
    .filter((info) => info.count)
    .sort((a, b) => a.count - b.count)
    .slice(0, 4);
}

function valuePocketRows() {
  const rows = availableRows().filter((row) => ["QB", "RB", "WR", "TE"].includes(row.Pos));
  const pockets = [
    { label: "Rounds 1-2", min: 1, max: leagueTeamTotal() * 2 },
    { label: "Rounds 3-5", min: leagueTeamTotal() * 2 + 1, max: leagueTeamTotal() * 5 },
    { label: "Rounds 6-9", min: leagueTeamTotal() * 5 + 1, max: leagueTeamTotal() * 9 },
    { label: "Rounds 10+", min: leagueTeamTotal() * 9 + 1, max: 999 },
  ];
  return pockets.map((pocket) => {
    const pocketRows = rows
      .filter((row) => Number(row.Rank || 999) >= pocket.min && Number(row.Rank || 999) <= pocket.max)
      .sort((a, b) => Number(b["League Value"] || b.Value || 0) - Number(a["League Value"] || a.Value || 0))
      .slice(0, 3);
    const positions = [...new Set(pocketRows.map((row) => row.Pos))].join("/") || "RB/WR";
    const names = pocketRows.map((row) => `${row.Player} (${row.Pos})`).join(", ") || "Board loading";
    return { ...pocket, positions, names };
  });
}

function buildPlan(build) {
  const plans = {
    balanced: {
      title: "Balanced Hammer",
      detail: "Open RB/WR flexible, then let value decide the first luxury position.",
      rounds: ["Rounds 1-4: three RB/WR starters minimum.", "Rounds 5-8: one QB or TE edge only if the tier is discounted.", "Rounds 9+: upside bench, then DST/K late."],
    },
    "hero-rb": {
      title: "Hero RB",
      detail: "Anchor one premium RB, then flood WR and add contingent RB upside later.",
      rounds: ["Round 1-2: one RB anchor.", "Rounds 3-7: WR target volume and one QB/TE value if it falls.", "Bench: handcuff-plus RBs with injury leverage."],
    },
    "wr-heavy": {
      title: "WR Heavy",
      detail: "Build weekly floor through target earners, then attack RB volatility after the room overpays.",
      rounds: ["Rounds 1-4: at least three WR/FLEX-caliber players.", "Rounds 5-8: RB value pockets and one premium QB/TE if clean.", "Bench: prioritize RB paths to touches over safe low-ceiling WRs."],
    },
    "elite-edge": {
      title: "Elite QB/TE Edge",
      detail: "Take a true positional separator only when RB/WR tiers remain healthy.",
      rounds: ["Do not take both elite QB and elite TE unless RB/WR value falls hard.", "After the edge pick, spend the next two picks repairing RB/WR depth.", "If the tier is gone, skip the position and stream value later."],
    },
  };
  return plans[build] || plans.balanced;
}

function draftAvoidWindows() {
  const round = currentRound();
  const rows = avoidRows({ QB: 0, RB: 0, WR: 0, TE: 0, DST: 0, K: 0 }).slice(0, 3);
  const playerLine = rows.length ? rows.map((row) => `${row.Player} (${row.Pos})`).join(", ") : "No board-specific fade is urgent yet.";
  return [
    `Before round ${Math.max(9, round)}: avoid K/DST unless your league is already in endgame.`,
    "Before your RB/WR base is stable: do not buy backup QB or second TE.",
    `Current board discipline: ${playerLine}`,
  ];
}

function benchRules() {
  const slots = activeLineupSlots();
  const bench = Number(slots.BE || 0);
  return [
    bench >= 7 ? "Deep bench: chase upside, not floor. Handcuff-plus RBs and route-growth WRs matter." : "Short bench: avoid clogging spots with low-ceiling backups.",
    Number(slots.FLEX || 0) >= 2 ? "Multiple flexes: WR/RB depth beats backup QB/TE comfort." : "Single flex: keep the bench liquid for waiver pivots.",
    "Final rounds: DST only with early schedule value, kicker last.",
  ];
}

function addDraftWatchlistItem() {
  const name = (draftWatchlistInput?.value || "").trim();
  if (!name) return;
  const row = findPlayer(name) || availableRows().find((item) => item.Player.toLowerCase().includes(name.toLowerCase()));
  const item = {
    name: row?.Player || name,
    pos: row?.Pos || "",
    team: row?.Team || "",
    rank: row?.Rank || "",
    tier: row?.["Pos Tier"] || row?.Category || "",
    type: draftWatchlistType?.value || "Target",
  };
  const items = draftWatchlistItems().filter((existing) => existing.name.toLowerCase() !== item.name.toLowerCase());
  items.unshift(item);
  saveDraftWatchlist(items);
  if (draftWatchlistInput) draftWatchlistInput.value = "";
  renderDraftPrep();
}

function renderWatchlist() {
  if (!draftWatchlistList) return;
  const items = draftWatchlistItems();
  if (!items.length) {
    draftWatchlistList.innerHTML = "<p>No saved watchlist yet. Add targets, fades, sleepers, or must-drafts before your room opens.</p>";
    return;
  }
  draftWatchlistList.innerHTML = items
    .map(
      (item, index) => `<article>
        <span>${htmlEscape(item.type)}</span>
        <strong>${htmlEscape(item.name)}</strong>
        <small>${htmlEscape([item.pos, item.team, item.rank ? `#${item.rank}` : "", item.tier].filter(Boolean).join(" / "))}</small>
        <button type="button" data-watchlist-remove="${index}" aria-label="Remove ${htmlEscape(item.name)}">Remove</button>
      </article>`,
    )
    .join("");
  draftWatchlistList.querySelectorAll("[data-watchlist-remove]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = draftWatchlistItems();
      next.splice(Number(button.dataset.watchlistRemove), 1);
      saveDraftWatchlist(next);
      renderDraftPrep();
    });
  });
}

function renderDraftPrep() {
  if (!draftPrepScore) return;
  const settings = activeLeagueSettings();
  const teamId = selectedTeamId();
  const firstPick = firstRoundPickForTeam(teamId);
  const scheduleDate = draftScheduleDate();
  const watchlist = draftWatchlistItems();
  const boardReady = Boolean(boardData && availableRows().length);
  const orderReady = Boolean((liveDraft?.draftOrder || []).length);
  const slots = settings.lineupSlots || {};
  const rosterDetected = Object.values(slots).some((value) => Number(value) > 0);
  const checks = [
    { label: "League Public", ok: Boolean(liveDraft), value: liveDraft ? "Verified" : "Pending", detail: liveDraft ? "ESPN public sync reached this league" : "Run Sync Now before draft day" },
    { label: "League IDs", ok: Boolean(appConfig.leagueId && (appConfig.customerTeamId || teamId)), value: appConfig.leagueId ? "Saved" : "Missing", detail: teamId ? `Team ${teamId}` : "Save ESPN league and team IDs" },
    { label: "Draft Date", ok: Boolean(scheduleDate || liveDraft?.drafted || liveDraft?.inProgress), value: liveDraft?.drafted ? "Complete" : liveDraft?.inProgress ? "Live" : draftScheduleValue(), detail: draftScheduleDetail() },
    { label: "Draft Position", ok: Boolean(firstPick), value: draftPositionValue(firstPick), detail: draftPositionDetail(firstPick) },
    { label: "Scoring", ok: Boolean(settings.scoringType || settings.scoringLabel), value: settings.scoringLabel || settings.scoringType || "Missing", detail: settings.source || "ESPN scoring profile" },
    { label: "Roster Slots", ok: rosterDetected, value: rosterDetected ? lineupSummary(settings) : "Missing", detail: rosterDetected ? "Lineup shape loaded" : "Open setup to detect roster slots" },
    { label: "Draft Rounds", ok: Boolean(draftRoundTotal(settings)), value: `${draftRoundTotal(settings)} rounds`, detail: "Used for mock and live pick pacing" },
    { label: "Board Loaded", ok: boardReady, value: boardReady ? `${availableRows().length} available` : "Loading", detail: boardReady ? "Tier and value data ready" : "Load Big Board data" },
    { label: "ESPN Sync", ok: Boolean(liveDraft && !liveDraft.staleError), value: liveDraft?.staleError ? "Cached" : liveDraft ? "Live" : "Pending", detail: liveDraft?.staleError ? "Using cached board mode" : "Click Sync Now on draft day" },
    { label: "Fallback Mode", ok: Boolean(boardReady), value: boardReady ? "Ready" : "Pending", detail: boardReady ? "Manual draft tracking can continue if ESPN lags" : "Board data must load first" },
    { label: "Watchlist", ok: watchlist.length >= 3, value: `${watchlist.length} saved`, detail: watchlist.length >= 3 ? "Targets are staged" : "Save at least 3 names" },
  ];
  const score = Math.round((checks.filter((item) => item.ok).length / checks.length) * 100);
  draftPrepScore.textContent = `${score}%`;
  if (draftPrepScoreNote) {
    draftPrepScoreNote.textContent = score >= 100
      ? "Ready for draft day; slot will keep updating from ESPN."
      : "Finish the watchlist and select your team; the draft slot updates when ESPN publishes order.";
  }
  if (draftPrepReadiness) {
    draftPrepReadiness.innerHTML = checks
      .map(
        (item) => `<article class="${item.ok ? "good" : "watch"}">
          <span>${htmlEscape(item.label)}</span>
          <strong>${htmlEscape(item.value)}</strong>
          <small>${htmlEscape(item.detail)}</small>
        </article>`,
      )
      .join("");
  }

  const slot = slotPlan(firstPick);
  if (draftPrepSlot) {
    draftPrepSlot.innerHTML = `<p class="eyebrow">Pick Slot Strategy</p><h3>${htmlEscape(slot.title)}</h3>
      <div class="draft-prep-meta" aria-label="Draft schedule and position">
        <span><strong>${htmlEscape(draftPositionValue(firstPick))}</strong>${htmlEscape(draftPositionDetail(firstPick))}</span>
        <span><strong>${htmlEscape(draftScheduleValue())}</strong>${htmlEscape(draftScheduleDetail())}</span>
      </div>
      <p>${htmlEscape(slot.detail)}</p><ul>${slot.bullets.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>`;
  }
  if (draftPrepSettings) {
    const notes = settingsDraftIntel(settings);
    draftPrepSettings.innerHTML = `<p class="eyebrow">League Settings Intelligence</p><h3>${htmlEscape(settings.scoringLabel || "Custom format")}</h3><p>${htmlEscape(`${leagueTeamTotal()} teams / ${lineupSummary(settings)} / ${draftRoundTotal(settings)} rounds`)}</p><ul>${notes.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>`;
  }
  if (draftPrepTiers) {
    const tiers = tierPressureItems();
    draftPrepTiers.innerHTML = `<p class="eyebrow">Tier Pressure</p><h3>${tiers.length ? "Current cliffs" : "Loading tiers"}</h3><div class="draft-chip-list">${tiers.map((info) => `<span>${htmlEscape(info.pos)}: ${info.count} in ${htmlEscape(info.tier)}</span>`).join("") || "<span>Board loading</span>"}</div>`;
  }
  if (draftPrepValues) {
    draftPrepValues.innerHTML = `<p class="eyebrow">Value Pockets</p><h3>Round map</h3><div class="draft-pocket-list">${valuePocketRows().map((pocket) => `<article><strong>${htmlEscape(pocket.label)}: ${htmlEscape(pocket.positions)}</strong><small>${htmlEscape(pocket.names)}</small></article>`).join("")}</div>`;
  }

  const build = selectedDraftBuild();
  draftBuildButtons.forEach((button) => button.classList.toggle("active", (button.dataset.draftBuild || "balanced") === build));
  const plan = buildPlan(build);
  if (draftBuildPlan) {
    draftBuildPlan.innerHTML = `<p class="eyebrow">Roster Build Plan</p><h3>${htmlEscape(plan.title)}</h3><p>${htmlEscape(plan.detail)}</p><ul>${plan.rounds.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>`;
  }
  if (draftPrepAvoid) {
    draftPrepAvoid.innerHTML = `<p class="eyebrow">Do Not Draft Too Early</p><h3>Price discipline</h3><ul>${draftAvoidWindows().map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>`;
  }
  if (draftPrepBench) {
    draftPrepBench.innerHTML = `<p class="eyebrow">Bench Strategy</p><h3>Upside over comfort</h3><ul>${benchRules().map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul>`;
  }
  renderWatchlist();
}

function renderPreDraftPanel() {
  if (!preDraftPanel) return;
  if (!isPreDraftLeague()) {
    preDraftPanel.hidden = true;
    return;
  }
  const teamId = selectedTeamId();
  const firstPick = firstRoundPickForTeam(teamId);
  const orderCount = (liveDraft?.draftOrder || []).length;
  const settings = activeLeagueSettings();
  const bestRb = topTierNames("RB", 2) || "RB tier loading";
  const bestWr = topTierNames("WR", 2) || "WR tier loading";
  const format = `${leagueTeamTotal()} teams / ${settings.scoringLabel || SCORING_LABELS[settings.scoringType] || "Custom scoring"}`;
  const orderText = orderCount ? `${orderCount} draft slots loaded` : "Draft order pending";
  const slotText = firstPick ? `Your first pick: Round 1, Pick ${firstPick.roundPick}, Overall ${firstPick.overall}` : "Choose your ESPN team to personalize the board.";
  const tierText = `Watch early RB/WR value: ${bestRb}; ${bestWr}`;
  preDraftPanel.hidden = false;
  preDraftPanel.innerHTML = `
    <div class="pre-draft-copy">
      <span>Draft setup</span>
      <strong>${htmlEscape(firstPick ? "Ready for your pick" : "Room is ready")}</strong>
      <p>${htmlEscape(`${slotText} ${orderText}. ${format}. ${tierText}`)}</p>
    </div>
    <div class="pre-draft-actions">
      <button class="secondary-action pre-draft-nav" type="button" data-jump="simulator">Practice This Room</button>
      <button class="secondary-action pre-draft-nav" type="button" data-jump="workbooks">Review Big Board</button>
    </div>
  `;
  preDraftPanel.querySelectorAll(".pre-draft-nav").forEach((button) => {
    button.addEventListener("click", () => activateSection(button.dataset.jump));
  });
}

function preDraftRecommendationIntro(teamId) {
  return emptyStateHtml(
    "Pre-draft board value is ready",
    teamId
      ? `${preDraftSlotSummary(teamId)} These cards use your slot, league scoring, and the live board before picks start.`
      : "Choose My ESPN Team to turn overall values into slot-specific survival reads.",
    [
      "Use Pick Now for players you should not risk trying to sneak back.",
      "Use Can Wait once your team is selected and FantasyIQ can see the return pick.",
      "Keep K/DST late unless the draft is already in the endgame.",
    ],
    "good",
  );
}

function preDraftRosterEmpty(teamId) {
  return emptyStateHtml(
    "Roster starts clean",
    preDraftSlotSummary(teamId),
    [
      "Early goal: secure RB/WR volume before luxury picks.",
      "Do not take backup QB, second TE, DST, or K before the board forces it.",
      "Roster tracker will switch from plan to actual picks as ESPN records them.",
    ],
    "good",
  );
}

function preDraftNoTeamEmpty() {
  return emptyStateHtml(
    "Pick your ESPN team",
    "The board is live, but roster pressure and next-pick survival need your team slot.",
    ["Use the My ESPN Team selector above.", "FantasyIQ will remember it on this device.", "Then the first-pick radar and build tracker become personalized."],
    "watch",
  );
}

function preDraftRecentPicksEmpty() {
  return emptyStateHtml(
    "No picks yet",
    "ESPN has the order loaded, but the room has not started drafting.",
    ["Keep Sync Now handy near draft time.", "Recent picks will appear here as soon as ESPN records the first selection."],
    "good",
  );
}

function renderRecommendationCard(row, counts, index = 0) {
  const decision = recommendationDecision(row, counts);
  const momentum = playerMarketMomentum(row);
  const udk = udkAlignmentSignal(row);
  const priority = decision.label === "Pick now" || index < 3 ? "priority" : "";
  const survivalText = decision.survival.label === "Select team" ? "team needed" : `${decision.survival.pct}% back`;
  const proof = [
    scoringProjectionLabel(),
    `${leagueTeamTotal()} teams`,
    lineupSummary(),
    selectedTeamId() ? "selected roster" : "board value",
    liveDraftedKeys().size ? `${liveDraftedKeys().size} drafted filtered` : "draft board state",
    hasUdkSignal(row) ? `UDK ${row["UDK Alignment"]}` : "",
  ].filter(Boolean);
  return `<div class="pick-card recommendation ${priority} ${decision.className}">
    <span>#${row.Rank} / ${row.Pos} / ${row.Team}</span>
    <div class="recommendation-actions">
      ${playerFocusButton(row)}
      <button type="button" class="manual-draft-button" data-manual-draft-player="${htmlEscape(row.Player)}">Mark Drafted</button>
    </div>
    <div class="rec-meta">
      <em>${decision.label}</em>
      <b class="${decision.survival.className}">${survivalText}</b>
      ${momentum.hasSleeperSignal ? `<b class="${momentum.className}">${htmlEscape(momentum.label)}</b>` : ""}
      ${hasUdkSignal(row) ? `<b class="${udk.className}">${htmlEscape(udk.label)}</b>` : ""}
      <b>${row["Pos Tier"] || row.Category}</b>
    </div>
    <small>${decision.reason} ${scoringProjectionLabel()}: ${projectionDisplay(row)}. League value: ${valueDisplay(row)}. ${decision.survival.detail} ${momentum.hasSleeperSignal ? htmlEscape(momentum.detail) : ""} ${hasUdkSignal(row) ? htmlEscape(udk.detail) : ""}</small>
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
  const preDraft = isPreDraftLeague();

  liveRecommendations.innerHTML = `
    ${preDraft ? preDraftRecommendationIntro(teamId) : ""}
    <div class="recommendation-block">
      <h4>${teamId ? "Pick Now" : "Best Board Values"}</h4>
      ${pickNow.length ? pickNow.map((row, index) => renderRecommendationCard(row, counts, index)).join("") : "<p>No urgent pick yet. Let the room make the first mistake.</p>"}
    </div>
    <div class="recommendation-block">
      <h4>Can Wait</h4>
      ${waitList.length ? waitList.map((row) => renderRecommendationCard(row, counts)).join("") : preDraft && !teamId ? "<p>Select your ESPN team to see what can survive back to your next pick.</p>" : "<p>Not enough separation yet for a confident wait list.</p>"}
    </div>
    <div class="recommendation-block compact-block">
      <h4>Avoid Under Clock</h4>
      ${avoids.length ? avoids.map((row) => renderRecommendationCard(row, counts)).join("") : preDraft ? "<p>Pre-draft avoid rule: do not force K/DST, backup QB, or second TE before starter value dries up.</p>" : "<p>No major avoid flags from roster/round logic.</p>"}
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
  const saved = activeDraftLeagueOverride()?.teamId || localStorage.getItem(teamStorageKey) || myTeamSelect.value || appConfig.customerTeamId || "";
  const validIds = new Set((liveDraft.teams || []).map((team) => String(team.teamId)));
  myTeamSelect.innerHTML = `<option value="">Choose your team</option>${liveDraft.teams
    .map((team) => `<option value="${htmlEscape(team.teamId)}">${htmlEscape(team.teamName)}${team.manager ? ` (${htmlEscape(team.manager)})` : ""}</option>`)
    .join("")}`;
  if (saved && validIds.has(String(saved))) {
    myTeamSelect.value = saved;
  } else if (saved) {
    myTeamSelect.value = "";
    localStorage.removeItem(teamStorageKey);
  }
  if (!localStorage.getItem(teamStorageKey) && appConfig.customerTeamId && validIds.has(String(appConfig.customerTeamId))) {
    localStorage.setItem(teamStorageKey, appConfig.customerTeamId);
  }
}

function renderLiveDraftSlot() {
  if (!liveMySlot || !liveMySlotNote) return;
  if (!liveDraft) {
    liveMySlot.textContent = "Pending";
    liveMySlotNote.textContent = "Connect ESPN, then click Sync Now after the room opens.";
    return;
  }
  const teamId = selectedTeamId();
  if (!teamId) {
    liveMySlot.textContent = "Select team";
    liveMySlotNote.textContent = "Random rooms can reshuffle; choose your team after ESPN publishes order.";
    return;
  }
  const firstPick = firstRoundPickForTeam(teamId);
  if (!firstPick) {
    liveMySlot.textContent = "Order pending";
    liveMySlotNote.textContent = "Click Sync Now after entering the ESPN draft room. Slot is not assumed from setup.";
    return;
  }
  const upcoming = pendingPicksForTeam(teamId);
  const nextPick = upcoming[0];
  const changeNote = liveDraftSlotChangeNote(teamId, firstPick);
  liveMySlot.textContent = `Pick ${firstPick.roundPick}`;
  liveMySlotNote.textContent =
    `Live ESPN order. First pick overall ${firstPick.overall}.${nextPick ? ` Next turn overall ${nextPick.overall}.` : ""}${changeNote}`;
}

function renderPickCards(container, picks, emptyMessage) {
  if (!container) return;
  if (!picks?.length) {
    container.innerHTML = String(emptyMessage || "").includes("<") ? emptyMessage : `<p>${htmlEscape(emptyMessage)}</p>`;
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
    liveMyRoster.innerHTML = isPreDraftLeague()
      ? preDraftNoTeamEmpty()
      : "<p>Select your ESPN team after the order appears.</p>";
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
      ${isPreDraftLeague() ? preDraftRosterEmpty(teamId) : "<p>No picks for your team yet.</p>"}
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
    nextPickRadar.innerHTML = isPreDraftLeague()
      ? preDraftNoTeamEmpty()
      : "<p>Select your ESPN team to unlock live survival odds.</p>";
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
    ${isPreDraftLeague() ? emptyStateHtml("First-pick radar", preDraftSlotSummary(teamId), ["Likely Gone means do not count on that player coming back.", "Can Wait means FantasyIQ sees enough room before your return pick."], "good") : ""}
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
    roomDetector.innerHTML = `<div class="intel-card good"><strong>${isPreDraftLeague() ? "No room behavior yet" : "No run yet"}</strong><small>${isPreDraftLeague() ? "Pre-draft signal is quiet by design. Once picks start, this will separate real position runs from noise." : "ESPN has not recorded any picks. Once the room starts drafting, this will spot panic pockets."}</small></div>`;
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
    riskMeter.innerHTML = isPreDraftLeague()
      ? preDraftNoTeamEmpty()
      : "<p>Select your ESPN team after the order appears.</p>";
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
        <small>${nextPick ? `Overall ${nextPick.overall}, ${until} picks away` : teamId ? "No remaining ESPN picks found" : "Use Schedule IQ for schedule context"}</small>
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

function liveDraftTeamsBySlot() {
  const teams = liveDraft?.teams || [];
  const picks = liveDraft?.picks || [];
  const slotByTeam = new Map();
  (liveDraft?.draftOrder || []).forEach((pick, index) => {
    slotByTeam.set(String(pick.teamId), Number(pick.roundPick || index + 1));
  });
  const teamsById = new Map(
    teams.map((team) => [
      String(team.teamId),
      {
        teamId: String(team.teamId),
        teamName: team.teamName || team.name || `Team ${team.teamId}`,
        manager: team.manager || "",
      },
    ]),
  );
  picks.forEach((pick) => {
    const key = String(pick.teamId || "");
    if (!key || teamsById.has(key)) return;
    teamsById.set(key, {
      teamId: key,
      teamName: pick.fantasyTeam || `Team ${key}`,
      manager: pick.manager || "",
    });
  });
  return Array.from(teamsById.values()).sort((a, b) => {
    const aSlot = slotByTeam.get(String(a.teamId)) || 999;
    const bSlot = slotByTeam.get(String(b.teamId)) || 999;
    return aSlot - bSlot || String(a.teamName).localeCompare(String(b.teamName));
  });
}

function draftBoardRoundCount(picks = liveDraft?.picks || []) {
  const maxRound = picks.reduce((max, pick) => Math.max(max, Number(pick.round || 0)), 0);
  return Math.max(1, draftRoundTotal(), maxRound);
}

function pickPositionForDraftBoard(pick) {
  const row = pickBoardRow(pick);
  return String(row?.Pos || pick?.pos || "").toUpperCase();
}

function draftBoardPositionClass(pos) {
  const normalized = String(pos || "pending").toLowerCase().replace(/[^a-z]/g, "");
  if (["qb", "rb", "wr", "te", "dst", "k"].includes(normalized)) return `pick-pos-${normalized}`;
  return "pick-pos-pending";
}

function draftBoardPickTile(pick, round) {
  if (!pick) {
    return `<div class="draft-board-pick empty">
      <span>R${round}</span>
      <strong>Pending</strong>
      <small>Awaiting ESPN</small>
    </div>`;
  }
  const drafted = pick.status === "drafted";
  const current = Number(pick.overall || 0) === currentOverallPick();
  const row = pickBoardRow(pick);
  const pos = pickPositionForDraftBoard(pick);
  const player = drafted ? pick.player || "Unknown player" : current ? "On the clock" : `Pick ${pick.overall}`;
  const detail = drafted
    ? [pos, row?.Team || pick.proTeam, row?.Rank ? `#${row.Rank}` : ""].filter(Boolean).join(" / ") || "Drafted"
    : `Overall ${pick.overall || "?"}`;
  return `<div class="draft-board-pick ${drafted ? "made" : "pending"} ${current ? "current" : ""} ${draftBoardPositionClass(pos)}">
    <span>R${htmlEscape(pick.round || round)}.${htmlEscape(pick.roundPick || "?")}</span>
    <strong>${htmlEscape(player)}</strong>
    <small>${htmlEscape(detail)}</small>
  </div>`;
}

function renderAllTeamsDraftBoard() {
  if (!allTeamsDraftBoard) return;
  if (!liveDraft) {
    allTeamsDraftBoard.textContent = "Connecting to ESPN public draft sync.";
    if (allTeamsDraftSummary) allTeamsDraftSummary.textContent = "Waiting for ESPN.";
    return;
  }
  const teams = liveDraftTeamsBySlot();
  const picks = liveDraft?.picks || [];
  const completed = Number(liveDraft.completedPicks || 0);
  const total = Number(liveDraft.totalPicks || picks.length || 0);
  if (allTeamsDraftSummary) {
    const fallbackLabel = liveDraft.draftSyncMode === "rosterFallback" ? " / roster fallback" : "";
    allTeamsDraftSummary.textContent = `${completed}/${total || leagueTeamTotal() * draftRoundTotal()} picks complete${fallbackLabel}`;
  }
  if (!teams.length || !picks.length) {
    allTeamsDraftBoard.innerHTML = emptyStateHtml(
      "Waiting for ESPN draft board",
      "Keep Auto sync on, then hit Sync Now once the room publishes order or the first pick.",
      ["The grid fills by team slot as ESPN records each pick.", "Use My ESPN Team above first so your build stays personalized."],
      "watch",
    );
    return;
  }
  const roundCount = draftBoardRoundCount(picks);
  allTeamsDraftBoard.innerHTML = `
    <div class="draft-board-scroll" role="region" aria-label="Live ESPN draft board by team">
      <div class="draft-board-grid" style="--draft-team-count: ${teams.length}; --draft-round-count: ${roundCount};">
        ${teams
          .map((team, index) => {
      const teamPicks = picks
        .filter((pick) => String(pick.teamId) === String(team.teamId))
        .sort((a, b) => Number(a.overall || 0) - Number(b.overall || 0));
      const draftedCount = teamPicks.filter((pick) => pick.status === "drafted").length;
      const isMine = String(team.teamId) === String(selectedTeamId());
      const picksByRound = new Map(teamPicks.map((pick) => [Number(pick.round || 0), pick]));
      return `<section class="draft-board-column ${isMine ? "mine" : ""}">
        <header class="draft-board-team">
          <span>Slot ${index + 1}${isMine ? " / You" : ""}</span>
          <strong>${htmlEscape(team.teamName)}</strong>
          <small>${htmlEscape(team.manager || "Manager TBD")} / ${draftedCount}/${teamPicks.length || roundCount}</small>
        </header>
        ${Array.from({ length: roundCount }, (_, roundIndex) => draftBoardPickTile(picksByRound.get(roundIndex + 1), roundIndex + 1)).join("")}
      </section>`;
    })
          .join("")}
      </div>
    </div>
  `;
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
    syncMode: data.draftSyncMode || "",
    draftScheduledAt: data.draftScheduledAt || "",
    draftTimePerSelection: Number(data.draftTimePerSelection || 0),
    rosteredCount: (data.rosteredNames || []).length,
    fallbackStates: (data.fallbackStates || []).join("|"),
    currentOverall: Number(current.overall || 0),
    currentTeam: current.fantasyTeam || "",
    currentManager: current.manager || "",
    draftedCount: (data.draftedNames || []).length,
    teams: (data.teams || []).length,
    teamNames: (data.teams || []).map((team) => team.teamName || team.name || team.fantasyTeam || "").join("|"),
    recent: recent.map((pick) => `${pick.overall || ""}:${pick.player || pick.playerName || ""}`).join("|"),
    next: next.map((pick) => `${pick.overall || ""}:${pick.fantasyTeam || ""}`).join("|"),
    draftOrder: draftOrder.map((pick) => `${pick.overall || ""}:${pick.roundPick || ""}:${pick.fantasyTeam || ""}`).join("|"),
    staleError: data.staleError || "",
  });
}

function liveSyncIntervalMs(data = liveDraft) {
  if (liveSyncFailureCount > 0) {
    return Math.min(LIVE_SYNC_ERROR_INTERVAL_MS * liveSyncFailureCount, 60000);
  }
  if (!data) return LIVE_SYNC_PREDRAFT_INTERVAL_MS;
  if (data.drafted) return LIVE_SYNC_COMPLETE_INTERVAL_MS;
  if (data.inProgress || Number(data.completedPicks || 0) > 0) return LIVE_SYNC_DRAFT_INTERVAL_MS;
  return LIVE_SYNC_PREDRAFT_INTERVAL_MS;
}

function liveSyncCadenceLabel(data = liveDraft) {
  const seconds = Math.round(liveSyncIntervalMs(data) / 1000);
  if (liveSyncFailureCount > 0) return `ESPN sync is backing off for ${seconds} seconds after a connection issue.`;
  if (data?.drafted) return `Draft is complete; auto sync checks ESPN every ${seconds} seconds.`;
  if (data?.inProgress || Number(data?.completedPicks || 0) > 0) {
    return `Draft-day turbo sync checks ESPN about every ${seconds} seconds.`;
  }
  return `Pre-draft auto sync checks ESPN every ${seconds} seconds.`;
}

function renderLiveDraftSummary() {
  if (!liveDraft) {
    if (liveStatus) liveStatus.textContent = "Connecting to ESPN public draft sync...";
    renderPreDraftPanel();
    renderDraftPrep();
    renderLeagueHealth();
    return;
  }

  const current = liveDraft.currentPick;
  const completed = Number(liveDraft.completedPicks || 0);
  const total = Number(liveDraft.totalPicks || 0);
  const totalFallback = leagueTeamTotal() * draftRoundTotal();
  const pct = total || totalFallback ? Math.round((completed / (total || totalFallback)) * 100) : 0;
  const stale = liveDraft.staleError ? ` ESPN sync is delayed. FantasyIQ is using cached board mode. Click Sync Now or continue with manual draft tracking. ${liveDraft.staleError}` : "";
  const syncWarnings = Array.isArray(liveDraft.fallbackStates) && liveDraft.fallbackStates.length
    ? ` ${liveDraft.fallbackStates.join(" ")}`
    : "";
  const preDraft = isPreDraftLeague();
  const state = liveDraft.inProgress ? "Draft live" : liveDraft.drafted ? "Draft complete" : preDraft ? "Pre-draft board ready" : "Draft board loaded";
  const sourceNote = liveDraft.draftSyncMode === "rosterFallback"
    ? " ESPN roster fallback is active for drafted-player filtering."
    : liveDraft.draftSyncMode === "espnDraftRoomBridge"
      ? " ESPN public picks are hidden, so FantasyIQ is using authenticated draft-room bridge events."
    : liveDraft.draftSyncMode === "espnLiveHidden"
      ? " ESPN has started this draft but is not exposing live picks through the public feed. Use the drafted-player paste importer below."
    : "";
  const draftOverride = activeDraftLeagueOverride();
  const overrideNote = draftOverride?.leagueId
    ? ` Draft-room override is using ESPN league ${draftOverride.leagueId}.`
    : "";
  const manualNote = manualDraftOverrides.length
    ? ` Manual tracker has ${manualDraftOverrides.length} pick${manualDraftOverrides.length === 1 ? "" : "s"}. <button type="button" class="inline-sync-action" data-clear-manual-draft>Clear manual picks</button>`
    : "";
  const syncContext = liveDraft.demoMode
    ? " Public demo league is connected; subscribers get their ESPN league configured after checkout."
    : preDraft
      ? " ESPN order is loaded; keep auto sync on when the room opens."
      : ` ${liveSyncCadenceLabel()}`;

  if (liveStatus) {
    liveStatus.innerHTML = `<strong>${state}</strong>: ${completed}/${total || totalFallback} picks completed.${syncContext}${overrideNote}${sourceNote}${syncWarnings}${manualNote}${stale}`;
  }
  if (liveSyncStatus) {
    liveSyncStatus.textContent = liveDraft.demoMode ? "Demo league connected" : liveDraft.inProgress ? "Draft live" : preDraft ? "Pre-draft ready" : "ESPN connected";
  }
  if (liveCurrentPick) {
    liveCurrentPick.textContent = current ? `Round ${current.round}, Pick ${current.roundPick}` : "Draft complete";
  }
  if (liveCurrentTeam) {
    liveCurrentTeam.textContent = preDraft && selectedTeamId()
      ? preDraftSlotSummary()
      : current
        ? `Overall ${current.overall}: ${current.fantasyTeam}${current.manager ? ` / ${current.manager}` : ""}`
        : "All picks are complete.";
  }
  if (liveCompleted) liveCompleted.textContent = String(completed);
  if (liveTotal) liveTotal.textContent = `of ${total || totalFallback}`;
  if (liveProgressBar) liveProgressBar.style.width = `${pct}%`;
  if (liveLastSync) liveLastSync.textContent = formatSyncTime(liveDraft.syncedAt);
  if (liveSource) {
    liveSource.textContent = liveDraft.demoMode
      ? "ESPN public demo league"
      : liveDraft.draftSyncMode === "rosterFallback"
        ? "ESPN roster fallback"
        : liveDraft.draftSyncMode === "espnDraftRoomBridge"
          ? "ESPN draft-room bridge"
        : liveDraft.draftSyncMode === "espnLiveHidden"
          ? "ESPN live picks hidden"
        : activeDraftLeagueOverride()?.leagueId
          ? `ESPN override ${activeDraftLeagueOverride().leagueId}`
        : liveDraft.source || "ESPN public league API";
  }
  renderLiveDraftSlot();
  renderPreDraftPanel();
  renderDraftPrep();
  renderLeagueHealth();
}

function renderLiveDraft(options = {}) {
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
  renderDraftPrep();

  renderRecommendations();
  renderMyRoster();
  renderNextPickRadar();
  renderTierAlerts();
  renderRoomDetector();
  renderRiskMeter();
  renderRosterEngines();
  renderCheatcodeMode();
  renderPickCards(liveRecentPicks, liveDraft.recentPicks, isPreDraftLeague() ? preDraftRecentPicksEmpty() : "No picks have been made yet.");
  renderPickCards(liveNextPicks, liveDraft.nextPicks, "No upcoming picks found.");
  renderLiveTierBoard();
  renderDraftOrder();
  renderAllTeamsDraftBoard();
  renderBoard();
  lastLiveDraftRenderSignature = liveDraftRenderSignature();
}
