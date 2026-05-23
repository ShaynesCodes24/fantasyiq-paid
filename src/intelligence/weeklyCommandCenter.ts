import type {
  DataFreshness,
  DraftPlayer,
  LeagueContext,
  OpponentRoster,
  PlayerPosition,
  Position,
  RosterPlayer,
  SeasonPhase,
} from "./liveDraftPhase1";

export type WeeklyMoveType = "DO_NOTHING" | "START_SIT" | "WAIVER_ADD" | "DROP" | "BYE_FIX" | "INJURY_FIX" | "TRADE_CONSOLIDATION";
export type WeeklyAction = "ACT_NOW" | "WAIT" | "AVOID";

export interface WeeklyPlayer extends RosterPlayer {
  playerId: string;
  team?: string;
  byeWeek?: number;
  injuryStatus?: "ACTIVE" | "QUESTIONABLE" | "DOUBTFUL" | "OUT" | "IR" | "UNKNOWN";
  weeklyProjection?: number;
  projectedPoints?: number;
  floorPoints?: number;
  ceilingPoints?: number;
  restOfSeasonValue?: number;
  matchupRating?: number;
  volatility?: number;
  rosteredPercent?: number;
  startPercent?: number;
  isLocked?: boolean;
}

export interface WeeklyFreeAgent extends DraftPlayer {
  byeWeek?: number;
  injuryStatus?: WeeklyPlayer["injuryStatus"];
  projectedPoints?: number;
  floorPoints?: number;
  ceilingPoints?: number;
  restOfSeasonValue?: number;
  matchupRating?: number;
  volatility?: number;
  rosteredPercent?: number;
  startPercent?: number;
}

export interface WeeklyMatchupContext {
  opponentTeamId?: string;
  opponentProjectedPoints?: number;
  userProjectedPoints?: number;
  winProbability?: number;
  matchupLeverageByPosition?: Partial<Record<PlayerPosition, number>>;
}

export interface PlayoffContext {
  weeksUntilPlayoffs?: number;
  playoffOdds?: number;
  mustWinLevel?: number;
  scheduleStrengthByPosition?: Partial<Record<PlayerPosition, number>>;
}

export interface WeeklyCommandContext extends LeagueContext {
  currentWeek: number;
  seasonPhase: Exclude<SeasonPhase, "pre_draft" | "draft" | "offseason">;
  currentRosterConstruction: WeeklyPlayer[];
  liveFreeAgents: WeeklyFreeAgent[];
  opponentRosters?: OpponentRoster[];
  weeklyMatchup?: WeeklyMatchupContext;
  playoffContext?: PlayoffContext;
}

export interface WeeklyMoveCandidate {
  type: WeeklyMoveType;
  action: WeeklyAction;
  mainMove: string;
  projectedPointGain: number;
  vorGain: number;
  lineupGapImpact: number;
  benchVorImpact: number;
  riskDelta: number;
  urgencyScore: number;
  confidenceScore: number;
  playerIn?: WeeklyPlayer | WeeklyFreeAgent;
  playerOut?: WeeklyPlayer;
  supportingQuantitativeReasons: [string, string, string];
  riskWarning: string;
  alternativePath: string;
  dataFreshnessStatus: string;
  fallbackLogicUsed: string[];
}

export interface WeeklyCommandSnapshot {
  recommendation: WeeklyMoveCandidate;
  evaluatedMoves: WeeklyMoveCandidate[];
  optimalLineup: WeeklyPlayer[];
  bench: WeeklyPlayer[];
  missingDataWarnings: string[];
  fallbackLogicUsed: string[];
  generatedAt: string;
}

interface ResolvedWeeklyContext {
  scoringSettings: Record<string, unknown>;
  startingSlots: Required<Record<Position, number>>;
  benchSize: number;
  totalTeams: number;
  currentWeek: number;
  seasonPhase: WeeklyCommandContext["seasonPhase"];
  roster: WeeklyPlayer[];
  freeAgents: WeeklyFreeAgent[];
  opponentRosters: OpponentRoster[];
  weeklyMatchup: WeeklyMatchupContext;
  playoffContext: PlayoffContext;
  dataFreshness: DataFreshness[];
  warnings: string[];
  fallbacks: string[];
}

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

const PLAYER_POSITIONS: PlayerPosition[] = ["QB", "RB", "WR", "TE", "DST", "K"];
const FLEX_POSITIONS = new Set<PlayerPosition>(["RB", "WR", "TE"]);
const SUPERFLEX_POSITIONS = new Set<PlayerPosition>(["QB", "RB", "WR", "TE"]);

export function generateWeeklyCommandCenter(context: WeeklyCommandContext): WeeklyCommandSnapshot {
  const resolved = resolveWeeklyContext(context);
  const lineupPlan = buildOptimalLineup(resolved.roster, resolved.startingSlots);
  const replacementValues = calculateWeeklyReplacementValues(resolved);
  const baselineScore = lineupProjection(lineupPlan.starters);
  const moves = [
    evaluateDoNothing(resolved, lineupPlan, replacementValues),
    ...evaluateStartSitMoves(resolved, lineupPlan),
    ...evaluateWaiverMoves(resolved, lineupPlan, replacementValues),
    ...evaluateByeAndInjuryMoves(resolved, lineupPlan, replacementValues),
    evaluateTradeConsolidationNeed(resolved, lineupPlan, replacementValues),
  ]
    .filter((move): move is WeeklyMoveCandidate => Boolean(move))
    .map((move) => ({ ...move, lineupGapImpact: round(move.lineupGapImpact || baselineScore - opponentProjection(resolved), 2) }))
    .sort(compareWeeklyMoves);

  const actionable = moves.filter((move) => move.type !== "DO_NOTHING" && move.action === "ACT_NOW");
  const hold = moves.find((move) => move.type === "DO_NOTHING");
  const recommendation =
    (actionable[0] && actionable[0].urgencyScore > (hold?.urgencyScore ?? 0) + 5 ? actionable[0] : hold ?? moves[0]) ??
    evaluateDoNothing(resolved, lineupPlan, replacementValues);

  return {
    recommendation,
    evaluatedMoves: moves.slice(0, 24),
    optimalLineup: lineupPlan.starters,
    bench: lineupPlan.bench,
    missingDataWarnings: resolved.warnings,
    fallbackLogicUsed: resolved.fallbacks,
    generatedAt: new Date().toISOString(),
  };
}

function evaluateDoNothing(
  context: ResolvedWeeklyContext,
  lineupPlan: LineupPlan,
  replacementValues: Record<PlayerPosition, number>,
): WeeklyMoveCandidate {
  const bestWaiver = bestWaiverGain(context, lineupPlan, replacementValues);
  const lineupGap = lineupProjection(lineupPlan.starters) - opponentProjection(context);
  const benchHealth = benchDepthScore(lineupPlan.bench, replacementValues);
  const risk = rosterRiskScore(context.roster, context.currentWeek);
  const faabPreservation = faabPreservationValue(context);
  const holdScore = round(
    Math.max(0, -bestWaiver) * 1.8 +
      clamp(lineupGap, -12, 18) * 0.9 +
      benchHealth * 14 +
      faabPreservation * 10 -
      risk * 1.6,
    2,
  );

  return {
    type: "DO_NOTHING",
    action: holdScore >= 18 ? "WAIT" : "AVOID",
    mainMove: "Do Nothing",
    projectedPointGain: 0,
    vorGain: 0,
    lineupGapImpact: lineupGap,
    benchVorImpact: benchHealth,
    riskDelta: 0,
    urgencyScore: holdScore,
    confidenceScore: confidenceScore(context, holdScore, risk),
    supportingQuantitativeReasons: [
      `Best available waiver upgrade is ${formatSigned(bestWaiver)} projected points over your current roster fit.`,
      `Current optimal lineup is ${formatSigned(lineupGap)} points versus opponent projection.`,
      `Bench depth score is ${formatNumber(benchHealth * 100)}/100, so FAAB/priority preservation has value.`,
    ],
    riskWarning: risk >= 6 ? "Hold is fragile because injury, bye, or volatility risk is elevated." : "No urgent roster warning beats patience this week.",
    alternativePath: bestWaiver > 2 ? "Monitor the top waiver add, but wait unless news raises his role." : "Set the optimal lineup and preserve waiver/FAAB leverage.",
    dataFreshnessStatus: dataFreshnessStatus(context),
    fallbackLogicUsed: context.fallbacks,
  };
}

function evaluateStartSitMoves(context: ResolvedWeeklyContext, lineupPlan: LineupPlan): WeeklyMoveCandidate[] {
  const moves: WeeklyMoveCandidate[] = [];
  for (const starter of lineupPlan.starters) {
    const replacement = lineupPlan.bench
      .filter((benchPlayer) => canFillSlot(benchPlayer.position, slotOrPosition(starter.lineupSlot, starter.position)))
      .sort((a, b) => weeklyProjection(b, context) - weeklyProjection(a, context))[0];
    if (!replacement) continue;
    const gain = weeklyProjection(replacement, context) - weeklyProjection(starter, context);
    const riskDelta = playerRisk(starter, context.currentWeek) - playerRisk(replacement, context.currentWeek);
    const leverage = matchupLeverage(replacement.position, context);
    const score = gain * 4 + riskDelta * 2 + leverage * 8;
    if (score < 5) continue;
    moves.push({
      type: "START_SIT",
      action: score >= 12 ? "ACT_NOW" : "WAIT",
      mainMove: `Start ${replacement.name} over ${starter.name}`,
      projectedPointGain: round(gain, 2),
      vorGain: round(gain, 2),
      lineupGapImpact: round(gain, 2),
      benchVorImpact: 0,
      riskDelta: round(riskDelta, 2),
      urgencyScore: round(score, 2),
      confidenceScore: confidenceScore(context, score, playerRisk(replacement, context.currentWeek)),
      playerIn: replacement,
      playerOut: starter,
      supportingQuantitativeReasons: [
        `${replacement.name} projects ${formatSigned(gain)} points over ${starter.name}.`,
        `Risk improves by ${formatSigned(riskDelta)} risk points after injury/bye/volatility adjustment.`,
        `Matchup leverage adds ${formatNumber(leverage * 100)}/100 pressure at ${replacement.position}.`,
      ],
      riskWarning: playerRisk(replacement, context.currentWeek) >= 7 ? "The replacement is volatile; confirm news before lock." : "The main risk is projection error, not roster structure.",
      alternativePath: `Keep ${starter.name} active if late news improves his role or ${replacement.name} loses matchup leverage.`,
      dataFreshnessStatus: dataFreshnessStatus(context),
      fallbackLogicUsed: context.fallbacks,
    });
  }
  return moves;
}

function evaluateWaiverMoves(
  context: ResolvedWeeklyContext,
  lineupPlan: LineupPlan,
  replacementValues: Record<PlayerPosition, number>,
): WeeklyMoveCandidate[] {
  const drops = dropCandidates(context.roster, lineupPlan, context);
  const moves: WeeklyMoveCandidate[] = [];
  for (const add of context.freeAgents.slice(0, 50)) {
    const drop = drops.find((candidate) => candidate.position === add.position) ?? drops[0];
    if (!drop) continue;
    const addProjection = weeklyProjection(add, context);
    const dropProjection = weeklyProjection(drop, context);
    const vorGain = addProjection - Math.max(dropProjection, replacementValues[add.position] ?? 0);
    const rosterImpact = rosterConstructionImpact(add, drop, context);
    const urgency = vorGain * 3.3 + rosterImpact * 14 + matchupLeverage(add.position, context) * 9 - playerRisk(add, context.currentWeek) * 1.1;
    if (urgency < 6) continue;
    moves.push({
      type: "WAIVER_ADD",
      action: urgency >= 16 ? "ACT_NOW" : "WAIT",
      mainMove: `Add ${add.name}; drop ${drop.name}`,
      projectedPointGain: round(addProjection - dropProjection, 2),
      vorGain: round(vorGain, 2),
      lineupGapImpact: round(Math.max(0, addProjection - weakestStarterProjection(add.position, lineupPlan, context)), 2),
      benchVorImpact: round(rosterImpact, 2),
      riskDelta: round(playerRisk(drop, context.currentWeek) - playerRisk(add, context.currentWeek), 2),
      urgencyScore: round(urgency, 2),
      confidenceScore: confidenceScore(context, urgency, playerRisk(add, context.currentWeek)),
      playerIn: add,
      playerOut: drop,
      supportingQuantitativeReasons: [
        `${add.name} creates ${formatSigned(vorGain)} VOR versus ${add.position} replacement/drop value.`,
        `Roster construction impact is ${formatSigned(rosterImpact * 100)}/100 after positional need and bench depth.`,
        `Lineup gap impact is ${formatSigned(Math.max(0, addProjection - weakestStarterProjection(add.position, lineupPlan, context)))} points this week.`,
      ],
      riskWarning: waiverRiskWarning(add, context),
      alternativePath: `If waiver cost spikes, hold ${drop.name} and revisit after injury reports.`,
      dataFreshnessStatus: dataFreshnessStatus(context),
      fallbackLogicUsed: context.fallbacks,
    });
  }
  return moves.sort(compareWeeklyMoves).slice(0, 8);
}

function evaluateByeAndInjuryMoves(
  context: ResolvedWeeklyContext,
  lineupPlan: LineupPlan,
  replacementValues: Record<PlayerPosition, number>,
): WeeklyMoveCandidate[] {
  const problemPlayers = context.roster.filter((player) => hasCurrentWeekProblem(player, context.currentWeek));
  return problemPlayers
    .map((problem) => {
      const replacement =
        lineupPlan.bench.find((player) => player.playerId !== problem.playerId && canFillSlot(player.position, slotOrPosition(problem.lineupSlot, problem.position)) && !hasCurrentWeekProblem(player, context.currentWeek)) ??
        context.freeAgents.find((player) => canFillSlot(player.position, slotOrPosition(problem.lineupSlot, problem.position)) && !hasCurrentWeekProblem(player, context.currentWeek));
      if (!replacement) return undefined;
      const gain = weeklyProjection(replacement, context) - Math.max(0, weeklyProjection(problem, context));
      const type: WeeklyMoveType = problem.byeWeek === context.currentWeek ? "BYE_FIX" : "INJURY_FIX";
      const urgency = 20 + Math.max(0, gain) * 3 + matchupLeverage(problem.position, context) * 8;
      const move: WeeklyMoveCandidate = {
        type,
        action: "ACT_NOW",
        mainMove: `${type === "BYE_FIX" ? "Fix bye week" : "Replace injury risk"}: use ${replacement.name} for ${problem.name}`,
        projectedPointGain: round(gain, 2),
        vorGain: round(weeklyProjection(replacement, context) - (replacementValues[problem.position] ?? 0), 2),
        lineupGapImpact: round(gain, 2),
        benchVorImpact: 0,
        riskDelta: round(playerRisk(problem, context.currentWeek) - playerRisk(replacement, context.currentWeek), 2),
        urgencyScore: round(urgency, 2),
        confidenceScore: confidenceScore(context, urgency, playerRisk(replacement, context.currentWeek)),
        playerIn: replacement,
        playerOut: problem,
        supportingQuantitativeReasons: [
          `${problem.name} is ${problem.byeWeek === context.currentWeek ? "on bye" : `tagged ${problem.injuryStatus ?? "injured"}`}.`,
          `${replacement.name} adds ${formatSigned(gain)} projected points to the active lineup.`,
          `${replacement.position} replacement baseline is ${formatNumber(replacementValues[problem.position] ?? 0)} points.`,
        ],
        riskWarning: "Confirm official status before lineup lock; ESPN injury tags can lag breaking news.",
        alternativePath: `If ${replacement.name} becomes unavailable, use the highest-projected eligible bench player.`,
        dataFreshnessStatus: dataFreshnessStatus(context),
        fallbackLogicUsed: context.fallbacks,
      };
      return move;
    })
    .filter(isWeeklyMoveCandidate);
}

function evaluateTradeConsolidationNeed(
  context: ResolvedWeeklyContext,
  lineupPlan: LineupPlan,
  replacementValues: Record<PlayerPosition, number>,
): WeeklyMoveCandidate | undefined {
  const benchValue = lineupPlan.bench.reduce((sum, player) => sum + Math.max(0, weeklyProjection(player, context) - (replacementValues[player.position] ?? 0)), 0);
  const weakestStarter = [...lineupPlan.starters].sort((a, b) => weeklyProjection(a, context) - weeklyProjection(b, context))[0];
  if (!weakestStarter || benchValue < 18) return undefined;
  const score = benchValue * 0.9 + Math.max(0, 10 - weeklyProjection(weakestStarter, context)) * 2;
  return {
    type: "TRADE_CONSOLIDATION",
    action: score >= 24 ? "ACT_NOW" : "WAIT",
    mainMove: `Shop bench depth to upgrade ${weakestStarter.position}`,
    projectedPointGain: 0,
    vorGain: round(benchValue, 2),
    lineupGapImpact: 0,
    benchVorImpact: round(benchValue, 2),
    riskDelta: 0,
    urgencyScore: round(score, 2),
    confidenceScore: confidenceScore(context, score, 4),
    playerOut: weakestStarter,
    supportingQuantitativeReasons: [
      `Bench VOR surplus is ${formatNumber(benchValue)} points above replacement.`,
      `Weakest starter is ${weakestStarter.name} at ${formatNumber(weeklyProjection(weakestStarter, context))} projected points.`,
      `Consolidation is favored when bench points cannot enter ${starterCount(context.startingSlots)} starting slots.`,
    ],
    riskWarning: "Trade scan is directional until Phase 4 identifies exact partner acceptance probability.",
    alternativePath: "Hold depth through the next injury/news window if your starters are already projected ahead.",
    dataFreshnessStatus: dataFreshnessStatus(context),
    fallbackLogicUsed: context.fallbacks,
  };
}

interface LineupPlan {
  starters: WeeklyPlayer[];
  bench: WeeklyPlayer[];
}

function buildOptimalLineup(roster: WeeklyPlayer[], slots: Required<Record<Position, number>>): LineupPlan {
  const remaining = [...roster].sort((a, b) => baseProjection(b) - baseProjection(a));
  const starters: WeeklyPlayer[] = [];

  for (const pos of PLAYER_POSITIONS) {
    takeForSlot(remaining, starters, pos, slots[pos], pos);
  }
  takeForSlot(remaining, starters, "FLEX", slots.FLEX, "FLEX");
  takeForSlot(remaining, starters, "SUPERFLEX", slots.SUPERFLEX, "SUPERFLEX");

  return { starters, bench: remaining };
}

function takeForSlot(
  remaining: WeeklyPlayer[],
  starters: WeeklyPlayer[],
  slot: Position,
  count: number,
  lineupSlot: Position,
): void {
  for (let index = 0; index < count; index += 1) {
    const candidateIndex = remaining.findIndex((player) => canFillSlot(player.position, slot));
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

function slotOrPosition(slot: WeeklyPlayer["lineupSlot"], fallback: PlayerPosition): Position {
  if (!slot || slot === "BE" || slot === "IR") return fallback;
  return slot;
}

function resolveWeeklyContext(context: WeeklyCommandContext): ResolvedWeeklyContext {
  const warnings: string[] = [];
  const fallbacks: string[] = [];
  const startingSlots = { ...DEFAULT_STARTING_SLOTS, ...(context.startingSlots ?? {}) };
  const roster = context.currentRosterConstruction ?? [];
  const freeAgents = context.liveFreeAgents ?? [];

  if (!context.currentRosterConstruction?.length) {
    warnings.push("currentRosterConstruction missing; Weekly Command Center cannot evaluate true lineup strength.");
    fallbacks.push("Roster fallback: empty roster.");
  }
  if (!context.liveFreeAgents?.length) {
    warnings.push("liveFreeAgents missing; waiver comparison falls back to hold/start-sit logic.");
    fallbacks.push("Free-agent fallback: no waiver pool.");
  }
  if (!context.weeklyMatchup?.opponentProjectedPoints) {
    warnings.push("weeklyMatchup.opponentProjectedPoints missing; matchup gap uses neutral opponent projection.");
    fallbacks.push("Matchup fallback: neutral opponent projection.");
  }
  if (!context.dataFreshness?.length) {
    warnings.push("dataFreshness missing; freshness status is unknown.");
    fallbacks.push("Freshness fallback: unknown source timestamps.");
  }

  return {
    scoringSettings: context.scoringSettings ?? {},
    startingSlots,
    benchSize: positiveInt(context.benchSize, 7),
    totalTeams: positiveInt(context.totalTeams, 12),
    currentWeek: positiveInt(context.currentWeek, 1),
    seasonPhase: context.seasonPhase,
    roster,
    freeAgents,
    opponentRosters: context.opponentRosters ?? [],
    weeklyMatchup: context.weeklyMatchup ?? {},
    playoffContext: context.playoffContext ?? {},
    dataFreshness: context.dataFreshness ?? [],
    warnings,
    fallbacks,
  };
}

function calculateWeeklyReplacementValues(context: ResolvedWeeklyContext): Record<PlayerPosition, number> {
  const values = {} as Record<PlayerPosition, number>;
  for (const pos of PLAYER_POSITIONS) {
    const pool = context.freeAgents.filter((player) => player.position === pos).sort((a, b) => weeklyProjection(b, context) - weeklyProjection(a, context));
    const replacementIndex = Math.min(Math.max(0, Math.round(context.totalTeams * 0.15)), Math.max(0, pool.length - 1));
    values[pos] = pool[replacementIndex] ? weeklyProjection(pool[replacementIndex], context) : defaultReplacement(pos);
  }
  return values;
}

function dropCandidates(roster: WeeklyPlayer[], lineupPlan: LineupPlan, context: ResolvedWeeklyContext): WeeklyPlayer[] {
  const starterIds = new Set(lineupPlan.starters.map((player) => player.playerId));
  return roster
    .filter((player) => !starterIds.has(player.playerId) && !player.isLocked)
    .sort((a, b) => dropScore(b, context) - dropScore(a, context));
}

function dropScore(player: WeeklyPlayer, context: ResolvedWeeklyContext): number {
  return (
    playerRisk(player, context.currentWeek) * 2 -
    weeklyProjection(player, context) * 0.7 -
    (player.restOfSeasonValue ?? weeklyProjection(player, context) * 1.8) * 0.3 -
    positionalFragility(player.position, context) * 8
  );
}

function bestWaiverGain(
  context: ResolvedWeeklyContext,
  lineupPlan: LineupPlan,
  replacementValues: Record<PlayerPosition, number>,
): number {
  const drops = dropCandidates(context.roster, lineupPlan, context);
  let best = 0;
  for (const add of context.freeAgents.slice(0, 30)) {
    const drop = drops.find((candidate) => candidate.position === add.position) ?? drops[0];
    if (!drop) continue;
    best = Math.max(best, weeklyProjection(add, context) - Math.max(weeklyProjection(drop, context), replacementValues[add.position] ?? 0));
  }
  return round(best, 2);
}

function rosterConstructionImpact(add: WeeklyFreeAgent, drop: WeeklyPlayer, context: ResolvedWeeklyContext): number {
  const before = positionalFragility(add.position, context);
  const addedPlayer = compactWeeklyPlayer(add);
  const afterRoster = context.roster.filter((player) => player.playerId !== drop.playerId).concat(addedPlayer);
  const afterContext = { ...context, roster: afterRoster };
  return round(before - positionalFragility(add.position, afterContext), 2);
}

function compactWeeklyPlayer(add: WeeklyFreeAgent): WeeklyPlayer {
  const player: WeeklyPlayer = {
    playerId: add.id,
    name: add.name,
    position: add.position,
  };
  if (add.team !== undefined) player.team = add.team;
  if (add.projectedPoints !== undefined) player.projectedPoints = add.projectedPoints;
  if (add.weeklyProjection !== undefined) player.weeklyProjection = add.weeklyProjection;
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

function positionalFragility(pos: PlayerPosition, context: ResolvedWeeklyContext): number {
  const healthy = context.roster.filter((player) => player.position === pos && !hasCurrentWeekProblem(player, context.currentWeek)).length;
  const target = Math.max(1, Math.ceil(starterDemand(pos, context.startingSlots)));
  return clamp((target + 1 - healthy) / (target + 1), 0, 1);
}

function starterDemand(pos: PlayerPosition, slots: Required<Record<Position, number>>): number {
  let demand = slots[pos];
  if (FLEX_POSITIONS.has(pos)) demand += slots.FLEX / 3;
  if (SUPERFLEX_POSITIONS.has(pos)) demand += slots.SUPERFLEX / 4;
  return demand;
}

function weakestStarterProjection(pos: PlayerPosition, lineupPlan: LineupPlan, context: ResolvedWeeklyContext): number {
  const eligible = lineupPlan.starters.filter((player) => canFillSlot(pos, slotOrPosition(player.lineupSlot, player.position)));
  return eligible.length ? Math.min(...eligible.map((player) => weeklyProjection(player, context))) : 0;
}

function weeklyProjection(player: WeeklyPlayer | WeeklyFreeAgent, context: ResolvedWeeklyContext): number {
  if (hasCurrentWeekProblem(player, context.currentWeek)) return 0;
  let projection = baseProjection(player);
  projection += (player.matchupRating ?? 0) * 0.08;
  if (context.seasonPhase === "playoffs") projection += (context.playoffContext.scheduleStrengthByPosition?.[player.position] ?? 0) * 0.1;
  return round(Math.max(0, projection), 2);
}

function baseProjection(player: WeeklyPlayer | WeeklyFreeAgent): number {
  return numberFrom(player.weeklyProjection) ?? numberFrom(player.projectedPoints) ?? impliedProjection(player.position);
}

function impliedProjection(pos: PlayerPosition): number {
  const defaults: Record<PlayerPosition, number> = { QB: 17, RB: 10, WR: 10, TE: 7, DST: 6, K: 7 };
  return defaults[pos];
}

function playerRisk(player: WeeklyPlayer | WeeklyFreeAgent, currentWeek: number): number {
  let risk = player.volatility ?? 4;
  if (player.byeWeek === currentWeek) risk += 10;
  if (player.injuryStatus === "QUESTIONABLE") risk += 2;
  if (player.injuryStatus === "DOUBTFUL") risk += 6;
  if (player.injuryStatus === "OUT" || player.injuryStatus === "IR") risk += 10;
  return clamp(risk, 1, 10);
}

function rosterRiskScore(roster: WeeklyPlayer[], currentWeek: number): number {
  if (!roster.length) return 8;
  return average(roster.map((player) => playerRisk(player, currentWeek)));
}

function hasCurrentWeekProblem(player: WeeklyPlayer | WeeklyFreeAgent, currentWeek: number): boolean {
  return player.byeWeek === currentWeek || player.injuryStatus === "OUT" || player.injuryStatus === "IR" || player.injuryStatus === "DOUBTFUL";
}

function benchDepthScore(bench: WeeklyPlayer[], replacementValues: Record<PlayerPosition, number>): number {
  if (!bench.length) return 0;
  const positiveDepth = bench.reduce((sum, player) => sum + Math.max(0, baseProjection(player) - (replacementValues[player.position] ?? 0)), 0);
  return clamp(positiveDepth / 30, 0, 1);
}

function matchupLeverage(pos: PlayerPosition, context: ResolvedWeeklyContext): number {
  return clamp(context.weeklyMatchup.matchupLeverageByPosition?.[pos] ?? 0.35, 0, 1);
}

function opponentProjection(context: ResolvedWeeklyContext): number {
  return context.weeklyMatchup.opponentProjectedPoints ?? context.weeklyMatchup.userProjectedPoints ?? 112;
}

function lineupProjection(starters: WeeklyPlayer[]): number {
  return round(starters.reduce((sum, player) => sum + baseProjection(player), 0), 2);
}

function faabPreservationValue(context: ResolvedWeeklyContext): number {
  const budget = numberFrom(context.scoringSettings["faabBudget"]) ?? 100;
  const remaining = numberFrom(context.scoringSettings["remainingFaabBudget"]) ?? budget;
  const seasonRemaining = clamp((15 - context.currentWeek) / 14, 0, 1);
  return clamp((remaining / Math.max(1, budget)) * seasonRemaining, 0, 1);
}

function confidenceScore(context: ResolvedWeeklyContext, moveScore: number, risk: number): number {
  const stalePenalty = context.dataFreshness.some((item) => item.stale) ? 14 : 0;
  const missingPenalty = Math.min(22, context.warnings.length * 4);
  return Math.round(clamp(48 + moveScore * 1.2 - risk * 2 - stalePenalty - missingPenalty, 12, 96));
}

function compareWeeklyMoves(a: WeeklyMoveCandidate, b: WeeklyMoveCandidate): number {
  return b.urgencyScore - a.urgencyScore || b.confidenceScore - a.confidenceScore || b.projectedPointGain - a.projectedPointGain;
}

function isWeeklyMoveCandidate(move: WeeklyMoveCandidate | undefined): move is WeeklyMoveCandidate {
  return Boolean(move);
}

function waiverRiskWarning(add: WeeklyFreeAgent, context: ResolvedWeeklyContext): string {
  if (playerRisk(add, context.currentWeek) >= 7) return "High player risk; do not spend aggressively unless news confirms role security.";
  if ((add.rosteredPercent ?? 0) < 15) return "Thin market confirmation; treat as speculative unless your roster need is urgent.";
  return "Main risk is opportunity volatility and waiver cost.";
}

function dataFreshnessStatus(context: ResolvedWeeklyContext): string {
  if (!context.dataFreshness.length) return "Data freshness unknown; use as directional until ESPN/projection sync is confirmed.";
  const stale = context.dataFreshness.filter((item) => item.stale);
  if (stale.length) return `Stale data warning: ${stale.map((item) => item.source).join(", ")}.`;
  return `Fresh: ${context.dataFreshness.map((item) => `${item.source}${item.updatedAt ? ` @ ${item.updatedAt}` : ""}`).join("; ")}.`;
}

function starterCount(slots: Required<Record<Position, number>>): number {
  return Object.entries(slots)
    .filter(([slot]) => slot !== "BE" && slot !== "IR")
    .reduce((sum, [, count]) => sum + Number(count || 0), 0);
}

function defaultReplacement(pos: PlayerPosition): number {
  const defaults: Record<PlayerPosition, number> = { QB: 15, RB: 8, WR: 8, TE: 5.5, DST: 5, K: 6 };
  return defaults[pos];
}

function positiveInt(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

function numberFrom(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return undefined;
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

function formatSigned(value: number): string {
  return `${value >= 0 ? "+" : ""}${formatNumber(round(value, 1))}`;
}
