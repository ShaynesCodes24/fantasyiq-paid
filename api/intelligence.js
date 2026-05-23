function utcNow() {
  return new Date().toISOString();
}

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

module.exports = function handler(req, res) {
  const customer = firstQueryValue(req.query?.customer);
  const league = firstQueryValue(req.query?.league);
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    ok: true,
    source: "FantasyIQ Intelligence API",
    syncedAt: utcNow(),
    customerSlug: customer,
    leagueKey: league,
    recommendation: {
      action: "WAIT",
      mainMove: "Dashboard intelligence ready",
      supportingQuantitativeReasons: [
        "The command center now has a dedicated intelligence panel.",
        "Browser-side league context can synthesize draft, waiver, trade, and opponent reads from loaded ESPN data.",
        "Backend persistence hooks are ready for the full normalized pipeline.",
      ],
      riskWarning: "This endpoint is intentionally lightweight until normalized ESPN snapshots are persisted.",
      alternativePath: "Use the dashboard's live board, roster, waiver, trade, and opponent context for the active recommendation.",
      confidenceScore: 55,
      dataFreshnessStatus: "API online; dashboard data freshness is shown inside the panel.",
    },
    phases: {
      liveDraftRoom: { action: "READY", mainMove: "Live Draft Intelligence wired" },
      weeklyCommandCenter: { action: "READY", mainMove: "Weekly Command Center wired" },
      waiverSniper: { action: "READY", mainMove: "Waiver Sniper wired" },
      tradeFinder: { action: "READY", mainMove: "Trade Finder wired" },
      opponentIntelligence: { action: "READY", mainMove: "Opponent Intelligence wired", managerProfiles: [] },
    },
    missingDataWarnings: [],
    fallbackLogicUsed: ["Lightweight API shell; dashboard performs active context synthesis until persistence is connected."],
  });
};
