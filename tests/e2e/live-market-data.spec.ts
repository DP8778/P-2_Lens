import { expect, test, type Page } from "@playwright/test";

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
const spcx = { ...aapl, id: "twelvedata:XNYS:SPCX", providerSymbol: "SPCX", symbol: "SPCX", name: "SPAC and New Issue ETF", type: "etf", exchange: "NYSE", micCode: "XNYS" };
const dates = ["2026-09-10", "2026-09-11", "2026-09-14", "2026-09-17"];

async function mockMarket(page: Page, historyUnavailable = false) {
  await page.route("**/api/market/status", (route) => route.fulfill({ json: { provider: "twelvedata", configured: true } }));
  await page.route("**/api/market/search?*", async (route) => {
    const query = new URL(route.request().url()).searchParams.get("q")?.toUpperCase();
    await route.fulfill({ json: { assets: query === "SPY" ? [spy] : query === "SPCX" ? [spcx] : [aapl] } });
  });
  await page.route("**/api/market/quotes", async (route) => {
    const body = route.request().postDataJSON() as { assets: typeof aapl[] };
    await route.fulfill({ json: { quotes: body.assets.map((asset) => ({
      assetId: asset.id,
      price: asset.symbol === "AAPL" ? 331.34 : asset.symbol === "SPCX" ? 24.62 : 606,
      change: asset.symbol === "AAPL" ? 2.41 : 1.2,
      changePercent: asset.symbol === "AAPL" ? 0.73 : 0.2,
      currency: asset.currency,
      timestamp: "2026-09-17T20:00:00.000Z",
      marketState: "closed",
      freshness: "lastClose",
      source: "network",
    })) } });
  });
  await page.route("**/api/market/history?*", async (route) => {
    if (historyUnavailable) {
      await route.fulfill({ status: 404, json: { error: { code: "NOT_FOUND", message: "No data is available on the specified dates.", retryable: false } } });
      return;
    }
    const asset = JSON.parse(new URL(route.request().url()).searchParams.get("asset")!) as typeof aapl;
    await route.fulfill({ json: { asset, range: { from: dates[0], to: dates.at(-1), interval: "1day" }, points: dates.map((date, index) => ({ assetId: asset.id, date, close: (asset.symbol === "AAPL" ? 320 : 600) + index * 3, currency: asset.currency, adjustedForSplits: true })), source: "network" } });
  });
  await page.route("**/api/market/fx?*", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has("start"))
      await route.fulfill({ json: { base: "USD", quote: "CZK", range: { from: dates[0], to: dates.at(-1), interval: "1day" }, points: dates.map((date) => ({ base: "USD", quote: "CZK", date, rate: 22.4 })), source: "network" } });
    else await route.fulfill({ json: { base: "USD", quote: "CZK", rate: 22.4, timestamp: "2026-09-17T20:00:00.000Z", freshness: "fresh", source: "network" } });
  });
}

test("current-price Add Asset leads to provider-aware asset detail and supports buying more", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockMarket(page);
  await page.goto("/cs-CZ/dashboard");
  await page.locator(".portfolio-picker > summary").click();
  await page.getByRole("button", { name: /Moje portfolio Vaše transakce/ }).click();

  await page.getByRole("button", { name: "Přidat první aktivum" }).click();
  await expect(page.getByRole("heading", { name: "Přidat aktivum" })).toBeVisible();
  await page.getByLabel("Hledat akcii nebo ETF").fill("AAPL");
  const result = page.getByRole("option", { name: /AAPL Apple Inc/ });
  await expect(result).toContainText("331,34 USD");
  await expect(result).toContainText("Poslední cena");
  await result.click();

  await expect(page.getByText("Apple Inc.", { exact: true })).toBeVisible();
  await expect(page.getByText("331,34 USD", { exact: true })).toBeVisible();
  await expect(page.getByText("Poslední cena", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Nákupní cena")).toHaveCount(0);
  await expect(page.getByLabel("Datum")).toHaveCount(0);
  await expect(page.getByLabel(/Poplatek/)).toHaveCount(0);
  await page.getByLabel("Množství").fill("3");
  await expect(page.getByText("994,02 USD")).toBeVisible();
  await expect(page.getByText(/≈.*Kč/)).toBeVisible();
  await page.getByRole("button", { name: "Přidat do portfolia" }).click();

  await expect(page.locator(".portfolio-toast")).toContainText("AAPL bylo přidáno do portfolia");
  const holding = page.getByRole("link", { name: "Detail AAPL" });
  await expect(holding).toBeVisible();
  await holding.click();
  await expect(page).toHaveURL(/\/cs-CZ\/assets\/twelvedata(?::|%3A)XNAS(?::|%3A)AAPL/);

  await expect(page.getByRole("heading", { name: "Apple Inc." })).toBeVisible();
  await expect(page.locator(".asset-detail-quote")).toContainText("331,34 USD");
  await expect(page.locator(".asset-detail-quote")).toContainText("Poslední zavírací cena");
  await expect(page.getByTestId("asset-price-chart")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Moje pozice" })).toBeVisible();
  await expect(page.getByText("V portfoliu · 3 ks")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Informace" })).toBeVisible();
  await expect(page.locator(".asset-information-section")).toContainText("XNAS");

  await page.getByRole("button", { name: "Dokoupit" }).click();
  await expect(page.getByRole("heading", { name: "Přidat aktivum" })).toBeVisible();
  await expect(page.getByRole("dialog").getByText("V portfoliu · 3 ks")).toBeVisible();
  await page.getByLabel("Množství").fill("2");
  await page.getByRole("button", { name: "Přidat do portfolia" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".asset-detail-identity").getByText("V portfoliu · 5 ks")).toBeVisible();

  const { stored, localToday } = await page.evaluate(() => {
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const stored = JSON.parse(localStorage.getItem("lens-personal-portfolio-v1")!) as { transactions: Array<{ type: string; quantity?: number; unitPrice?: number; occurredAt: string }> };
    return { stored, localToday };
  });
  const buys = stored.transactions.filter((row) => row.type === "buy");
  expect(buys).toHaveLength(2);
  expect(buys.every((row) => row.unitPrice === 331.34)).toBe(true);
  expect(buys.every((row) => row.occurredAt === localToday)).toBe(true);
});

test("global navbar search navigates by provider-aware identity and shows current quote", async ({ page }) => {
  await mockMarket(page);
  await page.goto("/cs-CZ/dashboard");
  const search = page.getByRole("combobox", { name: "Globální hledání aktiv" });
  await search.fill("AAPL");
  await expect(page.getByRole("option", { name: /AAPL Apple Inc/ })).toContainText("331,34 USD");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/cs-CZ\/assets\/twelvedata(?::|%3A)XNAS(?::|%3A)AAPL/);
  await expect(page.locator(".asset-detail-quote")).toContainText("331,34 USD");

  await search.fill("SPCX");
  await expect(page.getByRole("option", { name: /SPCX SPAC and New Issue ETF/ })).toContainText("24,62 USD");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/cs-CZ\/assets\/twelvedata(?::|%3A)XNYS(?::|%3A)SPCX/);
  await expect(page.locator(".asset-detail-quote")).toContainText("24,62 USD");
});

test("unavailable secondary listing offers an explicit available alternative", async ({ page }) => {
  const bmv = { ...aapl, id: "twelvedata:XMEX:DUOL", providerSymbol: "DUOL", symbol: "DUOL", name: "Duolingo, Inc.", exchange: "BMV", micCode: "XMEX", currency: "MXN", country: "Mexico" };
  const nasdaq = { ...bmv, id: "twelvedata:XNGS:DUOL", exchange: "NASDAQ", micCode: "XNGS", currency: "USD", country: "United States" };
  await page.route("**/api/market/status", (route) => route.fulfill({ json: { provider: "twelvedata", configured: true } }));
  await page.route("**/api/market/search?*", (route) => route.fulfill({ json: { assets: [nasdaq, bmv] } }));
  await page.route("**/api/market/quotes", async (route) => {
    const body = route.request().postDataJSON() as { assets: typeof bmv[] };
    if (body.assets[0].id === bmv.id) {
      await route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE", message: "raw provider quote failure", retryable: true } } });
      return;
    }
    await route.fulfill({ json: { quotes: [{ assetId: nasdaq.id, price: 234.56, change: 1.2, changePercent: 0.52, currency: "USD", timestamp: "2026-09-18T13:30:00.000Z", marketState: "open", freshness: "fresh", source: "network" }] } });
  });
  await page.route("**/api/market/history?*", (route) => route.fulfill({ status: 404, json: { error: { code: "NO_HISTORY", message: "raw history", retryable: false } } }));
  await page.route("**/api/market/fx?*", (route) => route.fulfill({ json: { base: "USD", quote: "CZK", rate: 22, timestamp: "2026-09-18T13:30:00.000Z", freshness: "fresh", source: "network" } }));

  await page.goto(`/cs-CZ/assets/${encodeURIComponent(bmv.id)}`);
  await expect(page.getByText("Cena pro BMV není dostupná.")).toBeVisible();
  await expect(page.locator(".asset-quote-fallback")).toContainText("DUOL · NASDAQ · USD");
  await expect(page.locator(".asset-quote-fallback")).toContainText("234,56 USD");
  await expect(page.getByText(/raw provider quote failure/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Použít NASDAQ listing" }).click();
  await expect(page).toHaveURL(/twelvedata(?::|%3A)XNGS(?::|%3A)DUOL/);
  await expect(page.locator(".asset-detail-quote")).toContainText("234,56 USD");
});

test("history failure keeps quote and metadata usable without exposing provider messages", async ({ page }) => {
  await mockMarket(page, true);
  await page.goto(`/cs-CZ/assets/${encodeURIComponent(aapl.id)}`);

  await expect(page.getByRole("heading", { name: "Apple Inc." })).toBeVisible();
  await expect(page.locator(".asset-detail-quote")).toContainText("331,34 USD");
  await expect(page.getByText("Historická data momentálně nejsou dostupná.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Informace" })).toBeVisible();
  await expect(page.getByText(/No data is available/i)).toHaveCount(0);
});
