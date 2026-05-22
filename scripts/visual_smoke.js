const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const BASE_URL = (process.env.VISUAL_SMOKE_BASE_URL || "https://myfantasyiq.com").replace(/\/$/, "");
const OUTPUT_DIR = process.env.VISUAL_SMOKE_OUTPUT_DIR || path.join("artifacts", "visual-smoke");
const HEADLESS = process.env.VISUAL_SMOKE_HEADLESS !== "0";
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1100 },
  { name: "mobile", width: 390, height: 844 },
];

const consoleIssues = [];
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
    { route: "/admin.html", name: "admin", text: "Customer operations" },
    { route: "/help.html", name: "help", text: "FantasyIQ Q&A" },
    { route: "/feedback.html", name: "feedback", text: "Help improve MyFantasyIQ" },
  ];

  for (const item of pages) {
    const page = await newPage(browser, viewport);
    const response = await page.goto(urlFor(item.route), { waitUntil: "domcontentloaded", timeout: 45000 });
    await waitForQuietPage(page);
    await expectBodyText(page, item.text, `${viewport.name} ${item.name}`);
    const file = await screenshot(page, `${viewport.name}-${item.name}`);
    record(`${viewport.name} ${item.name}`, {
      detail: `HTTP ${response?.status() || "unknown"}, screenshot ${file}`,
    });
    await page.close();
  }
}

async function checkLoginRoute(browser, viewport) {
  const page = await newPage(browser, viewport);
  const response = await page.goto(urlFor("/login"), { waitUntil: "domcontentloaded", timeout: 45000 });
  await waitForQuietPage(page);
  await page.locator("#customer-access-gate").waitFor({ state: "visible", timeout: 15000 });
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

async function checkPreDraftState(page, viewport) {
  const liveStatusText = await page.locator("#live-status").innerText({ timeout: 15000 });
  if (!liveStatusText.includes("Pre-draft board ready")) return;

  const preDraftPanel = page.locator("#pre-draft-panel");
  await preDraftPanel.waitFor({ state: "visible", timeout: 15000 });
  const preDraftText = await preDraftPanel.innerText({ timeout: 10000 });
  const normalizedPreDraftText = preDraftText.toLowerCase();
  for (const text of ["before the draft opens", "room is staged", "league", "order", "tier watch"]) {
    if (!normalizedPreDraftText.includes(text)) {
      throw new Error(`${viewport.name} pre-draft panel missing: ${text}`);
    }
  }

  const recommendationText = await page.locator("#live-recommendations").innerText({ timeout: 10000 });
  if (!recommendationText.toLowerCase().includes("pre-draft board value is ready")) {
    throw new Error(`${viewport.name} pre-draft recommendations did not render the readiness intro`);
  }

  const rosterText = await page.locator("#live-my-roster").innerText({ timeout: 10000 });
  const normalizedRosterText = rosterText.toLowerCase();
  if (!normalizedRosterText.includes("roster starts clean") && !normalizedRosterText.includes("pick your espn team")) {
    throw new Error(`${viewport.name} pre-draft roster empty state was not helpful`);
  }

  const postDraftText = await page.locator("#post-draft-plan").innerText({ timeout: 10000 });
  const normalizedPostDraftText = postDraftText.toLowerCase();
  if (!normalizedPostDraftText.includes("armed") || !normalizedPostDraftText.includes("after the draft")) {
    throw new Error(`${viewport.name} pre-draft post-draft plan was not armed`);
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

  for (const section of ["draft", "live", "simulator", "trade", "workbooks", "account"]) {
    await activateDashboardSection(page, section);
    if (section === "live") await checkPreDraftState(page, viewport);
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

  const hardConsoleErrors = consoleIssues.filter((issue) => issue.includes(" error:"));
  if (pageErrors.length || hardConsoleErrors.length) {
    console.error("Page errors:");
    pageErrors.forEach((error) => console.error(`- ${error}`));
    console.error("Console errors:");
    hardConsoleErrors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  await fs.writeFile(
    path.join(OUTPUT_DIR, "summary.json"),
    JSON.stringify({ baseUrl: BASE_URL, viewports: VIEWPORTS, results, consoleIssues, pageErrors }, null, 2),
  );
  console.log(`PASS visual smoke complete: ${results.length} checks, screenshots in ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(`FAIL visual smoke: ${error.message}`);
  process.exit(1);
});
