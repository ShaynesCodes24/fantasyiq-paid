import type { DataFreshness, LeagueContext, ManagerTendency, PlayerPosition, Position } from "./liveDraftPhase1";
import type { PlayoffContext, WeeklyPlayer } from "./weeklyCommandCenter";

export type TradeProposalAction = "SEND_OFFER" | "WATCH" | "AVOID";

export interface TradeSignalPlayer extends WeeklyPlayer {
  restOfSeasonValue: number;
  tradeValue?: number;
  marketValue?: number;
  recentFantasyPoints?: number;
  expectedFantasyPoints?: number;
  utilizationScore?: number;
  snapShare?: number;
  routeParticipation?: number;
  targetShare?: number;
  carryShare?: number;
  redZoneUsage?: number;
  touchdownDelta?: number;
  playoffScheduleRating?: number;
  nameValueScore?: number;
  ageRisk?: number;
}

export interface TradePartnerTeam {
  teamId: string;
  teamName: string;
  managerName?: string;
  roster: TradeSignalPlayer[];
  managerTendency?: ManagerTendency & {
    tradeAggression?: number;
    acceptsDepthForStarters?: number;
    nameValueBias?: number;
  };
}

export interface TradeFinderContext extends LeagueContext {
  currentWeek: number;
  seasonPhase: "regular_season" | "playoffs";
  currentRosterConstruction: TradeSignalPlayer[];
  opponentTeams: TradePartnerTeam[];
  playoffContext?: PlayoffContext;
  tradeSettings?: {
    deadlineWeek?: number;
    vetoRisk?: number;
    allowDraftPickTrading?: boolean;
  };
}

export interface TradeProposal {
  action: TradeProposalAction;
  mainMove: string;
  userSends: TradeSignalPlayer[];
  userReceives: TradeSignalPlayer[];
  opponentTeamId: string;
  opponentTeamName: string;
  whyOtherManagerMayAccept: string;
  projectedLineupImprovementForUser: number;
  projectedLineupImprovementForOpponent: number;
  opponentRosterBalanceImprovement: number;
  buyLowScore: number;
  sellHighScore: number;
  acceptanceProbability: number;
  confidenceScore: number;
  supportingQuantitativeReasons: [string, string, string];
  riskWarning: string;
  negotiationAngle: string;
  alternativePath: string;
  dataFreshnessStatus: string;
  missingDataWarnings: string[];
  fallbackLogicUsed: string[];
}

export interface TradeFinderSnapshot {
  recommendation: TradeProposal;
  proposals: TradeProposal[];
  buyLowTargets: TradeSignalPlayer[];
  sellHighCandidates: TradeSignalPlayer[];
  missingDataWarnings: string[];
  fallbackLogicUsed: string[];
  generatedAt: string;
}

interface ResolvedTradeContext {
  startingSlots: Required<Record<Position, number>>;
  benchSize: number;
  totalTeams: number;
  currentWeek: number;
  seasonPhase: TradeFinderContext["seasonPhase"];
  userRoster: TradeSignalPlayer[];
  opponentTeams: TradePartnerTeam[];
  playoffContext: PlayoffContext;
  deadlineWeek: number;
  vetoRisk: number;
  dataFreshness: DataFreshness[];
  warnings: string[];
  fallbacks: string[];
}

interface TeamProfile {
  teamId: string;
  teamName: string;
  managerName?: string;
  roster: TradeSignalPlayer[];
  lineupValue: number;
  needs: Partial<Record<PlayerPosition, number>>;
  surplus: Partial<Record<PlayerPosition, number>>;
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

export function generateTradeFinder(context: TradeFinderContext): TradeFinderSnapshot {
  const resolved = resolveTradeContext(context);
  const userProfile = teamProfile("user", "Your Team", resolved.userRoster, resolved);
  const buyLowTargets = resolved.opponentTeams
    .flatMap((team) => team.roster)
    .filter((player) => valueDepressionScore(player) >= 0.48)
    .sort((a, b) => valueDepressionScore(b) - valueDepressionScore(a))
    .slice(0, 16);
  const sellHighCandidates = resolved.userRoster
    .filter((player) => sellHighScore(player) >= 0.38 || surplusAtPosition(player.position, userProfile) > 0.25)
    .sort((a, b) => sellHighScore(b) - sellHighScore(a))
    .slice(0, 16);

  const proposals = resolved.opponentTeams
    .flatMap((opponent) => generateProposalsForOpponent(opponent, userProfile, resolved, buyLowTargets, sellHighCandidates))
    .sort(compareProposals)
    .slice(0, 18);

  const recommendation = proposals[0] ?? buildNoTradeRecommendation(resolved);
  return {
    recommendation,
    proposals,
    buyLowTargets,
    sellHighCandidates,
    missingDataWarnings: resolved.warnings,
    fallbackLogicUsed: resolved.fallbacks,
    generatedAt: new Date().toISOString(),
  };
}

function generateProposalsForOpponent(
  opponent: TradePartnerTeam,
  userProfile: TeamProfile,
  context: ResolvedTradeContext,
  buyLowTargets: TradeSignalPlayer[],
  sellHighCandidates: TradeSignalPlayer[],
): TradeProposal[] {
  const opponentProfile = teamProfile(opponent.teamId, opponent.teamName, opponent.roster, context, opponent.managerName);
  const userTradeAwayPool = tradeAwayPool(userProfile, sellHighCandidates, context);
  const opponentTargets = opponent.roster
    .filter((player) => needAtPosition(player.position, userProfile) > 0.1 || buyLowTargets.some((target) => target.playerId === player.playerId))
    .sort((a, b) => targetScore(b, userProfile, context) - targetScore(a, userProfile, context))
    .slice(0, 8);
  const proposals: TradeProposal[] = [];

  for (const target of opponentTargets) {
    for (const send of userTradeAwayPool.slice(0, 10)) {
      const oneForOne = evaluateTrade([send], [target], opponent, userProfile, opponentProfile, context);
      if (oneForOne) proposals.push(oneForOne);
    }
    for (const bundle of userBundles(userTradeAwayPool, target, opponentProfile, context).slice(0, 8)) {
      const proposal = evaluateTrade(bundle, [target], opponent, userProfile, opponentProfile, context);
      if (proposal) proposals.push(proposal);
    }
  }

  return proposals;
}

function evaluateTrade(
  userSends: TradeSignalPlayer[],
  userReceives: TradeSignalPlayer[],
  opponent: TradePartnerTeam,
  userProfile: TeamProfile,
  opponentProfile: TeamProfile,
  context: ResolvedTradeContext,
): TradeProposal | undefined {
  const beforeUser = userProfile.lineupValue;
  const afterUserRoster = applyTrade(userProfile.roster, userSends, userReceives);
  const afterUserLineup = lineupValue(afterUserRoster, context);
  const userGain = round(afterUserLineup - beforeUser, 2);

  const beforeOpponent = opponentProfile.lineupValue;
  const afterOpponentRoster = applyTrade(opponentProfile.roster, userReceives, userSends);
  const afterOpponentLineup = lineupValue(afterOpponentRoster, context);
  const opponentGain = round(afterOpponentLineup - beforeOpponent, 2);
  const opponentBalance = round(balanceScore(afterOpponentRoster, context) - balanceScore(opponentProfile.roster, context), 2);
  const outgoingValue = userSends.reduce((sum, player) => sum + perceivedTradeValue(player, opponent.managerTendency), 0);
  const incomingValue = userReceives.reduce((sum, player) => sum + perceivedTradeValue(player), 0);
  const valueDeltaForOpponent = outgoingValue - incomingValue;
  const buyLow = average(userReceives.map(valueDepressionScore));
  const sellHigh = average(userSends.map(sellHighScore));
  const acceptanceProbability = acceptanceProbabilityFor({
    opponentGain,
    opponentBalance,
    valueDeltaForOpponent,
    opponent,
    userSends,
    userReceives,
    context,
  });
  const score = userGain * 8 + opponentGain * 3.5 + opponentBalance * 12 + buyLow * 18 + sellHigh * 8 + acceptanceProbability * 20 - context.vetoRisk * 8;

  if (userGain < -1.5 || acceptanceProbability < 0.18 || score < 16) return undefined;

  const action: TradeProposalAction = score >= 36 && acceptanceProbability >= 0.38 ? "SEND_OFFER" : score >= 24 ? "WATCH" : "AVOID";
  const target = userReceives[0];
  const mainMove = `Offer ${playerList(userSends)} for ${playerList(userReceives)}`;

  return {
    action,
    mainMove,
    userSends,
    userReceives,
    opponentTeamId: opponent.teamId,
    opponentTeamName: opponent.teamName,
    whyOtherManagerMayAccept: whyOpponentMayAccept(userSends, userReceives, opponentProfile, opponentGain, opponentBalance),
    projectedLineupImprovementForUser: userGain,
    projectedLineupImprovementForOpponent: opponentGain,
    opponentRosterBalanceImprovement: opponentBalance,
    buyLowScore: round(buyLow, 3),
    sellHighScore: round(sellHigh, 3),
    acceptanceProbability: round(acceptanceProbability, 3),
    confidenceScore: confidenceFor(score, acceptanceProbability, context),
    supportingQuantitativeReasons: [
      `Your optimized lineup improves ${formatSigned(userGain)} points after the trade.`,
      `${opponent.teamName} improves ${formatSigned(opponentGain)} lineup points and ${formatSigned(opponentBalance * 100)}/100 roster balance.`,
      `${target ? target.name : "Target"} buy-low score is ${formatNumber(buyLow * 100)}/100; outgoing sell-high score is ${formatNumber(sellHigh * 100)}/100.`,
    ],
    riskWarning: riskWarningFor(userSends, userReceives, context),
    negotiationAngle: negotiationAngleFor(userSends, userReceives, opponentProfile),
    alternativePath: alternativePathFor(action, userReceives, userSends),
    dataFreshnessStatus: dataFreshnessStatus(context),
    missingDataWarnings: context.warnings,
    fallbackLogicUsed: context.fallbacks,
  };
}

function valueDepressionScore(player: TradeSignalPlayer): number {
  const expected = numberFrom(player.expectedFantasyPoints) ?? baseProjection(player);
  const recent = numberFrom(player.recentFantasyPoints) ?? baseProjection(player);
  const utilization = clamp((player.utilizationScore ?? utilizationProxy(player)) / 100, 0, 1);
  const tdUnderperformance = clamp(Math.max(0, -(player.touchdownDelta ?? 0)) / 5, 0, 0.35);
  const roleStrength = clamp((player.snapShare ?? 0) / 100, 0, 0.18) + clamp((player.routeParticipation ?? 0) / 100, 0, 0.16);
  const expectedGap = clamp((expected - recent) / 12, 0, 0.34);
  return clamp(expectedGap + utilization * 0.34 + tdUnderperformance + roleStrength, 0, 1);
}

function sellHighScore(player: TradeSignalPlayer): number {
  const expected = numberFrom(player.expectedFantasyPoints) ?? baseProjection(player);
  const recent = numberFrom(player.recentFantasyPoints) ?? baseProjection(player);
  const tdOverperformance = clamp(Math.max(0, player.touchdownDelta ?? 0) / 5, 0, 0.32);
  const weakUtilization = clamp(1 - (player.utilizationScore ?? utilizationProxy(player)) / 100, 0, 0.38);
  const recentGap = clamp((recent - expected) / 12, 0, 0.32);
  const nameValue = clamp((player.nameValueScore ?? 45) / 100, 0, 0.16);
  return clamp(recentGap + tdOverperformance + weakUtilization + nameValue, 0, 1);
}

function teamProfile(
  teamId: string,
  teamName: string,
  roster: TradeSignalPlayer[],
  context: ResolvedTradeContext,
  managerName?: string,
): TeamProfile {
  const profile: TeamProfile = {
    teamId,
    teamName,
    roster,
    lineupValue: lineupValue(roster, context),
    needs: positionNeeds(roster, context),
    surplus: positionSurplus(roster, context),
  };
  if (managerName !== undefined) profile.managerName = managerName;
  return profile;
}

function tradeAwayPool(userProfile: TeamProfile, sellHighCandidates: TradeSignalPlayer[], context: ResolvedTradeContext): TradeSignalPlayer[] {
  const starterIds = new Set(buildOptimalLineup(userProfile.roster, context.startingSlots).map((player) => player.playerId));
  return userProfile.roster
    .filter((player) => !player.isLocked)
    .map((player) => ({
      player,
      score:
        surplusAtPosition(player.position, userProfile) * 22 +
        sellHighScore(player) * 24 +
        (starterIds.has(player.playerId) ? -12 : 8) -
        needAtPosition(player.position, userProfile) * 18,
    }))
    .filter((item) => item.score > -2 || sellHighCandidates.some((player) => player.playerId === item.player.playerId))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.player);
}

function userBundles(
  pool: TradeSignalPlayer[],
  target: TradeSignalPlayer,
  opponentProfile: TeamProfile,
  context: ResolvedTradeContext,
): TradeSignalPlayer[][] {
  const targetPerceived = perceivedTradeValue(target);
  const candidates = pool.filter((player) => needAtPosition(player.position, opponentProfile) > 0.1 || perceivedTradeValue(player) >= targetPerceived * 0.35);
  const bundles: TradeSignalPlayer[][] = [];
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const first = candidates[i];
      const second = candidates[j];
      if (!first || !second) continue;
      const value = perceivedTradeValue(first) + perceivedTradeValue(second);
      if (value >= targetPerceived * 0.72 && value <= targetPerceived * 1.45) bundles.push([first, second]);
    }
  }
  return bundles.sort((a, b) => bundleFitScore(b, opponentProfile, context) - bundleFitScore(a, opponentProfile, context));
}

function bundleFitScore(bundle: TradeSignalPlayer[], opponentProfile: TeamProfile, context: ResolvedTradeContext): number {
  return bundle.reduce((sum, player) => sum + needAtPosition(player.position, opponentProfile) * 18 + baseProjection(player) * 0.2, 0) - (bundle.length - 1) * 2;
}

function targetScore(player: TradeSignalPlayer, userProfile: TeamProfile, context: ResolvedTradeContext): number {
  return (
    needAtPosition(player.position, userProfile) * 28 +
    valueDepressionScore(player) * 22 +
    baseProjection(player) * 0.45 +
    (player.playoffScheduleRating ?? context.playoffContext.scheduleStrengthByPosition?.[player.position] ?? 0) * 0.18
  );
}

function applyTrade(roster: TradeSignalPlayer[], sends: TradeSignalPlayer[], receives: TradeSignalPlayer[]): TradeSignalPlayer[] {
  const sendIds = new Set(sends.map((player) => player.playerId));
  return roster.filter((player) => !sendIds.has(player.playerId)).concat(receives);
}

function buildOptimalLineup(roster: TradeSignalPlayer[], slots: Required<Record<Position, number>>): TradeSignalPlayer[] {
  const remaining = [...roster].sort((a, b) => baseProjection(b) - baseProjection(a));
  const starters: TradeSignalPlayer[] = [];
  for (const pos of PLAYER_POSITIONS) takeForSlot(remaining, starters, pos, slots[pos]);
  takeForSlot(remaining, starters, "FLEX", slots.FLEX);
  takeForSlot(remaining, starters, "SUPERFLEX", slots.SUPERFLEX);
  return starters;
}

function takeForSlot(remaining: TradeSignalPlayer[], starters: TradeSignalPlayer[], slot: Position, count: number): void {
  for (let index = 0; index < count; index += 1) {
    const candidateIndex = remaining.findIndex((player) => canFillSlot(player.position, slot));
    if (candidateIndex < 0) return;
    const [candidate] = remaining.splice(candidateIndex, 1);
    if (candidate) starters.push(candidate);
  }
}

function canFillSlot(position: PlayerPosition, slot: Position): boolean {
  if (slot === "FLEX") return FLEX_POSITIONS.has(position);
  if (slot === "SUPERFLEX") return SUPERFLEX_POSITIONS.has(position);
  return position === slot;
}

function lineupValue(roster: TradeSignalPlayer[], context: ResolvedTradeContext): number {
  return round(buildOptimalLineup(roster, context.startingSlots).reduce((sum, player) => sum + baseProjection(player), 0), 2);
}

function balanceScore(roster: TradeSignalPlayer[], context: ResolvedTradeContext): number {
  const needs = positionNeeds(roster, context);
  const needPenalty = PLAYER_POSITIONS.reduce((sum, pos) => sum + (needs[pos] ?? 0), 0);
  const starters = buildOptimalLineup(roster, context.startingSlots);
  const starterIds = new Set(starters.map((player) => player.playerId));
  const benchValue = roster
    .filter((player) => !starterIds.has(player.playerId))
    .reduce((sum, player) => sum + Math.max(0, baseProjection(player) - defaultReplacement(player.position)), 0);
  return clamp(1 - needPenalty / 4 + benchValue / 60, -1, 1);
}

function positionNeeds(roster: TradeSignalPlayer[], context: ResolvedTradeContext): Partial<Record<PlayerPosition, number>> {
  const counts = positionCounts(roster);
  const needs: Partial<Record<PlayerPosition, number>> = {};
  for (const pos of PLAYER_POSITIONS) {
    const target = starterDemand(pos, context.startingSlots) + context.benchSize * benchShare(pos);
    needs[pos] = clamp((target - (counts[pos] ?? 0)) / Math.max(1, target), 0, 1);
  }
  return needs;
}

function positionSurplus(roster: TradeSignalPlayer[], context: ResolvedTradeContext): Partial<Record<PlayerPosition, number>> {
  const counts = positionCounts(roster);
  const surplus: Partial<Record<PlayerPosition, number>> = {};
  for (const pos of PLAYER_POSITIONS) {
    const target = starterDemand(pos, context.startingSlots) + context.benchSize * benchShare(pos);
    surplus[pos] = clamp(((counts[pos] ?? 0) - target) / Math.max(1, target), 0, 1);
  }
  return surplus;
}

function positionCounts(roster: TradeSignalPlayer[]): Partial<Record<PlayerPosition, number>> {
  const counts: Partial<Record<PlayerPosition, number>> = {};
  for (const player of roster) counts[player.position] = (counts[player.position] ?? 0) + 1;
  return counts;
}

function needAtPosition(pos: PlayerPosition, profile: TeamProfile): number {
  return profile.needs[pos] ?? 0;
}

function surplusAtPosition(pos: PlayerPosition, profile: TeamProfile): number {
  return profile.surplus[pos] ?? 0;
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

function baseProjection(player: TradeSignalPlayer): number {
  return numberFrom(player.weeklyProjection) ?? numberFrom(player.projectedPoints) ?? defaultReplacement(player.position);
}

function perceivedTradeValue(player: TradeSignalPlayer, tendency?: TradePartnerTeam["managerTendency"]): number {
  const base = numberFrom(player.tradeValue) ?? numberFrom(player.marketValue) ?? player.restOfSeasonValue ?? baseProjection(player) * 5;
  const nameBoost = (tendency?.nameValueBias ?? 0.4) * ((player.nameValueScore ?? 45) - 45) * 0.08;
  const recentBoost = Math.max(0, (player.recentFantasyPoints ?? baseProjection(player)) - (player.expectedFantasyPoints ?? baseProjection(player))) * 1.8;
  return round(Math.max(1, base + nameBoost + recentBoost), 2);
}

function acceptanceProbabilityFor(input: {
  opponentGain: number;
  opponentBalance: number;
  valueDeltaForOpponent: number;
  opponent: TradePartnerTeam;
  userSends: TradeSignalPlayer[];
  userReceives: TradeSignalPlayer[];
  context: ResolvedTradeContext;
}): number {
  const aggression = input.opponent.managerTendency?.tradeAggression ?? input.opponent.managerTendency?.aggressiveness ?? 0.42;
  const depthPreference = input.opponent.managerTendency?.acceptsDepthForStarters ?? 0.4;
  const bundleFit = input.userSends.length > input.userReceives.length ? depthPreference * 0.12 : 0;
  const score =
    input.opponentGain * 0.08 +
    input.opponentBalance * 0.28 +
    input.valueDeltaForOpponent * 0.012 +
    aggression * 0.18 +
    bundleFit -
    input.context.vetoRisk * 0.12;
  return round(clamp(0.28 + score, 0.03, 0.92), 3);
}

function whyOpponentMayAccept(
  sends: TradeSignalPlayer[],
  receives: TradeSignalPlayer[],
  opponentProfile: TeamProfile,
  opponentGain: number,
  opponentBalance: number,
): string {
  const incomingPositions = [...new Set(sends.map((player) => player.position))];
  const needText = incomingPositions
    .filter((pos) => needAtPosition(pos, opponentProfile) > 0.15)
    .map((pos) => `${pos} need ${formatNumber((needAtPosition(pos, opponentProfile) ?? 0) * 100)}/100`)
    .join(", ");
  const valueText = `${formatSigned(opponentGain)} projected starter points and ${formatSigned(opponentBalance * 100)}/100 roster balance`;
  return needText ? `They may accept because your offer addresses ${needText}, worth ${valueText}.` : `They may accept because the deal offers ${valueText} without relying only on raw rankings.`;
}

function negotiationAngleFor(sends: TradeSignalPlayer[], receives: TradeSignalPlayer[], opponentProfile: TeamProfile): string {
  const positions = [...new Set(sends.map((player) => player.position))];
  const hook = positions.find((pos) => needAtPosition(pos, opponentProfile) > 0.15);
  if (hook) return `Lead with their ${hook} need and frame ${playerList(sends)} as immediate lineup stability.`;
  if (sends.length > receives.length) return "Frame this as depth plus injury protection for one concentrated asset.";
  return "Frame this as a clean need-for-need swap, then leave room to add a small bench sweetener.";
}

function riskWarningFor(sends: TradeSignalPlayer[], receives: TradeSignalPlayer[], context: ResolvedTradeContext): string {
  const receivedRisk = average(receives.map((player) => player.volatility ?? 4));
  const sentPositions = new Set(sends.map((player) => player.position));
  const createsThinSpot = [...sentPositions].some((pos) => {
    const after = context.userRoster.filter((player) => !sends.some((sent) => sent.playerId === player.playerId)).concat(receives);
    return (positionNeeds(after, context)[pos] ?? 0) > 0.45;
  });
  if (createsThinSpot) return "This could create a thin positional room; confirm waiver fallback before sending.";
  if (receivedRisk >= 7) return "Incoming side is volatile; negotiate a safer secondary piece or keep the offer small.";
  if (context.currentWeek >= context.deadlineWeek - 1) return "Trade deadline pressure can reduce negotiation flexibility; avoid overpaying just to act.";
  return "Main risk is partner rejection or role volatility after the offer is sent.";
}

function alternativePathFor(action: TradeProposalAction, receives: TradeSignalPlayer[], sends: TradeSignalPlayer[]): string {
  if (action === "SEND_OFFER") return `If rejected, remove the lowest-value outgoing piece or ask for a bench throw-in with ${playerList(receives)}.`;
  if (action === "WATCH") return `Watch ${playerList(receives)} for one more usage/news cycle before sending ${playerList(sends)}.`;
  return "Do not force this trade; keep scanning for a cleaner partner need.";
}

function buildNoTradeRecommendation(context: ResolvedTradeContext): TradeProposal {
  const placeholder: TradeSignalPlayer = {
    playerId: "none",
    name: "No trade target",
    position: "WR",
    restOfSeasonValue: 0,
    projectedPoints: 0,
  };
  return {
    action: "WATCH",
    mainMove: "Do Not Force A Trade",
    userSends: [],
    userReceives: [placeholder],
    opponentTeamId: "",
    opponentTeamName: "",
    whyOtherManagerMayAccept: "No proposal cleared both user improvement and partner acceptance thresholds.",
    projectedLineupImprovementForUser: 0,
    projectedLineupImprovementForOpponent: 0,
    opponentRosterBalanceImprovement: 0,
    buyLowScore: 0,
    sellHighScore: 0,
    acceptanceProbability: 0,
    confidenceScore: Math.round(clamp(62 - context.warnings.length * 5, 20, 88)),
    supportingQuantitativeReasons: [
      "No scanned offer improved your lineup enough while also helping the opponent.",
      "Forcing a trade would likely sacrifice roster balance or create a weak starter slot.",
      "Current recommendation is to wait for a better buy-low or surplus/need match.",
    ],
    riskWarning: "Waiting can miss a market window; re-run after injuries, role changes, or trade chatter.",
    negotiationAngle: "None yet. Build the next offer around a clear opponent need.",
    alternativePath: "Use Waiver Sniper or hold depth until a partner weakness becomes obvious.",
    dataFreshnessStatus: dataFreshnessStatus(context),
    missingDataWarnings: context.warnings,
    fallbackLogicUsed: context.fallbacks,
  };
}

function resolveTradeContext(context: TradeFinderContext): ResolvedTradeContext {
  const warnings: string[] = [];
  const fallbacks: string[] = [];
  if (!context.currentRosterConstruction?.length) {
    warnings.push("currentRosterConstruction missing; trade finder cannot model your lineup accurately.");
    fallbacks.push("Roster fallback: empty user roster.");
  }
  if (!context.opponentTeams?.length) {
    warnings.push("opponentTeams missing; no proactive trade partners can be scanned.");
    fallbacks.push("Opponent fallback: empty partner list.");
  }
  if (!context.dataFreshness?.length) {
    warnings.push("dataFreshness missing; freshness status is unknown.");
    fallbacks.push("Freshness fallback: unknown timestamps.");
  }
  return {
    startingSlots: { ...DEFAULT_STARTING_SLOTS, ...(context.startingSlots ?? {}) },
    benchSize: positiveInt(context.benchSize, 7),
    totalTeams: positiveInt(context.totalTeams, 12),
    currentWeek: positiveInt(context.currentWeek, 1),
    seasonPhase: context.seasonPhase,
    userRoster: context.currentRosterConstruction ?? [],
    opponentTeams: context.opponentTeams ?? [],
    playoffContext: context.playoffContext ?? {},
    deadlineWeek: positiveInt(context.tradeSettings?.deadlineWeek, 11),
    vetoRisk: clamp(context.tradeSettings?.vetoRisk ?? 0.12, 0, 1),
    dataFreshness: context.dataFreshness ?? [],
    warnings,
    fallbacks,
  };
}

function confidenceFor(score: number, acceptance: number, context: ResolvedTradeContext): number {
  const freshnessPenalty = context.dataFreshness.some((item) => item.stale) ? 12 : 0;
  const missingPenalty = Math.min(20, context.warnings.length * 4);
  return Math.round(clamp(42 + score * 0.75 + acceptance * 20 - freshnessPenalty - missingPenalty, 10, 96));
}

function compareProposals(a: TradeProposal, b: TradeProposal): number {
  return (
    b.confidenceScore - a.confidenceScore ||
    b.projectedLineupImprovementForUser - a.projectedLineupImprovementForUser ||
    b.acceptanceProbability - a.acceptanceProbability
  );
}

function utilizationProxy(player: TradeSignalPlayer): number {
  const touches = (player.targetShare ?? 0) + (player.carryShare ?? 0) + (player.redZoneUsage ?? 0) * 0.5;
  const routes = (player.routeParticipation ?? 0) * 0.35;
  const snaps = (player.snapShare ?? 0) * 0.25;
  return clamp(touches + routes + snaps, 0, 100);
}

function dataFreshnessStatus(context: ResolvedTradeContext): string {
  if (!context.dataFreshness.length) return "Data freshness unknown; use as directional until roster/trade sync is confirmed.";
  const stale = context.dataFreshness.filter((item) => item.stale);
  if (stale.length) return `Stale data warning: ${stale.map((item) => item.source).join(", ")}.`;
  return `Fresh: ${context.dataFreshness.map((item) => `${item.source}${item.updatedAt ? ` @ ${item.updatedAt}` : ""}`).join("; ")}.`;
}

function playerList(players: TradeSignalPlayer[]): string {
  return players.map((player) => player.name).join(" + ");
}

function defaultReplacement(pos: PlayerPosition): number {
  const values: Record<PlayerPosition, number> = { QB: 15, RB: 8, WR: 8, TE: 5.5, DST: 5, K: 6 };
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
