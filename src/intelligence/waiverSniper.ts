import type { DataFreshness, LeagueContext, PlayerPosition, Position } from "./liveDraftPhase1";
import type { PlayoffContext, WeeklyFreeAgent, WeeklyMatchupContext, WeeklyPlayer } from "./weeklyCommandCenter";

export type WaiverRecommendationClass = "ONE_WEEK_STREAMER" | "SEASON_LONG_ACCUMULATOR";
export type WaiverAction = "ACT_NOW" | "WAIT" | "AVOID";

export interface WaiverSignalPlayer extends WeeklyFreeAgent {
  snapShare?: number;
  snapShareTrend?: number;
  routeParticipation?: number;
  routeParticipationTrend?: number;
  targetShare?: number;
  targetShareTrend?: number;
  carryShare?: number;
  carryShareTrend?: number;
  redZoneUsage?: number;
  expectedFantasyPoints?: number;
  injuryAheadOfPlayer?: boolean;
  roleChangeSignal?: number;
  scheduleImprovement?: number;
  opponentWeakness?: number;
  projectedRoleDurationWeeks?: number;
  addDropMomentum?: number;
}

export interface WaiverSniperContext extends LeagueContext {
  currentWeek: number;
  seasonPhase: "regular_season" | "playoffs";
  currentRosterConstruction: WeeklyPlayer[];
  liveFreeAgents: WaiverSignalPlayer[];
  weeklyMatchup?: WeeklyMatchupContext;
  playoffContext?: PlayoffContext;
  waiverSettings?: {
    mode?: "FAAB" | "WAIVER_PRIORITY" | "FREE_AGENT";
    waiverPriority?: number;
    waiverRunsAt?: string;
    minimumBid?: number;
  };
  faabBudget?: number;
  remainingFaabBudget?: number;
  leagueCompetitiveness?: number;
}

export interface FaabBidRange {
  min: number;
  max: number;
  aggression: "none" | "low" | "medium" | "high" | "empty_the_clip";
  rationale: string;
}

export interface WaiverAddRecommendation {
  recommendationClass: WaiverRecommendationClass;
  action: WaiverAction;
  mainMove: string;
  add: WaiverSignalPlayer;
  drop: WeeklyPlayer;
  projectedVorGain: number;
  weeklyPointGain: number;
  restOfSeasonGain: number;
  rosterConstructionImpact: number;
  faabBidRange: FaabBidRange;
  waiverPriorityAggression: "hold_priority" | "normal_claim" | "aggressive_claim";
  confidenceScore: number;
  dataFreshnessStatus: string;
  supportingQuantitativeReasons: [string, string, string];
  riskWarning: string;
  alternativePath: string;
  missingDataWarnings: string[];
  fallbackLogicUsed: string[];
}

export interface WaiverSniperSnapshot {
  recommendation: WaiverAddRecommendation;
  recommendations: WaiverAddRecommendation[];
  doNothingComparison: string;
  replacementValues: Record<PlayerPosition, number>;
  missingDataWarnings: string[];
  fallbackLogicUsed: string[];
  generatedAt: string;
}

interface ResolvedWaiverContext {
  startingSlots: Required<Record<Position, number>>;
  benchSize: number;
  totalTeams: number;
  currentWeek: number;
  seasonPhase: WaiverSniperContext["seasonPhase"];
  roster: WeeklyPlayer[];
  freeAgents: WaiverSignalPlayer[];
  weeklyMatchup: WeeklyMatchupContext;
  playoffContext: PlayoffContext;
  waiverMode: "FAAB" | "WAIVER_PRIORITY" | "FREE_AGENT";
  waiverPriority?: number;
  faabBudget: number;
  remainingFaabBudget: number;
  leagueCompetitiveness: number;
  dataFreshness: DataFreshness[];
  warnings: string[];
  fallbacks: string[];
}

const PLAYER_POSITIONS: PlayerPosition[] = ["QB", "RB", "WR", "TE", "DST", "K"];
const FLEX_POSITIONS = new Set<PlayerPosition>(["RB", "WR", "TE"]);
const SUPERFLEX_POSITIONS = new Set<PlayerPosition>(["QB", "RB", "WR", "TE"]);
const DEFAULT_STARTING_SLOTS: Required<Record<Position, number>> = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 1,
  SUPERFLEX: 0,
  DST: 1,
  K: 1,
};

export function generateWaiverSniper(context: WaiverSniperContext): WaiverSniperSnapshot {
  const resolved = resolveWaiverContext(context);
  const replacementValues = calculateReplacementValues(resolved);
  const currentLineup = buildOptimalLineup(resolved.roster, resolved.startingSlots);
  const dropPool = dropCandidates(resolved.roster, currentLineup, resolved);

  const recommendations = resolved.freeAgents
    .flatMap((add) => {
      const candidateDrops = prioritizedDropsFor(add, dropPool);
      return candidateDrops.slice(0, 3).map((drop) => evaluateAddDrop(add, drop, resolved, replacementValues, currentLineup));
    })
    .filter((item): item is WaiverAddRecommendation => Boolean(item))
    .sort(compareRecommendations)
    .slice(0, 18);

  const best = recommendations[0] ?? buildHoldRecommendation(resolved, replacementValues);
  const recommendation = best.action === "ACT_NOW" ? best : buildHoldRecommendation(resolved, replacementValues, best);

  return {
    recommendation,
    recommendations,
    doNothingComparison: compareAgainstDoingNothing(recommendation, recommendations[1]),
    replacementValues,
    missingDataWarnings: resolved.warnings,
    fallbackLogicUsed: resolved.fallbacks,
    generatedAt: new Date().toISOString(),
  };
}

function evaluateAddDrop(
  add: WaiverSignalPlayer,
  drop: WeeklyPlayer,
  context: ResolvedWaiverContext,
  replacementValues: Record<PlayerPosition, number>,
  currentLineup: LineupPlan,
): WaiverAddRecommendation | undefined {
  if (drop.isLocked) return undefined;

  const classification = classifyWaiverAdd(add, context);
  const addWeekly = weeklyProjection(add, context);
  const dropWeekly = weeklyProjection(drop, context);
  const addRos = restOfSeasonValue(add, context);
  const dropRos = restOfSeasonValue(drop, context);
  const projectedVorGain = round(addWeekly - Math.max(dropWeekly, replacementValues[add.position] ?? 0), 2);
  const weeklyPointGain = round(lineupGainAfterAddDrop(add, drop, context, currentLineup), 2);
  const restOfSeasonGain = round(addRos - dropRos, 2);
  const rosterConstructionImpact = round(rosterImpact(add, drop, context), 2);
  const riskDelta = playerRisk(drop, context) - playerRisk(add, context);
  const roleScore = roleOpportunityScore(add, context);
  const urgencyScore = round(
    projectedVorGain * 2.6 +
      weeklyPointGain * 3.2 +
      restOfSeasonGain * 0.42 +
      rosterConstructionImpact * 15 +
      roleScore * 14 +
      riskDelta * 1.6,
    2,
  );
  if (urgencyScore < 5 && projectedVorGain < 1.5 && restOfSeasonGain < 5) return undefined;

  const faabBidRange = faabBidRangeFor(add, {
    classification,
    projectedVorGain,
    weeklyPointGain,
    restOfSeasonGain,
    rosterConstructionImpact,
    urgencyScore,
    context,
  });
  const action = waiverActionFor(urgencyScore, faabBidRange, context);
  const confidenceScore = confidenceFor(add, drop, urgencyScore, context);

  return {
    recommendationClass: classification,
    action,
    mainMove: `Add ${add.name}; drop ${drop.name}`,
    add,
    drop,
    projectedVorGain,
    weeklyPointGain,
    restOfSeasonGain,
    rosterConstructionImpact,
    faabBidRange,
    waiverPriorityAggression: waiverPriorityAggressionFor(action, urgencyScore, context),
    confidenceScore,
    dataFreshnessStatus: dataFreshnessStatus(context),
    supportingQuantitativeReasons: [
      `${formatClass(classification)} score: ${formatNumber(classificationScore(add, classification, context) * 100)}/100 with ${formatNumber(roleScore * 100)}/100 role signal.`,
      `${formatSigned(projectedVorGain)} weekly VOR and ${formatSigned(weeklyPointGain)} active-lineup points versus dropping ${drop.name}.`,
      `${formatSigned(restOfSeasonGain)} rest-of-season value with ${formatSigned(rosterConstructionImpact * 100)}/100 roster construction impact.`,
    ],
    riskWarning: riskWarningFor(add, drop, classification, context),
    alternativePath: alternativePathFor(add, drop, action, context),
    missingDataWarnings: context.warnings,
    fallbackLogicUsed: context.fallbacks,
  };
}

function classifyWaiverAdd(add: WaiverSignalPlayer, context: ResolvedWaiverContext): WaiverRecommendationClass {
  const streamer = streamerScore(add, context);
  const accumulator = accumulatorScore(add, context);
  return streamer >= accumulator + 0.08 ? "ONE_WEEK_STREAMER" : "SEASON_LONG_ACCUMULATOR";
}

function streamerScore(add: WaiverSignalPlayer, context: ResolvedWaiverContext): number {
  const matchup = clamp((add.matchupRating ?? 0) / 30, -0.2, 0.35);
  const weakness = clamp((add.opponentWeakness ?? 0) / 100, 0, 0.3);
  const byeNeed = rosterPositionProblem(add.position, context) ? 0.22 : 0;
  const injuryFill = add.injuryAheadOfPlayer ? 0.18 : 0;
  const projectionEdge = clamp((weeklyProjection(add, context) - defaultReplacement(add.position)) / 12, 0, 0.35);
  const shortRole = clamp((add.projectedRoleDurationWeeks ?? 1) / 4, 0, 0.15);
  return clamp(0.18 + matchup + weakness + byeNeed + injuryFill + projectionEdge + shortRole, 0, 1);
}

function accumulatorScore(add: WaiverSignalPlayer, context: ResolvedWaiverContext): number {
  const utilization =
    trendScore(add.snapShareTrend) * 0.16 +
    trendScore(add.routeParticipationTrend) * 0.2 +
    trendScore(add.targetShareTrend) * 0.22 +
    trendScore(add.carryShareTrend) * 0.18;
  const role = clamp((add.roleChangeSignal ?? 0) / 100, 0, 0.18) + (add.injuryAheadOfPlayer ? 0.12 : 0);
  const schedule = clamp((add.scheduleImprovement ?? 0) / 100, -0.08, 0.12);
  const ros = clamp((restOfSeasonValue(add, context) - defaultRosReplacement(add.position)) / 40, 0, 0.28);
  const market = clamp((add.addDropMomentum ?? add.marketTrendScore ?? 0) / 100, -0.1, 0.12);
  return clamp(0.14 + utilization + role + schedule + ros + market, 0, 1);
}

function faabBidRangeFor(
  add: WaiverSignalPlayer,
  input: {
    classification: WaiverRecommendationClass;
    projectedVorGain: number;
    weeklyPointGain: number;
    restOfSeasonGain: number;
    rosterConstructionImpact: number;
    urgencyScore: number;
    context: ResolvedWaiverContext;
  },
): FaabBidRange {
  const { context } = input;
  if (context.waiverMode !== "FAAB" || context.remainingFaabBudget <= 0) {
    return { min: 0, max: 0, aggression: "none", rationale: "League is not using FAAB or no FAAB remains." };
  }

  const weekPressure = clamp(1 - (context.currentWeek - 1) / 15, 0.25, 1);
  const desperation = rosterDesperation(input.rosterConstructionImpact, input.weeklyPointGain, context);
  const scarcity = positionalScarcity(add.position, context);
  const roleDuration = clamp((add.projectedRoleDurationWeeks ?? (input.classification === "SEASON_LONG_ACCUMULATOR" ? 8 : 2)) / 8, 0.15, 1.2);
  const competition = clamp(context.leagueCompetitiveness, 0.2, 1);
  const gainBase = clamp(input.projectedVorGain / 12 + input.restOfSeasonGain / 70, 0, 0.45);
  const classBoost = input.classification === "SEASON_LONG_ACCUMULATOR" ? 0.08 : 0.02;
  const pct = clamp(0.02 + gainBase + desperation * 0.16 + scarcity * 0.1 + roleDuration * 0.08 + competition * 0.06 + classBoost, 0.01, 0.78);
  const adjustedPct = pct * (0.72 + weekPressure * 0.28);
  const minBid = Math.max(1, Math.round(context.remainingFaabBudget * adjustedPct * 0.65));
  const maxBid = Math.max(minBid, Math.round(context.remainingFaabBudget * adjustedPct));
  const aggression =
    adjustedPct >= 0.48 ? "empty_the_clip" :
    adjustedPct >= 0.28 ? "high" :
    adjustedPct >= 0.14 ? "medium" :
    adjustedPct >= 0.05 ? "low" :
    "none";
  return {
    min: minBid,
    max: maxBid,
    aggression,
    rationale: `${formatClass(input.classification)} with ${formatSigned(input.projectedVorGain)} VOR, ${formatNumber(scarcity * 100)}/100 scarcity, ${formatNumber(desperation * 100)}/100 roster desperation.`,
  };
}

function buildHoldRecommendation(
  context: ResolvedWaiverContext,
  replacementValues: Record<PlayerPosition, number>,
  bestAdd?: WaiverAddRecommendation,
): WaiverAddRecommendation {
  const weakestDrop = dropCandidates(context.roster, buildOptimalLineup(context.roster, context.startingSlots), context)[0] ?? context.roster[context.roster.length - 1];
  const placeholderDrop = weakestDrop ?? {
    playerId: "none",
    name: "No drop candidate",
    position: "WR" as PlayerPosition,
    projectedPoints: 0,
  };
  const placeholderAdd = bestAdd?.add ?? context.freeAgents[0] ?? {
    id: "none",
    name: "No waiver add",
    position: "WR" as PlayerPosition,
    projectedPoints: 0,
  };
  const bestGain = bestAdd?.projectedVorGain ?? 0;
  const benchScore = benchDepthScore(context.roster, replacementValues);
  return {
    recommendationClass: bestAdd?.recommendationClass ?? "ONE_WEEK_STREAMER",
    action: "WAIT",
    mainMove: "Do Nothing",
    add: placeholderAdd,
    drop: placeholderDrop,
    projectedVorGain: 0,
    weeklyPointGain: 0,
    restOfSeasonGain: 0,
    rosterConstructionImpact: 0,
    faabBidRange: { min: 0, max: 0, aggression: "none", rationale: "Hold FAAB/priority because no waiver add beats the roster threshold." },
    waiverPriorityAggression: "hold_priority",
    confidenceScore: Math.round(clamp(58 + benchScore * 25 - Math.max(0, bestGain) * 4 - context.warnings.length * 4, 18, 94)),
    dataFreshnessStatus: dataFreshnessStatus(context),
    supportingQuantitativeReasons: [
      `Best waiver VOR gain is only ${formatSigned(bestGain)} against your drop pool.`,
      `Bench depth score is ${formatNumber(benchScore * 100)}/100 versus current free-agent replacement values.`,
      `FAAB/priority preservation is worth more with ${context.remainingFaabBudget}/${context.faabBudget} budget remaining in Week ${context.currentWeek}.`,
    ],
    riskWarning: "Holding can miss a role breakout; set alerts for injury-driven usage changes before waivers run.",
    alternativePath: bestAdd ? `Watch ${bestAdd.add.name}; claim only if news improves role security.` : "Wait for a clearer add/drop edge.",
    missingDataWarnings: context.warnings,
    fallbackLogicUsed: context.fallbacks,
  };
}

function resolveWaiverContext(context: WaiverSniperContext): ResolvedWaiverContext {
  const warnings: string[] = [];
  const fallbacks: string[] = [];
  if (!context.currentRosterConstruction?.length) {
    warnings.push("currentRosterConstruction missing; drop candidates are unreliable.");
    fallbacks.push("Roster fallback: empty roster.");
  }
  if (!context.liveFreeAgents?.length) {
    warnings.push("liveFreeAgents missing; waiver sniper can only recommend holding.");
    fallbacks.push("Free-agent fallback: empty free-agent pool.");
  }
  if (!context.dataFreshness?.length) {
    warnings.push("dataFreshness missing; freshness status is unknown.");
    fallbacks.push("Freshness fallback: unknown timestamps.");
  }
  const resolved: ResolvedWaiverContext = {
    startingSlots: { ...DEFAULT_STARTING_SLOTS, ...(context.startingSlots ?? {}) },
    benchSize: positiveInt(context.benchSize, 7),
    totalTeams: positiveInt(context.totalTeams, 12),
    currentWeek: positiveInt(context.currentWeek, 1),
    seasonPhase: context.seasonPhase,
    roster: context.currentRosterConstruction ?? [],
    freeAgents: context.liveFreeAgents ?? [],
    weeklyMatchup: context.weeklyMatchup ?? {},
    playoffContext: context.playoffContext ?? {},
    waiverMode: context.waiverSettings?.mode ?? "FAAB",
    faabBudget: positiveInt(context.faabBudget, 100),
    remainingFaabBudget: Math.max(0, positiveInt(context.remainingFaabBudget, context.faabBudget ?? 100)),
    leagueCompetitiveness: clamp(context.leagueCompetitiveness ?? 0.65, 0, 1),
    dataFreshness: context.dataFreshness ?? [],
    warnings,
    fallbacks,
  };
  if (context.waiverSettings?.waiverPriority !== undefined) {
    resolved.waiverPriority = context.waiverSettings.waiverPriority;
  }
  return resolved;
}

interface LineupPlan {
  starters: WeeklyPlayer[];
  bench: WeeklyPlayer[];
}

function buildOptimalLineup(roster: WeeklyPlayer[], slots: Required<Record<Position, number>>): LineupPlan {
  const remaining = [...roster].sort((a, b) => baseProjection(b) - baseProjection(a));
  const starters: WeeklyPlayer[] = [];
  for (const pos of PLAYER_POSITIONS) takeForSlot(remaining, starters, pos, slots[pos], pos);
  takeForSlot(remaining, starters, "FLEX", slots.FLEX, "FLEX");
  takeForSlot(remaining, starters, "SUPERFLEX", slots.SUPERFLEX, "SUPERFLEX");
  return { starters, bench: remaining };
}

function takeForSlot(remaining: WeeklyPlayer[], starters: WeeklyPlayer[], slot: Position, count: number, lineupSlot: Position): void {
  for (let index = 0; index < count; index += 1) {
    const candidateIndex = remaining.findIndex((player) => canFillSlot(player.position, slot) && !hasCurrentWeekProblem(player));
    if (candidateIndex < 0) return;
    const [candidate] = remaining.splice(candidateIndex, 1);
    if (candidate) starters.push({ ...candidate, lineupSlot });
  }
}

function canFillSlot(position: PlayerPosition, slot: Position): boolean {
  if (slot === "FLEX") return FLEX_POSITIONS.has(position);
  if (slot === "SUPERFLEX") return SUPERFLEX_POSITIONS.has(position);
  return position === slot;
}

function calculateReplacementValues(context: ResolvedWaiverContext): Record<PlayerPosition, number> {
  const values = {} as Record<PlayerPosition, number>;
  for (const pos of PLAYER_POSITIONS) {
    const pool = context.freeAgents.filter((player) => player.position === pos).sort((a, b) => weeklyProjection(b, context) - weeklyProjection(a, context));
    const index = Math.min(pool.length - 1, Math.max(0, Math.round(context.totalTeams * 0.2)));
    values[pos] = pool[index] ? weeklyProjection(pool[index], context) : defaultReplacement(pos);
  }
  return values;
}

function dropCandidates(roster: WeeklyPlayer[], lineup: LineupPlan, context: ResolvedWaiverContext): WeeklyPlayer[] {
  const starterIds = new Set(lineup.starters.map((player) => player.playerId));
  return roster
    .filter((player) => !starterIds.has(player.playerId) && !player.isLocked)
    .sort((a, b) => dropScore(b, context) - dropScore(a, context));
}

function prioritizedDropsFor(add: WaiverSignalPlayer, drops: WeeklyPlayer[]): WeeklyPlayer[] {
  const samePosition = drops.filter((drop) => drop.position === add.position);
  const flexible = drops.filter((drop) => FLEX_POSITIONS.has(drop.position) && FLEX_POSITIONS.has(add.position));
  const others = drops.filter((drop) => !samePosition.includes(drop) && !flexible.includes(drop));
  return [...samePosition, ...flexible, ...others];
}

function dropScore(player: WeeklyPlayer, context: ResolvedWaiverContext): number {
  return (
    playerRisk(player, context) * 2.2 -
    weeklyProjection(player, context) * 0.7 -
    restOfSeasonValue(player, context) * 0.28 -
    positionalScarcity(player.position, context) * 9
  );
}

function weeklyProjection(player: WeeklyPlayer | WaiverSignalPlayer, context: ResolvedWaiverContext): number {
  if (hasCurrentWeekProblem(player)) return 0;
  let projection = baseProjection(player);
  projection += (player.matchupRating ?? 0) * 0.08;
  projection += ("opponentWeakness" in player ? (player.opponentWeakness ?? 0) : 0) * 0.025;
  if (context.seasonPhase === "playoffs") projection += (context.playoffContext.scheduleStrengthByPosition?.[player.position] ?? 0) * 0.1;
  return round(Math.max(0, projection), 2);
}

function baseProjection(player: WeeklyPlayer | WaiverSignalPlayer): number {
  const expected = "expectedFantasyPoints" in player ? player.expectedFantasyPoints : undefined;
  return numberFrom(player.weeklyProjection) ?? numberFrom(player.projectedPoints) ?? numberFrom(expected) ?? defaultReplacement(player.position);
}

function restOfSeasonValue(player: WeeklyPlayer | WaiverSignalPlayer, context: ResolvedWaiverContext): number {
  const explicit = numberFrom(player.restOfSeasonValue);
  if (explicit !== undefined) return explicit;
  const duration = "projectedRoleDurationWeeks" in player ? (player.projectedRoleDurationWeeks ?? 5) : 5;
  return round(baseProjection(player) * Math.max(2, Math.min(8, 16 - context.currentWeek, duration)), 2);
}

function lineupGainAfterAddDrop(add: WaiverSignalPlayer, drop: WeeklyPlayer, context: ResolvedWaiverContext, currentLineup: LineupPlan): number {
  const afterRoster = context.roster.filter((player) => player.playerId !== drop.playerId).concat(toWeeklyPlayer(add));
  const afterLineup = buildOptimalLineup(afterRoster, context.startingSlots);
  return round(lineupProjection(afterLineup.starters, context) - lineupProjection(currentLineup.starters, context), 2);
}

function rosterImpact(add: WaiverSignalPlayer, drop: WeeklyPlayer, context: ResolvedWaiverContext): number {
  const before = rosterNeedScore(add.position, context.roster, context);
  const afterRoster = context.roster.filter((player) => player.playerId !== drop.playerId).concat(toWeeklyPlayer(add));
  const after = rosterNeedScore(add.position, afterRoster, context);
  const flexGain = FLEX_POSITIONS.has(add.position) && !FLEX_POSITIONS.has(drop.position) ? 0.08 : 0;
  return clamp(before - after + flexGain, -0.4, 0.8);
}

function roleOpportunityScore(add: WaiverSignalPlayer, context: ResolvedWaiverContext): number {
  const utilization = clamp((add.snapShare ?? 0) / 100, 0, 0.22) + clamp((add.routeParticipation ?? 0) / 100, 0, 0.2);
  const trends = trendScore(add.snapShareTrend) + trendScore(add.routeParticipationTrend) + trendScore(add.targetShareTrend) + trendScore(add.carryShareTrend);
  const role = clamp((add.roleChangeSignal ?? 0) / 100, 0, 0.22) + (add.injuryAheadOfPlayer ? 0.14 : 0);
  const market = clamp((add.addDropMomentum ?? add.marketTrendScore ?? 0) / 100, -0.08, 0.12);
  const need = rosterPositionProblem(add.position, context) ? 0.12 : 0;
  return clamp(utilization + trends * 0.12 + role + market + need, 0, 1);
}

function rosterNeedScore(pos: PlayerPosition, roster: WeeklyPlayer[], context: ResolvedWaiverContext): number {
  const healthy = roster.filter((player) => player.position === pos && !hasCurrentWeekProblem(player)).length;
  const target = Math.ceil(starterDemand(pos, context.startingSlots) + context.benchSize * benchShare(pos));
  return clamp((target - healthy) / Math.max(1, target), 0, 1);
}

function rosterPositionProblem(pos: PlayerPosition, context: ResolvedWaiverContext): boolean {
  return rosterNeedScore(pos, context.roster, context) >= 0.34 || context.roster.some((player) => player.position === pos && hasCurrentWeekProblem(player));
}

function starterDemand(pos: PlayerPosition, slots: Required<Record<Position, number>>): number {
  let demand = slots[pos];
  if (FLEX_POSITIONS.has(pos)) demand += slots.FLEX / 3;
  if (SUPERFLEX_POSITIONS.has(pos)) demand += slots.SUPERFLEX / 4;
  return demand;
}

function benchShare(pos: PlayerPosition): number {
  const shares: Record<PlayerPosition, number> = { QB: 0.12, RB: 0.34, WR: 0.36, TE: 0.1, DST: 0.04, K: 0.04 };
  return shares[pos];
}

function positionalScarcity(pos: PlayerPosition, context: ResolvedWaiverContext): number {
  const viable = context.freeAgents.filter((player) => player.position === pos && weeklyProjection(player, context) >= defaultReplacement(pos)).length;
  const demand = Math.max(1, starterDemand(pos, context.startingSlots) * context.totalTeams);
  return clamp(1 - viable / demand, 0, 1);
}

function rosterDesperation(rosterConstructionImpact: number, weeklyPointGain: number, context: ResolvedWaiverContext): number {
  const matchupGap = (context.weeklyMatchup.opponentProjectedPoints ?? context.weeklyMatchup.userProjectedPoints ?? 112) - (context.weeklyMatchup.userProjectedPoints ?? 112);
  const mustWin = context.playoffContext.mustWinLevel ?? 0.35;
  return clamp(rosterConstructionImpact * 0.7 + Math.max(0, weeklyPointGain) / 12 + Math.max(0, matchupGap) / 25 + mustWin * 0.25, 0, 1);
}

function playerRisk(player: WeeklyPlayer | WaiverSignalPlayer, context: ResolvedWaiverContext): number {
  let risk = player.volatility ?? 4;
  if (player.byeWeek === context.currentWeek) risk += 10;
  if (player.injuryStatus === "QUESTIONABLE") risk += 2;
  if (player.injuryStatus === "DOUBTFUL") risk += 6;
  if (player.injuryStatus === "OUT" || player.injuryStatus === "IR") risk += 10;
  if ("projectedRoleDurationWeeks" in player && player.projectedRoleDurationWeeks !== undefined && player.projectedRoleDurationWeeks <= 2) risk += 1.2;
  return clamp(risk, 1, 10);
}

function hasCurrentWeekProblem(player: WeeklyPlayer | WaiverSignalPlayer): boolean {
  return player.injuryStatus === "OUT" || player.injuryStatus === "IR" || player.injuryStatus === "DOUBTFUL";
}

function benchDepthScore(roster: WeeklyPlayer[], replacementValues: Record<PlayerPosition, number>): number {
  const depth = roster.reduce((sum, player) => sum + Math.max(0, baseProjection(player) - (replacementValues[player.position] ?? 0)), 0);
  return clamp(depth / 38, 0, 1);
}

function lineupProjection(starters: WeeklyPlayer[], context: ResolvedWaiverContext): number {
  return starters.reduce((sum, player) => sum + weeklyProjection(player, context), 0);
}

function waiverActionFor(score: number, faab: FaabBidRange, context: ResolvedWaiverContext): WaiverAction {
  if (score >= 24 || faab.aggression === "high" || faab.aggression === "empty_the_clip") return "ACT_NOW";
  if (score >= 11) return context.waiverMode === "FREE_AGENT" ? "ACT_NOW" : "WAIT";
  return "AVOID";
}

function waiverPriorityAggressionFor(action: WaiverAction, score: number, context: ResolvedWaiverContext): WaiverAddRecommendation["waiverPriorityAggression"] {
  if (context.waiverMode !== "WAIVER_PRIORITY") return action === "ACT_NOW" ? "normal_claim" : "hold_priority";
  if (action !== "ACT_NOW") return "hold_priority";
  return score >= 28 || (context.waiverPriority ?? 12) <= 4 ? "aggressive_claim" : "normal_claim";
}

function confidenceFor(add: WaiverSignalPlayer, drop: WeeklyPlayer, score: number, context: ResolvedWaiverContext): number {
  const freshnessPenalty = context.dataFreshness.some((item) => item.stale) ? 14 : 0;
  const missingPenalty = Math.min(20, context.warnings.length * 4);
  const riskPenalty = playerRisk(add, context) * 1.6;
  const signalBonus = roleOpportunityScore(add, context) * 18 + Math.max(0, restOfSeasonValue(add, context) - restOfSeasonValue(drop, context)) * 0.08;
  return Math.round(clamp(44 + score * 0.9 + signalBonus - riskPenalty - freshnessPenalty - missingPenalty, 10, 96));
}

function compareRecommendations(a: WaiverAddRecommendation, b: WaiverAddRecommendation): number {
  return b.confidenceScore - a.confidenceScore || b.projectedVorGain - a.projectedVorGain || b.weeklyPointGain - a.weeklyPointGain;
}

function compareAgainstDoingNothing(best: WaiverAddRecommendation, alternative?: WaiverAddRecommendation): string {
  if (best.mainMove === "Do Nothing") {
    return `Do Nothing is better because the top waiver edge is below the claim threshold. ${best.supportingQuantitativeReasons[0]}`;
  }
  const alt = alternative ? ` Best alternative: ${alternative.mainMove} (${formatSigned(alternative.projectedVorGain)} VOR).` : "";
  return `${best.mainMove} beats doing nothing by ${formatSigned(best.projectedVorGain)} VOR and ${formatSigned(best.weeklyPointGain)} active-lineup points.${alt}`;
}

function riskWarningFor(add: WaiverSignalPlayer, drop: WeeklyPlayer, classification: WaiverRecommendationClass, context: ResolvedWaiverContext): string {
  if (playerRisk(add, context) >= 7) return `${add.name} carries elevated injury/role volatility; do not bid above range unless news confirms usage.`;
  if (classification === "ONE_WEEK_STREAMER" && (add.projectedRoleDurationWeeks ?? 1) <= 2) return "This is short-term value; avoid dropping a season-long bench asset with a durable role.";
  if (restOfSeasonValue(drop, context) > restOfSeasonValue(add, context) + 10) return `${drop.name} has better long-term value; this claim is only justified by urgent weekly need.`;
  return "Main risk is waiver cost versus how quickly the role can disappear.";
}

function alternativePathFor(add: WaiverSignalPlayer, drop: WeeklyPlayer, action: WaiverAction, context: ResolvedWaiverContext): string {
  if (action === "ACT_NOW") return `If the bid gets too expensive, lower the offer and keep ${drop.name} as the fallback.`;
  if (context.waiverMode === "FREE_AGENT") return `Wait for news, then add ${add.name} only if the role signal strengthens.`;
  return `Hold priority/FAAB unless ${add.name}'s role improves before waivers run.`;
}

function dataFreshnessStatus(context: ResolvedWaiverContext): string {
  if (!context.dataFreshness.length) return "Data freshness unknown; use as directional until ESPN/free-agent sync is confirmed.";
  const stale = context.dataFreshness.filter((item) => item.stale);
  if (stale.length) return `Stale data warning: ${stale.map((item) => item.source).join(", ")}.`;
  return `Fresh: ${context.dataFreshness.map((item) => `${item.source}${item.updatedAt ? ` @ ${item.updatedAt}` : ""}`).join("; ")}.`;
}

function toWeeklyPlayer(add: WaiverSignalPlayer): WeeklyPlayer {
  const player: WeeklyPlayer = { playerId: add.id, name: add.name, position: add.position };
  if (add.team !== undefined) player.team = add.team;
  if (add.weeklyProjection !== undefined) player.weeklyProjection = add.weeklyProjection;
  if (add.projectedPoints !== undefined) player.projectedPoints = add.projectedPoints;
  if (add.byeWeek !== undefined) player.byeWeek = add.byeWeek;
  if (add.injuryStatus !== undefined) player.injuryStatus = add.injuryStatus;
  if (add.floorPoints !== undefined) player.floorPoints = add.floorPoints;
  if (add.ceilingPoints !== undefined) player.ceilingPoints = add.ceilingPoints;
  if (add.restOfSeasonValue !== undefined) player.restOfSeasonValue = add.restOfSeasonValue;
  if (add.matchupRating !== undefined) player.matchupRating = add.matchupRating;
  if (add.volatility !== undefined) player.volatility = add.volatility;
  if (add.rosteredPercent !== undefined) player.rosteredPercent = add.rosteredPercent;
  if (add.startPercent !== undefined) player.startPercent = add.startPercent;
  return player;
}

function classificationScore(add: WaiverSignalPlayer, classification: WaiverRecommendationClass, context: ResolvedWaiverContext): number {
  return classification === "ONE_WEEK_STREAMER" ? streamerScore(add, context) : accumulatorScore(add, context);
}

function trendScore(value: number | undefined): number {
  return clamp((value ?? 0) / 100, -0.08, 0.16);
}

function defaultReplacement(pos: PlayerPosition): number {
  const values: Record<PlayerPosition, number> = { QB: 15, RB: 8, WR: 8, TE: 5.5, DST: 5, K: 6 };
  return values[pos];
}

function defaultRosReplacement(pos: PlayerPosition): number {
  const values: Record<PlayerPosition, number> = { QB: 70, RB: 42, WR: 42, TE: 28, DST: 18, K: 20 };
  return values[pos];
}

function positiveInt(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

function numberFrom(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number, decimals = 1): number {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatSigned(value: number): string {
  return `${value >= 0 ? "+" : ""}${formatNumber(round(value, 1))}`;
}

function formatClass(value: WaiverRecommendationClass): string {
  return value === "ONE_WEEK_STREAMER" ? "One-week streamer" : "Season-long accumulator";
}
