export type Position = "QB" | "RB" | "WR" | "TE" | "FLEX" | "SUPERFLEX" | "DST" | "K";
export type PlayerPosition = Exclude<Position, "FLEX" | "SUPERFLEX">;
export type SeasonPhase = "pre_draft" | "draft" | "regular_season" | "playoffs" | "offseason";
export type DraftDecision = "TAKE" | "WAIT" | "AVOID";

export interface DataFreshness {
  source: string;
  updatedAt?: string;
  maxAgeMinutes?: number;
  stale?: boolean;
  warning?: string;
}

export interface DraftPlayer {
  id: string;
  name: string;
  position: PlayerPosition;
  team?: string;
  projectedPoints?: number;
  weeklyProjection?: number;
  rank?: number;
  positionalRank?: number;
  adp?: number;
  tier?: string;
  tierSort?: number;
  valueScore?: number;
  riskScore?: number;
  floorScore?: number;
  upsideScore?: number;
  receptionsProjection?: number;
  targetShareProxy?: number;
  expertDelta?: number;
  marketTrendScore?: number;
}

export interface RosterPlayer {
  playerId?: string;
  name: string;
  position: PlayerPosition;
  lineupSlot?: Position | "BE" | "IR";
  projectedPoints?: number;
}

export interface OpponentRoster {
  teamId: string;
  managerName?: string;
  roster: RosterPlayer[];
}

export interface ManagerTendency {
  teamId: string;
  earlyQbBias?: number;
  rbHoardingBias?: number;
  rookieBias?: number;
  nameValueBias?: number;
  streamerBias?: number;
  positionalBias?: Partial<Record<PlayerPosition, number>>;
  aggressiveness?: number;
}

export interface LeagueContext {
  scoringSettings?: Record<string, unknown>;
  startingSlots?: Partial<Record<Position, number>>;
  benchSize?: number;
  totalTeams?: number;
  draftSlot?: number;
  currentPickNumber?: number;
  currentRosterConstruction?: RosterPlayer[];
  liveAvailablePlayers?: DraftPlayer[];
  liveFreeAgents?: DraftPlayer[];
  opponentRosters?: OpponentRoster[];
  waiverSettings?: Record<string, unknown>;
  tradeSettings?: Record<string, unknown>;
  faabBudget?: number;
  remainingFaabBudget?: number;
  currentWeek?: number;
  seasonPhase?: SeasonPhase;
  userTeamNeeds?: Partial<Record<PlayerPosition, number>>;
  opponentManagerTendencies?: ManagerTendency[];
  dataFreshness?: DataFreshness[];
}

export interface PhaseOnePlayerDecision {
  decision: DraftDecision;
  player: DraftPlayer;
  draftScore: number;
  adjustedProjection: number;
  vor: number;
  replacementValue: number;
  needScore: number;
  scarcityScore: number;
  nonReturnProbability: number;
  tierCliff: boolean;
  contextCorrection: number;
  reasons: string[];
  warning: string;
  fallbackLogicUsed: string[];
}

export interface PhaseOneRecommendation {
  mainMove: string;
  supportingQuantitativeReasons: [string, string, string];
  riskWarning: string;
  alternativePath: string;
  confidenceScore: number;
  dataFreshnessStatus: string;
  action: DraftDecision;
  player?: DraftPlayer;
}

export interface PhaseOneDraftSnapshot {
  recommendation: PhaseOneRecommendation;
  playerDecisions: PhaseOnePlayerDecision[];
  tierCliffAlerts: PhaseOnePlayerDecision[];
  missingDataWarnings: string[];
  fallbackLogicUsed: string[];
  generatedAt: string;
}

interface ResolvedContext {
  scoringType: "ppr" | "half_ppr" | "standard" | "custom";
  receptionPoints: number;
  startingSlots: Required<Record<Position, number>>;
  benchSize: number;
  totalTeams: number;
  draftSlot: number;
  currentPickNumber: number;
  roster: RosterPlayer[];
  availablePlayers: DraftPlayer[];
  opponentRosters: OpponentRoster[];
  tendencies: Map<string, ManagerTendency>;
  userNeeds: Partial<Record<PlayerPosition, number>>;
  freshness: DataFreshness[];
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

const POSITION_BENCH_SHARE: Record<PlayerPosition, number> = {
  QB: 0.12,
  RB: 0.34,
  WR: 0.36,
  TE: 0.1,
  DST: 0.04,
  K: 0.04,
};

export function generateLiveDraftPhaseOneSnapshot(context: LeagueContext): PhaseOneDraftSnapshot {
  const resolved = resolveContext(context);
  const replacementValues = calculateReplacementValues(resolved);
  const tierCounts = calculateTierCounts(resolved.availablePlayers);

  const playerDecisions = resolved.availablePlayers
    .map((player) => evaluateDraftPlayer(player, resolved, replacementValues, tierCounts))
    .sort((a, b) => b.draftScore - a.draftScore || a.nonReturnProbability - b.nonReturnProbability)
    .slice(0, 80);

  const takeCandidates = playerDecisions.filter((item) => item.decision === "TAKE");
  const waitCandidates = playerDecisions.filter((item) => item.decision === "WAIT");
  const main = takeCandidates[0] ?? waitCandidates[0] ?? playerDecisions[0];
  const alternative = playerDecisions.find((item) => item.player.id !== main?.player.id && item.decision !== "AVOID");
  const recommendation = buildRecommendation(main, alternative, resolved);

  return {
    recommendation,
    playerDecisions,
    tierCliffAlerts: playerDecisions.filter((item) => item.tierCliff).slice(0, 8),
    missingDataWarnings: resolved.warnings,
    fallbackLogicUsed: resolved.fallbacks,
    generatedAt: new Date().toISOString(),
  };
}

export function evaluateDraftPlayer(
  player: DraftPlayer,
  context: LeagueContext | ResolvedContext,
  replacementValues?: Record<PlayerPosition, number>,
  tierCounts?: Map<string, number>,
): PhaseOnePlayerDecision {
  const resolved = isResolvedContext(context) ? context : resolveContext(context);
  const baselines = replacementValues ?? calculateReplacementValues(resolved);
  const tiers = tierCounts ?? calculateTierCounts(resolved.availablePlayers);
  const fallbackLogicUsed: string[] = [];

  const adjustedProjection = contextAdjustedProjection(player, resolved, fallbackLogicUsed);
  const replacementValue = baselines[player.position] ?? 0;
  const vor = round(adjustedProjection - replacementValue, 2);
  const needScore = rosterNeedScore(player.position, resolved);
  const scarcityScore = positionalScarcityScore(player, resolved, baselines);
  const nonReturnProbability = nonReturnProbabilityFor(player, resolved, scarcityScore, fallbackLogicUsed);
  const tierCliff = isTierCliff(player, tiers, scarcityScore);
  const contextCorrection = contextCorrectionFor(player, resolved);
  const riskPenalty = clamp((player.riskScore ?? 5) * 1.6, 2, 16);
  const marketValue = clamp((player.valueScore ?? 50) - 50, -16, 18);

  const draftScore = round(
    vor * 1.8 +
      needScore * 18 +
      scarcityScore * 16 +
      nonReturnProbability * 22 +
      (tierCliff ? 12 : 0) +
      contextCorrection +
      marketValue -
      riskPenalty,
    2,
  );

  const decision = classifyDecision({
    draftScore,
    nonReturnProbability,
    needScore,
    tierCliff,
    vor,
    player,
    contextCorrection,
  });

  return {
    decision,
    player,
    draftScore,
    adjustedProjection,
    vor,
    replacementValue,
    needScore,
    scarcityScore,
    nonReturnProbability,
    tierCliff,
    contextCorrection,
    reasons: [
      `${formatNumber(vor)} VOR over ${player.position} replacement (${formatNumber(adjustedProjection)} vs ${formatNumber(replacementValue)}).`,
      `${Math.round(nonReturnProbability * 100)}% non-return probability before your next pick.`,
      `${formatNumber(needScore * 100)} roster-fit score with ${formatNumber(scarcityScore * 100)} scarcity pressure.`,
    ],
    warning: warningFor(player, decision, vor, needScore, nonReturnProbability),
    fallbackLogicUsed,
  };
}

function resolveContext(context: LeagueContext): ResolvedContext {
  const warnings: string[] = [];
  const fallbacks: string[] = [];
  const scoring = normalizeScoring(context.scoringSettings, warnings, fallbacks);
  const startingSlots = { ...DEFAULT_STARTING_SLOTS, ...(context.startingSlots ?? {}) };
  const totalTeams = positiveInt(context.totalTeams, 12, "totalTeams", warnings, fallbacks);
  const benchSize = positiveInt(context.benchSize, 7, "benchSize", warnings, fallbacks);
  const draftSlot = clamp(positiveInt(context.draftSlot, 1, "draftSlot", warnings, fallbacks), 1, totalTeams);
  const currentPickNumber = positiveInt(context.currentPickNumber, 1, "currentPickNumber", warnings, fallbacks);
  const availablePlayers = (context.liveAvailablePlayers?.length ? context.liveAvailablePlayers : context.liveFreeAgents) ?? [];

  if (!context.liveAvailablePlayers?.length) {
    warnings.push("liveAvailablePlayers missing; using liveFreeAgents or an empty player pool.");
    fallbacks.push("Available pool fallback used.");
  }
  if (!context.currentRosterConstruction) {
    warnings.push("currentRosterConstruction missing; roster need uses empty-roster defaults.");
    fallbacks.push("Roster construction fallback used.");
  }
  if (!context.opponentRosters) {
    warnings.push("opponentRosters missing; non-return probability uses ADP, scarcity, and league size only.");
    fallbacks.push("Opponent roster need fallback used.");
  }

  return {
    scoringType: scoring.scoringType,
    receptionPoints: scoring.receptionPoints,
    startingSlots,
    benchSize,
    totalTeams,
    draftSlot,
    currentPickNumber,
    roster: context.currentRosterConstruction ?? [],
    availablePlayers,
    opponentRosters: context.opponentRosters ?? [],
    tendencies: new Map((context.opponentManagerTendencies ?? []).map((item) => [item.teamId, item])),
    userNeeds: context.userTeamNeeds ?? {},
    freshness: context.dataFreshness ?? [],
    warnings,
    fallbacks,
  };
}

function normalizeScoring(
  scoringSettings: Record<string, unknown> | undefined,
  warnings: string[],
  fallbacks: string[],
): { scoringType: ResolvedContext["scoringType"]; receptionPoints: number } {
  const rawReceptionPoints =
    numberFrom(scoringSettings?.["receptionPoints"]) ??
    numberFrom(scoringSettings?.["receptions"]) ??
    numberFrom(scoringSettings?.["pointsPerReception"]);

  if (rawReceptionPoints === undefined) {
    warnings.push("scoringSettings.receptionPoints missing; assuming full PPR.");
    fallbacks.push("Scoring fallback: full PPR reception weighting.");
  }

  const receptionPoints = rawReceptionPoints ?? 1;
  if (receptionPoints >= 0.95) return { scoringType: "ppr", receptionPoints };
  if (receptionPoints >= 0.45) return { scoringType: "half_ppr", receptionPoints };
  if (receptionPoints <= 0.05) return { scoringType: "standard", receptionPoints };
  return { scoringType: "custom", receptionPoints };
}

function calculateReplacementValues(context: ResolvedContext): Record<PlayerPosition, number> {
  const byPosition = groupAvailableByPosition(context.availablePlayers);
  const baselines = {} as Record<PlayerPosition, number>;

  for (const pos of PLAYER_POSITIONS) {
    const players = byPosition.get(pos) ?? [];
    const starterDemand = leagueStarterDemand(pos, context.startingSlots) * context.totalTeams;
    const benchDemand = Math.round(context.benchSize * context.totalTeams * POSITION_BENCH_SHARE[pos]);
    const rosterNeed = Math.round(Math.max(0, rosterNeedScore(pos, context)) * 2);
    const replacementIndex = clamp(Math.round(starterDemand + benchDemand * 0.45 - rosterNeed), 1, Math.max(players.length, 1)) - 1;
    baselines[pos] = adjustedProjectionForReplacement(players[replacementIndex] ?? players[players.length - 1]);
  }

  return baselines;
}

function groupAvailableByPosition(players: DraftPlayer[]): Map<PlayerPosition, DraftPlayer[]> {
  const grouped = new Map<PlayerPosition, DraftPlayer[]>();
  for (const player of players) {
    const rows = grouped.get(player.position) ?? [];
    rows.push(player);
    grouped.set(player.position, rows);
  }
  for (const [pos, rows] of grouped.entries()) {
    grouped.set(pos, rows.sort((a, b) => adjustedProjectionForReplacement(b) - adjustedProjectionForReplacement(a)));
  }
  return grouped;
}

function adjustedProjectionForReplacement(player: DraftPlayer | undefined): number {
  if (!player) return 0;
  return numberFrom(player.projectedPoints) ?? numberFrom(player.weeklyProjection) ?? impliedProjectionFromRank(player);
}

function contextAdjustedProjection(player: DraftPlayer, context: ResolvedContext, fallbacks: string[]): number {
  let projection = adjustedProjectionForReplacement(player);
  if (projection <= 0) {
    fallbacks.push(`Projection fallback for ${player.name}: rank-derived estimate.`);
    projection = impliedProjectionFromRank(player);
  }

  if (context.receptionPoints >= 0.95 && ["RB", "WR", "TE"].includes(player.position)) {
    projection += (player.receptionsProjection ?? 0) * 0.08;
  }
  if (context.receptionPoints <= 0.05 && ["RB", "WR", "TE"].includes(player.position)) {
    projection -= (player.receptionsProjection ?? 0) * 0.1;
  }
  if (context.startingSlots.SUPERFLEX > 0 && player.position === "QB") {
    projection *= 1.12;
  }
  if (context.startingSlots.TE >= 2 && player.position === "TE") {
    projection *= 1.08;
  }
  return round(projection, 2);
}

function impliedProjectionFromRank(player: DraftPlayer): number {
  const rank = player.rank ?? 180;
  const posBonus: Record<PlayerPosition, number> = { QB: 40, RB: 28, WR: 28, TE: 22, DST: 8, K: 4 };
  return round(Math.max(20, 285 - rank * 1.15 + posBonus[player.position]), 2);
}

function rosterNeedScore(pos: PlayerPosition, context: ResolvedContext): number {
  const explicitNeed = context.userNeeds[pos];
  if (explicitNeed !== undefined) return clamp(explicitNeed, 0, 1);

  const rosterCount = context.roster.filter((item) => item.position === pos).length;
  const starterTarget = leagueStarterDemand(pos, context.startingSlots);
  const benchTarget = context.benchSize * POSITION_BENCH_SHARE[pos];
  const target = starterTarget + benchTarget;
  if (target <= 0) return 0;
  return clamp((target - rosterCount) / Math.max(1, target), 0, 1);
}

function leagueStarterDemand(pos: PlayerPosition, slots: Required<Record<Position, number>>): number {
  let demand = slots[pos] ?? 0;
  if (FLEX_POSITIONS.has(pos)) demand += slots.FLEX / 3;
  if (SUPERFLEX_POSITIONS.has(pos)) demand += slots.SUPERFLEX / 4;
  return demand;
}

function positionalScarcityScore(
  player: DraftPlayer,
  context: ResolvedContext,
  replacementValues: Record<PlayerPosition, number>,
): number {
  const samePosition = context.availablePlayers
    .filter((item) => item.position === player.position)
    .sort((a, b) => adjustedProjectionForReplacement(b) - adjustedProjectionForReplacement(a));
  const index = samePosition.findIndex((item) => item.id === player.id);
  const next = samePosition[index + 1];
  const tierDrop = next ? adjustedProjectionForReplacement(player) - adjustedProjectionForReplacement(next) : 10;
  const replacementDrop = adjustedProjectionForReplacement(player) - (replacementValues[player.position] ?? 0);
  const availableStarterRatio = samePosition.length / Math.max(1, leagueStarterDemand(player.position, context.startingSlots) * context.totalTeams);
  return clamp(tierDrop / 18 + replacementDrop / 80 + (availableStarterRatio < 0.7 ? 0.18 : 0), 0, 1);
}

function nonReturnProbabilityFor(
  player: DraftPlayer,
  context: ResolvedContext,
  scarcityScore: number,
  fallbacks: string[],
): number {
  const nextPick = inferNextUserPick(context.currentPickNumber, context.totalTeams, context.draftSlot);
  const picksUntilNext = Math.max(1, nextPick - context.currentPickNumber);
  const price = player.adp ?? player.rank ?? player.positionalRank;
  if (price === undefined) {
    fallbacks.push(`Non-return fallback for ${player.name}: missing ADP/rank, using scarcity and roster pressure.`);
  }
  const effectivePrice = price ?? context.currentPickNumber + picksUntilNext + 18;
  const adpPressure = sigmoid((nextPick + 2 - effectivePrice) / Math.max(5, picksUntilNext * 0.55));
  const opponentPressure = opponentNeedPressure(player.position, context);
  const tendencyPressure = opponentTendencyPressure(player.position, context);
  return round(clamp(adpPressure * 0.58 + scarcityScore * 0.18 + opponentPressure * 0.16 + tendencyPressure * 0.08, 0.03, 0.98), 3);
}

function inferNextUserPick(currentPick: number, totalTeams: number, draftSlot: number): number {
  for (let pick = currentPick + 1; pick <= currentPick + totalTeams * 2 + 2; pick += 1) {
    const round = Math.floor((pick - 1) / totalTeams) + 1;
    const pickInRound = ((pick - 1) % totalTeams) + 1;
    const slot = round % 2 === 1 ? pickInRound : totalTeams - pickInRound + 1;
    if (slot === draftSlot) return pick;
  }
  return currentPick + totalTeams;
}

function opponentNeedPressure(pos: PlayerPosition, context: ResolvedContext): number {
  if (!context.opponentRosters.length) return 0.45;
  const pressures = context.opponentRosters.map((opponent) => {
    const rosterCount = opponent.roster.filter((item) => item.position === pos).length;
    const target = leagueStarterDemand(pos, context.startingSlots);
    return clamp((target - rosterCount + 0.5) / Math.max(1, target + 0.5), 0, 1);
  });
  return average(pressures);
}

function opponentTendencyPressure(pos: PlayerPosition, context: ResolvedContext): number {
  const tendencies = [...context.tendencies.values()];
  if (!tendencies.length) return 0.35;
  const values = tendencies.map((item) => {
    const positional = item.positionalBias?.[pos] ?? 0.5;
    const special =
      pos === "QB"
        ? item.earlyQbBias ?? 0
        : pos === "RB"
          ? item.rbHoardingBias ?? 0
          : 0;
    return clamp(positional * 0.7 + special * 0.3 + (item.aggressiveness ?? 0.5) * 0.1, 0, 1);
  });
  return average(values);
}

function calculateTierCounts(players: DraftPlayer[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const player of players) {
    const key = tierKey(player);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function isTierCliff(player: DraftPlayer, tierCounts: Map<string, number>, scarcityScore: number): boolean {
  const remaining = tierCounts.get(tierKey(player)) ?? 0;
  return remaining <= 2 && scarcityScore >= 0.38 && !["DST", "K"].includes(player.position);
}

function tierKey(player: DraftPlayer): string {
  return `${player.position}:${player.tier ?? player.tierSort ?? "unknown"}`;
}

function contextCorrectionFor(player: DraftPlayer, context: ResolvedContext): number {
  let correction = 0;
  if (context.startingSlots.SUPERFLEX > 0 && player.position === "QB") correction += 14;
  if (context.receptionPoints >= 0.95 && ["RB", "WR", "TE"].includes(player.position)) {
    correction += clamp((player.receptionsProjection ?? 0) / 12, 0, 7);
  }
  if (context.receptionPoints <= 0.05 && ["RB", "WR", "TE"].includes(player.position)) {
    correction -= clamp((player.receptionsProjection ?? 0) / 10, 0, 8);
  }
  if (context.benchSize <= 5 && (player.riskScore ?? 5) >= 7) correction -= 8;
  if (context.benchSize >= 8 && (player.upsideScore ?? 50) >= 70) correction += 5;
  return round(correction, 2);
}

function classifyDecision(input: {
  draftScore: number;
  nonReturnProbability: number;
  needScore: number;
  tierCliff: boolean;
  vor: number;
  player: DraftPlayer;
  contextCorrection: number;
}): DraftDecision {
  if (input.vor < -12 || (input.needScore < 0.12 && input.nonReturnProbability < 0.7) || input.contextCorrection <= -8) {
    return "AVOID";
  }
  if (
    input.draftScore >= 34 ||
    (input.vor >= 18 && input.nonReturnProbability >= 0.62) ||
    (input.tierCliff && input.needScore >= 0.35)
  ) {
    return "TAKE";
  }
  return "WAIT";
}

function buildRecommendation(
  main: PhaseOnePlayerDecision | undefined,
  alternative: PhaseOnePlayerDecision | undefined,
  context: ResolvedContext,
): PhaseOneRecommendation {
  if (!main) {
    return {
      mainMove: "WAIT: No draftable player pool is available yet.",
      supportingQuantitativeReasons: [
        "0 available players were provided by the live draft context.",
        "VOR cannot be calculated until projections or ranked players are available.",
        "Non-return probability is unavailable without a current player pool.",
      ],
      riskWarning: "Missing ESPN/player-board data. Sync the draft room before making a pick.",
      alternativePath: "Use the existing ranked board as a temporary fallback.",
      confidenceScore: 18,
      dataFreshnessStatus: dataFreshnessStatus(context),
      action: "WAIT",
    };
  }

  const actionText = main.decision === "TAKE" ? "TAKE" : main.decision === "AVOID" ? "AVOID" : "WAIT";
  const alternativeText = alternative
    ? `${alternative.decision}: ${alternative.player.name} (${alternative.player.position}) trails by ${formatNumber(main.draftScore - alternative.draftScore)} draft-score points.`
    : "No comparable alternative is available in the current player pool.";

  return {
    mainMove: `${actionText}: ${main.player.name} (${main.player.position})`,
    supportingQuantitativeReasons: [main.reasons[0] ?? "", main.reasons[1] ?? "", main.reasons[2] ?? ""],
    riskWarning: main.warning,
    alternativePath: alternativeText,
    confidenceScore: confidenceFor(main, context),
    dataFreshnessStatus: dataFreshnessStatus(context),
    action: main.decision,
    player: main.player,
  };
}

function confidenceFor(main: PhaseOnePlayerDecision, context: ResolvedContext): number {
  const freshnessPenalty = context.freshness.some((item) => item.stale) ? 14 : 0;
  const missingPenalty = Math.min(24, context.warnings.length * 5);
  const conviction = clamp(Math.abs(main.draftScore) / 1.4 + main.nonReturnProbability * 24, 25, 96);
  return Math.round(clamp(conviction - freshnessPenalty - missingPenalty, 10, 96));
}

function dataFreshnessStatus(context: ResolvedContext): string {
  if (!context.freshness.length) return "Data freshness unknown; live ESPN sync timestamp was not supplied.";
  const stale = context.freshness.filter((item) => item.stale);
  if (stale.length) return `Stale data warning: ${stale.map((item) => item.source).join(", ")}.`;
  return `Fresh: ${context.freshness.map((item) => `${item.source}${item.updatedAt ? ` @ ${item.updatedAt}` : ""}`).join("; ")}.`;
}

function warningFor(
  player: DraftPlayer,
  decision: DraftDecision,
  vor: number,
  needScore: number,
  nonReturnProbability: number,
): string {
  if ((player.riskScore ?? 0) >= 8) return `High risk profile (${player.riskScore}/10); draft only if your roster can absorb volatility.`;
  if (decision === "AVOID") return `Poor context fit: ${formatNumber(vor)} VOR and ${formatNumber(needScore * 100)} roster need.`;
  if (decision === "WAIT" && nonReturnProbability >= 0.55) return "Waiting has moderate room risk; be ready to pivot if the position starts running.";
  return "No major warning beyond normal draft variance.";
}

function isResolvedContext(context: LeagueContext | ResolvedContext): context is ResolvedContext {
  return "availablePlayers" in context && "warnings" in context && "fallbacks" in context;
}

function positiveInt(value: number | undefined, fallback: number, field: string, warnings: string[], fallbacks: string[]): number {
  if (Number.isInteger(value) && Number(value) > 0) return Number(value);
  warnings.push(`${field} missing or invalid; using ${fallback}.`);
  fallbacks.push(`${field} fallback: ${fallback}.`);
  return fallback;
}

function numberFrom(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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
