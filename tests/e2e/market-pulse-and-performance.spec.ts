import { expect, test, type Page, type Route } from "@playwright/test";

const instruments = {
  PLTR: { id: "twelvedata:XNGS:PLTR", provider: "twelvedata", providerSymbol: "PLTR", symbol: "PLTR", name: "Palantir Technologies Inc.", type: "stock", exchange: "NASDAQ", micCode: "XNGS", currency: "USD", country: "United States", timezone: "America/New_York" },
  NVDA: { id: "twelvedata:XNGS:NVDA", provider: "twelvedata", providerSymbol: "NVDA", symbol: "NVDA", name: "NVIDIA Corporation", type: "stock", exchange: "NASDAQ", micCode: "XNGS", currency: "USD", country: "United States", timezone: "America/New_York" },
} as const;

async function mockMarket(page: Page) {
  const quoteBatchSizes: number[] = [];
  await page.route("**/api/market/status", (route) => route.fulfill({ json: { provider: "twelvedata", configured: true } }));
  await page.route("**/api/market/search?*", async (route) => {
    const symbol = new URL(route.request().url()).searchParams.get("q")?.toUpperCase() as keyof typeof instruments;
    await route.fulfill({ json: { assets: instruments[symbol] ? [instruments[symbol]] : [] } });
  });
  await page.route("**/api/market/quotes", async (route: Route) => {
    const body = route.request().postDataJSON() as { assets: Array<{ id: string; symbol: string; currency: string }> };
    quoteBatchSizes.push(body.assets.length);
    await route.fulfill({ json: { quotes: body.assets.map((asset, index) => ({
      assetId: asset.id,
      price: asset.symbol === "NVDA" ? 184.2 : asset.symbol === "PLTR" ? 171.4 : 90 + index * 7.25,
      change: 1.2,
      changePercent: index % 4 === 0 ? -1.2 : 1.1 + (index % 5) * 0.6,
      currency: asset.currency,
      timestamp: "2026-09-18T20:00:00.000Z",
      marketState: "closed",
      freshness: "lastClose",
      source: "network",
    })) } });
  });
  await page.route("**/api/market/history?*", async (route) => {
    const asset = JSON.parse(new URL(route.request().url()).searchParams.get("asset")!) as { id: string; currency: string };
    const values = [72, 88, 112, 145, 190, 160, 168];
    const dates = ["2025-09-19", "2025-12-19", "2026-03-19", "2026-08-19", "2026-09-12", "2026-09-17", "2026-09-18"];
    await route.fulfill({ json: { asset, range: { from: dates[0], to: dates.at(-1), interval: "1day" }, points: dates.map((date, index) => ({ assetId: asset.id, date, close: values[index], currency: asset.currency, adjustedForSplits: true })), source: "network" } });
  });
  await page.route("**/api/market/fx?*", (route) => route.fulfill({ json: { base: "USD", quote: "CZK", rate: 21.3, timestamp: "2026-09-18T20:00:00.000Z", freshness: "fresh", source: "network" } }));
  await page.route("**/api/market/bitcoin", (route) => route.fulfill({ json: { price: 115000 } }));
  return quoteBatchSizes;
}

test("Market Pulse batches quotes, opens NVDA and PLTR shows annual performance", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const quoteBatchSizes = await mockMarket(page);

  await page.goto("/cs-CZ/dashboard");
  const pulse = page.locator(".market-pulse.compact");
  await expect(pulse).toBeVisible();
  await expect(pulse.getByText("AI", { exact: true })).toBeVisible();
  await expect.poll(() => quoteBatchSizes.some((size) => size > 1)).toBe(true);
  expect(quoteBatchSizes.filter((size) => size > 1)).toHaveLength(1);
  await pulse.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/market-pulse/dashboard-market-pulse.png", fullPage: false });

  await page.getByRole("link", { name: "Markets", exact: true }).click();
  await expect(page).toHaveURL(/\/cs-CZ\/markets/);
  const aiTheme = page.locator("button.market-theme-card").filter({ has: page.getByText("AI", { exact: true }) });
  await aiTheme.click();
  await expect(page.locator(".market-constituents")).toContainText("NVDA");
  await page.waitForTimeout(700);
  await page.screenshot({ path: "test-results/market-pulse/markets.png", fullPage: false });
  await page.getByRole("link", { name: "Detail NVDA" }).click();
  await expect(page).toHaveURL(/\/assets\/twelvedata(?::|%3A)XNGS(?::|%3A)NVDA/);
  await expect(page.getByRole("heading", { name: "NVIDIA Corporation" })).toBeVisible();

  await page.goto(`/cs-CZ/assets/${encodeURIComponent(instruments.PLTR.id)}`);
  await expect(page.getByRole("heading", { name: "Palantir Technologies Inc." })).toBeVisible();
  const performance = page.getByLabel("Výkonnost aktiva");
  await expect(performance).toContainText("1W");
  await expect(performance).toContainText("1M");
  await expect(performance).toContainText("1Y");
  await expect(performance).toContainText("52W high");
  await expect(performance).toContainText("52W low");
  await expect(performance).not.toContainText("—");
  await expect(page.getByTestId("asset-price-chart")).toBeVisible();
  await page.waitForTimeout(700);
  await page.screenshot({ path: "test-results/market-pulse/asset-detail-pltr.png", fullPage: false });
});
