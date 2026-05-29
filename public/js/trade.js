function positionCounts(players) {
  const counts = {};
  players.forEach((item) => {
    if (!item.row) return;
    counts[item.row.Pos] = (counts[item.row.Pos] || 0) + 1;
  });
  return counts;
}

function tradeTotals(players) {
  const marketPlayers = players.filter((item) => Number.isFinite(Number(item.marketValue)));
  return {
    value: players.reduce((sum, item) => sum + item.value, 0),
    fantasyIqValue: players.reduce((sum, item) => sum + Number(item.fantasyIqValue ?? item.value ?? 0), 0),
    marketValue: marketPlayers.reduce((sum, item) => sum + Number(item.marketValue || 0), 0),
    marketCount: marketPlayers.length,
    projection: players.reduce((sum, item) => sum + item.projection, 0),
    risk: players.length ? players.reduce((sum, item) => sum + item.risk, 0) / players.length : 0,
    best: players.reduce((best, item) => (!best || item.value > best.value ? item : best), null),
  };
}

function tradePositionSummary(players) {
  const counts = positionCounts(players);
  return (
    ["QB", "RB", "WR", "TE", "DST", "K"]
      .filter((pos) => counts[pos])
      .map((pos) => `${pos} ${counts[pos]}`)
      .join(" / ") || "No matched positions"
  );
}

function marketTotalLabel(totals) {
  if (!totals.marketCount) return "No Fantasy IQ Data match";
  return totals.marketValue.toFixed(1);
}

function tradeMarketCalibration(giveTotals, getTotals, give, get) {
  const marketReady = Boolean(fantasyCalcMarket?.ok && fantasyCalcMarket.playerCount);
  const netMarket = getTotals.marketValue - giveTotals.marketValue;
  const netFantasyIq = getTotals.fantasyIqValue - giveTotals.fantasyIqValue;
  const matched = giveTotals.marketCount + getTotals.marketCount;
  const total = give.length + get.length;
  const coverage = total ? matched / total : 0;
  let label = "FantasyIQ only";
  let className = "watch";
  let detail = "Trade IQ is using FantasyIQ league-fit values while Fantasy IQ Data is unavailable.";
  if (marketReady && coverage >= 0.75) {
    if (Math.abs(netMarket - netFantasyIq) <= 5) {
      label = "Market agrees";
      className = "good";
      detail = "Fantasy IQ Data real-trade value and FantasyIQ roster-fit value are pointing in the same direction.";
    } else if (netMarket < netFantasyIq - 5) {
      label = "Market colder";
      className = "watch";
      detail =
        "The real-trade market is less favorable than FantasyIQ roster fit. Expect the other manager to push back.";
    } else {
      label = "Market discount";
      className = "good";
      detail = "Fantasy IQ Data market value likes the incoming side more than the local board does.";
    }
  } else if (marketReady) {
    label = "Partial market";
    detail =
      "Some players do not have a Fantasy IQ Data match yet, so the verdict blends market value with FantasyIQ values.";
  }
  return {
    label,
    className,
    detail,
    coverage,
    netMarket,
    netFantasyIq,
    source: tradeMarketSourceLabel(),
  };
}

function packageRealism(give, get, giveTotals, getTotals) {
  if (!give.length || !get.length) {
    return {
      label: "Waiting",
      className: "watch",
      score: 0,
      detail: "Add both sides to judge whether this looks like a real offer.",
    };
  }
  const countDelta = give.length - get.length;
  const bestOutgoing = giveTotals.best?.value || 0;
  const bestIncoming = getTotals.best?.value || 0;
  const net = getTotals.value - giveTotals.value;
  let score = 60 - Math.abs(net) * 1.5 - Math.max(0, Math.abs(countDelta) - 1) * 10;
  if (countDelta > 0 && bestIncoming >= bestOutgoing - 3) score += 12;
  if (countDelta < 0 && bestIncoming <= bestOutgoing - 5) score -= 10;
  if (give.length >= 3 && get.length === 1 && bestIncoming < bestOutgoing + 6) score -= 12;
  score = clampNumber(score, 0, 100);
  if (score >= 68) {
    return {
      label: "Realistic ask",
      className: "good",
      score,
      detail: "The package shape is close enough that manager needs can sell it.",
    };
  }
  if (score >= 45) {
    return {
      label: "Needs framing",
      className: "watch",
      score,
      detail: "This can work if the other team has a clear positional reason to say yes.",
    };
  }
  return {
    label: "Unlikely ask",
    className: "danger",
    score,
    detail: "The value gap or package shape looks like a trade calculator offer, not a manager-to-manager offer.",
  };
}

function acceptanceProbability(give, get, roster, warnings, giveTotals, getTotals, marketRead) {
  const netToYou = getTotals.value - giveTotals.value;
  const partnerText = partnerLens(give, get);
  const partnerNeedBonus = /best fit|may value/i.test(partnerText) ? 12 : 0;
  const realism = packageRealism(give, get, giveTotals, getTotals);
  const marketPenalty = marketRead.className === "watch" && marketRead.netMarket < marketRead.netFantasyIq - 5 ? 8 : 0;
  const rosterPenalty = warnings.length * 4;
  const score = Math.round(
    clampNumber(
      52 - Math.max(0, netToYou) * 1.8 + partnerNeedBonus + (realism.score - 55) * 0.45 - marketPenalty - rosterPenalty,
      5,
      95,
    ),
  );
  let label = "Long shot";
  let className = "danger";
  if (score >= 68) {
    label = "Plausible";
    className = "good";
  } else if (score >= 42) {
    label = "Negotiable";
    className = "watch";
  }
  return {
    score,
    label,
    className,
    realism,
    detail: `${realism.detail} ${partnerNeedBonus ? "The partner roster gives you a need-based pitch." : "You need to create a stronger reason for the other manager."}`,
  };
}

function tradeSlotList(side) {
  return Array.from(side === "give" ? tradeGiveSlots || [] : tradeGetSlots || []);
}

function tradeSlotNames(side) {
  return tradeSlotList(side)
    .map((input) => input.value.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function setTradeSlots(side, names = []) {
  tradeSlotList(side).forEach((input, index) => {
    input.value = names[index] || "";
  });
  if (side === "give" && tradeGive) tradeGive.dataset.slotsHydrated = "true";
  if (side === "get" && tradeGet) tradeGet.dataset.slotsHydrated = "true";
}

function hydrateTradeSlotsFromTextareas() {
  const giveHydrated = tradeGive?.dataset.slotsHydrated === "true";
  const getHydrated = tradeGet?.dataset.slotsHydrated === "true";
  const giveSlotsEmpty = tradeSlotList("give").every((input) => !input.value.trim());
  const getSlotsEmpty = tradeSlotList("get").every((input) => !input.value.trim());
  if (!giveHydrated && giveSlotsEmpty && tradeGive?.value)
    setTradeSlots("give", parseLines(tradeGive.value).slice(0, 3));
  if (!getHydrated && getSlotsEmpty && tradeGet?.value) setTradeSlots("get", parseLines(tradeGet.value).slice(0, 3));
  if (tradeGive) tradeGive.dataset.slotsHydrated = "true";
  if (tradeGet) tradeGet.dataset.slotsHydrated = "true";
}

function syncTradeSlotsToTextareas() {
  hydrateTradeSlotsFromTextareas();
  if (tradeGiveSlots?.length && tradeGive) tradeGive.value = tradeSlotNames("give").join("\n");
  if (tradeGetSlots?.length && tradeGet) tradeGet.value = tradeSlotNames("get").join("\n");
}

function packageShapeFromCounts(giveCount, getCount) {
  const give = Math.max(1, Math.min(3, giveCount || 1));
  const get = Math.max(1, Math.min(3, getCount || 1));
  return `${give}-${get}`;
}

function desiredTradePackageShape() {
  return localStorage.getItem(tradeDeskStorageKey("package-shape")) || "1-1";
}

function updateTradePackageControls(giveCount, getCount) {
  const desired = desiredTradePackageShape();
  const [desiredGive, desiredGet] = desired.split("-").map((value) => Number(value || 1));
  const shape = packageShapeFromCounts(
    Math.max(giveCount || 0, desiredGive || 1),
    Math.max(getCount || 0, desiredGet || 1),
  );
  const [giveLimit, getLimit] = shape.split("-").map((value) => Number(value || 1));
  if (tradePackageLabel) tradePackageLabel.textContent = `${giveLimit}-for-${getLimit}`;
  tradePackageButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tradePackage === shape);
  });
  tradeSlotList("give").forEach((input, index) => {
    input.closest("label")?.classList.toggle("inactive", index >= giveLimit && !input.value.trim());
  });
  tradeSlotList("get").forEach((input, index) => {
    input.closest("label")?.classList.toggle("inactive", index >= getLimit && !input.value.trim());
  });
}

function applyTradePackageShape(shape = "1-1") {
  const [giveLimit, getLimit] = shape.split("-").map((value) => Math.max(1, Math.min(3, Number(value || 1))));
  localStorage.setItem(tradeDeskStorageKey("package-shape"), `${giveLimit}-${getLimit}`);
  updateTradePackageControls(giveLimit, getLimit);
  const focusSide = tradeSlotNames("give").length < giveLimit ? "give" : "get";
  const focusLimit = focusSide === "give" ? giveLimit : getLimit;
  const nextInput = tradeSlotList(focusSide).find((input, index) => index < focusLimit && !input.value.trim());
  nextInput?.focus();
}

function riskBand(risk) {
  if (!risk) {
    return {
      label: "Waiting on players",
      className: "watch",
      detail: "Incoming risk is the average volatility of the players you receive.",
    };
  }
  if (risk <= 3.5) {
    return {
      label: "Stable",
      className: "good",
      detail:
        "The incoming side is mostly predictable. That usually means safer weekly points and fewer panic decisions.",
    };
  }
  if (risk <= 5) {
    return {
      label: "Manageable",
      className: "good",
      detail: "This is normal fantasy uncertainty. Let the value edge and roster fit decide the deal.",
    };
  }
  if (risk <= 6.5) {
    return {
      label: "Volatile",
      className: "watch",
      detail:
        "The incoming side has more role, injury, age, or team-environment uncertainty. Upside is fine, but do not pay full price for it.",
    };
  }
  return {
    label: "High risk",
    className: "danger",
    detail:
      "The incoming side is fragile. You need a clear discount, major upside, or a roster emergency to justify it.",
  };
}

function tradeRiskRead(giveTotals, getTotals, get) {
  const band = riskBand(getTotals.risk);
  const riskDelta = getTotals.risk - giveTotals.risk;
  const comparison = !get.length
    ? "Add the players you would receive to get a risk read."
    : giveTotals.risk === 0
      ? "The number is a 1-10 average from the player board, where higher means less predictable."
      : riskDelta >= 2
        ? `That is ${riskDelta.toFixed(1)} points riskier than what you are sending.`
        : riskDelta <= -2
          ? `That is ${Math.abs(riskDelta).toFixed(1)} points safer than what you are sending.`
          : "That is close to the risk level you are sending away.";
  const riskyPlayers = get
    .filter((item) => item.row)
    .sort((a, b) => b.risk - a.risk)
    .slice(0, 2)
    .map((item) => `${item.row.Player}: ${item.risk}/10${item.row.Action ? `, ${item.row.Action.toLowerCase()}` : ""}`);
  return {
    ...band,
    comparison,
    notes: riskyPlayers,
  };
}

function tradeDealShape(give, get, net, warnings, giveTotals, getTotals) {
  if (!give.length || !get.length) {
    return {
      label: "Waiting on both sides",
      detail: "Add at least one player to each side and FantasyIQ will read the structure of the offer.",
    };
  }
  const giveBest = giveTotals.best?.value || 0;
  const getBest = getTotals.best?.value || 0;
  const bestPlayerDelta = getBest - giveBest;
  const projectionDelta = getTotals.projection - giveTotals.projection;

  if (bestPlayerDelta <= -10) {
    return {
      label: "Star tax",
      detail:
        "You are probably giving up the best player. Make sure the total value and roster need are strong enough to cover that.",
    };
  }
  if (give.length > get.length && bestPlayerDelta >= 0) {
    return {
      label: "Consolidation win",
      detail:
        "You are turning multiple pieces into equal-or-better player quality. That is usually a clean trade shape.",
    };
  }
  if (get.length > give.length) {
    return {
      label: "Depth add",
      detail: "You are adding bodies. Useful if your bench is thin, but it can water down starter quality.",
    };
  }
  if (net >= 4 && warnings.length) {
    return {
      label: "Value with conditions",
      detail: "The math leans your way, but the warnings need a real answer before you accept.",
    };
  }
  if (Math.abs(net) <= 3 && Math.abs(projectionDelta) <= 10) {
    return {
      label: "Need-for-need",
      detail: "This is close enough that team context matters more than the raw score.",
    };
  }
  return {
    label: net >= 0 ? "Clean edge" : "Thin edge",
    detail:
      net >= 0
        ? "The incoming side gives you a measurable value edge. Check risk and lineup need, then negotiate from strength."
        : "You are giving up value on paper. Only do it if it fixes a real weekly lineup problem.",
  };
}

function renderTradePlayers(container, players, emptyMessage) {
  if (!container) return;
  if (!players.length) {
    container.textContent = emptyMessage;
    return;
  }
  container.innerHTML = players
    .map((item) => {
      if (!item.row) {
        return `<div class="trade-player-chip missing"><strong>${htmlEscape(item.name)}</strong><span>No board match</span><small>Check spelling or use full player name.</small></div>`;
      }
      return `<div class="trade-player-chip">
        ${playerFocusButton(item.row)}
        <span>${item.row.Pos}${item.row["Pos Rank"] || ""} / #${item.row.Rank} / ${htmlEscape(item.row["Pos Tier"] || item.row.Category || "Tier")}</span>
        <small>Trade value ${item.value.toFixed(1)} / Market ${item.marketValue === null ? "N/A" : item.marketValue.toFixed(1)} / ${scoringProjectionLabel()} ${item.projection.toFixed(1)} / Risk ${item.risk}/10</small>
        ${playerSynopsisBlock(item.row, { compact: true })}
      </div>`;
    })
    .join("");
}

function renderRosterPills(roster) {
  if (!tradeRosterPills) return;
  if (!roster.length) {
    tradeRosterPills.textContent = "Add roster names to unlock fit warnings.";
    return;
  }
  const counts = positionCounts(roster);
  tradeRosterPills.innerHTML = ["QB", "RB", "WR", "TE", "DST", "K"]
    .map((pos) => `<span>${pos} ${counts[pos] || 0}</span>`)
    .join("");
}

function tradeFitWarnings(give, get, roster) {
  const warnings = [];
  const before = positionCounts(roster);
  const after = { ...before };
  give.forEach((item) => {
    if (item.row?.Pos && after[item.row.Pos] !== undefined) after[item.row.Pos] -= 1;
  });
  get.forEach((item) => {
    if (item.row?.Pos) after[item.row.Pos] = (after[item.row.Pos] || 0) + 1;
  });

  if (roster.length) {
    const starters = starterTargetCounts();
    if ((after.RB || 0) < Math.max(2, starters.RB + 1)) warnings.push("RB room gets thin.");
    if ((after.WR || 0) < Math.max(3, starters.WR + 1)) warnings.push("WR room gets thin.");
    if ((after.TE || 0) < starters.TE) warnings.push("No starting TE left after trade.");
    if (activeLineupSlots().SUPERFLEX && (after.QB || 0) < starters.QB) warnings.push("Superflex QB room gets thin.");
    const giveCounts = positionCounts(give);
    const getCounts = positionCounts(get);
    ["RB", "WR", "TE", "QB"].forEach((pos) => {
      if ((giveCounts[pos] || 0) > (getCounts[pos] || 0) && (after[pos] || 0) <= 2 && ["RB", "WR"].includes(pos)) {
        warnings.push(`You are losing ${pos} depth.`);
      }
    });
  }

  const giveBest = tradeTotals(give).best;
  const getBest = tradeTotals(get).best;
  if (giveBest?.value && getBest?.value && giveBest.value - getBest.value >= 10) {
    warnings.push(`You are giving up the best player: ${giveBest.row?.Player || giveBest.name}.`);
  }
  if (tradeTotals(get).risk - tradeTotals(give).risk >= 2) {
    warnings.push("Incoming side carries meaningfully more risk.");
  }
  return warnings;
}

function tradeDeskStorageKey(key) {
  return loadoutStorageKey(`trade-desk-${key}`);
}

function selectedTradeMode() {
  return localStorage.getItem(tradeDeskStorageKey("mode")) || "balanced";
}

function tradeModeLabel(mode = selectedTradeMode()) {
  if (mode === "win-now") return "Win now";
  if (mode === "upside") return "Upside";
  return "Balanced";
}

function rowListFromTradeItems(items) {
  return items.map((item) => item.row).filter(Boolean);
}

function tradeAdjustedRosterRows(roster, give, get) {
  const giveKeys = new Set(rowListFromTradeItems(give).map((row) => normalizePlayerName(row.Player)));
  const before = rowListFromTradeItems(roster);
  const after = before
    .filter((row) => !giveKeys.has(normalizePlayerName(row.Player)))
    .concat(rowListFromTradeItems(get));
  return { before, after };
}

function lineupSlotsForDisplay() {
  const slots = activeLineupSlots();
  const list = [];
  ["QB", "RB", "WR", "TE"].forEach((pos) => {
    const count = Number(slots[pos] || 0);
    for (let index = 0; index < count; index += 1) list.push(pos);
  });
  for (let index = 0; index < Number(slots.FLEX || 0); index += 1) list.push("FLEX");
  for (let index = 0; index < Number(slots.SUPERFLEX || 0); index += 1) list.push("SFLEX");
  if (Number(slots.DST || 0)) list.push("DST");
  if (Number(slots.K || 0)) list.push("K");
  return list;
}

function fillLineup(rows) {
  const used = new Set();
  const sortedByPos = (posList) =>
    rows
      .filter((row) => posList.includes(row.Pos) && !used.has(normalizePlayerName(row.Player)))
      .sort((a, b) => leagueValueScore(b) - leagueValueScore(a));
  return lineupSlotsForDisplay().map((slot) => {
    const eligible = slot === "FLEX" ? ["RB", "WR", "TE"] : slot === "SFLEX" ? ["QB", "RB", "WR", "TE"] : [slot];
    const row = sortedByPos(eligible)[0] || null;
    if (row) used.add(normalizePlayerName(row.Player));
    return { slot, row };
  });
}

function lineupValue(lineup) {
  return lineup.reduce((sum, item) => sum + (item.row ? leagueValueScore(item.row) : 0), 0);
}

function renderLineupComparison(roster, give, get) {
  if (!roster.length) {
    return `<div class="trade-lineup-card"><span>Before / After Lineup</span><strong>Roster needed</strong><p>Paste your roster or select your ESPN team to see who starts before and after the trade.</p></div>`;
  }
  const { before, after } = tradeAdjustedRosterRows(roster, give, get);
  const beforeLineup = fillLineup(before);
  const afterLineup = fillLineup(after);
  const delta = lineupValue(afterLineup) - lineupValue(beforeLineup);
  const renderSide = (label, lineup) =>
    `<section><h4>${label}</h4>${lineup
      .map(
        (item) =>
          `<div><span>${htmlEscape(item.slot)}</span><strong>${item.row ? htmlEscape(item.row.Player) : "Open slot"}</strong><small>${item.row ? `${item.row.Pos} / value ${valueDisplay(item.row)}` : "Needs player"}</small></div>`,
      )
      .join("")}</section>`;
  return `<div class="trade-lineup-card">
    <span>Before / After Lineup</span>
    <strong>${delta >= 0 ? "+" : ""}${delta.toFixed(1)} starter value</strong>
    <div class="trade-lineup-grid">${renderSide("Before", beforeLineup)}${renderSide("After", afterLineup)}</div>
  </div>`;
}

function tradeRosterFitRead(give, get, roster) {
  if (!roster.length) {
    return {
      label: "Roster context pending",
      className: "watch",
      detail: "Paste your roster or use the ESPN team selector to unlock true roster-fit judgment.",
      score: 0,
    };
  }
  const { before, after } = tradeAdjustedRosterRows(roster, give, get);
  const beforeSnapshot = {
    counts: countsFromRosterItems(before.map((row) => ({ row }))),
    rows: before,
  };
  const afterSnapshot = {
    counts: countsFromRosterItems(after.map((row) => ({ row }))),
    rows: after,
  };
  const beforeNeeds = rosterWeaknesses(beforeSnapshot);
  const afterNeeds = rosterWeaknesses(afterSnapshot);
  const beforeNeedScore = beforeNeeds.reduce((sum, item) => sum + item.weight, 0);
  const afterNeedScore = afterNeeds.reduce((sum, item) => sum + item.weight, 0);
  const lineupDelta = lineupValue(fillLineup(after)) - lineupValue(fillLineup(before));
  const score = (beforeNeedScore - afterNeedScore) * 1.8 + lineupDelta * 0.65;
  const mainNeed = afterNeeds[0]?.pos;
  if (score >= 8)
    return {
      label: "Roster fit improves",
      className: "good",
      detail: `Starter/depth shape improves. ${mainNeed ? `Main remaining need: ${mainNeed}.` : "No obvious remaining hole."}`,
      score,
    };
  if (score <= -8)
    return {
      label: "Roster fit worsens",
      className: "danger",
      detail: `This creates or deepens a roster hole${mainNeed ? ` at ${mainNeed}` : ""}.`,
      score,
    };
  return {
    label: "Fit is neutral",
    className: "watch",
    detail: mainNeed
      ? `The deal is close. Your main remaining need is ${mainNeed}.`
      : "Roster shape stays mostly intact, so raw value and risk should decide.",
    score,
  };
}

function tradeScoreBreakdown(giveTotals, getTotals, give, get, roster, warnings) {
  const mode = selectedTradeMode();
  const net = getTotals.value - giveTotals.value;
  const projectionDelta = getTotals.projection - giveTotals.projection;
  const bestDelta = (getTotals.best?.value || 0) - (giveTotals.best?.value || 0);
  const fit = tradeRosterFitRead(give, get, roster);
  const scarcity =
    rowListFromTradeItems(get).reduce((sum, row) => sum + (topTierInfo(row.Pos).count <= 3 ? 5 : 0), 0) -
    rowListFromTradeItems(give).reduce((sum, row) => sum + (topTierInfo(row.Pos).count <= 3 ? 5 : 0), 0);
  const riskDelta = getTotals.risk - giveTotals.risk;
  const modeBias =
    mode === "win-now"
      ? projectionDelta * 0.08 - Math.max(0, riskDelta) * 2
      : mode === "upside"
        ? Math.max(0, riskDelta) * 0.8 +
          rowListFromTradeItems(get).reduce((sum, row) => sum + Number(row.Upside || row.Ceiling || 0) * 0.04, 0)
        : 0;
  const marketRead = tradeMarketCalibration(giveTotals, getTotals, give, get);
  const marketDelta = marketRead.netMarket - marketRead.netFantasyIq;
  const marketBias = marketRead.coverage >= 0.75 ? clampNumber(marketDelta * 0.45, -7, 7) : 0;
  const score = Math.round(
    clampNumber(
      50 +
        net * 1.15 +
        projectionDelta * 0.06 +
        bestDelta * 0.7 +
        fit.score +
        scarcity +
        modeBias +
        marketBias -
        warnings.length * 4,
      0,
      100,
    ),
  );
  return {
    score,
    fit,
    marketRead,
    items: [
      {
        label: "Raw value",
        value: `${net >= 0 ? "+" : ""}${net.toFixed(1)}`,
        className: net >= 4 ? "good" : net < -4 ? "danger" : "watch",
      },
      {
        label: "Market value",
        value: marketRead.coverage
          ? `${marketRead.netMarket >= 0 ? "+" : ""}${marketRead.netMarket.toFixed(1)}`
          : "Loading",
        className: marketRead.className,
      },
      {
        label: "Starter impact",
        value: `${projectionDelta >= 0 ? "+" : ""}${projectionDelta.toFixed(1)}`,
        className: projectionDelta >= 10 ? "good" : projectionDelta < -10 ? "danger" : "watch",
      },
      { label: "Roster fit", value: fit.label, className: fit.className },
      {
        label: "Scarcity",
        value: scarcity > 0 ? `+${scarcity}` : String(scarcity),
        className: scarcity > 0 ? "good" : scarcity < 0 ? "danger" : "watch",
      },
      {
        label: "Risk",
        value: `${riskDelta >= 0 ? "+" : ""}${riskDelta.toFixed(1)}`,
        className: riskDelta <= -1 ? "good" : riskDelta >= 1.5 ? "danger" : "watch",
      },
      { label: "Mode", value: tradeModeLabel(mode), className: "watch" },
    ],
  };
}

function fairnessLabel(score) {
  if (score >= 68) return { label: "You win", className: "good" };
  if (score >= 45) return { label: "Fair zone", className: "watch" };
  return { label: "They win", className: "danger" };
}

function oneLineTradeVerdict(verdict, breakdown, warnings) {
  if (verdict === "Enter both sides") return "Add both sides before making a decision.";
  if (verdict === "Fix unknown players") return "Fix the unmatched player names before trusting the result.";
  if (breakdown.fit.className === "danger")
    return "Reject or counter. The value may not cover the roster hole this creates.";
  if (warnings.some((warning) => warning.includes("best player")))
    return "Counter. You are giving up the best player and need a cleaner premium back.";
  if (breakdown.score >= 70) return "Accept if the incoming players fit your weekly lineup.";
  if (breakdown.score >= 50) return "Negotiate. This is close enough that one bench piece can swing it.";
  return "Reject unless this solves an urgent lineup problem.";
}

function counterOfferIdeas(give, get, roster, breakdown) {
  const needs = roster.length
    ? rosterWeaknesses({ rows: rowListFromTradeItems(roster), counts: positionCounts(roster) })
    : [];
  const topNeed = needs[0]?.pos || rowListFromTradeItems(give)[0]?.Pos || "RB/WR";
  const incomingBest = tradeTotals(get).best;
  const outgoingBest = tradeTotals(give).best;
  const ideas = [];
  if (breakdown.score < 55) ideas.push(`Ask for one more ${topNeed} depth piece or a safer starter before accepting.`);
  if (outgoingBest?.value && incomingBest?.value && outgoingBest.value - incomingBest.value >= 8)
    ideas.push(
      `Keep ${outgoingBest.row?.Player || outgoingBest.name} unless ${incomingBest.row?.Player || incomingBest.name} comes with a meaningful add-on.`,
    );
  if (breakdown.fit.className === "danger")
    ideas.push(`Counter by replacing the outgoing ${topNeed} with a bench piece, or ask for ${topNeed} back.`);
  if (!ideas.length)
    ideas.push("If you want to press, ask for a small bench upside player instead of changing the core.");
  ideas.push("If they reject, remove your lowest-value outgoing piece before upgrading the incoming side.");
  return ideas.slice(0, 3);
}

function partnerLens(give, get) {
  const giveRows = rowListFromTradeItems(give);
  const getRows = rowListFromTradeItems(get);
  if (!giveRows.length || !getRows.length) return "Add both sides to estimate the other manager's incentive.";
  const getPositions = new Set(getRows.map((row) => row.Pos));
  const givePositions = new Set(giveRows.map((row) => row.Pos));
  const teams = leagueTeamSnapshots()
    .filter((snapshot) => String(snapshot.teamId) !== String(selectedTeamId()))
    .map((snapshot) => {
      const needs = tradeNeedProfiles(snapshot);
      const wantsIncoming = needs
        .filter((need) => givePositions.has(need.pos))
        .reduce((sum, need) => sum + need.weight, 0);
      const losingNeed = needs.filter((need) => getPositions.has(need.pos)).reduce((sum, need) => sum + need.weight, 0);
      return { snapshot, score: wantsIncoming - losingNeed, needs };
    })
    .sort((a, b) => b.score - a.score);
  const best = teams[0];
  if (best && best.score > 0) {
    return `${teamSnapshotLabel(best.snapshot)} is the best fit: they need ${best.needs
      .slice(0, 2)
      .map((need) => need.pos)
      .join("/")} and may value what you are sending.`;
  }
  return "Partner lens: sell the incoming manager on need, not raw value. This offer is more likely to work if their roster needs the position you send.";
}

function savedTradeNotes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(tradeDeskStorageKey("notes")) || "[]");
    return Array.isArray(parsed) ? parsed.slice(0, 12) : [];
  } catch {
    return [];
  }
}

function saveTradeNotes(notes) {
  localStorage.setItem(tradeDeskStorageKey("notes"), JSON.stringify(notes.slice(0, 12)));
}

function currentTradeNote() {
  syncTradeSlotsToTextareas();
  const give = tradeSideValue(tradeGive?.value || "");
  const get = tradeSideValue(tradeGet?.value || "");
  const giveTotals = tradeTotals(give);
  const getTotals = tradeTotals(get);
  return {
    at: new Date().toISOString(),
    mode: selectedTradeMode(),
    give: parseLines(tradeGive?.value || ""),
    get: parseLines(tradeGet?.value || ""),
    net: Number((getTotals.value - giveTotals.value).toFixed(1)),
  };
}

function renderSavedTradeNotes() {
  if (!tradeSavedNotes) return;
  const notes = savedTradeNotes();
  if (!notes.length) {
    tradeSavedNotes.textContent = "No saved trade checks yet.";
    return;
  }
  tradeSavedNotes.innerHTML = notes
    .map(
      (note, index) => `<article>
      <span>${htmlEscape(tradeModeLabel(note.mode))} / ${htmlEscape(new Date(note.at).toLocaleDateString())}</span>
      <strong>${htmlEscape(note.give.join(", ") || "Nothing")} -> ${htmlEscape(note.get.join(", ") || "Nothing")}</strong>
      <small>${note.net >= 0 ? "+" : ""}${Number(note.net || 0).toFixed(1)} net value</small>
      <button type="button" data-load-trade-note="${index}">Load</button>
      <button type="button" data-remove-trade-note="${index}">Remove</button>
    </article>`,
    )
    .join("");
  tradeSavedNotes.querySelectorAll("[data-load-trade-note]").forEach((button) => {
    button.addEventListener("click", () => {
      const note = savedTradeNotes()[Number(button.dataset.loadTradeNote)];
      if (!note) return;
      if (tradeGive) tradeGive.value = (note.give || []).join("\n");
      if (tradeGet) tradeGet.value = (note.get || []).join("\n");
      setTradeSlots("give", note.give || []);
      setTradeSlots("get", note.get || []);
      localStorage.setItem(tradeDeskStorageKey("mode"), note.mode || "balanced");
      renderTradeCalc();
    });
  });
  tradeSavedNotes.querySelectorAll("[data-remove-trade-note]").forEach((button) => {
    button.addEventListener("click", () => {
      const notes = savedTradeNotes();
      notes.splice(Number(button.dataset.removeTradeNote), 1);
      saveTradeNotes(notes);
      renderSavedTradeNotes();
    });
  });
}

function saveCurrentTradeNote() {
  const note = currentTradeNote();
  if (!note.give.length && !note.get.length) return;
  saveTradeNotes([note, ...savedTradeNotes()]);
  renderSavedTradeNotes();
}

function renderTradeCalc() {
  if (!tradeOutput) return;
  syncTradeSlotsToTextareas();
  if (!boardData) {
    tradeOutput.innerHTML = `
      <span class="trade-verdict-label">Deal Verdict</span>
      <strong>Loading board</strong>
      <p>Live ESPN board values are still loading. Try again in a moment.</p>
    `;
    return;
  }
  const give = tradeSideValue(tradeGive?.value || "");
  const get = tradeSideValue(tradeGet?.value || "");
  const pastedRoster = tradeSideValue(tradeRoster?.value || "");
  const snapshotRoster = !pastedRoster.length
    ? activeRosterSnapshot().rows.map((row) => ({
        name: row.Player,
        row,
        value: leagueValueScore(row),
        risk: Number(row.Risk || 0),
        projection: projectionValue(row),
      }))
    : [];
  const roster = pastedRoster.length ? pastedRoster : snapshotRoster;
  const giveTotals = tradeTotals(give);
  const getTotals = tradeTotals(get);
  const giveTotal = giveTotals.value;
  const getTotal = getTotals.value;
  const net = getTotal - giveTotal;
  const projectionDelta = getTotals.projection - giveTotals.projection;
  const unknowns = [...give, ...get].filter((item) => !item.row).map((item) => item.name);
  const warnings = tradeFitWarnings(give, get, roster);
  const riskRead = tradeRiskRead(giveTotals, getTotals, get);
  const dealShape = tradeDealShape(give, get, net, warnings, giveTotals, getTotals);
  const breakdown = tradeScoreBreakdown(giveTotals, getTotals, give, get, roster, warnings);
  const acceptance = acceptanceProbability(give, get, roster, warnings, giveTotals, getTotals, breakdown.marketRead);
  if (give.length && get.length && !unknowns.length) {
    breakdown.score = Math.round(Math.min(breakdown.score, acceptance.score + 35));
  }
  const fairness =
    acceptance.score < 30 && give.length && get.length && !unknowns.length
      ? { label: "Unrealistic ask", className: "danger" }
      : fairnessLabel(breakdown.score);
  const verdict =
    !give.length || !get.length
      ? "Enter both sides"
      : unknowns.length
        ? "Fix unknown players"
        : acceptance.score < 30
          ? "Unlikely, counter"
          : breakdown.score >= 72 && !warnings.length
            ? "Accept"
            : breakdown.score >= 60
              ? "Lean accept"
              : breakdown.score >= 45
                ? "Fair, negotiate"
                : breakdown.score >= 35
                  ? "Only for roster fit"
                  : "Reject or counter";
  const verdictClass =
    verdict === "Accept" || verdict === "Lean accept"
      ? "good"
      : verdict === "Reject or counter" || verdict === "Fix unknown players" || verdict === "Unlikely, counter"
        ? "danger"
        : "watch";
  const summary =
    !give.length || !get.length
      ? "Type one player per line on each side. Trade IQ updates from the live ESPN board."
      : acceptance.score < 30 && !unknowns.length
        ? "Good for you on paper, but unlikely to be accepted. Add a real incentive, lower the target, or shop a need the other roster actually has."
        : oneLineTradeVerdict(verdict, breakdown, warnings);

  if (tradeGiveTotal) tradeGiveTotal.textContent = giveTotal.toFixed(1);
  if (tradeGetTotal) tradeGetTotal.textContent = getTotal.toFixed(1);
  updateTradePackageControls(give.length, get.length);
  if (tradeRosterStatus)
    tradeRosterStatus.textContent = pastedRoster.length ? "Pasted" : roster.length ? "ESPN" : "Optional";
  renderTradePlayers(tradeGiveList, give, "No outgoing players yet.");
  renderTradePlayers(tradeGetList, get, "No incoming players yet.");
  renderRosterPills(roster);
  tradeModeButtons.forEach((button) =>
    button.classList.toggle("active", (button.dataset.tradeMode || "balanced") === selectedTradeMode()),
  );
  renderSavedTradeNotes();

  if (!give.length || !get.length) {
    tradeOutput.innerHTML = `
      <span class="trade-verdict-label">Deal Verdict</span>
      <strong class="${verdictClass}">${verdict}</strong>
      <p>${htmlEscape(summary)}</p>
      <div class="trade-score-grid">
        <div><span>Send Value</span><strong>${giveTotal.toFixed(1)}</strong></div>
        <div><span>Receive Value</span><strong>${getTotal.toFixed(1)}</strong></div>
        <div><span>Roster Context</span><strong>${roster.length ? "Ready" : "Optional"}</strong><small>${roster.length ? "Using your active roster." : "Paste or sync a roster for fit reads."}</small></div>
      </div>
    `;
    renderRosterEngines();
    return;
  }

  tradeOutput.innerHTML = `
    <span class="trade-verdict-label">Deal Verdict</span>
    <strong class="${verdictClass}">${verdict}</strong>
    <p>${htmlEscape(summary)}</p>
    <div class="trade-fairness ${fairness.className}">
      <span>Deal Quality Index</span>
      <strong>${htmlEscape(fairness.label)}</strong>
      <div class="trade-quality-track"><i style="width:${breakdown.score}%"></i><b>Reject</b><b>Negotiate</b><b>Lean Accept</b><b>Accept</b></div>
      <small>${breakdown.score}/100 decision score in ${htmlEscape(tradeModeLabel())} mode</small>
    </div>
    <div class="trade-score-grid">
      <div><span>Net Value</span><strong>${net >= 0 ? "+" : ""}${net.toFixed(1)}</strong></div>
      <div><span>Fantasy IQ Data</span><strong>${marketTotalLabel(getTotals)} / ${marketTotalLabel(giveTotals)}</strong><small>${htmlEscape(breakdown.marketRead.label)}</small></div>
      <div><span>${scoringProjectionLabel()}</span><strong>${projectionDelta >= 0 ? "+" : ""}${projectionDelta.toFixed(1)}</strong></div>
      <div><span>Incoming Risk</span><strong class="${riskRead.className}">${getTotals.risk.toFixed(1)}/10</strong><small>${htmlEscape(riskRead.label)}</small></div>
      <div><span>Roster Fit</span><strong class="${breakdown.fit.className}">${htmlEscape(breakdown.fit.label)}</strong></div>
      <div><span>Acceptance</span><strong class="${acceptance.className}">${acceptance.score}%</strong><small>${htmlEscape(acceptance.label)}</small></div>
    </div>
    <div class="trade-breakdown-grid">
      ${breakdown.items.map((item) => `<article><span>${htmlEscape(item.label)}</span><strong class="${item.className}">${htmlEscape(item.value)}</strong></article>`).join("")}
    </div>
    <div class="trade-detail-grid">
      <article class="trade-risk-read ${riskRead.className}">
        <span>Incoming risk explained</span>
        <strong>${htmlEscape(riskRead.label)}</strong>
        <p>${htmlEscape(riskRead.detail)} ${htmlEscape(riskRead.comparison)}</p>
        ${riskRead.notes.length ? `<ul>${riskRead.notes.map((note) => `<li>${htmlEscape(note)}</li>`).join("")}</ul>` : ""}
      </article>
      <article class="trade-shape-read">
        <span>Deal shape</span>
        <strong>${htmlEscape(dealShape.label)}</strong>
        <p>${htmlEscape(dealShape.detail)}</p>
      </article>
      <article class="${breakdown.marketRead.className}">
        <span>Fantasy IQ Data</span>
        <strong>${htmlEscape(breakdown.marketRead.label)}</strong>
        <p>${htmlEscape(breakdown.marketRead.detail)} ${htmlEscape(breakdown.marketRead.source)}.</p>
      </article>
      <article class="${breakdown.fit.className}">
        <span>Roster-fit read</span>
        <strong>${htmlEscape(breakdown.fit.label)}</strong>
        <p>${htmlEscape(breakdown.fit.detail)}</p>
      </article>
      <article class="${acceptance.className}">
        <span>Real-world acceptance</span>
        <strong>${htmlEscape(acceptance.label)} / ${acceptance.score}%</strong>
        <p>${htmlEscape(acceptance.detail)}</p>
      </article>
      <article>
        <span>Trade partner lens</span>
        <strong>Acceptance angle</strong>
        <p>${htmlEscape(partnerLens(give, get))}</p>
      </article>
    </div>
    ${renderLineupComparison(roster, give, get)}
    <div class="trade-counteroffers">
      <span>Negotiation Script</span>
      <ul>${counterOfferIdeas(give, get, roster, breakdown)
        .map((idea) => `<li>${htmlEscape(idea)}</li>`)
        .join("")}</ul>
    </div>
    <p><strong>Positions:</strong> Send ${tradePositionSummary(give)}. Receive ${tradePositionSummary(get)}.</p>
    ${warnings.length ? `<div class="trade-warning-list">${warnings.map((warning) => `<span>${htmlEscape(warning)}</span>`).join("")}</div>` : ""}
    ${unknowns.length ? `<p><strong>Unknown players:</strong> ${unknowns.map(htmlEscape).join(", ")}.</p>` : ""}
  `;
  renderRosterEngines();
}

function gradeLetter(score) {
  if (score >= 93) return "A";
  if (score >= 88) return "A-";
  if (score >= 83) return "B+";
  if (score >= 78) return "B";
  if (score >= 73) return "B-";
  if (score >= 68) return "C+";
  if (score >= 62) return "C";
  if (score >= 55) return "D";
  return "F";
}

function rosterRowsFromText(text = "") {
  return tradeSideValue(text).filter((item) => item.row);
}

function emptyRosterSnapshot(source = "none") {
  return { source, teamId: "", counts: emptyPositionCounts(), picks: [], rows: [], players: [] };
}

function pastedRosterSnapshot() {
  const pasted = rosterRowsFromText(tradeRoster?.value || "");
  if (!pasted.length) return null;
  const rows = pasted.map((item) => item.row);
  return {
    source: "pasted",
    teamId: "",
    counts: positionCounts(pasted),
    picks: [],
    rows,
    players: pasted,
  };
}

function combinedBoardRows() {
  return boardData?.boards?.combined?.rows || [];
}
