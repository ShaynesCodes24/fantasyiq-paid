(() => {
  if (window.__fantasyIQDraftCompanionStarted) return;
  window.__fantasyIQDraftCompanionStarted = true;

  const STORE_PREFIX = "fantasyiq:draftBridge:";
  const DEFAULT_SEASON = "2026";
  const picks = [];
  let postTimer = null;
  let heartbeatTimer = null;
  let pingTimer = null;
  let fallbackStarted = false;

  function log(message) {
    console.log(`[MyFantasyIQ Draft Sync] ${message}`);
  }

  function param(name) {
    return new URL(window.location.href).searchParams.get(name) || "";
  }

  function storageKey(leagueId, season) {
    return `${STORE_PREFIX}${leagueId}:${season || DEFAULT_SEASON}`;
  }

  function getConfig() {
    const leagueId = param("leagueId");
    const season = param("seasonId") || param("season") || DEFAULT_SEASON;
    return new Promise((resolve) => {
      chrome.storage.local.get([storageKey(leagueId, season), "fantasyiq:draftBridge:latest"], (items) => {
        const exact = items[storageKey(leagueId, season)];
        const latest = items["fantasyiq:draftBridge:latest"];
        resolve(exact || (latest?.leagueId === leagueId ? latest : null));
      });
    });
  }

  async function decode(data) {
    if (typeof data === "string") return data;
    if (data instanceof ArrayBuffer) return new TextDecoder().decode(data).replace(/\0+$/g, "");
    if (data instanceof Blob) return (await data.text()).replace(/\0+$/g, "");
    return String(data || "");
  }

  function remember(config, event, teamId, playerId, slotId) {
    const normalizedTeamId = Number(teamId);
    const normalizedPlayerId = Number(playerId);
    const normalizedSlotId = Number(slotId);
    if (!normalizedTeamId || !normalizedPlayerId) return;
    if (picks.some((pick) => pick.teamId === normalizedTeamId && pick.playerId === normalizedPlayerId)) return;
    picks.push({
      event,
      teamId: normalizedTeamId,
      playerId: normalizedPlayerId,
      slotId: Number.isFinite(normalizedSlotId) ? normalizedSlotId : -1,
      pickNumber: picks.length + 1,
    });
    log(`${event} team ${normalizedTeamId} player ${normalizedPlayerId}`);
    post(config, "pick");
  }

  function post(config, reason = "heartbeat") {
    window.clearTimeout(postTimer);
    postTimer = window.setTimeout(() => {
      fetch(config.endpoint, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leagueId: config.leagueId,
          season: config.season || DEFAULT_SEASON,
          bridgeKey: config.bridgeKey,
          source: "espnDraftRoomCompanion",
          reason,
          picks,
        }),
      })
        .then((response) => response.json())
        .then((payload) => {
          if (payload.ok) log(`posted ${payload.pickCount} pick event(s) to MyFantasyIQ`);
          else log(`post rejected: ${payload.error || "unknown error"}`);
        })
        .catch((error) => log(`post failed: ${error.message}`));
    }, 250);
  }

  function parseLine(config, line) {
    const parts = String(line || "").trim().split(/\s+/);
    if (!parts[0]) return;
    if (parts[0] === "SELECTED") remember(config, "SELECTED", parts[1], parts[2], parts[3]);
    if (parts[0] === "SOLD") remember(config, "SOLD", parts[1], parts[2], parts[3]);
    if (parts[0] === "UNDONE") {
      const keep = Math.max(0, Number(parts[1]) || 0);
      picks.splice(keep);
      post(config, "undo");
    }
    if (parts[0] === "INIT") log("received ESPN draft init state");
  }

  async function draftSecurityToken(config) {
    const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${encodeURIComponent(
      config.season || DEFAULT_SEASON
    )}/segments/0/leagues/${encodeURIComponent(config.leagueId)}/teams/${encodeURIComponent(config.teamId)}/draftSecurity`;
    const response = await fetch(url, {
      credentials: "include",
      headers: { Accept: "application/json", "X-Fantasy-Source": "kona" },
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`draftSecurity HTTP ${response.status} ${text.slice(0, 80)}`);
    try {
      const parsed = JSON.parse(text);
      return String(parsed.token || parsed.draftToken || parsed.securityToken || parsed).replace(/^"|"$/g, "");
    } catch (error) {
      return String(text).replace(/^"|"$/g, "");
    }
  }

  function draftToken(config, token) {
    return ["ffl", config.leagueId, config.teamId, config.memberId, token].join(":");
  }

  function joinUrl(config, base, token) {
    const params = new URLSearchParams({
      1: "ffl",
      2: config.leagueId,
      3: config.teamId,
      4: config.memberId,
      5: draftToken(config, token),
      6: "false",
      7: "false",
      8: "KONA",
      nocache: String(Math.floor(Math.random() * 1000000)),
    });
    return `${base}/JOIN?${params.toString()}`;
  }

  function startHeartbeat(config, transport) {
    window.clearInterval(heartbeatTimer);
    window.clearInterval(pingTimer);
    post(config, "heartbeat");
    heartbeatTimer = window.setInterval(() => post(config, "heartbeat"), 15000);
    pingTimer = window.setInterval(() => {
      try {
        if (transport?.readyState === WebSocket.OPEN) transport.send("PING\n");
      } catch (error) {
        log(`ping failed: ${error.message}`);
      }
    }, 12000);
  }

  function connectSse(config, token) {
    if (fallbackStarted) return;
    fallbackStarted = true;
    const source = new EventSource(
      joinUrl(config, `https://fantasydraft.espn.com/game-ffl/league-${encodeURIComponent(config.leagueId)}/sse`, token)
    );
    source.onopen = () => {
      log("connected through ESPN SSE fallback");
      startHeartbeat(config, null);
    };
    source.onerror = () => log("ESPN SSE connection issue; browser will retry when possible");
    source.onmessage = (event) => String(event.data || "").split(/\r?\n/).forEach((line) => parseLine(config, line));
  }

  function connectWebSocket(config, token) {
    const socket = new WebSocket(
      joinUrl(config, `wss://fantasydraft.espn.com/game-ffl/league-${encodeURIComponent(config.leagueId)}`, token)
    );
    socket.binaryType = "arraybuffer";
    socket.onopen = () => {
      log("connected through ESPN WebSocket");
      startHeartbeat(config, socket);
    };
    socket.onerror = () => log("ESPN WebSocket error");
    socket.onclose = () => {
      window.clearInterval(pingTimer);
      log("ESPN WebSocket closed; trying SSE fallback");
      connectSse(config, token);
    };
    socket.onmessage = async (event) => {
      const text = await decode(event.data);
      text.split(/\r?\n/).forEach((line) => parseLine(config, line));
    };
  }

  getConfig()
    .then(async (config) => {
      if (!config?.leagueId || !config.teamId || !config.memberId || !config.bridgeKey || !config.endpoint) {
        log("waiting for MyFantasyIQ dashboard to open this draft room");
        return;
      }
      log("config found; connecting to ESPN draft feed");
      const token = await draftSecurityToken(config);
      connectWebSocket(config, token);
    })
    .catch((error) => log(`could not start: ${error.message}`));
})();
