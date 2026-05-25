const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const BASE_URL = (process.env.VISUAL_SMOKE_BASE_URL || "https://myfantasyiq.com").replace(/\/$/, "");
const OUTPUT_DIR = process.env.VISUAL_SMOKE_OUTPUT_DIR || path.join("artifacts", "visual-smoke");
const HEADLESS = process.env.VISUAL_SMOKE_HEADLESS !== "0";
const IGNORE_STATIC_API_404 = process.env.VISUAL_SMOKE_IGNORE_STATIC_API_404 === "1";
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1100 },
  { name: "mobile", width: 390, height: 844 },
];

const consoleIssues = [];
const responseIssues = [];
const pageErrors = [];
const results = [];

function urlFor(route) {
  return `${BASE_URL}${route}`;
}

function cleanName(value) {
  return value.replace(/[^a-z0-9-]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}

async function ensureDir() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

async function screenshot(page, name) {
  const file = path.join(OUTPUT_DIR, `${cleanName(name)}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function waitForQuietPage(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 45000 });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
}

function record(name, details) {
  results.push({ name, ...details });
  console.log(`PASS ${name}: ${details.detail}`);
}

async function expectBodyText(page, text, label) {
  const body = await page.locator("body").innerText({ timeout: 15000 });
  if (!body.includes(text)) {
    throw new Error(`${label} missing expected text: ${text}`);
  }
  return body;
}

async function newPage(browser, viewport) {
  const page = await browser.newPage({
    viewport: { width: viewport.width, height: viewport.height },
  });
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleIssues.push(`${viewport.name} ${message.type()}: ${message.text()}`);
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      responseIssues.push(`${viewport.name} HTTP ${response.status()}: ${response.url()}`);
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(`${viewport.name}: ${error.message}`);
  });
  return page;
}

async function checkPublicPages(browser, viewport) {
  const pages = [
    { route: "/", name: "home", text: "FantasyIQ" },
    { route: "/setup.html", name: "setup", text: "Set up FantasyIQ in two minutes" },
    { route: "/success.html", name: "success", text: "Welcome to FantasyIQ" },
    { route: "/admin-login.html", name: "admin-gate", text: "Admin sign in" },
    { route: "/help.html", name: "help", text: "FantasyIQ Q&A" },
    { route: "/feedback.html", name: "feedback", text: "Help improve MyFantasyIQ" },
  ];

  for (const item of pages) {
    const page = await newPage(browser, viewport);
    const response = await page.goto(urlFor(item.route), { waitUntil: "domcontentloaded", timeout: 45000 });
    await waitForQuietPage(page);
    await expectBodyText(page, item.text, `${viewport.name} ${item.name}`);
    if (item.name === "success") {
      const href = await page.locator("#success-dashboard-link").getAttribute("href");
      if (!href || !href.includes("login=1")) {
        throw new Error(`${viewport.name} success customer login link must preserve login=1, found ${href || "missing"}`);
      }
    }
    if (item.name === "setup") {
      const href = await page.locator("#setup-open-dashboard-link").getAttribute("href");
      if (!href || !href.includes("login=1")) {
        throw new Error(`${viewport.name} setup dashboard link must preserve login=1, found ${href || "missing"}`);
      }
    }
    const file = await screenshot(page, `${viewport.name}-${item.name}`);
    record(`${viewport.name} ${item.name}`, {
      detail: `HTTP ${response?.status() || "unknown"}, screenshot ${file}`,
    });
    await page.close();
  }
}

async function checkLoginRoute(browser, viewport) {
  const page = await newPage(browser, viewport);
  let response = await page.goto(urlFor("/login"), { waitUntil: "domcontentloaded", timeout: 45000 });
  await waitForQuietPage(page);
  const gate = page.locator("#customer-access-gate");
  if ((await gate.count()) === 0) {
    response = await page.goto(urlFor("/?login=1"), { waitUntil: "domcontentloaded", timeout: 45000 });
    await waitForQuietPage(page);
  }
  await gate.waitFor({ state: "visible", timeout: 15000 });
  await page.locator("#customer-login-identity").waitFor({ state: "visible", timeout: 15000 });
  await page.locator("#customer-login-password").waitFor({ state: "visible", timeout: 15000 });

  const heading = await page.locator(".access-card h2").innerText({ timeout: 10000 });
  if (!heading.includes("Log in to your dashboard")) {
    throw new Error(`${viewport.name} login route rendered unexpected heading: ${heading}`);
  }
  const forgot = page.locator("#customer-forgot-password");
  if ((await forgot.count()) !== 1) throw new Error(`${viewport.name} login forgot-password action is missing`);

  const recovery = page.locator(".access-recovery");
  const recoveryOpen = await recovery.evaluate((node) => node.open);
  if (recoveryOpen) throw new Error(`${viewport.name} login recovery panel should start collapsed`);
  await recovery.locator("summary").click();
  await page.locator("#customer-access-code").waitFor({ state: "visible", timeout: 15000 });
  await page.locator("#customer-email-reset").waitFor({ state: "visible", timeout: 15000 });
  const file = await screenshot(page, `${viewport.name}-login-route`);
  record(`${viewport.name} login route`, {
    detail: `HTTP ${response?.status() || "unknown"}, redirected to ${page.url()}, screenshot ${file}`,
  });
  await page.close();
}

async function activateDashboardSection(page, section) {
  const nav = page.locator(`.nav-item[data-section="${section}"]`);
  if ((await nav.count()) !== 1) {
    throw new Error(`Could not find dashboard nav section ${section}`);
  }
  await nav.click();
  await page.locator(`.panel#${section}.active`).waitFor({ state: "visible", timeout: 15000 });
}

async function checkScheduleIqState(page, viewport) {
  await page.locator("#sos-position").waitFor({ state: "visible", timeout: 15000 });
  await page.locator("#sos-range").waitFor({ state: "visible", timeout: 15000 });
  await page.locator("#sos-table-body tr").first().waitFor({ state: "visible", timeout: 15000 });
  const summary = await page.locator("#sos-selected-summary").innerText({ timeout: 10000 });
  if (!summary.toLowerCase().includes("weeks")) {
    throw new Error(`${viewport.name} Schedule IQ summary did not render week context`);
  }
}

async function checkOptionalUdkView(page, viewport) {
  const udkTab = page.locator('.workbook-tabs .tab[data-board="udk"]');
  if ((await udkTab.count()) !== 1) {
    throw new Error(`${viewport.name} UDK tab control is missing`);
  }
  if (!(await udkTab.isVisible())) return;
  await udkTab.click();
  await page.locator(".panel#workbooks.active").waitFor({ state: "visible", timeout: 15000 });
  const statusText = await page.locator("#board-status").innerText({ timeout: 10000 });
  if (!statusText.includes("UDK Alignment")) {
    throw new Error(`${viewport.name} UDK View did not activate correctly`);
  }
}

async function checkDashboard(browser, viewport) {
  const page = await newPage(browser, viewport);
  const response = await page.goto(urlFor("/FantasyIQ/"), { waitUntil: "domcontentloaded", timeout: 45000 });
  await waitForQuietPage(page);
  await page.locator("#live-status").waitFor({ state: "attached", timeout: 30000 });
  await expectBodyText(page, "FantasyIQ", `${viewport.name} dashboard`);

  const navItems = await page.locator(".nav-item").count();
  if (navItems < 7) throw new Error(`${viewport.name} dashboard expected at least 7 nav items, found ${navItems}`);

  const boardRows = await page.locator("#board-table tbody tr").count();
  if (boardRows < 50) throw new Error(`${viewport.name} dashboard expected board rows, found ${boardRows}`);

  await screenshot(page, `${viewport.name}-dashboard-command`);
  await page.locator("#manual-sync").waitFor({ state: "visible", timeout: 15000 });
  await page.locator("#live-sync-toggle").waitFor({ state: "visible", timeout: 15000 });

  for (const section of ["draft", "live", "simulator", "trade", "workbooks", "account"]) {
    await activateDashboardSection(page, section);
    if (section === "live") await checkScheduleIqState(page, viewport);
    if (section === "workbooks") await checkOptionalUdkView(page, viewport);
    await screenshot(page, `${viewport.name}-dashboard-${section}`);
  }

  const tradeText = await page.locator("#trade-finder").innerText({ timeout: 10000 });
  const waiverText = await page.locator("#waiver-assistant").innerText({ timeout: 10000 });
  if (!tradeText || !waiverText) throw new Error(`${viewport.name} trade/waiver panels did not render text`);

  const accountAction = page.locator("#account-action");
  if ((await accountAction.count()) !== 1) throw new Error(`${viewport.name} account action is missing`);
  await accountAction.click();
  await page.locator("#customer-access-gate").waitFor({ state: "visible", timeout: 15000 });
  await page.locator("#customer-login-password").waitFor({ state: "visible", timeout: 15000 });
  await page.locator("#customer-forgot-password").waitFor({ state: "visible", timeout: 15000 });
  await page.locator(".access-recovery summary").click();
  await page.locator("#customer-access-code").waitFor({ state: "visible", timeout: 15000 });
  await screenshot(page, `${viewport.name}-dashboard-sign-in`);

  record(`${viewport.name} dashboard`, {
    detail: `HTTP ${response?.status() || "unknown"}, ${boardRows} board rows, ${navItems} nav items`,
  });
  await page.close();
}

async function main() {
  await ensureDir();
  const browser = await chromium.launch({ headless: HEADLESS });
  try {
    for (const viewport of VIEWPORTS) {
      await checkPublicPages(browser, viewport);
      await checkLoginRoute(browser, viewport);
      await checkDashboard(browser, viewport);
    }
  } finally {
    await browser.close();
  }

  const hardConsoleErrors = consoleIssues.filter((issue) => {
    if (!issue.includes(" error:")) return false;
    if (IGNORE_STATIC_API_404 && issue.includes("Failed to load resource: the server responded with a status of 404")) {
      return false;
    }
    return true;
  });
  const hardResponseErrors = responseIssues.filter((issue) => {
    if (IGNORE_STATIC_API_404 && /HTTP 404: .*\/api\//.test(issue)) return false;
    if (IGNORE_STATIC_API_404 && /HTTP 404: .*\/login$/.test(issue)) return false;
    return true;
  });
  if (pageErrors.length || hardConsoleErrors.length || hardResponseErrors.length) {
    console.error("Page errors:");
    pageErrors.forEach((error) => console.error(`- ${error}`));
    console.error("Response errors:");
    hardResponseErrors.forEach((error) => console.error(`- ${error}`));
    console.error("Console errors:");
    hardConsoleErrors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  await fs.writeFile(
    path.join(OUTPUT_DIR, "summary.json"),
    JSON.stringify({ baseUrl: BASE_URL, viewports: VIEWPORTS, results, responseIssues, consoleIssues, pageErrors }, null, 2),
  );
  console.log(`PASS visual smoke complete: ${results.length} checks, screenshots in ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(`FAIL visual smoke: ${error.message}`);
  process.exit(1);
});
