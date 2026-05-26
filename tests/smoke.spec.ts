import { expect, test } from "@playwright/test";

const pages = [
  { route: "/", text: "FantasyIQ" },
  { route: "/setup.html", text: "Set up FantasyIQ in two minutes" },
  { route: "/help.html", text: "FantasyIQ Q&A" },
  { route: "/feedback.html", text: "Help improve MyFantasyIQ" },
  { route: "/FantasyIQ/", text: "FantasyIQ" },
];

test.beforeEach(async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ ok: false, message: "Static smoke test API stub." }),
      contentType: "application/json",
      status: 404,
    });
  });
});

for (const item of pages) {
  test(`renders ${item.route}`, async ({ page }) => {
    await page.goto(item.route);
    await expect(page.locator("body")).toContainText(item.text);
  });
}

test("keeps the public homepage lightweight", async ({ page }) => {
  const apiRequests: string[] = [];

  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/api/")) {
      apiRequests.push(path);
    }
  });

  await page.goto("/");
  await page.waitForLoadState("networkidle");

  await expect(page.locator("script[src]")).toHaveCount(0);
  expect(apiRequests).toEqual([]);
});

test("customer dashboard links target the app route", async ({ page }) => {
  await page.goto("/setup.html");
  await expect(page.locator("#setup-open-dashboard-link")).toHaveAttribute("href", /\/FantasyIQ\/\?login=1/);

  await page.goto("/success.html?customer=test-manager&league=home-league");
  await expect(page.locator("#success-dashboard-link")).toHaveAttribute(
    "href",
    /\/FantasyIQ\/\?customer=test-manager&league=home-league&login=1/,
  );
});
