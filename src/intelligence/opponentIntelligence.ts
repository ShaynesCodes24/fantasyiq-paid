import type { DataFreshness, LeagueContext, ManagerTendency, PlayerPosition, Position } from "./liveDraftPhase1";

export type OpponentBehaviorEventType =
  | "DRAFT_PICK"
  | "WAIVER_ADD"
  | "WAIVER_DROP"
  | "TRADE_SENT"
  | "TRADE_RECEIVED"
  | "LINEUP_SET"
  | "INACTIVE_WEEK";

export type ManagerPersona =
  | "Rookie Chaser"
  | "QB Early Adopter"
  | "RB Hoarder"
  | "Name-Value Bias"
  | "Waiver Aggressor"
  | "Trade Grinder"
  | "Passive Manager"
  | "Streaming Specialist"
  | "Balanced Manager";

export interface OpponentBehaviorEvent {
  eventType: OpponentBehaviorEventType;
  teamId: string;
  managerName?: string;
  week?: number;
  season?: number;
  playerId?: string;
  playerName?: string;
  position?: PlayerPosition;
  transactionId?: string;
  overallPick?: number;
  round?: number;
  adpAtTime?: number;
  playerRankAtTime?: number;
  rosteredPercent?: number;
  isRookie?: boolean;
  isStreamerPosition?: boolean;
  isBigName?: boolean;
  faabBid?: number;
  tradeAssetCount?: number;
  tradePartnerTeamId?: string;
  lineupChanged?: boolean;
  observedAt?: string;
}

export interface OpponentIntelligenceContext extends LeagueContext {
  season: number;
  currentWeek?: number;
  managers: Array<{
    teamId: string;
    managerName?: string;
    teamName?: string;
  }>;
  behaviorEvents: OpponentBehaviorEvent[];
}

export interface OpponentManagerProfile extends ManagerTendency {
  managerName?: string;
  teamName?: string;
  primaryPersona: ManagerPersona;
  secondaryPersonas: ManagerPersona[];
  sampleSize: number;
  confidenceScore: number;
  waiverAggression: number;
  tradeAggression: number;
  acceptsDepthForStarters: number;
  inactivityRisk: number;
  streamerBias: number;
  rookieBias: number;
  nameValueBias: number;
  earlyQbBias: number;
  rbHoardingBias: number;
  positionalBias: Partial<Record<PlayerPosition, number>>;
  draftNonReturnPressure: Partial<Record<PlayerPosition, number>>;
  waiverCompetitionPressure: Partial<Record<PlayerPosition, number>>;
  tradeAcceptanceModifier: number;
  evidence: [string, string, string];
}

export interface OpponentIntelligenceSnapshot {
  managerProfiles: OpponentManagerProfile[];
  strongestSignals: OpponentManagerProfile[];
  missingDataWarnings: string[];
  fallbackLogicUsed: string[];
  dataFreshnessStatus: string;
  generatedAt: string;
}

interface ResolvedOpponentContext {
  startingSlots: Required<Record<Position, number>>;
  season: number;
  currentWeek: number;
  managers: Array<{ teamId: string; managerName?: string; teamName?: string }>;
  events: OpponentBehaviorEvent[];
  dataFreshness: DataFreshness[];
  warnings: string[];
  fallbacks: string[];
}

interface EventSummary {
  draftPicks: OpponentBehaviorEvent[];
  waiverAdds: OpponentBehaviorEvent[];
  waiverDrops: OpponentBehaviorEvent[];
  tradesSent: OpponentBehaviorEvent[];
  tradesReceived: OpponentBehaviorEvent[];
  inactiveWeeks: OpponentBehaviorEvent[];
  lineupEvents: OpponentBehaviorEvent[];
  positionCounts: Partial<Record<PlayerPosition, number>>;
  earlyPositionCounts: Partial<Record<PlayerPosition, number>>;
}

const PLAYER_POSITIONS: PlayerPosition[] = ["QB", "RB", "WR", "TE", "DST", "K"];
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

export function generateOpponentIntelligence(context: OpponentIntelligenceContext): OpponentIntelligenceSnapshot {
  const resolved = resolveOpponentContext(context);
  const managerProfiles = resolved.managers
    .map((manager) => buildManagerProfile(manager, resolved))
    .sort((a, b) => b.confidenceScore - a.confidenceScore || b.sampleSize - a.sampleSize);

  return {
    managerProfiles,
    strongestSignals: managerProfiles.filter((profile) => profile.primaryPersona !== "Balanced Manager").slice(0, 8),
    missingDataWarnings: resolved.warnings,
    fallbackLogicUsed: resolved.fallbacks,
    dataFreshnessStatus: dataFreshnessStatus(resolved),
    generatedAt: new Date().toISOString(),
  };
}

function buildManagerProfile(
  manager: { teamId: string; managerName?: string; teamName?: string },
  context: ResolvedOpponentContext,
): OpponentManagerProfile {
  const events = context.events.filter((event) => event.teamId === manager.teamId);
  const summary = summarizeEvents(events);
  const sampleSize = events.length;
  const positionalBias = positionalBiasFor(summary);
  const earlyQbBias = earlyQbBiasFor(summary, context);
  const rbHoardingBias = rbHoardingBiasFor(summary, context);
  const rookieBias = rookieBiasFor(summary);
  const nameValueBias = nameValueBiasFor(summary);
  const waiverAggression = waiverAggressionFor(summary, context);
  const tradeAggression = tradeAggressionFor(summary, context);
  const acceptsDepthForStarters = acceptsDepthForStartersFor(summary);
  const streamerBias = streamerBiasFor(summary);
  const inactivityRisk = inactivityRiskFor(summary, context);
  const personaScores = personaScoresFor({
    earlyQbBias,
    rbHoardingBias,
    rookieBias,
    nameValueBias,
    waiverAggression,
    tradeAggression,
    streamerBias,
    inactivityRisk,
  });
  const personas = Object.entries(personaScores)
    .sort(([, a], [, b]) => b - a)
    .filter(([, score]) => score >= 0.42)
    .map(([persona]) => persona as ManagerPersona);
  const primaryPersona = personas[0] ?? "Balanced Manager";
  const pressure = pressureByPosition(positionalBias, {
    earlyQbBias,
    rbHoardingBias,
    streamerBias,
    waiverAggression,
  });
  const profileBase: OpponentManagerProfile = {
    teamId: manager.teamId,
    primaryPersona,
    secondaryPersonas: personas.filter((persona) => persona !== primaryPersona).slice(0, 3),
    sampleSize,
    confidenceScore: confidenceFor(sampleSize, context, personaScores[primaryPersona] ?? 0.25),
    waiverAggression,
    tradeAggression,
    acceptsDepthForStarters,
    inactivityRisk,
    streamerBias,
    rookieBias,
    nameValueBias,
    earlyQbBias,
    rbHoardingBias,
    positionalBias,
    draftNonReturnPressure: pressure.draft,
    waiverCompetitionPressure: pressure.waiver,
    tradeAcceptanceModifier: round(tradeAggression * 0.5 + acceptsDepthForStarters * 0.25 + nameValueBias * 0.15 - inactivityRisk * 0.3, 3),
    aggressiveness: round((waiverAggression + tradeAggression) / 2, 3),
    evidence: evidenceFor(primaryPersona, summary, {
      earlyQbBias,
      rbHoardingBias,
      rookieBias,
      nameValueBias,
      waiverAggression,
      tradeAggression,
      streamerBias,
      inactivityRisk,
    }),
  };
  if (manager.managerName !== undefined) profileBase.managerName = manager.managerName;
  if (manager.teamName !== undefined) profileBase.teamName = manager.teamName;
  return profileBase;
}

function summarizeEvents(events: OpponentBehaviorEvent[]): EventSummary {
  const summary: EventSummary = {
    draftPicks: [],
    waiverAdds: [],
    waiverDrops: [],
    tradesSent: [],
    tradesReceived: [],
    inactiveWeeks: [],
    lineupEvents: [],
    positionCounts: {},
    earlyPositionCounts: {},
  };
  for (const event of events) {
    if (event.position) summary.positionCounts[event.position] = (summary.positionCounts[event.position] ?? 0) + 1;
    if (event.eventType === "DRAFT_PICK") {
      summary.draftPicks.push(event);
      if ((event.round ?? 99) <= 5 && event.position) {
        summary.earlyPositionCounts[event.position] = (summary.earlyPositionCounts[event.position] ?? 0) + 1;
      }
    } else if (event.eventType === "WAIVER_ADD") {
      summary.waiverAdds.push(event);
    } else if (event.eventType === "WAIVER_DROP") {
      summary.waiverDrops.push(event);
    } else if (event.eventType === "TRADE_SENT") {
      summary.tradesSent.push(event);
    } else if (event.eventType === "TRADE_RECEIVED") {
      summary.tradesReceived.push(event);
    } else if (event.eventType === "INACTIVE_WEEK") {
      summary.inactiveWeeks.push(event);
    } else if (event.eventType === "LINEUP_SET") {
      summary.lineupEvents.push(event);
    }
  }
  return summary;
}

function earlyQbBiasFor(summary: EventSummary, context: ResolvedOpponentContext): number {
  const earlyQbs = summary.earlyPositionCounts.QB ?? 0;
  const superflexBoost = context.startingSlots.SUPERFLEX > 0 ? -0.18 : 0;
  return clamp(earlyQbs / Math.max(1, summary.draftPicks.length * 0.28) + superflexBoost, 0, 1);
}

function rbHoardingBiasFor(summary: EventSummary, context: ResolvedOpponentContext): number {
  const rbEvents = summary.positionCounts.RB ?? 0;
  const expected = Math.max(1, summary.draftPicks.length * 0.32 + summary.waiverAdds.length * 0.22);
  return clamp((rbEvents - expected) / Math.max(1, expected) + 0.35, 0, 1);
}

function rookieBiasFor(summary: EventSummary): number {
  const rookieEvents = [...summary.draftPicks, ...summary.waiverAdds].filter((event) => event.isRookie).length;
  return clamp(rookieEvents / Math.max(1, summary.draftPicks.length + summary.waiverAdds.length) * 2.4, 0, 1);
}

function nameValueBiasFor(summary: EventSummary): number {
  const bigNames = [...summary.draftPicks, ...summary.waiverAdds, ...summary.tradesReceived].filter((event) => event.isBigName).length;
  const reachPicks = summary.draftPicks.filter((event) => {
    const rank = event.playerRankAtTime ?? event.adpAtTime;
    return rank !== undefined && event.overallPick !== undefined && event.overallPick + 18 < rank;
  }).length;
  return clamp((bigNames + reachPicks * 1.25) / Math.max(1, summary.draftPicks.length + summary.waiverAdds.length + summary.tradesReceived.length) * 1.8, 0, 1);
}

function waiverAggressionFor(summary: EventSummary, context: ResolvedOpponentContext): number {
  const weeklyRate = summary.waiverAdds.length / Math.max(1, context.currentWeek);
  const faabPressure = average(summary.waiverAdds.map((event) => clamp((event.faabBid ?? 0) / 25, 0, 1)));
  return clamp(weeklyRate / 1.4 + faabPressure * 0.35, 0, 1);
}

function tradeAggressionFor(summary: EventSummary, context: ResolvedOpponentContext): number {
  const tradeCount = summary.tradesSent.length + summary.tradesReceived.length;
  return clamp(tradeCount / Math.max(1, context.currentWeek * 0.45), 0, 1);
}

function acceptsDepthForStartersFor(summary: EventSummary): number {
  const receivedBundles = summary.tradesReceived.filter((event) => (event.tradeAssetCount ?? 1) >= 2).length;
  return clamp(0.25 + receivedBundles / Math.max(1, summary.tradesReceived.length) * 0.65, 0, 1);
}

function streamerBiasFor(summary: EventSummary): number {
  const streamers = summary.waiverAdds.filter((event) => event.isStreamerPosition || event.position === "DST" || event.position === "K").length;
  return clamp(streamers / Math.max(1, summary.waiverAdds.length) * 1.25, 0, 1);
}

function inactivityRiskFor(summary: EventSummary, context: ResolvedOpponentContext): number {
  const inactiveRate = summary.inactiveWeeks.length / Math.max(1, context.currentWeek);
  const lineupRate = summary.lineupEvents.filter((event) => event.lineupChanged).length / Math.max(1, context.currentWeek);
  return clamp(inactiveRate * 1.2 + Math.max(0, 0.35 - lineupRate), 0, 1);
}

function positionalBiasFor(summary: EventSummary): Partial<Record<PlayerPosition, number>> {
  const total = PLAYER_POSITIONS.reduce((sum, pos) => sum + (summary.positionCounts[pos] ?? 0), 0);
  const bias: Partial<Record<PlayerPosition, number>> = {};
  for (const pos of PLAYER_POSITIONS) {
    bias[pos] = total > 0 ? round((summary.positionCounts[pos] ?? 0) / total, 3) : 0.16;
  }
  return bias;
}

function personaScoresFor(input: {
  earlyQbBias: number;
  rbHoardingBias: number;
  rookieBias: number;
  nameValueBias: number;
  waiverAggression: number;
  tradeAggression: number;
  streamerBias: number;
  inactivityRisk: number;
}): Record<ManagerPersona, number> {
  return {
    "Rookie Chaser": input.rookieBias,
    "QB Early Adopter": input.earlyQbBias,
    "RB Hoarder": input.rbHoardingBias,
    "Name-Value Bias": input.nameValueBias,
    "Waiver Aggressor": input.waiverAggression,
    "Trade Grinder": input.tradeAggression,
    "Passive Manager": input.inactivityRisk,
    "Streaming Specialist": input.streamerBias,
    "Balanced Manager": 0.35,
  };
}

function pressureByPosition(
  positionalBias: Partial<Record<PlayerPosition, number>>,
  input: { earlyQbBias: number; rbHoardingBias: number; streamerBias: number; waiverAggression: number },
): {
  draft: Partial<Record<PlayerPosition, number>>;
  waiver: Partial<Record<PlayerPosition, number>>;
} {
  const draft: Partial<Record<PlayerPosition, number>> = {};
  const waiver: Partial<Record<PlayerPosition, number>> = {};
  for (const pos of PLAYER_POSITIONS) {
    const base = positionalBias[pos] ?? 0.16;
    draft[pos] = round(clamp(base * 1.4 + (pos === "QB" ? input.earlyQbBias * 0.35 : 0) + (pos === "RB" ? input.rbHoardingBias * 0.35 : 0), 0, 1), 3);
    waiver[pos] = round(clamp(base * 1.1 + input.waiverAggression * 0.28 + ((pos === "DST" || pos === "K") ? input.streamerBias * 0.35 : 0), 0, 1), 3);
  }
  return { draft, waiver };
}

function evidenceFor(
  persona: ManagerPersona,
  summary: EventSummary,
  scores: {
    earlyQbBias: number;
    rbHoardingBias: number;
    rookieBias: number;
    nameValueBias: number;
    waiverAggression: number;
    tradeAggression: number;
    streamerBias: number;
    inactivityRisk: number;
  },
): [string, string, string] {
  const counts = `${summary.draftPicks.length} draft pick(s), ${summary.waiverAdds.length} waiver add(s), ${summary.tradesSent.length + summary.tradesReceived.length} trade event(s).`;
  const scoreLine = `${persona} score drivers: QB ${formatPct(scores.earlyQbBias)}, RB ${formatPct(scores.rbHoardingBias)}, rookie ${formatPct(scores.rookieBias)}, waiver ${formatPct(scores.waiverAggression)}.`;
  const behaviorLine =
    persona === "Passive Manager"
      ? `${summary.inactiveWeeks.length} inactive week(s) and ${summary.lineupEvents.filter((event) => event.lineupChanged).length} lineup-change event(s).`
      : `Most observed position: ${topPosition(summary.positionCounts)}; streamer rate ${formatPct(scores.streamerBias)}; trade rate ${formatPct(scores.tradeAggression)}.`;
  return [counts, scoreLine, behaviorLine];
}

function resolveOpponentContext(context: OpponentIntelligenceContext): ResolvedOpponentContext {
  const warnings: string[] = [];
  const fallbacks: string[] = [];
  if (!context.managers.length) {
    warnings.push("managers missing; no opponent profiles can be generated.");
    fallbacks.push("Manager fallback: empty manager list.");
  }
  if (!context.behaviorEvents.length) {
    warnings.push("behaviorEvents missing; personas fall back to Balanced Manager with low confidence.");
    fallbacks.push("Behavior fallback: no events.");
  }
  if (!context.dataFreshness?.length) {
    warnings.push("dataFreshness missing; freshness status is unknown.");
    fallbacks.push("Freshness fallback: unknown timestamps.");
  }
  return {
    startingSlots: { ...DEFAULT_STARTING_SLOTS, ...(context.startingSlots ?? {}) },
    season: positiveInt(context.season, 2026),
    currentWeek: positiveInt(context.currentWeek, 1),
    managers: context.managers,
    events: context.behaviorEvents,
    dataFreshness: context.dataFreshness ?? [],
    warnings,
    fallbacks,
  };
}

function confidenceFor(sampleSize: number, context: ResolvedOpponentContext, personaScore: number): number {
  const sampleConfidence = clamp(sampleSize / 32, 0.12, 1);
  const stalePenalty = context.dataFreshness.some((item) => item.stale) ? 14 : 0;
  const missingPenalty = Math.min(22, context.warnings.length * 5);
  return Math.round(clamp(28 + sampleConfidence * 45 + personaScore * 28 - stalePenalty - missingPenalty, 8, 96));
}

function dataFreshnessStatus(context: ResolvedOpponentContext): string {
  if (!context.dataFreshness.length) return "Data freshness unknown; personas are directional until ESPN event sync is confirmed.";
  const stale = context.dataFreshness.filter((item) => item.stale);
  if (stale.length) return `Stale data warning: ${stale.map((item) => item.source).join(", ")}.`;
  return `Fresh: ${context.dataFreshness.map((item) => `${item.source}${item.updatedAt ? ` @ ${item.updatedAt}` : ""}`).join("; ")}.`;
}

function topPosition(counts: Partial<Record<PlayerPosition, number>>): string {
  return PLAYER_POSITIONS.map((pos) => ({ pos, count: counts[pos] ?? 0 })).sort((a, b) => b.count - a.count)[0]?.pos ?? "none";
}

function positiveInt(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
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

function formatPct(value: number): string {
  return `${Math.round(value * 100)}/100`;
}
