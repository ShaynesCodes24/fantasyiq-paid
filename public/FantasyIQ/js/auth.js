function showCustomerAccessGate(message = "") {
  if (customerAccessGate()) return;
  document.body.classList.add("access-locked");
  const customerLabel = appConfig.customerName || appConfig.customerTeamName || "your dashboard";
  const needsIdentity = true;
  const gate = document.createElement("section");
  gate.id = "customer-access-gate";
  gate.className = "access-gate";
  gate.innerHTML = `
    <form class="access-card">
      <button type="button" class="access-close" id="customer-access-close" aria-label="Close sign in and view public demo" title="View public demo">×</button>
      <p class="eyebrow">Customer Login</p>
      <h2>${needsIdentity ? "Log in to your dashboard" : `Open ${htmlEscape(customerLabel)}`}</h2>
      <p>${needsIdentity ? "Use the email from checkout and your FantasyIQ password." : "Use your FantasyIQ password to open your saved leagues."}</p>
      <label ${needsIdentity ? "" : "hidden"}>
        Email
        <input id="customer-login-identity" type="email" autocomplete="username" inputmode="email" ${needsIdentity ? "required" : ""} />
      </label>
      <label>
        Password
        <input id="customer-login-password" type="password" autocomplete="current-password" />
      </label>
      <button type="button" class="access-forgot" id="customer-forgot-password">Forgot password?</button>
      <button type="submit" class="primary-action" id="customer-password-signin">Log in</button>
      <details class="access-recovery" ${message ? "open" : ""}>
        <summary>Setup code or password reset</summary>
        <label>
          Access code
          <input id="customer-access-code" type="password" autocomplete="off" />
        </label>
        <div class="access-grid">
          <label>
            New password
            <input id="customer-new-password" type="password" autocomplete="new-password" />
          </label>
          <label>
            Confirm
            <input id="customer-confirm-password" type="password" autocomplete="new-password" />
          </label>
        </div>
        <div class="access-actions">
          <button type="button" id="customer-code-unlock">Unlock With Code</button>
          <button type="button" id="customer-create-password">Create / Reset Password</button>
          <button type="button" id="customer-email-reset">Send Reset Email</button>
        </div>
      </details>
      <div class="access-message" role="status" aria-live="polite" data-state="${message ? "info" : "idle"}">${message ? htmlEscape(message) : ""}</div>
      <small>Need help? Email ${htmlEscape(appConfig.supportEmail || "support")}.</small>
    </form>
  `;
  document.body.appendChild(gate);
  const identityInput = gate.querySelector("#customer-login-identity");
  const passwordInput = gate.querySelector("#customer-login-password");
  const codeInput = gate.querySelector("#customer-access-code");
  const newPasswordInput = gate.querySelector("#customer-new-password");
  const confirmPasswordInput = gate.querySelector("#customer-confirm-password");
  const recoveryPanel = gate.querySelector(".access-recovery");
  const output = gate.querySelector(".access-message");
  const authButtons = Array.from(gate.querySelectorAll("button"));
  const identityValue = () =>
    needsIdentity ? identityInput.value.trim() : appConfig.customerEmail || appConfig.email || "";
  const identityIsEmail = () => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(identityValue());
  const passwordSetupMessage =
    "This account does not have a saved password yet. Use the access code from the setup email below, enter the password twice, then click Create / Reset Password. You can also click Unlock With Code for one-time access.";
  const friendlyAuthMessage = (message = "") => {
    if (/failed to fetch|networkerror|load failed|abort/i.test(message)) {
      return "Could not reach the FantasyIQ login service. Check your connection and try again.";
    }
    if (/create a password/i.test(message)) return passwordSetupMessage;
    if (
      /valid email|customer account was not found|could not find that checkout email|could not find that customer dashboard/i.test(
        message,
      )
    ) {
      return "Use the exact email from checkout.";
    }
    if (/access code does not match/i.test(message)) {
      return "That access code does not match this checkout email. Check your setup email or contact support.";
    }
    if (/email or password/i.test(message))
      return "That email and password did not match. Try again, or use your setup access code below to reset/create the password.";
    return message || "Could not sign in. Refresh and try again.";
  };
  const fetchJsonWithRetry = async (path, body, fallbackMessage, attempts = 2) => {
    let lastError = null;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(path, {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok || payload.authenticated === false) {
          throw new Error(payload.message || fallbackMessage);
        }
        return payload;
      } catch (error) {
        lastError = error;
        const message = String(error?.message || "");
        if (attempt >= attempts || !/failed to fetch|networkerror|load failed|abort/i.test(message)) {
          throw error;
        }
        showAuthMessage("Retrying the login service...", "info");
        await new Promise((resolve) => window.setTimeout(resolve, 900));
      } finally {
        window.clearTimeout(timeout);
      }
    }
    throw lastError || new Error(fallbackMessage);
  };
  const setAuthBusy = (busy) => {
    authButtons.forEach((button) => {
      button.disabled = busy;
      button.setAttribute("aria-busy", busy ? "true" : "false");
    });
  };
  const showAuthMessage = (text, state = "info") => {
    output.textContent = text;
    output.dataset.state = state;
    if (text) output.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  const customerBody = (extra = {}) => ({
    email: identityValue(),
    league: appConfig.leagueKey || "",
    ...extra,
  });
  const requireIdentity = () => {
    if (!needsIdentity || identityIsEmail()) return true;
    showAuthMessage("Enter the email from checkout.", "error");
    return false;
  };
  const postAuth = async (path, body) => {
    return fetchJsonWithRetry(path, body, "That sign in did not work.");
  };
  const sendPasswordReset = async () => {
    if (!requireIdentity()) return;
    showAuthMessage("Sending reset email...", "info");
    setAuthBusy(true);
    const progressTimer = window.setTimeout(() => {
      showAuthMessage("Still checking that account. Keep this window open for a moment.", "info");
    }, 8000);
    try {
      const payload = await fetchJsonWithRetry(
        "/api/customer-password-reset",
        customerBody(),
        "Could not send reset email.",
      );
      showAuthMessage(payload.message || "If that account exists, a password reset email is on the way.", "info");
    } catch (error) {
      showAuthMessage(friendlyAuthMessage(error.message || "Could not send reset email right now."), "error");
    } finally {
      window.clearTimeout(progressTimer);
      setAuthBusy(false);
    }
  };
  (needsIdentity ? identityInput : passwordInput)?.focus();
  gate.querySelector("#customer-access-close")?.addEventListener("click", () => {
    if (requiresCustomerAccess() || loginRequested()) {
      window.location.href = "/";
      return;
    }
    removeCustomerAccessGate();
  });
  gate.querySelector("form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = passwordInput.value.trim();
    if (!password) {
      showAuthMessage("Enter your password, or use the setup access code below to create one.", "error");
      return;
    }
    if (!requireIdentity()) return;
    showAuthMessage("Signing in...", "info");
    setAuthBusy(true);
    try {
      finishCustomerSignIn(await postAuth("/api/customer-login", customerBody({ password })));
    } catch (error) {
      const messageText = friendlyAuthMessage(error.message);
      showAuthMessage(messageText, "error");
      if (messageText === passwordSetupMessage) {
        recoveryPanel.open = true;
        codeInput.focus();
      }
    } finally {
      setAuthBusy(false);
    }
  });
  gate.querySelector("#customer-code-unlock")?.addEventListener("click", async () => {
    const code = codeInput.value.trim();
    if (!code) {
      showAuthMessage("Enter your FantasyIQ access code.", "error");
      return;
    }
    if (!requireIdentity()) return;
    showAuthMessage("Checking access...", "info");
    setAuthBusy(true);
    try {
      finishCustomerSignIn(await postAuth("/api/customer-login", customerBody({ accessCode: code })), code);
    } catch (error) {
      showAuthMessage(
        friendlyAuthMessage(error.message || "Could not verify the code. Refresh and try again."),
        "error",
      );
    } finally {
      setAuthBusy(false);
    }
  });
  gate.querySelector("#customer-create-password")?.addEventListener("click", async () => {
    const code = codeInput.value.trim();
    const password = newPasswordInput.value.trim();
    const confirm = confirmPasswordInput.value.trim();
    if (!code) {
      showAuthMessage("Enter your setup access code first.", "error");
      return;
    }
    if (password !== confirm) {
      showAuthMessage("Those passwords do not match.", "error");
      return;
    }
    if (!requireIdentity()) return;
    showAuthMessage("Creating password...", "info");
    setAuthBusy(true);
    try {
      finishCustomerSignIn(await postAuth("/api/customer-password", customerBody({ accessCode: code, password })));
    } catch (error) {
      showAuthMessage(friendlyAuthMessage(error.message || "Could not create that password right now."), "error");
    } finally {
      setAuthBusy(false);
    }
  });
  gate.querySelector("#customer-forgot-password")?.addEventListener("click", sendPasswordReset);
  gate.querySelector("#customer-email-reset")?.addEventListener("click", sendPasswordReset);
}

function ensureCustomerAccess() {
  if (!requiresCustomerAccess()) return true;
  if (hasCustomerAccess()) return true;
  showCustomerAccessGate();
  return false;
}

function handleCustomerAccessFailure(message = "Enter the current customer access code.") {
  if (!requiresCustomerAccess()) return false;
  clearCustomerAccessCode();
  clearRememberedPasswordSession();
  customerPasswordSession = false;
  stopLiveSyncTimer();
  updateAccountControl();
  showCustomerAccessGate(message);
  if (liveStatus) liveStatus.innerHTML = "<strong>Customer login required.</strong>";
  return true;
}

async function restoreCustomerSession() {
  if (hasCustomerAccess()) return false;
  if (!(requiresCustomerAccess() || loginRequested() || rememberedPasswordSession())) return false;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(apiUrl("/api/customer-session", { v: Date.now() }), {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok || payload.authenticated === false || !payload.customer) {
      return false;
    }
    customerPasswordSession = true;
    applyServerCustomerContext(payload.customer);
    rememberCustomerDashboard(payload.customer);
    removeCustomerAccessGate();
    ensureCustomerUrlContext();
    applyAppConfig();
    updateAccountControl();
    return true;
  } catch (error) {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function bootCustomerDashboard() {
  if (customerBootStarted) return;
  customerBootStarted = true;
  if (loginRequested() && !hasCustomerAccess()) {
    showCustomerAccessGate();
  }
  await restoreCustomerSession();
  if (loginRequested() && !hasCustomerAccess()) {
    showCustomerAccessGate();
  }
  if (!dashboardOpenTracked) {
    const params = new URLSearchParams(window.location.search);
    dashboardOpenTracked = true;
    trackDashboardEvent("dashboard.opened", {
      openedFrom: params.get("source") || params.get("from") || "",
      loginRequested: loginRequested() ? "1" : "0",
    });
  }
  if (typeof renderCommandDecision === "function") {
    renderCommandDecision();
  }
  loadBoards();
  startLiveSync();
}

function updateAccountControl() {
  if (!accountCard) return;
  const customerLabel = appConfig.customerName || appConfig.customerTeamName || appConfig.loadoutKey || "Dashboard";
  if (accountLabel) accountLabel.textContent = requiresCustomerAccess() ? customerLabel : "Public Demo";
  if (accountState)
    accountState.textContent = requiresCustomerAccess()
      ? hasCustomerAccess()
        ? "Signed In"
        : "Signed Out"
      : "Preview";
  if (accountAction) {
    accountAction.textContent = requiresCustomerAccess() ? (hasCustomerAccess() ? "Sign Out" : "Sign In") : "Sign In";
    accountAction.disabled = false;
  }
  accountCard.classList.toggle("signed-in", requiresCustomerAccess() && hasCustomerAccess());
  accountCard.classList.toggle("signed-out", requiresCustomerAccess() && !hasCustomerAccess());
  updateBrandHomeLink();
  renderAccountPanel();
}

async function signOutCustomer() {
  clearCustomerAccessCode();
  clearRememberedPasswordSession();
  customerPasswordSession = false;
  fetch("/api/customer-session", { method: "DELETE", cache: "no-store", credentials: "same-origin" }).catch(() => {});
  stopLiveSyncTimer();
  updateAccountControl();
  if (requiresCustomerAccess()) {
    if (liveStatus) liveStatus.innerHTML = "<strong>Signed out.</strong> Sign in to reconnect matchup intelligence.";
    showCustomerAccessGate("Signed out. Use your password or setup access code to unlock the dashboard.");
  }
}

async function jsonOrAccessError(response, fallbackMessage) {
  const data = await response.json().catch(() => null);
  if (response.status === 401) {
    handleCustomerAccessFailure(data?.error || data?.message || "Enter the current customer access code.");
    throw new Error("Customer login required.");
  }
  if (!response.ok) throw new Error(data?.error || data?.message || fallbackMessage || `HTTP ${response.status}`);
  return data;
}

function customerBrandSubtitle(fallbackLeagueName) {
  if (appConfig.customerName && appConfig.customerTeamName) {
    return `${appConfig.customerName} / ${appConfig.customerTeamName}`;
  }
  if (appConfig.customerName && fallbackLeagueName) {
    return `${appConfig.customerName} / ${fallbackLeagueName}`;
  }
  return appConfig.leagueSubtitle || "ESPN fantasy football decision engine";
}

function applyAppConfig() {
  const siteName = appConfig.siteName || "MyFantasyIQ";
  document.title = siteName;

  const brandTitle = document.querySelector(".brand-lockup h1");
  const brandEyebrow = document.querySelector(".brand-lockup .eyebrow");
  const brandSubtitle = document.querySelector(".brand-lockup small");
  const logo = document.querySelector(".brand-lockup img");
  const draftCardLabel = document.querySelector(".draft-card span");
  const draftCardValue = document.querySelector(".draft-card strong");
  const draftCardNote = document.querySelector(".draft-card small");
  const subscribeButton = document.querySelector(".draft-card .subscribe-button");
  const heroTitle = document.querySelector(".command-hero h2");
  const heroSubtitle = document.querySelector(".command-hero p:not(.eyebrow)");
  const leftEndzone = document.querySelector(".field-endzone-left");
  const rightEndzone = document.querySelector(".field-endzone-right");
  const demoBanner = document.querySelector("[data-demo-banner]");

  if (brandTitle) brandTitle.textContent = siteName;
  if (brandEyebrow) brandEyebrow.textContent = appConfig.customerTeamName || appConfig.leagueName || "Command Center";
  if (brandSubtitle) {
    brandSubtitle.textContent = customerBrandSubtitle(appConfig.leagueName);
  }
  if (logo && appConfig.logoUrl) logo.src = appConfig.logoUrl;
  if (logo) logo.alt = appConfig.logoAlt || `${siteName} league logo`;
  if (draftCardLabel) draftCardLabel.textContent = appConfig.draftCardLabel || "Subscription";
  if (draftCardValue) draftCardValue.textContent = appConfig.draftCardValue || "$30/year";
  if (draftCardNote) draftCardNote.textContent = appConfig.draftCardNote || "Configured for your ESPN league";
  if (subscribeButton && appConfig.showSubscribeButton === false) {
    subscribeButton.remove();
  }
  if (heroTitle) heroTitle.textContent = appConfig.heroTitle || "Your smartest next move, explained.";
  if (heroSubtitle) {
    heroSubtitle.textContent =
      appConfig.heroSubtitle ||
      "MyFantasyIQ reads league context, roster shape, player values, schedule leverage, trade lanes, and waiver opportunities before returning a Main Move Brief.";
  }
  if (leftEndzone) leftEndzone.textContent = appConfig.fieldLeftLabel || "Fantasy";
  if (rightEndzone) rightEndzone.textContent = appConfig.fieldRightLabel || "IQ";
  if (demoBanner && appConfig.isDemoPreview === false) {
    demoBanner.remove();
  } else if (demoBanner) {
    const label = demoBanner.querySelector("strong");
    const message = demoBanner.querySelector("span");
    if (label) label.textContent = appConfig.demoLabel || "Demo Mode";
    if (message) {
      message.textContent = appConfig.demoMessage || "Sample league only. No customer account is loaded.";
    }
  }
  renderLeagueProfile();
  updateBrandHomeLink();
}

function applyEspnLeagueBranding() {
  if (!appConfig.useEspnLeagueBranding || !liveDraft || liveDraft.demoMode) return;
  const brandEyebrow = document.querySelector(".brand-lockup .eyebrow");
  const brandSubtitle = document.querySelector(".brand-lockup small");
  const logo = document.querySelector(".brand-lockup img");

  if (brandEyebrow) brandEyebrow.textContent = appConfig.customerTeamName || liveDraft.leagueName || "Command Center";
  if (brandSubtitle && liveDraft.leagueId) {
    brandSubtitle.textContent = appConfig.customerName
      ? customerBrandSubtitle(liveDraft.leagueName || "ESPN league")
      : `ESPN league ${liveDraft.leagueId} / season ${liveDraft.season || ""}`.trim();
  }
  if (logo && liveDraft.leagueLogo) {
    logo.src = liveDraft.leagueLogo;
    logo.alt = `${liveDraft.leagueName || "ESPN"} league logo`;
  }
}

function mergeLeagueSettings(base, override = {}) {
  return normalizeLeagueSettings({
    ...(base || {}),
    ...(override || {}),
    lineupSlots: {
      ...((base || {}).lineupSlots || {}),
      ...((override || {}).lineupSlots || {}),
    },
  });
}
