let parlayIqData = null;
let parlayIqLoading = false;
let parlayIqLoadedAt = 0;
const parlaySelectedLegIds = new Set();

function parlayNormalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function parlayMoney(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || !number) return "--";
  return `${number > 0 ? "+" : ""}${Math.round(number)}`;
}

function parlayPercent(value, digits = 1) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return "--";
  return `${number.toFixed(digits)}%`;
}

function parlayDecimalFromAmerican(price) {
  const odds = Number(price || 0);
  if (!odds) return 1;
  return odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
}

function parlayAmericanFromDecimal(decimal) {
  const value = Math.max(1.01, Number(decimal || 1.01));
  return value >= 2 ? Math.round((value - 1) * 100) : Math.round(-100 / (value - 1));
}

function parlayLegLabel(leg) {
  const line = leg.line === null || leg.line === undefined ? "" : ` ${Number(leg.line).toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
  return `${leg.player} ${leg.side}${line} ${leg.marketLabel || leg.market || ""}`.trim();
}

function compactParlayRow(row) {
  if (!row) return {};
  return {
    Player: row.Player || row.player || row.name || "",
    Pos: row.Pos || row.position || row.pos || "",
    Team: row.Team || row.team || row.proTeam || "",
    Rank: row.Rank || row.rank || "",
    "Value Score": row["Value Score"] || row.value || row.marketScore || "",
    "Proj PPR Pts": row["Native Projection"] || row["Proj PPR Pts"] || row.Projection || row.projected || "",
    Receptions: row.Receptions || row["Projected Receptions"] || row.Rec || "",
    Analysis: row.Analysis || row["Daily Synopsis"] || "",
  };
}

function parlayContextPayload(mode = "standard") {
  const snapshot = typeof activeRosterSnapshot === "function" ? activeRosterSnapshot({ preferPasted: false }) : null;
  const rosterRows = Array.isArray(snapshot?.rows) ? snapshot.rows : [];
  const rosterEntries = Array.isArray(snapshot?.rosterEntries) ? snapshot.rosterEntries : [];
  const boardRows = boardData?.boards?.combined?.rows || [];
  const waiverRows = typeof availableRows === "function" ? availableRows().slice(0, 80) : boardRows.slice(0, 80);
  return {
    mode,
    sport: parlaySport?.value || "americanfootball_nfl",
    teamId: typeof selectedTeamId === "function" ? selectedTeamId() : "",
    leagueSettings: typeof activeLeagueSettings === "function" ? activeLeagueSettings() : appConfig.leagueSettings || {},
    roster: rosterRows.slice(0, 40).map(compactParlayRow),
    rosterEntries: rosterEntries.slice(0, 40),
    waiverPool: waiverRows.slice(0, 80).map(compactParlayRow),
    boardRows: boardRows.slice(0, 260).map(compactParlayRow),
  };
}

function parlaySetLoading(message = "Parlay IQ is scanning odds.") {
  if (parlayStatus) parlayStatus.textContent = message;
  if (parlaySmartList) {
    parlaySmartList.innerHTML = `
      <article class="parlay-empty">
        <strong>Building Smart Parlays...</strong>
        <p>Coordinator is waiting on the odds and roster agents.</p>
      </article>
    `;
  }
  if (parlayLegTable) parlayLegTable.textContent = "Scanning books and model edges.";
}

function loadParlayIq(options = {}) {
  if (!parlaySmartList || parlayIqLoading) return Promise.resolve(parlayIqData);
  const now = Date.now();
  const mode = options.mode || "standard";
  if (!options.force && parlayIqData && now - parlayIqLoadedAt < 1000 * 60 * 6) {
    renderParlayIq(parlayIqData);
    return Promise.resolve(parlayIqData);
  }
  parlayIqLoading = true;
  parlaySetLoading(mode === "roster" ? "Bet My Team is building roster-only slips." : "Parlay IQ is scanning odds.");
  const payload = { ...parlayContextPayload(mode), force: Boolean(options.force), mode };
  return fetch(apiUrl("/api/parlay-iq"), {
    method: "POST",
    cache: "no-store",
    headers: apiHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Parlay IQ returned HTTP ${response.status}`);
      return response.json();
    })
    .then((data) => {
      if (!data?.ok) throw new Error(data?.message || data?.error || "Parlay IQ returned no recommendation.");
      parlayIqData = data;
      parlayIqLoadedAt = Date.now();
      renderParlayIq(data);
      return data;
    })
    .catch((error) => {
      if (parlayStatus) parlayStatus.textContent = "Parlay IQ unavailable";
      if (parlaySmartList) {
        parlaySmartList.innerHTML = `<article class="parlay-empty danger"><strong>Parlay IQ is offline.</strong><p>${htmlEscape(error.message)}</p></article>`;
      }
      if (parlayLegTable) parlayLegTable.textContent = "Try again after odds refresh.";
      return null;
    })
    .finally(() => {
      parlayIqLoading = false;
    });
}

function renderParlayIq(data) {
  const parlays = data.smartParlays || [];
  const legs = data.legs || data.allLegs || [];
  const bestEdge = Math.max(...legs.map((leg) => Number(leg.edgePct || 0)), 0);
  const matrix = data.historicalMatrix || [];
  const bestMatrix = matrix.reduce((best, item) => (Number(item.winRate || 0) > Number(best?.winRate || 0) ? item : best), null);

  if (parlaySmartCount) parlaySmartCount.textContent = String(parlays.length);
  if (parlayBestEdge) parlayBestEdge.textContent = bestEdge ? parlayPercent(bestEdge) : "--";
  if (parlayWinRate) parlayWinRate.textContent = bestMatrix ? parlayPercent(Number(bestMatrix.winRate || 0) * 100, 0) : "--";
  if (parlayMatrixNote) parlayMatrixNote.textContent = bestMatrix ? `${bestMatrix.marketLabel} / ${bestMatrix.sampleSize} samples` : "Backtest matrix pending";
  if (parlayOddsSource) parlayOddsSource.textContent = data.oddsConfigured ? "Live books" : "Model only";
  if (parlayCacheNote) parlayCacheNote.textContent = data.cache?.layer ? `${data.cache.layer} cache` : "Server-side cache";
  if (parlayStatus) {
    const warnings = data.warnings || [];
    parlayStatus.textContent = warnings[0] || `${legs.length} +EV candidates scanned.`;
  }

  renderSmartParlays(parlays);
  renderParlayLegTable(legs);
  renderParlayRosterList(data.rosterLegs || legs.filter((leg) => leg.isRoster || leg.isWaiver));
  renderParlayHistory(matrix);
  renderParlayAgents(data.agents || []);
  renderParlaySlip();
}

function renderSmartParlays(parlays) {
  if (!parlaySmartList) return;
  if (!parlays.length) {
    parlaySmartList.innerHTML = `<article class="parlay-empty"><strong>No clean +EV parlay.</strong><p>Single-leg candidates are still available below.</p></article>`;
    return;
  }
  parlaySmartList.innerHTML = parlays
    .map((item) => {
      const legList = (item.legs || [])
        .map((leg) => `<li>${htmlEscape(parlayLegLabel(leg))}<small>${htmlEscape(leg.book || "")} ${parlayMoney(leg.priceAmerican)}</small></li>`)
        .join("");
      return `
        <article class="parlay-card">
          <div class="parlay-card-top">
            <span>${htmlEscape(item.tier)}</span>
            <strong>${htmlEscape(item.label)}</strong>
          </div>
          <div class="parlay-card-metrics">
            <b>${parlayMoney(item.americanOdds)}</b>
            <b>${parlayPercent(Number(item.edgePct || 0))} edge</b>
            <b>${Number(item.unitSize || 0).toFixed(2)}u</b>
          </div>
          <ul>${legList}</ul>
          <p>${htmlEscape(item.reason || "")}</p>
          <button class="secondary-action" type="button" data-parlay-use="${htmlEscape(item.id)}">Use This Slip</button>
        </article>
      `;
    })
    .join("");
}

function renderParlayLegTable(legs) {
  if (!parlayLegTable) return;
  if (!legs.length) {
    parlayLegTable.textContent = "No parlay legs available.";
    return;
  }
  parlayLegTable.innerHTML = `
    <div class="parlay-row parlay-row-head">
      <span>Leg</span>
      <span>Book</span>
      <span>Edge</span>
      <span>EV</span>
      <span></span>
    </div>
    ${legs
      .slice(0, 28)
      .map((leg, index) => {
        const id = leg.id || `leg-${index + 1}`;
        leg.id = id;
        const selected = parlaySelectedLegIds.has(id);
        return `
          <div class="parlay-row ${selected ? "selected" : ""}">
            <span>
              <strong>${htmlEscape(parlayLegLabel(leg))}</strong>
              <small>${htmlEscape([leg.proTeam || leg.homeTeam, leg.position].filter(Boolean).join(" / "))}</small>
            </span>
            <span>${htmlEscape(leg.book || "Best")} <small>${parlayMoney(leg.priceAmerican)}</small></span>
            <span class="${Number(leg.edgePct || 0) >= 4 ? "edge-hot" : ""}">${parlayPercent(Number(leg.edgePct || 0))}</span>
            <span>${Number(leg.ev || 0).toFixed(3)}</span>
            <button class="icon-text-action" type="button" data-parlay-leg="${htmlEscape(id)}">${selected ? "Remove" : "Add"}</button>
          </div>
        `;
      })
      .join("")}
  `;
}

function renderParlayRosterList(legs) {
  if (!parlayRosterList) return;
  const rosterLegs = (legs || []).filter((leg) => leg.isRoster || leg.isWaiver).slice(0, 8);
  if (!rosterLegs.length) {
    parlayRosterList.innerHTML = `<article><strong>No roster-linked props yet.</strong><p>Sync My Team or use Bet My Team after roster context loads.</p></article>`;
    return;
  }
  parlayRosterList.innerHTML = rosterLegs
    .map(
      (leg) => `
        <article>
          <span>${leg.isRoster ? "My Team" : "Waiver"}</span>
          <strong>${htmlEscape(parlayLegLabel(leg))}</strong>
          <small>${htmlEscape(leg.book || "Best book")} ${parlayMoney(leg.priceAmerican)} / ${parlayPercent(Number(leg.edgePct || 0))} edge</small>
        </article>
      `,
    )
    .join("");
}

function renderParlayHistory(matrix) {
  if (!parlayHistoryMatrix) return;
  if (!matrix.length) {
    parlayHistoryMatrix.textContent = "No historical rows available.";
    return;
  }
  parlayHistoryMatrix.innerHTML = matrix
    .slice(0, 6)
    .map(
      (item) => `
        <div class="parlay-history-row">
          <strong>${htmlEscape(item.marketLabel || item.market)}</strong>
          <span>${parlayPercent(Number(item.winRate || 0) * 100, 0)} win</span>
          <span>${Number(item.sampleSize || 0)} samples</span>
          <span>${parlayPercent(Number(item.roi || 0) * 100, 1)} ROI</span>
        </div>
      `,
    )
    .join("");
}

function renderParlayAgents(agents) {
  if (!parlayAgentTrace) return;
  if (!agents.length) {
    parlayAgentTrace.textContent = "No agent trace available.";
    return;
  }
  parlayAgentTrace.innerHTML = agents
    .map(
      (agent) => `
        <div class="parlay-agent-row">
          <strong>${htmlEscape(agent.name)}</strong>
          <span>${parlayPercent(Number(agent.confidence || 0) * 100, 0)}</span>
          <small>${htmlEscape(agent.summary || "")}</small>
        </div>
      `,
    )
    .join("");
}

function findParlayLeg(id) {
  const legs = parlayIqData?.allLegs || parlayIqData?.legs || [];
  return legs.find((leg, index) => (leg.id || `leg-${index + 1}`) === id) || null;
}

function parlayPairCorrelation(a, b) {
  if (!a || !b) return { score: 0, reason: "" };
  const sameEvent = a.eventId && a.eventId === b.eventId;
  const samePlayer = parlayNormalizeName(a.player) && parlayNormalizeName(a.player) === parlayNormalizeName(b.player);
  if (samePlayer && a.market === b.market && a.side !== b.side) return { score: -0.82, reason: "Contradictory sides on the same player market." };
  if (samePlayer && a.side === b.side && ["player_receptions", "player_reception_yds"].includes(a.market) && ["player_receptions", "player_reception_yds"].includes(b.market)) {
    return { score: 0.42, reason: "Same-player reception volume is positively correlated." };
  }
  if (sameEvent && a.side !== b.side) return { score: -0.12, reason: "Mixed same-game direction lowers parlay efficiency." };
  if (sameEvent && ["Over", "Yes"].includes(a.side) && ["Over", "Yes"].includes(b.side)) return { score: 0.16, reason: "Same-game overs share scoring environment." };
  return { score: 0, reason: "" };
}

function renderParlaySlip() {
  const selected = Array.from(parlaySelectedLegIds).map(findParlayLeg).filter(Boolean);
  if (parlaySlipCount) parlaySlipCount.textContent = `${selected.length} leg${selected.length === 1 ? "" : "s"}`;
  if (!parlaySlipList || !parlaySlipSummary) return;
  if (!selected.length) {
    parlaySlipList.innerHTML = "<p>Select legs from the board.</p>";
    parlaySlipSummary.innerHTML = "<span>FantasyIQ Edge</span><strong>--</strong><small>Edge updates as legs are added.</small>";
    if (parlaySlipWarning) parlaySlipWarning.hidden = true;
    return;
  }

  parlaySlipList.innerHTML = selected
    .map(
      (leg) => `
        <article>
          <button type="button" aria-label="Remove ${htmlEscape(leg.player)}" data-parlay-remove="${htmlEscape(leg.id)}">x</button>
          <strong>${htmlEscape(parlayLegLabel(leg))}</strong>
          <small>${htmlEscape(leg.book || "Best")} ${parlayMoney(leg.priceAmerican)} / ${parlayPercent(Number(leg.edgePct || 0))} edge</small>
        </article>
      `,
    )
    .join("");

  let decimal = 1;
  let probability = 1;
  selected.forEach((leg) => {
    decimal *= Number(leg.decimal || parlayDecimalFromAmerican(leg.priceAmerican) || 1);
    probability *= Math.max(0.02, Math.min(0.96, Number(leg.modelProbability || 0.5)));
  });
  let correlation = 0;
  const warnings = [];
  selected.forEach((leg, index) => {
    selected.slice(index + 1).forEach((other) => {
      const pair = parlayPairCorrelation(leg, other);
      correlation += pair.score;
      if (pair.reason && pair.score < 0) warnings.push(pair.reason);
    });
  });
  probability = Math.max(0.005, Math.min(0.92, probability * Math.max(0.72, Math.min(1.22, 1 + correlation * 0.16))));
  const implied = 1 / decimal;
  const ev = probability * (decimal - 1) - (1 - probability);
  const edge = (probability - implied) * 100;
  parlaySlipSummary.innerHTML = `
    <span>FantasyIQ Edge</span>
    <strong>${parlayPercent(edge)}</strong>
    <small>${parlayMoney(parlayAmericanFromDecimal(decimal))} / ${(probability * 100).toFixed(1)}% model / EV ${ev.toFixed(3)}</small>
  `;
  if (parlaySlipWarning) {
    const message = warnings[0] || (ev < 0 ? "This custom slip is negative EV. Drop a leg or line shop before playing it." : "");
    parlaySlipWarning.hidden = !message;
    parlaySlipWarning.textContent = message;
  }
}

function useSmartParlay(id) {
  const item = (parlayIqData?.smartParlays || []).find((parlay) => parlay.id === id);
  if (!item) return;
  parlaySelectedLegIds.clear();
  (item.legs || []).forEach((leg, index) => {
    if (!leg.id) leg.id = `${item.id}-leg-${index + 1}`;
    parlaySelectedLegIds.add(leg.id);
  });
  renderParlayLegTable(parlayIqData?.legs || parlayIqData?.allLegs || []);
  renderParlaySlip();
}

function handleParlayClick(event) {
  const legButton = event.target.closest("[data-parlay-leg]");
  if (legButton) {
    const id = legButton.dataset.parlayLeg;
    if (parlaySelectedLegIds.has(id)) {
      parlaySelectedLegIds.delete(id);
    } else {
      parlaySelectedLegIds.add(id);
    }
    renderParlayLegTable(parlayIqData?.legs || parlayIqData?.allLegs || []);
    renderParlaySlip();
    return;
  }
  const removeButton = event.target.closest("[data-parlay-remove]");
  if (removeButton) {
    parlaySelectedLegIds.delete(removeButton.dataset.parlayRemove);
    renderParlayLegTable(parlayIqData?.legs || parlayIqData?.allLegs || []);
    renderParlaySlip();
    return;
  }
  const useButton = event.target.closest("[data-parlay-use]");
  if (useButton) {
    useSmartParlay(useButton.dataset.parlayUse);
  }
}

document.querySelector("#parlay")?.addEventListener("click", handleParlayClick);
parlayRefresh?.addEventListener("click", () => loadParlayIq({ force: true }));
parlayBetMyTeam?.addEventListener("click", () => loadParlayIq({ force: true, mode: "roster" }));
parlayClearSlip?.addEventListener("click", () => {
  parlaySelectedLegIds.clear();
  renderParlayLegTable(parlayIqData?.legs || parlayIqData?.allLegs || []);
  renderParlaySlip();
});

if (document.querySelector("#parlay.panel.active")) {
  loadParlayIq();
}
