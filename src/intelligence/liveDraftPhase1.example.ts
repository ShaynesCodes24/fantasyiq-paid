import { generateLiveDraftPhaseOneSnapshot, type LeagueContext } from "./liveDraftPhase1";

export const phaseOneExampleInput: LeagueContext = {
  scoringSettings: { receptionPoints: 1 },
  startingSlots: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, DST: 1, K: 1 },
  benchSize: 7,
  totalTeams: 12,
  draftSlot: 8,
  currentPickNumber: 32,
  currentRosterConstruction: [
    { playerId: "101", name: "Elite WR A", position: "WR", lineupSlot: "WR", projectedPoints: 285 },
    { playerId: "102", name: "Anchor RB A", position: "RB", lineupSlot: "RB", projectedPoints: 260 },
  ],
  liveAvailablePlayers: [
    {
      id: "201",
      name: "Target RB",
      position: "RB",
      team: "DET",
      projectedPoints: 230,
      rank: 28,
      positionalRank: 13,
      adp: 27,
      tier: "RB2 Foundation",
      valueScore: 67,
      riskScore: 4,
      receptionsProjection: 45,
    },
    {
      id: "202",
      name: "Pocket QB",
      position: "QB",
      team: "LAC",
      projectedPoints: 315,
      rank: 58,
      positionalRank: 8,
      adp: 54,
      tier: "QB2 Edge",
      valueScore: 54,
      riskScore: 3,
    },
    {
      id: "203",
      name: "Upside WR",
      position: "WR",
      team: "GB",
      projectedPoints: 218,
      rank: 43,
      positionalRank: 20,
      adp: 50,
      tier: "WR2/3",
      valueScore: 62,
      riskScore: 6,
      receptionsProjection: 72,
    },
  ],
  opponentRosters: [
    { teamId: "1", roster: [{ name: "QB A", position: "QB" }] },
    { teamId: "2", roster: [{ name: "WR B", position: "WR" }] },
  ],
  opponentManagerTendencies: [
    { teamId: "1", rbHoardingBias: 0.7, positionalBias: { RB: 0.8 }, aggressiveness: 0.6 },
    { teamId: "2", earlyQbBias: 0.8, positionalBias: { QB: 0.75 }, aggressiveness: 0.5 },
  ],
  dataFreshness: [{ source: "ESPN public league API", updatedAt: "2026-08-26T14:15:00Z", stale: false }],
  seasonPhase: "draft",
};

export const phaseOneExampleOutput = generateLiveDraftPhaseOneSnapshot(phaseOneExampleInput).recommendation;
