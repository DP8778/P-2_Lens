import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

const aapl = {
  id: "twelvedata:XNGS:AAPL",
  provider: "twelvedata",
  providerSymbol: "AAPL",
  symbol: "AAPL",
  name: "Apple Inc",
  type: "stock",
  exchange: "NASDAQ",
  micCode: "XNGS",
  currency: "USD",
  country: "United States",
};
const quote = {
  assetId: aapl.id,
  price: 234.56,
  currency: "USD",
  timestamp: "2026-09-15T13:30:00.000Z",
  marketState: "open",
  freshness: "fresh",
  source: "network",
};

async function createAddPage(
  browser: Browser,
  options: { viewport?: { width: number; height: number }; fxFailure?: boolean } = {},
) {
  const context = await browser.newContext({ viewport: options.viewport ?? { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    localStorage.setItem("lens-portfolio-mode-v1", "personal");
    localStorage.setItem("lens-personal-portfolio-v1", JSON.stringify({ version: 1, assets: [], transactions: [] }));
    localStorage.removeItem("lens-recent-market-assets-v1");
  });
  const page = await context.newPage();
  await page.route("**/api/portfolio/context", (route) => route.abort());
  await page.route("**/api/market/status", (route) =>
    route.fulfill({ json: { provider: "twelvedata", configured: true } }),
  );
  await page.route("**/api/market/search?*", (route) => route.fulfill({ json: { assets: [aapl] } }));
  await page.route("**/api/market/quotes", (route) => route.fulfill({ json: { quotes: [quote] } }));
  await page.route("**/api/market/fx?*", (route) => options.fxFailure
    ? route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE", message: "FX unavailable", retryable: true } } })
    : route.fulfill({ json: { base: "USD", quote: "CZK", rate: 24, timestamp: quote.timestamp, freshness: "fresh", source: "network" } }));
  await page.goto("/cs-CZ/dashboard");
  await page.getByRole("button", { name: "Přidat první investici" }).click();
  await expect(page.getByRole("heading", { name: "Přidat investici" })).toBeVisible();
  return { context, page };
}

async function searchWithPrice(page: Page) {
  await page.getByLabel("Hledat akcii nebo ETF").fill("AAPL");
  const option = page.getByRole("option", { name: /AAPL Apple Inc/ });
  await expect(option).toBeVisible();
  await expect(option.locator(".asset-search-price")).toContainText("234,56 USD");
  return option;
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `test-results/add-price/${name}.png`, fullPage: false });
}

async function close(context: BrowserContext) {
  await context.close();
}

test("captures reliable Add Investment price states", async ({ browser }) => {
  test.setTimeout(120_000);

  let view = await createAddPage(browser);
  await screenshot(view.page, "before-search");
  await close(view.context);

  view = await createAddPage(browser);
  const result = await searchWithPrice(view.page);
  await screenshot(view.page, "after-search-with-price");
  await result.click();
  await expect(view.page.locator(".instrument-quote strong")).toContainText("234,56 USD");
  await screenshot(view.page, "selected-stock");
  await close(view.context);

  view = await createAddPage(browser, { fxFailure: true });
  await (await searchWithPrice(view.page)).click();
  await expect(view.page.locator(".instrument-quote strong")).toContainText("234,56 USD");
  await expect(view.page.getByText("Přepočet do CZK není dostupný.")).toBeVisible();
  await screenshot(view.page, "fx-failure-quote-success");
  await close(view.context);

  view = await createAddPage(browser, { viewport: { width: 390, height: 844 } });
  await searchWithPrice(view.page);
  await screenshot(view.page, "mobile");
  await close(view.context);
});
