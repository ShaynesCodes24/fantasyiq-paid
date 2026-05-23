import { generateTradeFinder, type TradeFinderContext } from "./tradeFinder";

export const tradeFinderExampleInput: TradeFinderContext = {
  scoringSettings: { receptionPoints: 1 },
  startingSlots: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, DST: 1, K: 1 },
  benchSize: 7,
  totalTeams: 12,
  currentWeek: 7,
  seasonPhase: "regular_season",
  tradeSettings: { deadlineWeek: 11, vetoRisk: 0.08 },
  playoffContext: {
    playoffOdds: 0.52,
    weeksUntilPlayoffs: 6,
    scheduleStrengthByPosition: { RB: 18, WR: 6 },
  },
  currentRosterConstruction: [
    { playerId: "u-qb", name: "User QB", position: "QB", projectedPoints: 18.2, restOfSeasonValue: 88, tradeValue: 24 },
    { playerId: "u-rb1", name: "User RB Anchor", position: "RB", projectedPoints: 17.1, restOfSeasonValue: 122, tradeValue: 42 },
    { playerId: "u-rb2", name: "User RB Depth A", position: "RB", projectedPoints: 11.6, restOfSeasonValue: 74, tradeValue: 25, recentFantasyPoints: 16, expectedFantasyPoints: 10, touchdownDelta: 2, utilizationScore: 42, nameValueScore: 52 },
    { playerId: "u-rb3", name: "User RB Depth B", position: "RB", projectedPoints: 9.8, restOfSeasonValue: 58, tradeValue: 18 },
    { playerId: "u-wr1", name: "User WR Anchor", position: "WR", projectedPoints: 16.5, restOfSeasonValue: 116, tradeValue: 39 },
    { playerId: "u-wr2", name: "User WR Starter", position: "WR", projectedPoints: 11.2, restOfSeasonValue: 66, tradeValue: 21 },
    { playerId: "u-te", name: "User TE", position: "TE", projectedPoints: 8.1, restOfSeasonValue: 46, tradeValue: 13 },
    { playerId: "u-wr3", name: "Bench WR", position: "WR", projectedPoints: 8.4, restOfSeasonValue: 42, tradeValue: 12 },
    { playerId: "u-dst", name: "User DST", position: "DST", projectedPoints: 6.2, restOfSeasonValue: 24, tradeValue: 4 },
    { playerId: "u-k", name: "User K", position: "K", projectedPoints: 7.0, restOfSeasonValue: 28, tradeValue: 3 },
  ],
  opponentTeams: [
    {
      teamId: "team-4",
      teamName: "RB Thin Manager",
      managerName: "Taylor",
      managerTendency: {
        teamId: "team-4",
        rbHoardingBias: 0.25,
        nameValueBias: 0.62,
        tradeAggression: 0.58,
        acceptsDepthForStarters: 0.64,
      },
      roster: [
        { playerId: "o-qb", name: "Opponent QB", position: "QB", projectedPoints: 17.4, restOfSeasonValue: 82, tradeValue: 21 },
        { playerId: "o-rb1", name: "Opponent RB Starter", position: "RB", projectedPoints: 12.1, restOfSeasonValue: 70, tradeValue: 23 },
        { playerId: "o-wr-buy", name: "Depressed Alpha WR", position: "WR", projectedPoints: 15.4, restOfSeasonValue: 108, tradeValue: 34, recentFantasyPoints: 7.8, expectedFantasyPoints: 15.9, utilizationScore: 82, routeParticipation: 91, targetShare: 27, touchdownDelta: -3, playoffScheduleRating: 12 },
        { playerId: "o-wr2", name: "Opponent WR Starter", position: "WR", projectedPoints: 12.6, restOfSeasonValue: 72, tradeValue: 24 },
        { playerId: "o-te", name: "Opponent TE", position: "TE", projectedPoints: 7.4, restOfSeasonValue: 38, tradeValue: 10 },
        { playerId: "o-rb2", name: "Opponent Bench RB", position: "RB", projectedPoints: 5.3, restOfSeasonValue: 22, tradeValue: 7 },
        { playerId: "o-dst", name: "Opponent DST", position: "DST", projectedPoints: 5.9, restOfSeasonValue: 20, tradeValue: 4 },
        { playerId: "o-k", name: "Opponent K", position: "K", projectedPoints: 6.8, restOfSeasonValue: 25, tradeValue: 3 },
      ],
    },
  ],
  dataFreshness: [
    { source: "ESPN rosters", updatedAt: "2026-10-20T15:00:00Z", stale: false },
    { source: "trade value signals", updatedAt: "2026-10-20T14:45:00Z", stale: false },
  ],
};

export const tradeFinderExampleOutput = generateTradeFinder(tradeFinderExampleInput).recommendation;
