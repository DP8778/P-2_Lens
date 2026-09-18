import { expect, test, type Page } from "@playwright/test";

const phase = process.env.MARKET_VISUAL_PHASE;
test.skip(!phase, "Market search visual captures run only with MARKET_VISUAL_PHASE=before|after.");

const aapl = {
  id: "twelvedata:XNAS:AAPL",
  provider: "twelvedata",
  providerSymbol: "AAPL",
  symbol: "AAPL",
  name: "Apple Inc.",
  type: "stock",
  exchange: "NASDAQ",
  micCode: "XNAS",
  currency: "USD",
  country: "United States",
};

async function openAdd(page: Page, configured = true) {
  await page.addInitScript(() => {
    localStorage.setItem("lens-portfolio-mode-v1", "personal");
    localStorage.setItem(
      "lens-personal-portfolio-v1",
      JSON.stringify({ version: 1, assets: [], transactions: [] }),
    );
    localStorage.removeItem("lens-recent-market-assets-v1");
  });
  await page.route("**/api/portfolio/context", (route) => route.abort());
  await page.route("**/api/market/status", (route) =>
    route.fulfill({ json: { provider: "twelvedata", configured } }),
  );
  await page.goto("/cs-CZ/dashboard");
  await page.getByRole("button", { name: "Přidat první aktivum" }).click();
  await expect(page.getByRole("heading", { name: "Přidat aktivum" })).toBeVisible();
}

async function shot(page: Page, name: string) {
  await page.waitForTimeout(250);
  await page.screenshot({
    path: `test-results/market-search-recovery/${phase}/${name}`,
    fullPage: false,
  });
}

test("captures Add Investment market-search states", async ({ browser }) => {
  test.setTimeout(120_000);

  let context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  let page = await context.newPage();
  await openAdd(page);
  await shot(page, "01-add-idle.png");
  await context.close();

  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
  await page.route("**/api/market/search?*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    await route.fulfill({ json: { assets: [aapl] } });
  });
  await openAdd(page);
  await page.getByLabel("Hledat akcii nebo ETF").fill("AAPL");
  await expect(page.getByText("Hledám instrumenty…")).toBeVisible();
  await shot(page, "02-add-search-loading.png");
  await context.close();

  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
  await page.route("**/api/market/search?*", (route) =>
    route.fulfill({ json: { assets: [aapl] } }),
  );
  await openAdd(page);
  await page.getByLabel("Hledat akcii nebo ETF").fill("AAPL");
  await expect(page.getByRole("option", { name: /AAPL Apple Inc/ })).toBeVisible();
  await shot(page, "03-add-results.png");
  await context.close();

  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
  await page.route("**/api/market/search?*", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: {
          code: "AUTH",
          message: "Live market data nejsou nakonfigurována. Nastavte TWELVE_DATA_API_KEY.",
          retryable: false,
        },
      },
    }),
  );
  await openAdd(page, false);
  const search = page.getByLabel("Hledat akcii nebo ETF");
  if (await search.isEnabled()) await search.fill("PLTR");
  await expect(page.getByText(/Live market data nejsou nakonfigurována|Vyhledávání je momentálně nedostupné/)).toBeVisible();
  await shot(page, "04-add-not-configured.png");
  await context.close();

  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();
  await page.route("**/api/market/search?*", (route) =>
    route.fulfill({ json: { assets: [aapl] } }),
  );
  await page.route("**/api/market/quotes", (route) =>
    route.fulfill({
      json: {
        quotes: [{
          assetId: aapl.id,
          price: 230,
          currency: "USD",
          timestamp: "2026-09-15T08:00:00.000Z",
          marketState: "closed",
          freshness: "lastClose",
          source: "network",
        }],
      },
    }),
  );
  await openAdd(page);
  await page.getByLabel("Hledat akcii nebo ETF").fill("AAPL");
  await page.getByRole("option", { name: /AAPL Apple Inc/ }).click();
  await expect(page.getByLabel("Množství", { exact: true })).toBeVisible();
  await shot(page, "05-selected-transaction.png");
  await context.close();
});
