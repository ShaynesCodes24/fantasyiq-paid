(() => {
  const STORE_PREFIX = "fantasyiq:draftBridge:";
  const DASHBOARD_ORIGIN = "https://myfantasyiq.com";

  function sendStatus(detail = {}) {
    window.postMessage(
      {
        type: "FANTASYIQ_DRAFT_COMPANION_STATUS",
        installed: true,
        ...detail,
      },
      DASHBOARD_ORIGIN
    );
  }

  function storageKey(config) {
    return `${STORE_PREFIX}${config.leagueId || ""}:${config.season || "2026"}`;
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== DASHBOARD_ORIGIN) return;
    const message = event.data || {};
    if (message.type === "FANTASYIQ_DRAFT_COMPANION_PING") {
      sendStatus({ ok: true, reason: "installed" });
      return;
    }
    if (message.type !== "FANTASYIQ_DRAFT_BRIDGE_CONFIG") return;

    const config = message.config || {};
    if (!config.leagueId || !config.teamId || !config.bridgeKey || !config.endpoint) {
      sendStatus({ ok: false, reason: "missing-config" });
      return;
    }

    chrome.storage.local.set(
      {
        [storageKey(config)]: config,
        "fantasyiq:draftBridge:latest": config,
      },
      () => {
        sendStatus({
          ok: !chrome.runtime.lastError,
          reason: chrome.runtime.lastError?.message || "configured",
          leagueId: config.leagueId,
          season: config.season || "2026",
        });
      }
    );
  });

  sendStatus({ ok: true, reason: "installed" });
})();
