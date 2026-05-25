const SOS_POSITIONS = ["QB", "RB", "WR", "TE", "DST", "K"];
const SOS_TEAMS = [
  "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE",
  "DAL", "DEN", "DET", "GB", "HOU", "IND", "JAX", "KC",
  "LV", "LAC", "LAR", "MIA", "MIN", "NE", "NO", "NYG",
  "NYJ", "PHI", "PIT", "SF", "SEA", "TB", "TEN", "WAS",
];
const SOS_TEAM_NAMES = {
  ARI: "Arizona", ATL: "Atlanta", BAL: "Baltimore", BUF: "Buffalo", CAR: "Carolina", CHI: "Chicago",
  CIN: "Cincinnati", CLE: "Cleveland", DAL: "Dallas", DEN: "Denver", DET: "Detroit", GB: "Green Bay",
  HOU: "Houston", IND: "Indianapolis", JAX: "Jacksonville", KC: "Kansas City", LV: "Las Vegas",
  LAC: "LA Chargers", LAR: "LA Rams", MIA: "Miami", MIN: "Minnesota", NE: "New England", NO: "New Orleans",
  NYG: "NY Giants", NYJ: "NY Jets", PHI: "Philadelphia", PIT: "Pittsburgh", SF: "San Francisco",
  SEA: "Seattle", TB: "Tampa Bay", TEN: "Tennessee", WAS: "Washington",
};
let sosSort = { key: "overall", direction: "asc" };
let sosApiData = null;
let sosApiLoading = false;
let sosApiError = "";
sosRuntimeReady = true;
window.setTimeout(() => {
  if (document.querySelector("#live")?.classList.contains("active")) {
    renderSosHeatMap();
    loadSosHeatMap();
  }
}, 0);

function sosHash(value = "") {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function sosWeeks() {
  const range = sosRange?.value || "1-17";
  if (range === "custom") {
    const selected = Array.from(sosWeekToggles?.querySelectorAll(".active") || [])
      .map((button) => Number(button.dataset.sosWeek))
      .filter(Boolean)
      .sort((a, b) => a - b);
    return selected.length ? selected : [15, 16, 17];
  }
  const [start, end] = range.split("-").map(Number);
  return Array.from({ length: Math.max(1, end - start + 1) }, (_, index) => start + index);
}

function sosOpponent(team, week) {
  const index = SOS_TEAMS.indexOf(team);
  if (index < 0) return "BYE";
  const opponentIndex = (index + week * 7 + Math.floor(week / 3)) % SOS_TEAMS.length;
  return SOS_TEAMS[opponentIndex] === team ? SOS_TEAMS[(opponentIndex + 1) % SOS_TEAMS.length] : SOS_TEAMS[opponentIndex];
}

function sosScore(team, position, week) {
  const opponent = sosOpponent(team, week);
  const base = sosHash(`${opponent}:${position}:${week}`);
  const positionalBias = { QB: 1, RB: 3, WR: 2, TE: 0, DST: 2, K: 1 }[position] || 0;
  return ((base + positionalBias + week) % 4) + 1;
}

function sosTier(score, apiTier = "") {
  if (apiTier === "bye") return "tier-bye";
  if (score <= 1.75) return "tier-easy";
  if (score <= 2.5) return "tier-good";
  if (score <= 3.25) return "tier-hard";
  return "tier-brutal";
}

function sosTierLabel(score, apiTier = "") {
  if (apiTier === "bye") return "Bye";
  return score <= 1.75 ? "Easy" : score <= 2.5 ? "Good" : score <= 3.25 ? "Tough" : "Brutal";
}

function sosNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function sosFormat(value, digits = 1, fallback = "N/A") {
  const number = sosNumber(value);
  return number === null ? fallback : number.toFixed(digits);
}

function sosPercent(value, fallback = "N/A") {
  const number = sosNumber(value);
  return number === null ? fallback : `${Math.round(number * 100)}%`;
}

function sosMoneyline(value) {
  const number = sosNumber(value);
  if (number === null) return "N/A";
  return number > 0 ? `+${Math.round(number)}` : `${Math.round(number)}`;
}

function sosNormalizePosition(value = "") {
  const position = String(value || "").toUpperCase().replace(/[^A-Z/]/g, "");
  if (position.includes("DST") || position.includes("D/ST")) return "DST";
  if (position.includes("WRCB")) return "WR";
  if (SOS_POSITIONS.includes(position)) return position;
  return position.slice(0, 2);
}

function primaryRowsByTeamPosition() {
  const byKey = new Map();
  combinedBoardRows().forEach((row) => {
    const team = String(row.Team || row.NFL || "").toUpperCase();
    const position = sosNormalizePosition(row.Pos || row.Position || "");
    if (!SOS_TEAMS.includes(team) || !SOS_POSITIONS.includes(position)) return;
    const key = `${team}:${position}`;
    const current = byKey.get(key);
    if (!current || Number(row.Rank || 9999) < Number(current.Rank || 9999)) byKey.set(key, row);
  });
  return byKey;
}

function sosAverage(values, fallback = null) {
  const clean = values.filter((value) => Number.isFinite(value));
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : fallback;
}

function sosHasMarketSignal(item) {
  const source = String(item?.oddsSource || "").toLowerCase();
  return Boolean(
    Number.isFinite(item?.impliedTotal)
      || Number.isFinite(item?.opponentImpliedTotal)
      || Number.isFinite(item?.gameTotal)
      || Number.isFinite(item?.spread)
      || Number.isFinite(item?.moneyline)
      || source.includes("odds")
      || source.includes("market")
      || source.includes("historical")
  );
}

function sosRowMetrics(scores, position) {
  const playable = scores.filter((item) => item.apiTier !== "bye" && Number.isFinite(item.score));
  const validScores = playable.map((item) => item.score);
  const avg = sosAverage(validScores, 2.5);
  const ease = clampNumber(Math.round(((4 - avg) / 3) * 100), 0, 100);
  const easy = validScores.filter((score) => score <= 2.0).length;
  const tough = validScores.filter((score) => score >= 3.0).length;
  const brutal = validScores.filter((score) => score >= 3.25).length;
  const averageTotal = sosAverage(scores.map((item) => item.impliedTotal));
  const marketCells = scores.filter(sosHasMarketSignal).length;
  const sortedByScore = [...playable].sort((left, right) => left.score - right.score);
  const bestCell = sortedByScore[0] || null;
  const worstCell = sortedByScore[sortedByScore.length - 1] || null;
  const windowSize = Math.max(1, validScores.length);
  const easyNeeded = Math.max(1, Math.ceil(windowSize * 0.28));
  const brutalLimit = Math.max(1, Math.floor(windowSize * 0.22));
  const scheduleScore = clampNumber(Math.round(ease + easy * 2 - tough * 2.5), 0, 100);
  const streamerPosition = ["DST", "K", "TE"].includes(position);
  const isStreamer = streamerPosition && avg <= 2.4 && easy >= easyNeeded && brutal <= brutalLimit;
  const isTarget = avg <= 2.35 || (easy >= easyNeeded && tough <= brutalLimit);
  const isFade = avg >= 2.85 || tough >= Math.max(2, Math.ceil(windowSize * 0.34));
  let call = "Neutral";
  let callClass = "neutral";
  if (isFade) {
    call = "Tough run";
    callClass = "fade";
  } else if (isStreamer) {
    call = "Streamable";
    callClass = "stream";
  } else if (isTarget) {
    call = "Easy run";
    callClass = "target";
  }
  return {
    avg,
    avgDifficulty: avg,
    ease,
    easy,
    tough,
    brutal,
    averageTotal,
    marketCells,
    bestCell,
    worstCell,
    edgeScore: scheduleScore,
    scheduleScore,
    call,
    callClass,
    isTarget,
    isFade,
    isStreamer,
  };
}

function sosViewMatches(metrics) {
  const view = sosView?.value || "all";
  if (view === "easy" || view === "targets") return metrics.isTarget;
  if (view === "tough" || view === "fades") return metrics.isFade;
  if (view === "streamers") return metrics.isStreamer;
  return true;
}

function sosOrdinal(value) {
  const number = Number(value) || 0;
  const mod100 = number % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${number}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[number % 10] || "th";
  return `${number}${suffix}`;
}

function sosApplyScheduleRanks(rows) {
  const groups = rows.reduce((map, row) => {
    if (!map.has(row.position)) map.set(row.position, []);
    map.get(row.position).push(row);
    return map;
  }, new Map());
  groups.forEach((groupRows) => {
    const ranked = [...groupRows].sort((left, right) => left.avgDifficulty - right.avgDifficulty || left.rank - right.rank);
    const midpoint = Math.ceil(ranked.length / 2);
    ranked.forEach((row, index) => {
      const rank = index + 1;
      const toughRank = ranked.length - index;
      row.overallRank = rank;
      row.toughRank = toughRank;
      row.overallClass = rank <= midpoint ? "easy" : "tough";
      row.overallLabel = rank <= midpoint
        ? `${sosOrdinal(rank)}-Easy`
        : `${sosOrdinal(toughRank)}-Tough`;
    });
  });
  return rows;
}

function sosRows(options = {}) {
  const primary = primaryRowsByTeamPosition();
  const positionFilterValue = sosPosition?.value || "ALL";
  const search = normalizePlayerName(sosPlayerSearch?.value || "");
  const positions = positionFilterValue === "ALL" ? SOS_POSITIONS : [positionFilterValue];
  const weeks = sosWeeks();
  const rows = [];
  const apiRows = Array.isArray(sosApiData?.rows) ? sosApiData.rows : [];
  const rowSource = apiRows.length
    ? apiRows.filter((row) => positions.includes(row.position))
    : SOS_TEAMS.flatMap((team) => positions.map((position) => ({ team, position })));
  rowSource.forEach((sourceRow) => {
      const team = sourceRow.team;
      const position = sourceRow.position;
      const boardRow = primary.get(`${team}:${position}`);
      const player = boardRow?.Player || (position === "DST" ? `${SOS_TEAM_NAMES[team]} D/ST` : `${SOS_TEAM_NAMES[team]} ${position}1`);
      const haystack = normalizePlayerName(`${player} ${team} ${SOS_TEAM_NAMES[team]} ${position}`);
      if (search && !haystack.includes(search)) return;
      const sourceCells = Array.isArray(sourceRow.cells) ? sourceRow.cells : [];
      const scores = weeks.map((week) => {
        const apiCell = sourceCells.find((cell) => Number(cell.week) === Number(week));
        if (apiCell) {
          const score = sosNumber(apiCell.score);
          const fallbackHeat = score === null ? null : (5 - score) * 6.5;
          return {
            week,
            opponent: apiCell.opponent || "BYE",
            site: apiCell.site || "",
            isAway: Boolean(apiCell.isAway),
            score,
            apiTier: apiCell.tier || "",
            fpa: sosNumber(apiCell.fpa),
            fpaScore: sosNumber(apiCell.fpaScore),
            heatValue: sosNumber(apiCell.heatValue, sosNumber(apiCell.impliedTotal, fallbackHeat)),
            impliedTotal: sosNumber(apiCell.impliedTotal),
            opponentImpliedTotal: sosNumber(apiCell.opponentImpliedTotal),
            gameTotal: sosNumber(apiCell.gameTotal),
            spread: sosNumber(apiCell.spread),
            moneyline: sosNumber(apiCell.moneyline),
            noVigWinProbability: sosNumber(apiCell.noVigWinProbability),
            oddsSource: apiCell.oddsSource || sourceRow.oddsSource || "",
            bookmakers: sosNumber(apiCell.bookmakers),
            oddsSamples: sosNumber(apiCell.oddsSamples),
          };
        }
        const score = sosScore(team, position, week);
        return { week, opponent: sosOpponent(team, week), site: "", isAway: false, score, heatValue: (5 - score) * 6.5, oddsSource: "modeled fallback" };
      });
      const metrics = sosRowMetrics(scores, position);
      rows.push({ team, position, player, rank: Number(boardRow?.Rank || 999), scores, source: sourceRow.source || "modeled", ...metrics });
  });
  sosApplyScheduleRanks(rows);
  const filteredRows = options.ignoreView ? rows : rows.filter((row) => sosViewMatches(row));
  return filteredRows.sort((left, right) => {
    const direction = sosSort.direction === "desc" ? -1 : 1;
    if (sosSort.key === "player") return direction * left.player.localeCompare(right.player);
    if (sosSort.key === "position") return direction * left.position.localeCompare(right.position);
    if (sosSort.key === "team") return direction * left.team.localeCompare(right.team);
    if (sosSort.key === "overall") return direction * (left.avgDifficulty - right.avgDifficulty || left.rank - right.rank);
    if (sosSort.key === "tough") return direction * (left.tough - right.tough || left.avgDifficulty - right.avgDifficulty);
    if (sosSort.key === "easy") return direction * (left.easy - right.easy || right.avgDifficulty - left.avgDifficulty);
    return direction * (left.avgDifficulty - right.avgDifficulty || left.rank - right.rank);
  });
}

function sosHeatValues(rows) {
  return rows
    .flatMap((row) => row.scores.map((item) => item.score))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
}

function sosPercentileRank(value, values) {
  if (!Number.isFinite(value) || !values.length) return 0.5;
  if (values.length === 1) return 0.5;
  let below = 0;
  while (below < values.length && values[below] < value) below += 1;
  let equal = below;
  while (equal < values.length && values[equal] === value) equal += 1;
  return Math.max(0, Math.min(1, (below + (equal - below) / 2) / (values.length - 1)));
}

function sosInterpolateColor(left, right, amount) {
  return left.map((channel, index) => Math.round(channel + (right[index] - channel) * amount));
}

function sosHeatColor(percentile) {
  const stops = [
    [0, [47, 151, 83]],
    [0.28, [119, 191, 72]],
    [0.5, [226, 232, 52]],
    [0.72, [240, 143, 35]],
    [1, [216, 62, 61]],
  ];
  const pct = Math.max(0, Math.min(1, percentile));
  for (let index = 1; index < stops.length; index += 1) {
    const [stop, color] = stops[index];
    const [previousStop, previousColor] = stops[index - 1];
    if (pct <= stop) {
      const amount = (pct - previousStop) / (stop - previousStop || 1);
      return sosInterpolateColor(previousColor, color, amount).join(", ");
    }
  }
  return stops[stops.length - 1][1].join(", ");
}

function sosDifficultyPercent(item, heatValues = []) {
  if (item.apiTier === "bye") return "";
  const score = sosNumber(item.score);
  if (score === null) return 0.5;
  return clampNumber((score - 1) / 3, 0, 1);
}

function sosCellStyle(item, heatValues) {
  if (item.apiTier === "bye") return "";
  const percentile = sosDifficultyPercent(item, heatValues);
  const color = sosHeatColor(percentile);
  const glow = Math.round(10 + percentile * 28);
  const text = percentile > 0.18 && percentile < 0.78 ? "#181607" : "#fff8e8";
  return `--sos-heat-bg: rgb(${color}); --sos-heat-border: rgba(${color}, 0.72); --sos-heat-glow: rgba(${color}, ${percentile > 0.72 ? 0.46 : 0.2}); --sos-text: ${text}; --sos-glow-size: ${glow}px;`;
}

function sosSourceLabel(value = "") {
  const clean = String(value || "").replace(/[-_]/g, " ").trim();
  if (!clean) return "Fallback";
  return clean.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sosCellTooltip(row, item, percentile) {
  if (item.apiTier === "bye") return `${row.team} Week ${item.week}\nBye`;
  const lines = [
    `${row.player} (${row.team} ${row.position})`,
    `Week ${item.week} ${item.isAway ? "at" : "vs"} ${item.opponent}`,
    `Matchup difficulty: ${sosFormat(item.score, 2)} / 4`,
    `Difficulty percentile: ${Math.round(percentile * 100)}`,
    `Fantasy points allowed: ${sosFormat(item.fpa, 1)}`,
    `FPA difficulty score: ${sosFormat(item.fpaScore, 2)}`,
    `Implied team total: ${sosFormat(item.impliedTotal)}`,
    `Source: ${sosSourceLabel(item.oddsSource)}`,
  ];
  if (Number.isFinite(item.gameTotal)) lines.push(`Game total: ${sosFormat(item.gameTotal)}`);
  if (Number.isFinite(item.bookmakers)) lines.push(`Books: ${sosFormat(item.bookmakers, 0)}`);
  return lines.join("\n");
}

function sosWeekSummary(item) {
  if (!item) return "No matchup";
  if (item.apiTier === "bye" || item.opponent === "BYE") return `W${item.week} bye`;
  return `W${item.week} ${item.isAway ? "at" : "vs"} ${item.opponent}`;
}

function sosMarketCoverage(rows) {
  const cells = rows.flatMap((row) => row.scores).filter((item) => item.apiTier !== "bye");
  const marketCells = cells.filter(sosHasMarketSignal).length;
  return {
    total: cells.length,
    marketCells,
    percent: cells.length ? Math.round((marketCells / cells.length) * 100) : 0,
  };
}

function sosRelativeTime(value) {
  const timestamp = Date.parse(value || "");
  if (!Number.isFinite(timestamp)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 90) return "just updated";
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} days ago`;
}

function sosCacheLabel() {
  if (sosApiLoading) return "loading data";
  if (sosApiError) return sosApiError;
  if (!sosApiData) return "modeled fallback";
  const cache = sosApiData.cache || {};
  const updatedAt = sosApiData.updatedAt || sosApiData.generatedAt || cache.updatedAt || cache.createdAt || cache.storedAt;
  const relative = sosRelativeTime(updatedAt);
  const state = cache.hit ? "cache hit" : "fresh build";
  return relative ? `${state} / ${relative}` : state;
}

function sosMiniBars(row, heatValues) {
  const label = `${row.player} selected-window difficulty trend`;
  return `<div class="sos-mini-bars" aria-label="${htmlEscape(label)}">${row.scores.map((item) => {
    if (item.apiTier === "bye") {
      return `<span class="bye" title="${htmlEscape(sosWeekSummary(item))}"></span>`;
    }
    const percentile = sosDifficultyPercent(item, heatValues);
    const height = 12 + Math.round(percentile * 28);
    const color = sosHeatColor(percentile);
    return `<span style="--sos-bar-bg: rgb(${color}); --sos-bar-h: ${height}px;" title="${htmlEscape(sosWeekSummary(item))}"></span>`;
  }).join("")}</div>`;
}

function sosCallBadge(row) {
  const focusCell = row.callClass === "fade" ? row.worstCell : row.bestCell;
  const detail = row.callClass === "neutral"
    ? `Avg ${sosFormat(row.avgDifficulty, 2)}`
    : `${sosWeekSummary(focusCell)} / Avg ${sosFormat(row.avgDifficulty, 2)}`;
  return `<span class="sos-call sos-call-${htmlEscape(row.callClass)}">${htmlEscape(row.call)}</span><small>${htmlEscape(detail)}</small>`;
}

function sosInsightCard(kind, label, row, emptyText) {
  if (!row) {
    return `<article class="sos-insight-card sos-insight-${kind}">
      <span>${htmlEscape(label)}</span>
      <strong>${htmlEscape(emptyText)}</strong>
      <small>Try a wider week range or position filter.</small>
    </article>`;
  }
  const focusCell = kind === "fade" ? row.worstCell : row.bestCell;
  const metric = kind === "fade" ? `${row.tough} tough spots` : row.overallLabel;
  return `<article class="sos-insight-card sos-insight-${kind}">
    <span>${htmlEscape(label)}</span>
    <strong>${htmlEscape(row.player)}</strong>
    <small>${htmlEscape(`${row.team} ${row.position} / ${metric} / ${sosWeekSummary(focusCell)}`)}</small>
  </article>`;
}

function sosInsightCards(rows) {
  if (!rows.length) {
    return `<article class="sos-insight-card sos-insight-neutral">
      <span>No matches</span>
      <strong>Adjust filters</strong>
      <small>No heat map rows match the current player, position, or week window.</small>
    </article>`;
  }
  const byDifficulty = [...rows].sort((left, right) => left.avgDifficulty - right.avgDifficulty || left.rank - right.rank);
  const target = rows.filter((row) => row.isTarget).sort((left, right) => left.avgDifficulty - right.avgDifficulty || left.rank - right.rank)[0] || byDifficulty[0];
  const streamer = rows.filter((row) => row.isStreamer).sort((left, right) => left.avgDifficulty - right.avgDifficulty || left.rank - right.rank)[0] || null;
  const fade = rows.filter((row) => row.isFade).sort((left, right) => right.avgDifficulty - left.avgDifficulty || right.tough - left.tough)[0]
    || [...rows].sort((left, right) => right.avgDifficulty - left.avgDifficulty || right.tough - left.tough)[0];
  return [
    sosInsightCard("target", "Easiest schedule", target, "No easy edge"),
    sosInsightCard("stream", "Best streamer", streamer, "No streamer edge"),
    sosInsightCard("fade", "Toughest schedule", fade, "No tough run"),
  ].join("");
}

function sosOpponentLabel(item) {
  if (item.apiTier === "bye" || item.opponent === "BYE") return "BYE";
  return `${item.isAway ? "@" : ""}${item.opponent}`;
}

function sosWeekClass(week) {
  const number = Number(week);
  if (number < 15 || number > 17) return "";
  return [
    "sos-playoff-week",
    number === 15 ? "sos-playoff-start" : "",
    number === 17 ? "sos-playoff-end" : "",
  ].filter(Boolean).join(" ");
}

function loadSosHeatMap(force = false) {
  if (sosApiLoading || (!force && sosApiData)) return Promise.resolve(sosApiData);
  sosApiLoading = true;
  sosApiError = "";
  renderSosHeatMap();
  return fetch(apiUrl("/api/sos-heatmap", { season: appConfig.season || "2026", v: force ? Date.now() : "" }), {
    cache: "no-store",
    headers: apiHeaders(),
  })
    .then((response) => {
      if (!response.ok) throw new Error(`SoS API returned HTTP ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      if (!payload?.ok) throw new Error(payload?.error || "SoS API returned no data");
      sosApiData = payload;
      renderSosHeatMap();
      return payload;
    })
    .catch((error) => {
      sosApiError = error.message;
      renderSosHeatMap();
      return null;
    })
    .finally(() => {
      sosApiLoading = false;
      renderSosHeatMap();
    });
}

function renderSosHeatMap() {
  if (!sosTableHead || !sosTableBody) return;
  const weeks = sosWeeks();
  const allRows = sosRows({ ignoreView: true });
  const rows = sosRows();
  const heatValues = sosHeatValues(rows.length ? rows : allRows);
  const weekLabel = weeks.length === 1 ? `Week ${weeks[0]}` : `Weeks ${weeks[0]}-${weeks[weeks.length - 1]}`;
  const viewLabels = { all: "All schedules", easy: "Easiest", tough: "Toughest", targets: "Easiest", fades: "Toughest", streamers: "Streamers" };
  const viewLabel = viewLabels[sosView?.value || "all"] || "All schedules";
  if (sosSelectedSummary) {
    const sourceLabel = sosApiData
      ? "schedule difficulty model"
      : sosApiLoading
        ? "loading real data"
        : sosApiError
          ? "modeled fallback"
          : "modeled fallback";
    sosSelectedSummary.textContent = `${weekLabel} / ${sosPosition?.value === "ALL" ? "All positions" : sosPosition?.value} / ${viewLabel} / ${sourceLabel}`;
  }
  if (sosPlayoffEdge) {
    sosPlayoffEdge.textContent = (sosRange?.value || "") === "custom" ? weeks.join(", ") : "Weeks 15-17";
  }
  const best = [...allRows].sort((left, right) => left.avgDifficulty - right.avgDifficulty || left.rank - right.rank)[0];
  const brutal = [...allRows].sort((left, right) => right.avgDifficulty - left.avgDifficulty || right.tough - left.tough)[0];
  if (sosBestStretch) sosBestStretch.textContent = best ? `${best.player} (${best.overallLabel})` : "No match";
  if (sosBrutalStretch) sosBrutalStretch.textContent = brutal ? `${brutal.player} (${brutal.overallLabel})` : "No match";
  if (sosMarketStatus || sosMarketDetail) {
    const coverage = sosMarketCoverage(allRows);
    if (sosMarketStatus) {
      sosMarketStatus.textContent = sosApiLoading
        ? "Loading"
        : sosApiError
          ? "Fallback"
          : sosApiData
            ? "Schedule-first"
            : "Fallback";
    }
    if (sosMarketDetail) {
      sosMarketDetail.textContent = coverage.total
        ? `${coverage.marketCells}/${coverage.total} cells include market context / ${sosCacheLabel()}`
        : sosCacheLabel();
    }
  }
  if (sosInsights) {
    sosInsights.innerHTML = sosInsightCards(allRows);
  }
  const sortButton = (key, label) => `<button type="button" data-sos-sort="${key}">${htmlEscape(label)}${sosSort.key === key ? (sosSort.direction === "asc" ? " +" : " -") : ""}</button>`;
  sosTableHead.innerHTML = `<tr>
    <th>#</th>
    <th>${sortButton("player", "Player")}</th>
    <th>${sortButton("position", "Pos")}</th>
    <th>${sortButton("team", "Team")}</th>
    <th>${sortButton("overall", "Overall")}</th>
    ${weeks.map((week) => `<th class="${sosWeekClass(week)}">W${week}</th>`).join("")}
  </tr>`;
  sosTableBody.innerHTML = rows.slice(0, 192).map((row, index) => {
    return `<tr>
      <td class="sos-row-number">${index + 1}</td>
      <td><strong>${htmlEscape(row.player)}</strong><small>${htmlEscape(SOS_TEAM_NAMES[row.team] || row.team)}</small></td>
      <td>${htmlEscape(row.position)}</td>
      <td>${htmlEscape(row.team)}</td>
      <td><span class="sos-overall-badge sos-overall-${htmlEscape(row.overallClass || "neutral")}">${htmlEscape(row.overallLabel || "N/A")}</span><small>${sosFormat(row.avgDifficulty, 2)} avg</small></td>
      ${row.scores.map((item) => {
        const percentile = sosDifficultyPercent(item, heatValues);
        const tooltip = sosCellTooltip(row, item, percentile);
        const label = sosOpponentLabel(item);
        return `<td class="${sosWeekClass(item.week)}"><span class="sos-cell ${sosTier(item.score ?? 2.5, item.apiTier)}" style="${sosCellStyle(item, heatValues)}" data-tooltip="${htmlEscape(tooltip)}" title="${htmlEscape(tooltip)}">${htmlEscape(label)}</span></td>`;
      }).join("")}
    </tr>`;
  }).join("") || `<tr><td colspan="${weeks.length + 5}">No players match this filter.</td></tr>`;
}
