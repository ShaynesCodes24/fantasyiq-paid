import { generateWeeklyCommandCenter, type WeeklyCommandContext } from "./weeklyCommandCenter";

export const weeklyCommandExampleInput: WeeklyCommandContext = {
  scoringSettings: { receptionPoints: 1, faabBudget: 100, remainingFaabBudget: 82 },
  startingSlots: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, DST: 1, K: 1 },
  benchSize: 7,
  totalTeams: 12,
  currentWeek: 4,
  seasonPhase: "regular_season",
  currentRosterConstruction: [
    { playerId: "qb1", name: "Stable QB", position: "QB", projectedPoints: 18.4, byeWeek: 9, injuryStatus: "ACTIVE" },
    { playerId: "rb1", name: "Anchor RB", position: "RB", projectedPoints: 16.8, byeWeek: 10, injuryStatus: "ACTIVE" },
    { playerId: "rb2", name: "Questionable RB", position: "RB", projectedPoints: 10.1, byeWeek: 7, injuryStatus: "QUESTIONABLE", volatility: 6 },
    { playerId: "wr1", name: "Target Hog WR", position: "WR", projectedPoints: 17.2, byeWeek: 6, injuryStatus: "ACTIVE" },
    { playerId: "wr2", name: "Volatile WR", position: "WR", projectedPoints: 9.4, byeWeek: 4, injuryStatus: "ACTIVE" },
    { playerId: "te1", name: "Everydown TE", position: "TE", projectedPoints: 8.6, byeWeek: 11, injuryStatus: "ACTIVE" },
    { playerId: "flex1", name: "Bench WR", position: "WR", projectedPoints: 11.7, byeWeek: 8, injuryStatus: "ACTIVE", matchupRating: 14 },
    { playerId: "bench1", name: "Bench RB", position: "RB", projectedPoints: 8.2, byeWeek: 5, injuryStatus: "ACTIVE" },
    { playerId: "dst1", name: "Safe DST", position: "DST", projectedPoints: 6.5, byeWeek: 12, injuryStatus: "ACTIVE" },
    { playerId: "k1", name: "Indoor K", position: "K", projectedPoints: 7.1, byeWeek: 13, injuryStatus: "ACTIVE" },
  ],
  liveFreeAgents: [
    { id: "fa1", name: "Waiver WR", position: "WR", projectedPoints: 12.9, matchupRating: 20, rosteredPercent: 44, injuryStatus: "ACTIVE" },
    { id: "fa2", name: "Streamer RB", position: "RB", projectedPoints: 9.7, matchupRating: 12, rosteredPercent: 18, injuryStatus: "ACTIVE" },
    { id: "fa3", name: "Backup TE", position: "TE", projectedPoints: 6.4, rosteredPercent: 8, injuryStatus: "ACTIVE" },
  ],
  weeklyMatchup: {
    opponentTeamId: "team-7",
    opponentProjectedPoints: 109.4,
    userProjectedPoints: 113.2,
    winProbability: 0.56,
    matchupLeverageByPosition: { WR: 0.72, RB: 0.45, TE: 0.25 },
  },
  playoffContext: {
    weeksUntilPlayoffs: 10,
    playoffOdds: 0.54,
    mustWinLevel: 0.38,
  },
  dataFreshness: [
    { source: "ESPN roster sync", updatedAt: "2026-09-29T14:00:00Z", stale: false },
    { source: "weekly projections", updatedAt: "2026-09-29T13:45:00Z", stale: false },
  ],
};

export const weeklyCommandExampleOutput = generateWeeklyCommandCenter(weeklyCommandExampleInput).recommendation;
