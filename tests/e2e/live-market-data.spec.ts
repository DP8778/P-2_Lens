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
  await page.setViewportSize({ width: 1440, height: 900 });
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
  await page.getByRole("button", { name: "Přidat první investici" }).click();
  const dialogWidth = await page.getByRole("dialog").evaluate((element) => Math.round(element.getBoundingClientRect().width));
  expect(dialogWidth).toBeGreaterThanOrEqual(680);
  expect(dialogWidth).toBeLessThanOrEqual(760);
  await page.getByLabel("Hledat akcii nebo ETF").fill("Apple");
  await expect(page.getByRole("option", { name: /AAPL Apple Inc/ })).toBeVisible();
  await page.getByRole("option", { name: /AAPL Apple Inc/ }).click();
  await expect(page.getByText("210 USD")).toBeVisible();
  await page.getByLabel("Množství", { exact: true }).fill("5");
  await page.getByLabel(/Nákupní cena/).fill("200");
  await page.getByLabel("Datum", { exact: true }).fill("2026-09-10");
  await expect(page.getByRole("button", { name: "Zkontrolovat investici" })).toHaveCount(0);
  await expect(page.getByLabel("Náhled investice")).toBeVisible();
  await page.getByRole("button", { name: "Přidat do portfolia" }).click();
  await expect(page.locator(".portfolio-toast")).toContainText("AAPL bylo přidáno do portfolia");
  await expect(page.getByTestId("portfolio-value")).toBeVisible();
  await expect(page.getByRole("button", { name: "Detail AAPL" })).toBeVisible();
  await expect(page.locator(".hero-chart")).toBeVisible();
  await expect(page.locator(".lens-insight")).toBeVisible();
  await expect(page.locator(".market-data-strip")).toContainText("Poslední ceny");

  await page.locator(".portfolio-heading").getByRole("button", { name: "Přidat investici" }).click();
  await page.getByLabel("Hledat akcii nebo ETF").fill("Vanguard");
  await expect(page.locator(".asset-search-result")).toHaveCount(3);
  await expect(page.getByRole("option", { name: /VWCE Vanguard FTSE All-World/ })).toContainText("Xetra · ETF · EUR");
  await expect(page.getByRole("option", { name: /VUSA Vanguard S&P 500/ })).toContainText("London Stock Exchange · ETF · GBP");
  await page.screenshot({ path: "test-results/lens-live-search.png", fullPage: false });
  await page.getByRole("option", { name: /VWCE Vanguard FTSE All-World/ }).click();
  await expect(page.getByText("140 EUR")).toBeVisible();
  await page.getByRole("button", { name: "Zavřít", exact: true }).click();

  await page.locator(".portfolio-heading").getByRole("button", { name: "Přidat investici" }).click();
  await page.getByLabel("Hledat akcii nebo ETF").fill("Apple");
  await page.getByRole("option", { name: /AAPL Apple Inc/ }).click();
  await expect(page.getByText(/AAPL už máte v portfoliu/)).toBeVisible();
  await page.getByLabel("Množství", { exact: true }).fill("1");
  await page.getByLabel(/Nákupní cena/).fill("205");
  await page.getByLabel("Datum", { exact: true }).fill("2026-09-11");
  await page.getByRole("button", { name: "Přidat další nákup" }).click();
  await page.getByRole("button", { name: "Detail AAPL" }).click();
  await expect(page.locator(".transaction-row")).toHaveCount(2);
  await page.getByRole("button", { name: "Přidat prodej" }).click();
  await page.getByLabel("Množství transakce").fill("100");
  await page.getByLabel("Prodejní cena").fill("210");
  await page.getByRole("button", { name: "Uložit transakci" }).click();
  await expect(page.locator(".trade-editor").getByRole("alert")).toContainText("Nelze prodat více");
  await page.getByLabel("Množství transakce").fill("1");
  await page.getByRole("button", { name: "Uložit transakci" }).click();
  await expect(page.locator(".transaction-row")).toHaveCount(3);
  await page.getByRole("button", { name: "Přidat nákup" }).click();
  await expect(page.getByText(/AAPL už máte v portfoliu/)).toBeVisible();
  await page.getByLabel("Množství", { exact: true }).fill("0.25");
  await page.getByLabel(/Nákupní cena/).fill("208");
  await page.getByLabel("Datum", { exact: true }).fill("2026-09-12");
  await page.getByRole("button", { name: "Přidat další nákup" }).click();
  const syntheticCash = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("lens-personal-portfolio-v1")!) as { transactions: Array<{ type: string; amount?: number; quantity?: number; unitPrice?: number; fee: number }> };
    return saved.transactions.reduce((cash, row) => row.type === "deposit" ? cash + row.amount! - row.fee : row.type === "withdrawal" ? cash - row.amount! - row.fee : row.type === "buy" ? cash - row.quantity! * row.unitPrice! - row.fee : cash + row.quantity! * row.unitPrice! - row.fee, 0);
  });
  expect(syntheticCash).toBeCloseTo(0);
  await expect(page.getByRole("button", { name: "Detail CZK" })).toHaveCount(0);
  await page.getByRole("button", { name: "Detail AAPL" }).click();
  await expect(page.locator(".transaction-row")).toHaveCount(4);
  const sale = page.locator(".transaction-row").filter({ hasText: "Prodej" });
  await sale.getByRole("button", { name: "Upravit" }).click();
  await page.getByLabel("Množství transakce").fill("0.5");
  await page.getByRole("button", { name: "Uložit transakci" }).click();
  await sale.getByRole("button", { name: "Odstranit" }).click();
  await expect(page.locator(".transaction-row")).toHaveCount(3);
  await page.getByRole("button", { name: "Zavřít", exact: true }).click();
  const requestsBeforeReload = historyRequests;
  await page.reload();
  await expect(page.getByRole("button", { name: "Detail AAPL" })).toBeVisible();
  expect(historyRequests).toBe(requestsBeforeReload);

  await page.locator(".compare-trigger").click();
  await expect(page.getByRole("button", { name: "Hledat na trhu" })).toHaveCount(0);
  await page.getByLabel("Hledat instrument pro porovnání").fill("Vanguard");
  await page.locator(".compare-results").getByRole("option", { name: /VWCE Vanguard FTSE All-World/ }).click();
  await expect(page.locator(".chart-legend")).toContainText("VWCE");
  await page.screenshot({ path: "test-results/lens-live-compare.png", fullPage: false });
  await expect(page.getByRole("button", { name: "Detail AAPL" })).toHaveCount(1);
});
