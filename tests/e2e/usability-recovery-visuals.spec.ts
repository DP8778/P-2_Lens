import { expect, test, type Browser, type Page } from "@playwright/test";

const phase = process.env.RECOVERY_PHASE;
test.skip(!phase, "Visual recovery captures run only with RECOVERY_PHASE=before|after.");

const assets = Array.from({ length: 30 }, (_, index) => ({
  id: `twelvedata:${index % 2 ? "XETR" : "XNAS"}:${index === 0 ? "AAPL" : `UX${index}`}`,
  provider: "twelvedata",
  providerSymbol: index === 0 ? "AAPL" : `UX${index}`,
  symbol: index === 0 ? "AAPL" : `UX${index}`,
  name: index === 0 ? "Apple Inc." : `Test instrument ${index}`,
  type: index % 3 ? "stock" : "etf",
  exchange: index % 2 ? "Xetra" : "NASDAQ",
  micCode: index % 2 ? "XETR" : "XNAS",
  currency: index % 2 ? "EUR" : "USD",
  country: index % 2 ? "Germany" : "United States",
}));

const transactions = assets.flatMap((asset, index) => [
  { id: `personal-funding-${asset.id}-${index}`, type: "deposit", occurredAt: "2026-09-10", amount: 100 + index, currency: asset.currency, fee: 0 },
  { id: `personal-buy-${asset.id}-${index}`, type: "buy", occurredAt: "2026-09-10", assetId: asset.id, quantity: 1, unitPrice: 100 + index, currency: asset.currency, fee: 0 },
]);

const aapl = assets[0];

async function mockMarket(page: Page) {
  await page.route("**/api/portfolio/context", (route) => route.abort());
  await page.route("**/api/market/status", (route) => route.fulfill({ json: { provider: "twelvedata", configured: true } }));
  await page.route("**/api/market/search?*", (route) => route.fulfill({ json: { assets: [aapl] } }));
  await page.route("**/api/market/quotes", async (route) => {
    const body = route.request().postDataJSON() as { assets: typeof assets };
    await route.fulfill({ json: { quotes: body.assets.map((asset, index) => ({ assetId: asset.id, price: 130 + index, currency: asset.currency, timestamp: "2026-09-14T16:00:00.000Z", marketState: "closed", freshness: "lastClose", source: "network" })) } });
  });
  await page.route("**/api/market/history?*", async (route) => {
    const asset = JSON.parse(new URL(route.request().url()).searchParams.get("asset")!) as typeof aapl;
    await route.fulfill({ json: { asset, range: { from: "2026-09-10", to: "2026-09-14", interval: "1day" }, points: ["2026-09-10", "2026-09-11", "2026-09-14"].map((date, index) => ({ assetId: asset.id, date, close: 100 + index * 8, currency: asset.currency, adjustedForSplits: true })), source: "network" } });
  });
  await page.route("**/api/market/fx?*", async (route) => {
    const url = new URL(route.request().url());
    const base = url.searchParams.get("from") ?? url.searchParams.get("base") ?? "USD";
    await route.fulfill({ json: { base, quote: "CZK", range: { from: "2026-09-10", to: "2026-09-14", interval: "1day" }, points: ["2026-09-10", "2026-09-11", "2026-09-14"].map((date) => ({ base, quote: "CZK", date, rate: base === "EUR" ? 25 : 22.5 })), rate: base === "EUR" ? 25 : 22.5, timestamp: "2026-09-14T16:00:00.000Z", freshness: "fresh", source: "network" } });
  });
}

async function openScenario(browser: Browser, viewport: { width: number; height: number }, mode: "demo" | "personal", count = 0) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(({ mode, assets, transactions, count }) => {
    localStorage.setItem("lens-portfolio-mode-v1", mode);
    localStorage.setItem("lens-personal-portfolio-v1", JSON.stringify({ version: 1, assets: assets.slice(0, count), transactions: transactions.slice(0, count * 2) }));
  }, { mode, assets, transactions, count });
  const page = await context.newPage();
  await mockMarket(page);
  await page.goto("/cs-CZ/dashboard");
  return { context, page };
}

async function shot(page: Page, name: string) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `test-results/usability-recovery/${phase}/${name}`, fullPage: false });
}

async function scrollToHoldings(page: Page) {
  const holdings = page.locator("#holdings");
  await expect(holdings).toBeVisible();
  await holdings.evaluate((element) => element.scrollIntoView({ block: "start" }));
  await page.waitForTimeout(100);
}

test("captures the usability recovery comparison set", async ({ browser }) => {
  test.setTimeout(180_000);
  let scenario = await openScenario(browser, { width: 1440, height: 900 }, "demo");
  let { context, page } = scenario;
  await expect(page.getByTestId("portfolio-value")).toBeVisible();
  await shot(page, "01-demo-dashboard-1440.png");
  await context.close();

  scenario = await openScenario(browser, { width: 1440, height: 900 }, "personal", 6);
  ({ context, page } = scenario);
  await expect(page.getByText("Moje portfolio", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: /Pozice/ })).toContainText("6");
  await shot(page, "02-personal-dashboard-1440.png");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await scrollToHoldings(page);
  await shot(page, "07-holdings-small.png");
  await context.close();

  scenario = await openScenario(browser, { width: 1366, height: 768 }, "personal");
  ({ context, page } = scenario);
  await expect(page.getByRole("heading", { name: "Moje portfolio" })).toBeVisible();
  await shot(page, "03-personal-empty.png");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Přidat první aktivum" }).click();
  await page.getByLabel("Hledat akcii nebo ETF").fill("Apple");
  await expect(page.getByRole("option", { name: /AAPL Apple Inc/ })).toBeVisible();
  await shot(page, "04-add-search.png");
  await page.getByRole("option", { name: /AAPL Apple Inc/ }).click();
  await expect(page.getByLabel("Množství", { exact: true })).toBeVisible();
  await shot(page, "05-add-transaction.png");
  await page.getByLabel("Množství", { exact: true }).fill("2");
  await shot(page, "06-add-review.png");
  await page.getByRole("button", { name: "Zavřít", exact: true }).click();
  await context.close();

  scenario = await openScenario(browser, { width: 1440, height: 900 }, "personal", 30);
  ({ context, page } = scenario);
  await expect(page.getByRole("heading", { name: /Pozice/ })).toContainText("30");
  await scrollToHoldings(page);
  await shot(page, "08-holdings-30.png");

  await page.locator(".hero-chart").scrollIntoViewIfNeeded();
  await page.locator(".compare-trigger").click();
  await shot(page, "09-compare.png");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Příspěvky", exact: true }).click();
  await shot(page, "10-contribution.png");
  await context.close();

  scenario = await openScenario(browser, { width: 390, height: 844 }, "demo");
  ({ context, page } = scenario);
  await shot(page, "11-mobile-dashboard.png");
  await scrollToHoldings(page);
  await shot(page, "12-mobile-holdings.png");
  await page.getByRole("button", { name: "Použít vlastní portfolio" }).click();
  await page.getByRole("button", { name: "Přidat první aktivum" }).click();
  await shot(page, "13-mobile-add.png");
  await context.close();
});
