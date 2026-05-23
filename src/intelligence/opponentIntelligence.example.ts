import { generateOpponentIntelligence, type OpponentIntelligenceContext } from "./opponentIntelligence";

export const opponentIntelligenceExampleInput: OpponentIntelligenceContext = {
  scoringSettings: { receptionPoints: 1 },
  startingSlots: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, DST: 1, K: 1 },
  benchSize: 7,
  totalTeams: 12,
  season: 2026,
  currentWeek: 6,
  managers: [
    { teamId: "1", teamName: "Rocket Arms", managerName: "Avery" },
    { teamId: "2", teamName: "Waiver Wolves", managerName: "Jordan" },
    { teamId: "3", teamName: "Quiet Sundays", managerName: "Morgan" },
  ],
  behaviorEvents: [
    { eventType: "DRAFT_PICK", teamId: "1", managerName: "Avery", overallPick: 19, round: 2, playerName: "Name QB", position: "QB", playerRankAtTime: 45, isBigName: true },
    { eventType: "DRAFT_PICK", teamId: "1", managerName: "Avery", overallPick: 43, round: 4, playerName: "Rookie WR", position: "WR", isRookie: true },
    { eventType: "WAIVER_ADD", teamId: "1", managerName: "Avery", week: 2, playerName: "Rookie RB", position: "RB", isRookie: true, faabBid: 14 },
    { eventType: "TRADE_RECEIVED", teamId: "1", managerName: "Avery", week: 5, position: "QB", isBigName: true, tradeAssetCount: 1 },

    { eventType: "WAIVER_ADD", teamId: "2", managerName: "Jordan", week: 1, playerName: "DST Stream 1", position: "DST", isStreamerPosition: true, faabBid: 2 },
    { eventType: "WAIVER_ADD", teamId: "2", managerName: "Jordan", week: 2, playerName: "K Stream", position: "K", isStreamerPosition: true, faabBid: 1 },
    { eventType: "WAIVER_ADD", teamId: "2", managerName: "Jordan", week: 3, playerName: "RB Add", position: "RB", faabBid: 18 },
    { eventType: "WAIVER_ADD", teamId: "2", managerName: "Jordan", week: 5, playerName: "DST Stream 2", position: "DST", isStreamerPosition: true, faabBid: 3 },
    { eventType: "TRADE_SENT", teamId: "2", managerName: "Jordan", week: 4, position: "WR", tradeAssetCount: 2 },
    { eventType: "TRADE_RECEIVED", teamId: "2", managerName: "Jordan", week: 4, position: "RB", tradeAssetCount: 1 },

    { eventType: "INACTIVE_WEEK", teamId: "3", managerName: "Morgan", week: 2 },
    { eventType: "INACTIVE_WEEK", teamId: "3", managerName: "Morgan", week: 4 },
    { eventType: "LINEUP_SET", teamId: "3", managerName: "Morgan", week: 5, lineupChanged: false },
  ],
  dataFreshness: [
    { source: "ESPN draft history", updatedAt: "2026-10-13T16:00:00Z", stale: false },
    { source: "ESPN transactions", updatedAt: "2026-10-13T16:05:00Z", stale: false },
  ],
};

export const opponentIntelligenceExampleOutput = generateOpponentIntelligence(opponentIntelligenceExampleInput).managerProfiles;
