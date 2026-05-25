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

function simCache() {
  if (!mockSim) return null;
  if (!mockSim.cache) {
    mockSim.cache = {
      availableRows: null,
      tierInfo: {},
      recentCounts: {},
      futurePick: {},
      recommendationTargetOverall: undefined,
    };
  }
  return mockSim.cache;
}

function simInvalidateCache() {
  if (mockSim) mockSim.cache = null;
}

function simAvailableRows() {
  if (!boardData || !mockSim) return [];
  const cache = simCache();
  if (cache?.availableRows) return cache.availableRows;
  const rows = (boardData.boards?.combined?.rows || []).filter((row) => !mockSim.drafted.has(normalizePlayerName(row.Player)));
  if (cache) cache.availableRows = rows;
  return rows;
}

function simRecentPicks(limit = Math.min(12, leagueTeamTotal())) {
  return (mockSim?.picks || []).slice(-limit).reverse();
}

function simRecentPositionCounts(limit = Math.min(10, leagueTeamTotal())) {
  const cache = simCache();
  const key = String(limit);
  if (cache?.recentCounts?.[key]) return cache.recentCounts[key];
  const counts = {};
  simRecentPicks(limit).forEach((pick) => {
    counts[pick.row.Pos] = (counts[pick.row.Pos] || 0) + 1;
  });
  if (cache) cache.recentCounts[key] = counts;
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
  const cache = simCache();
  if (cache && cache.recommendationTargetOverall !== undefined) return cache.recommendationTargetOverall;
  const upcoming = simFutureUserPicks();
  const target = !upcoming.length ? null : upcoming[0] === mockSim.currentOverall && upcoming[1] ? upcoming[1] : upcoming[0];
  if (cache) cache.recommendationTargetOverall = target;
  return target;
}

function simTopTierInfo(pos) {
  const cache = simCache();
  if (cache?.tierInfo?.[pos]) return cache.tierInfo[pos];
  const rows = simAvailableRows().filter((row) => row.Pos === pos).sort((a, b) => Number(a.Rank) - Number(b.Rank));
  if (!rows.length) {
    const empty = { pos, tier: "Empty", count: 0, rows: [] };
    if (cache) cache.tierInfo[pos] = empty;
    return empty;
  }
  const tier = rows[0]["Pos Tier"] || rows[0].Category || "Top tier";
  const tierRows = rows.filter((row) => (row["Pos Tier"] || row.Category) === tier);
  const info = { pos, tier, count: tierRows.length, rows: tierRows };
  if (cache) cache.tierInfo[pos] = info;
  return info;
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

function simRecommendationScore(row, counts, decision = simDecision(row, counts)) {
  const round = simRound();
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
  const fromOverall = (mockSim?.currentOverall || 1) + 1;
  const cache = simCache();
  const key = `${slot}:${fromOverall}`;
  let next = cache?.futurePick?.[key];
  if (next === undefined) {
    next = simFuturePicksForSlot(slot, fromOverall)[0] || null;
    if (cache) cache.futurePick[key] = next;
  }
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
  const expert = udkAlignmentSignal(row);
  const tier = simTopTierInfo(row.Pos);
  const rank = Number(row.Rank || 999);
  const value = leagueValueScore(row);
  const upside = Number(row.Upside || row.Ceiling || 0);
  const risk = Number(row.Risk || 0);
  const needScore = rosterNeedScoreAdjustment(row, counts, round);
  let score = 1900 - rank * profile.rank + value * 8 * profile.value;

  score += needScore * profile.need;
  score += clampNumber(momentum.score * 7 * profile.market, -120, 145);
  score += clampNumber(expert.score * 18 * profile.market, -90, 90);
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

function simRecommendationRows() {
  const rows = simAvailableRows();
  const horizon = mockSim ? mockSim.currentOverall + leagueTeamTotal() * 10 : 160;
  return rows.slice(0, Math.min(rows.length, Math.max(140, horizon)));
}

function simTopRecommendations() {
  if (!mockSim) return [];
  const counts = simTeam(mockSim.userSlot).counts;
  return simRecommendationRows()
    .map((row) => {
      const decision = simDecision(row, counts);
      return { row, score: simRecommendationScore(row, counts, decision), decision };
    })
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
  simInvalidateCache();
}

function simOpponentPick() {
  if (!mockSim || mockSim.currentOverall > simTotalPicks()) return;
  const slot = simSlotFromOverall(mockSim.currentOverall);
  const team = simTeam(slot);
  const candidates = simAvailableRows().slice(0, Math.min(140, Math.max(70, leagueTeamTotal() * 11)));
  const row = candidates.reduce(
    (best, candidate) => {
      const score = simBotScore(candidate, team.counts, slot);
      return !best || score > best.score ? { row: candidate, score } : best;
    },
    null
  )?.row;
  if (!row) {
    mockSim.currentOverall = simTotalPicks() + 1;
    return;
  }
  simAddPick(slot, row, false);
}

function clearSimAutoAdvance() {
  if (simAutoAdvanceTimer) window.clearTimeout(simAutoAdvanceTimer);
  simAutoAdvanceTimer = null;
  simAutoAdvanceActive = false;
}

function simNeedsAutoAdvance() {
  return Boolean(mockSim && mockSim.currentOverall <= simTotalPicks() && simSlotFromOverall(mockSim.currentOverall) !== mockSim.userSlot);
}

function simAdvanceChunk() {
  if (!mockSim) {
    clearSimAutoAdvance();
    renderMockSimulator();
    return;
  }
  const startedAt = performance.now();
  let picks = 0;
  while (simNeedsAutoAdvance() && picks < 6 && performance.now() - startedAt < 12) {
    const before = mockSim.currentOverall;
    simOpponentPick();
    picks += 1;
    if (mockSim.currentOverall === before) {
      mockSim.currentOverall = simTotalPicks() + 1;
      break;
    }
  }

  if (simNeedsAutoAdvance()) {
    renderMockSimulator();
    simAutoAdvanceTimer = window.setTimeout(simAdvanceChunk, 0);
    return;
  }

  simAutoAdvanceTimer = null;
  simAutoAdvanceActive = false;
  renderMockSimulator();
}

function simAdvanceToUserPick() {
  if (!mockSim) return;
  if (!simNeedsAutoAdvance()) {
    renderMockSimulator();
    return;
  }
  if (simAutoAdvanceTimer) window.clearTimeout(simAutoAdvanceTimer);
  simAutoAdvanceActive = true;
  renderMockSimulator();
  simAutoAdvanceTimer = window.setTimeout(simAdvanceChunk, 0);
}

function simStartDraft() {
  if (!boardData) {
    if (simStatus) simStatus.innerHTML = "<strong>Board data is still loading.</strong> Try again in a second.";
    return;
  }
  clearSimAutoAdvance();
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
    cache: null,
  };
  localStorage.setItem(loadoutStorageKey("sim-slot"), selectedSlot);
  simAdvanceToUserPick();
  renderMockSimulator();
}

function simResetDraft() {
  clearSimAutoAdvance();
  mockSim = null;
  renderMockSimulator();
}

function simDraftPlayer(playerKey) {
  if (simAutoAdvanceActive) return;
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
    <button type="button" class="sim-draft-button" ${simAutoAdvanceActive ? "disabled" : ""} data-sim-player="${normalizePlayerName(row.Player)}">Draft</button>
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
  if (simAutoAdvanceActive) {
    simRecommendations.textContent = "Auto-drafting the room to your next pick...";
    return;
  }
  if (simSlotFromOverall(mockSim.currentOverall) !== mockSim.userSlot) {
    simRecommendations.textContent = "Auto-draft to your next pick to resume practice.";
    return;
  }
  const recommendations = simTopRecommendations();
  const waits = recommendations.filter((item) => item.decision.label === "Can wait").slice(0, 3);
  const pickNow = recommendations.filter((item) => !["Can wait", "Wait"].includes(item.decision.label)).slice(0, 5);
  const avoids = simRecommendationRows()
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
  if (simAutoAdvanceActive) {
    simAvailable.textContent = "Auto-drafting the room. Player buttons unlock when you are back on the clock.";
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
    canDraft: isUserPick && !simAutoAdvanceActive,
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
    ? `<strong>${simAutoAdvanceActive ? "Auto-drafting to your next pick." : userPick ? "You are on the clock." : "Mock in progress."}</strong> Slot ${mockSim.userSlot}, ${completed}/${totalPicks} picks complete. CPU managers now draft with value, scarcity, market${boardData?.externalSignals?.udk?.available ? ", expert alignment," : ","} and roster-build profiles.`
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
  if (simAuto) simAuto.disabled = !active || mockSim.currentOverall > totalPicks || userPick || simAutoAdvanceActive;

  if (simAutoAdvanceActive) {
    renderSimRecommendations();
    renderSimAvailable();
    return;
  }

  renderSimIntel();
  renderSimRecommendations();
  renderSimAvailable();
  renderSimRoster();
  renderSimLog();
}

function externalMockSettings() {
  const scoringType = normalizeScoringType(externalMockScoring?.value || "ppr");
  const receptionPoints = scoringType === "standard" ? 0 : scoringType === "half-ppr" ? 0.5 : 1;
  const teamCount = Number(externalMockTeams?.value || 12);
  const draftSlot = clampNumber(Number(externalMockSlot?.value || teamCount), 1, teamCount);
  return {
    teamCount,
    draftSlot,
    scoringType,
    scoringLabel: SCORING_LABELS[scoringType] || "Full PPR",
    receptionPoints,
    lineupSlots: {
      ...DEFAULT_LINEUP_SLOTS,
      FLEX: externalMockDoubleFlex?.checked ? 2 : 1,
      SUPERFLEX: externalMockSuperflex?.checked ? 1 : 0,
    },
  };
}

function syncExternalMockSlots() {
  if (!externalMockSlot) return;
  const teamCount = Number(externalMockTeams?.value || 12);
  const previous = clampNumber(Number(externalMockSlot.value || teamCount), 1, teamCount);
  externalMockSlot.innerHTML = Array.from({ length: teamCount }, (_, index) => {
    const slot = index + 1;
    return `<option value="${slot}">${slot}</option>`;
  }).join("");
  externalMockSlot.value = String(previous);
}

function externalSnakePickForRosterPick(rosterPickIndex, settings) {
  const teamCount = Number(settings.teamCount || 12);
  const slot = clampNumber(Number(settings.draftSlot || teamCount), 1, teamCount);
  const round = rosterPickIndex + 1;
  const pickInRound = round % 2 === 1 ? slot : teamCount + 1 - slot;
  return {
    overall: (round - 1) * teamCount + pickInRound,
    round,
    roundPick: pickInRound,
  };
}

function explicitExternalPickFromLine(line, settings) {
  const text = String(line || "").trim();
  const teamCount = Number(settings.teamCount || 12);
  const roundPick = text.match(/^\s*(?:round|rd)?\s*(\d{1,2})\s*(?:[.]|(?:\s*(?:pick|pk)\s*))\s*(\d{1,2})\b/i);
  if (roundPick) {
    const round = Number(roundPick[1]);
    const pickInRound = Number(roundPick[2]);
    if (round >= 1 && pickInRound >= 1 && pickInRound <= teamCount) {
      return { overall: (round - 1) * teamCount + pickInRound, round, roundPick: pickInRound };
    }
  }
  const overall = text.match(/^\s*(?:pick|pk)\s*(\d{1,3})\b/i);
  if (overall) {
    const pick = Number(overall[1]);
    if (pick >= 1) {
      return {
        overall: pick,
        round: Math.floor((pick - 1) / teamCount) + 1,
        roundPick: ((pick - 1) % teamCount) + 1,
      };
    }
  }
  return null;
}

function externalPickSlotLabel(pick) {
  return `R${pick.round}.${String(pick.roundPick).padStart(2, "0")} / Overall ${pick.overall}`;
}

function externalProjectionValue(row, settings) {
  const base = Number(row?.["Native Projection"] || row?.["Proj PPR Pts"] || 0);
  if (!base) return 0;
  if (rowUsesNativeScoring(row)) return Math.max(0, base);
  const receptionDelta = Math.max(0, 1 - Number(settings.receptionPoints ?? 1));
  return Math.max(0, base - estimatedReceptions(row) * receptionDelta);
}

function externalLeagueValueScore(row, settings) {
  if (!row) return 0;
  const slots = settings.lineupSlots || DEFAULT_LINEUP_SLOTS;
  const teamCount = Number(settings.teamCount || 12);
  const posRank = Number(row["Pos Rank"] || 99);
  let score = Number(row["Value Score"] || 0);

  if (!rowUsesNativeScoring(row)) {
    if (settings.scoringType === "half-ppr") score -= Math.min(4, estimatedReceptions(row) / 24);
    if (settings.scoringType === "standard") score -= Math.min(8, estimatedReceptions(row) / 12);
  }
  if (slots.SUPERFLEX && row.Pos === "QB") score += Math.max(10, 32 - posRank * 0.7);
  if (!slots.SUPERFLEX && row.Pos === "QB" && teamCount <= 10) score -= 4;
  if (slots.FLEX >= 2 && ["RB", "WR"].includes(row.Pos)) score += 4.5;
  if (slots.FLEX >= 2 && row.Pos === "TE") score += 1.5;
  if (teamCount >= 14 && ["RB", "WR"].includes(row.Pos)) score += 3;
  score += clampNumber(externalTrendScore(row) * 0.22, -4, 4);
  score += clampNumber(udkSignalScore(row), -3, 4);
  if (!slots.K && row.Pos === "K") score -= 25;
  if (!slots.DST && row.Pos === "DST") score -= 25;
  return Math.round(score * 10) / 10;
}

function externalExpectedPickFor(row, settings) {
  if (!row) return 999;
  const posRank = Number(row["Pos Rank"] || 99);
  let expected = Number(row.Rank || 999);
  if (settings.lineupSlots.SUPERFLEX && row.Pos === "QB") expected -= Math.max(0, 30 - posRank) * 0.9;
  if (!settings.lineupSlots.SUPERFLEX && row.Pos === "QB" && Number(settings.teamCount || 12) <= 10) expected += 10;
  if (settings.lineupSlots.FLEX >= 2 && ["RB", "WR"].includes(row.Pos)) expected -= 4;
  if (settings.scoringType === "standard" && ["WR", "TE"].includes(row.Pos)) expected += Math.min(8, estimatedReceptions(row) / 10);
  if (settings.scoringType === "standard" && row.Pos === "RB") expected -= 2;
  if (Number(settings.teamCount || 12) >= 14 && ["RB", "WR"].includes(row.Pos)) expected -= 3;
  return Math.max(1, Math.round(expected));
}

function cleanExternalMockLine(line) {
  return String(line || "")
    .replace(/^\s*[-*]\s*/, "")
    .replace(/^\s*(round|rd)\s*\d{1,2}\s*(pick|pk)?\s*\d{0,2}\s*[-:.)]?\s*/i, "")
    .replace(/^\s*(pick|pk)\s*\d{1,3}\s*[-:.)]?\s*/i, "")
    .replace(/^\s*(round|rd)?\s*\d{1,2}\s*(pick|pk)?\s*\d{0,2}\s*[:.)-]\s*/i, "")
    .replace(/^\s*\d{1,2}\.\d{1,2}\s*[-.)]?\s*/i, "")
    .replace(/^\s*\d{1,3}\s*[-.)]\s*/i, "")
    .replace(/\s+\((QB|RB|WR|TE|DST|K)[^)]+\)$/i, "")
    .replace(/\s+\b(QB|RB|WR|TE|DST|K)\b\s+[A-Z]{2,4}$/i, "")
    .replace(/\s+\b(QB|RB|WR|TE|DST|K)\b$/i, "")
    .trim();
}

function externalMockPickGrade(overall, row, settings) {
  if (!row) return { label: "Unmatched", className: "watch", delta: 0, detail: "Player was not matched to the FantasyIQ board." };
  const expected = externalExpectedPickFor(row, settings);
  const delta = expected - overall;
  if (delta >= 18) return { label: "Steal", className: "smash", delta, detail: `${row.Player} was ${delta} spots cheaper than format-adjusted rank.` };
  if (delta >= 6) return { label: "Good value", className: "target", delta, detail: `${row.Player} beat format-adjusted board value by ${delta} spots.` };
  if (delta >= -8) return { label: "Fair", className: "target", delta, detail: `${row.Player} was close to fair value for this format.` };
  return { label: "Reach", className: "wait", delta, detail: `${row.Player} was ${Math.abs(delta)} spots ahead of adjusted board value.` };
}

function externalMockRosterTargets(settings) {
  const slots = settings.lineupSlots || DEFAULT_LINEUP_SLOTS;
  const starters = {
    QB: 1 + Number(slots.SUPERFLEX || 0),
    RB: Number(slots.RB || 2),
    WR: Number(slots.WR || 2),
    TE: Number(slots.TE || 1),
    DST: Number(slots.DST || 1),
    K: Number(slots.K || 1),
  };
  const flex = Number(slots.FLEX || 1);
  return {
    starters,
    flex,
    targets: {
      QB: slots.SUPERFLEX ? 3 : Number(settings.teamCount || 12) <= 10 ? 1 : 2,
      RB: 4 + flex,
      WR: 4 + flex,
      TE: 2,
      DST: 1,
      K: 1,
    },
  };
}

function externalMockLetter(score) {
  if (score >= 93) return "A";
  if (score >= 86) return "B+";
  if (score >= 80) return "B";
  if (score >= 73) return "C+";
  if (score >= 67) return "C";
  if (score >= 58) return "D";
  return "F";
}

function gradeExternalMockDraft() {
  if (!externalMockOutput) return;
  if (!boardData) {
    externalMockOutput.innerHTML = "<strong>Board data is still loading.</strong> Try again in a second.";
    return;
  }
  const lines = parseLines(externalMockPicks?.value || "");
  if (!lines.length) {
    externalMockOutput.innerHTML = "Choose your draft spot, then paste player names from an outside mock draft to get a format-aware grade, build notes, reaches, steals, and roster fixes.";
    return;
  }

  const settings = externalMockSettings();
  const plan = externalMockRosterTargets(settings);
  const picks = lines.map((line, index) => {
    const clean = cleanExternalMockLine(line);
    const row = findPlayer(clean);
    const inferredPick = explicitExternalPickFromLine(line, settings) || externalSnakePickForRosterPick(index, settings);
    const overall = inferredPick.overall;
    const grade = externalMockPickGrade(overall, row, settings);
    return {
      line,
      clean,
      row,
      overall,
      round: inferredPick.round,
      roundPick: inferredPick.roundPick,
      grade,
      value: row ? externalLeagueValueScore(row, settings) : 0,
      projection: row ? externalProjectionValue(row, settings) : 0,
      risk: row ? Number(row.Risk || 0) : 0,
    };
  });
  const matched = picks.filter((pick) => pick.row);
  const unmatched = picks.filter((pick) => !pick.row);
  const counts = positionCounts(matched);
  const completion = Math.min(1, matched.length / Math.max(1, lines.length));
  const flexEligible = Number(counts.RB || 0) + Number(counts.WR || 0) + Number(counts.TE || 0);
  const avgRisk = matched.length ? matched.reduce((sum, pick) => sum + pick.risk, 0) / matched.length : 0;
  let score = 82;
  const notes = ["This grades an external mock only; it does not change your FantasyIQ live room or simulator draft."];

  picks.forEach((pick) => {
    if (!pick.row) {
      score -= 2;
      return;
    }
    if (pick.grade.label === "Steal") score += 3;
    if (pick.grade.label === "Good value") score += 1.5;
    if (pick.grade.label === "Reach") score += pick.grade.delta <= -24 ? -5 : -3;
    if (["K", "DST"].includes(pick.row.Pos) && pick.round < Math.max(1, Math.ceil(lines.length / Number(settings.teamCount || 12)) - 1)) {
      score -= 4;
      notes.push(`${pick.row.Pos} came before the final rounds.`);
    }
  });

  ["QB", "RB", "WR", "TE"].forEach((pos) => {
    const needed = Number(plan.starters[pos] || 0);
    const have = Number(counts[pos] || 0);
    if (have < needed && completion >= 0.55) {
      const penalty = pos === "QB" && settings.lineupSlots.SUPERFLEX ? 12 : 8;
      score -= penalty * (needed - have);
      notes.push(`${pos} starter slot is still thin for this format.`);
    }
  });
  if (settings.lineupSlots.SUPERFLEX && Number(counts.QB || 0) < 2 && matched.length >= 5) {
    score -= 10;
    notes.push("Superflex builds need two playable QBs early enough to avoid chasing.");
  }
  if (flexEligible < Number(plan.starters.RB || 0) + Number(plan.starters.WR || 0) + Number(plan.flex || 0) && completion >= 0.65) {
    score -= 8;
    notes.push("RB/WR/TE volume is light for the flex spots.");
  }
  if (Number(counts.RB || 0) < Math.min(plan.targets.RB, 4) && matched.length >= 8) {
    score -= 6;
    notes.push("RB depth is behind the target build.");
  }
  if (Number(counts.WR || 0) < Math.min(plan.targets.WR, 4) && matched.length >= 8) {
    score -= 6;
    notes.push("WR depth is behind the target build.");
  }
  if (avgRisk >= 6 && matched.length >= 5) {
    score -= 5;
    notes.push("Risk stack is high; pair upside with safer volume.");
  }
  if (unmatched.length) notes.push(`${unmatched.length} pasted line${unmatched.length === 1 ? "" : "s"} did not match the FantasyIQ board.`);

  score = Math.round(clampNumber(score, 0, 100));
  const steals = picks.filter((pick) => pick.grade.label === "Steal").length;
  const reaches = picks.filter((pick) => pick.grade.label === "Reach").length;
  const best = matched.reduce((top, pick) => (!top || pick.value > top.value ? pick : top), null);
  const formatParts = [
    settings.scoringLabel,
    `${settings.teamCount} teams`,
    `Draft spot ${settings.draftSlot}`,
    settings.lineupSlots.SUPERFLEX ? "Superflex" : "1QB",
    settings.lineupSlots.FLEX >= 2 ? "Double flex" : "Single flex",
  ];
  const pickCards = picks.slice(0, 18).map((pick) => {
    const title = pick.row ? `${pick.row.Player} / ${pick.row.Pos} / ${pick.row.Team}` : pick.clean || pick.line;
    return `<div class="pick-card recommendation ${pick.grade.className}">
      <span>${externalPickSlotLabel(pick)}</span>
      <strong>${htmlEscape(title)}</strong>
      <em>${htmlEscape(pick.grade.label)}</em>
      <small>${htmlEscape(pick.grade.detail)}${pick.row ? ` Value ${pick.value.toFixed(1)} / Projection ${pick.projection ? pick.projection.toFixed(1) : "TBD"}.` : ""}</small>
    </div>`;
  });

  externalMockOutput.innerHTML = `
    <div class="external-grade-summary">
      <article>
        <span>External Mock Grade</span>
        <strong>${externalMockLetter(score)} (${score})</strong>
        <small>${htmlEscape(formatParts.join(" / "))}</small>
      </article>
      <article>
        <span>Value Hits</span>
        <strong>${steals} steals</strong>
        <small>${reaches} reach${reaches === 1 ? "" : "es"} flagged</small>
      </article>
      <article>
        <span>Roster Shape</span>
        <strong>QB ${counts.QB || 0} / RB ${counts.RB || 0} / WR ${counts.WR || 0} / TE ${counts.TE || 0}</strong>
        <small>${best ? `Best value: ${best.row.Player}` : "No matched players yet."}</small>
      </article>
    </div>
    <div class="external-grade-notes">
      ${notes.slice(0, 6).map((note) => `<p>${htmlEscape(note)}</p>`).join("")}
    </div>
    <div class="external-grade-picks">${pickCards.join("")}</div>
  `;
}

function clearExternalMockDraft() {
  if (externalMockPicks) externalMockPicks.value = "";
  gradeExternalMockDraft();
}
