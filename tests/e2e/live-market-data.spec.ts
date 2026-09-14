import { test, expect } from "@playwright/test";

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
  timezone: "America/New_York",
};
const spy = { ...aapl, id: "twelvedata:ARCX:SPY", providerSymbol: "SPY", symbol: "SPY", name: "SPDR S&P 500 ETF Trust", type: "etf", exchange: "NYSE Arca", micCode: "ARCX" };
const vanguard = [
  { ...aapl, id: "twelvedata:XETR:VWCE", providerSymbol: "VWCE", symbol: "VWCE", name: "Vanguard FTSE All-World UCITS ETF", type: "etf", exchange: "Xetra", micCode: "XETR", currency: "EUR" },
  { ...aapl, id: "twelvedata:XLON:VUSA", providerSymbol: "VUSA", symbol: "VUSA", name: "Vanguard S&P 500 UCITS ETF", type: "etf", exchange: "London Stock Exchange", micCode: "XLON", currency: "GBP" },
  { ...aapl, id: "twelvedata:ARCX:VOO", providerSymbol: "VOO", symbol: "VOO", name: "Vanguard S&P 500 ETF", type: "etf", exchange: "NYSE Arca", micCode: "ARCX" },
];
const dates = ["2026-09-10", "2026-09-11", "2026-09-14"];

test("personal portfolio searches live universe, backfills history and updates all analytics", async ({ page }) => {
  page.on("pageerror", (error) => console.error("Browser page error:", error));
  let historyRequests = 0;
  await page.route("**/api/market/status", (route) => route.fulfill({ json: { provider: "twelvedata", configured: true } }));
  await page.route("**/api/market/search?*", async (route) => {
    const q = new URL(route.request().url()).searchParams.get("q")?.toUpperCase();
    await route.fulfill({ json: { assets: q === "SPY" ? [spy] : q === "VANGUARD" ? vanguard : [aapl] } });
  });
  await page.route("**/api/market/quotes", async (route) => {
    const body = route.request().postDataJSON() as { assets: typeof aapl[] };
    await route.fulfill({ json: { quotes: body.assets.map((asset) => ({ assetId: asset.id, price: asset.symbol === "AAPL" ? 210 : asset.symbol === "VWCE" ? 140 : 606, currency: asset.currency, timestamp: "2026-09-14T16:00:00.000Z", marketState: "closed", freshness: "lastClose", source: "network" })) } });
  });
  await page.route("**/api/market/history?*", async (route) => {
    historyRequests += 1;
    const asset = JSON.parse(new URL(route.request().url()).searchParams.get("asset")!) as typeof aapl;
    await route.fulfill({ json: { asset, range: { from: "2026-09-10", to: "2026-09-14", interval: "1day" }, points: dates.map((date, index) => ({ assetId: asset.id, date, close: (asset.symbol === "AAPL" ? 200 : 600) + index * 3, currency: "USD", adjustedForSplits: true })), source: "network" } });
  });
  await page.route("**/api/market/fx?*", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has("start"))
      await route.fulfill({ json: { base: "USD", quote: "CZK", range: { from: "2026-09-10", to: "2026-09-14", interval: "1day" }, points: dates.map((date, index) => ({ base: "USD", quote: "CZK", date, rate: 22 + index * 0.2 })), source: "network" } });
    else await route.fulfill({ json: { base: "USD", quote: "CZK", rate: 22.4, timestamp: "2026-09-14T16:00:00.000Z", freshness: "fresh", source: "network" } });
  });

  await page.goto("/cs-CZ/dashboard");
  await page.locator(".portfolio-picker > summary").click();
  await page.getByRole("button", { name: /Moje portfolio Vaše transakce/ }).click();
  await expect(page.getByRole("heading", { name: "Moje portfolio" })).toBeVisible();
  await page.getByRole("button", { name: "Přidat první aktivum" }).click();
  await page.getByLabel("Hledat akcii nebo ETF").fill("Apple");
  await expect(page.getByRole("button", { name: /AAPL Apple Inc/ })).toBeVisible();
  await page.getByRole("button", { name: /AAPL Apple Inc/ }).click();
  await expect(page.getByText("210 USD")).toBeVisible();
  await page.getByLabel("Množství", { exact: true }).fill("5");
  await page.getByLabel("Nákupní cena", { exact: true }).fill("200");
  await page.getByLabel("Datum pozice", { exact: true }).fill("2026-09-10");
  await page.getByRole("button", { name: "Zkontrolovat pozici" }).click();
  await page.getByRole("button", { name: "Přidat do portfolia" }).click();
  await expect(page.getByRole("heading", { name: "AAPL je v portfoliu" })).toBeVisible();
  await page.getByRole("button", { name: "Zpět do portfolia" }).click();
  await expect(page.getByTestId("portfolio-value")).toBeVisible();
  await expect(page.getByRole("button", { name: "Detail AAPL" })).toBeVisible();
  await expect(page.locator(".hero-chart")).toBeVisible();
  await expect(page.locator(".lens-insight")).toBeVisible();
  await expect(page.locator(".market-data-strip")).toContainText("Aktualizováno");

  await page.locator(".portfolio-heading").getByRole("button", { name: "Přidat aktivum" }).click();
  await page.getByLabel("Hledat akcii nebo ETF").fill("Vanguard");
  await expect(page.locator(".asset-search-result")).toHaveCount(3);
  await expect(page.getByRole("button", { name: /VWCE Vanguard FTSE All-World/ })).toContainText("Xetra · ETF · EUR");
  await expect(page.getByRole("button", { name: /VUSA Vanguard S&P 500/ })).toContainText("London Stock Exchange · ETF · GBP");
  await page.getByRole("button", { name: /VWCE Vanguard FTSE All-World/ }).click();
  await expect(page.getByText("140 EUR")).toBeVisible();
  await page.getByRole("button", { name: "Zavřít", exact: true }).click();

  await page.locator(".portfolio-heading").getByRole("button", { name: "Přidat aktivum" }).click();
  await page.getByLabel("Hledat akcii nebo ETF").fill("Apple");
  await page.getByRole("button", { name: /AAPL Apple Inc/ }).click();
  await expect(page.getByText("Aktivum již držíte.")).toBeVisible();
  await page.getByRole("button", { name: "Zavřít", exact: true }).click();
  const requestsBeforeReload = historyRequests;
  await page.reload();
  await expect(page.getByRole("button", { name: "Detail AAPL" })).toBeVisible();
  expect(historyRequests).toBe(requestsBeforeReload);
});
