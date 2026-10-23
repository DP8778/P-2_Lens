import { test, expect } from "@playwright/test";

const assets = Array.from({ length: 30 }, (_, index) => ({
  id: `twelvedata:${index % 2 ? "XETR" : "XNAS"}:${index === 17 ? "AAPL" : `UX${index}`}`,
  provider: "twelvedata", providerSymbol: index === 17 ? "AAPL" : `UX${index}`, symbol: index === 17 ? "AAPL" : `UX${index}`,
  name: `Test instrument ${index}`, type: index % 3 ? "stock" : "etf", exchange: index % 2 ? "Xetra" : "NASDAQ", micCode: index % 2 ? "XETR" : "XNAS", currency: index % 2 ? "EUR" : "USD",
}));
const spy = { ...assets[0], id: "twelvedata:ARCX:SPY", providerSymbol: "SPY", symbol: "SPY", name: "SPDR S&P 500 ETF", type: "etf", exchange: "NYSE Arca", micCode: "ARCX", currency: "USD" };
const transactions = assets.flatMap((asset, index) => [
  { id: `personal-funding-${asset.id}-${index}`, type: "deposit", occurredAt: "2026-09-10", amount: 100 + index, currency: asset.currency, fee: 0 },
  { id: `personal-buy-${asset.id}-${index}`, type: "buy", occurredAt: "2026-09-10", assetId: asset.id, quantity: 1, unitPrice: 100 + index, currency: asset.currency, fee: 0 },
]);
const smallAssets = [...assets.slice(0, 5), assets[17]];
const smallTransactions = [
  ...smallAssets.flatMap((asset, index) => [
    { id: `personal-funding-${asset.id}-small-${index}`, type: "deposit", occurredAt: "2026-09-10", amount: 100 + index, currency: asset.currency, fee: 0 },
    { id: `personal-buy-${asset.id}-small-${index}`, type: "buy", occurredAt: "2026-09-10", assetId: asset.id, quantity: 1, unitPrice: 100 + index, currency: asset.currency, fee: 0 },
  ]),
  ...Array.from({ length: 5 }, (_, index) => [
    { id: `personal-funding-${assets[17].id}-extra-${index}`, type: "deposit", occurredAt: `2026-09-${10 + index}`, amount: 10, currency: assets[17].currency, fee: 0 },
    { id: `personal-buy-${assets[17].id}-extra-${index}`, type: "buy", occurredAt: `2026-09-${10 + index}`, assetId: assets[17].id, quantity: 0.1, unitPrice: 100, currency: assets[17].currency, fee: 0 },
  ]).flat(),
];

test("six holdings avoid a permanent filter wall and open a usable asset detail", async ({ page }) => {
  await page.addInitScript(({ assets, transactions }) => {
    localStorage.setItem("lens-portfolio-mode-v1", "personal");
    localStorage.setItem("lens-personal-portfolio-v1", JSON.stringify({ version: 1, assets, transactions }));
  }, { assets: smallAssets, transactions: smallTransactions });
  await page.route("**/api/market/status", (route) => route.fulfill({ json: { provider: "twelvedata", configured: true } }));
  await page.route("**/api/market/search?*", (route) => route.fulfill({ json: { assets: [spy] } }));
  await page.route("**/api/market/quotes", async (route) => { const body = route.request().postDataJSON() as { assets: typeof assets }; return route.fulfill({ json: { quotes: body.assets.map((asset) => ({ assetId: asset.id, price: 130, currency: asset.currency, timestamp: "2026-09-14T16:00:00.000Z", marketState: "closed", freshness: "lastClose", source: "network" })) } }); });
  await page.route("**/api/market/history?*", (route) => { const asset = JSON.parse(new URL(route.request().url()).searchParams.get("asset")!) as typeof assets[number]; return route.fulfill({ json: { asset, range: { from: "2026-09-10", to: "2026-09-14", interval: "1day" }, points: ["2026-09-10", "2026-09-11", "2026-09-14"].map((date) => ({ assetId: asset.id, date, close: 120, currency: asset.currency, adjustedForSplits: true })), source: "network" } }); });
  await page.route("**/api/market/fx?*", (route) => { const base = new URL(route.request().url()).searchParams.get("from")!; return route.fulfill({ json: { base, quote: "CZK", range: { from: "2026-09-10", to: "2026-09-14", interval: "1day" }, points: ["2026-09-10", "2026-09-11", "2026-09-14"].map((date) => ({ base, quote: "CZK", date, rate: base === "EUR" ? 25 : 22.5 })), source: "network" } }); });

  await page.goto("/cs-CZ/dashboard");
  await expect(page.getByRole("heading", { name: /Pozice/ })).toContainText("6");
  await expect(page.getByLabel("Hledat pozici")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Filtry" })).toHaveCount(0);
  await expect(page.getByLabel("Řazení pozic", { exact: true })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Konec období" })).not.toHaveAttribute("max", "730");
  const detailLink = page.getByRole("link", { name: "Detail AAPL" });
  await expect(detailLink).toHaveAttribute("href", "/cs-CZ/assets/twelvedata%3AXETR%3AAAPL");
  await page.goto((await detailLink.getAttribute("href"))!);
  await expect(page).toHaveURL(/\/cs-CZ\/assets\/twelvedata(?::|%3A)XETR(?::|%3A)AAPL/);
  await expect(page.getByRole("heading", { name: "Test instrument 17" })).toBeVisible();
  await expect(page.getByTestId("asset-price-chart")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Moje pozice" })).toBeVisible();
  await expect(page.locator(".asset-position-metrics")).toContainText("Množství");
  await expect(page.getByRole("button", { name: "Dokoupit" })).toBeVisible();
});

test("thirty holdings use local search/sort and progressive contribution disclosure", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(({ assets, transactions }) => {
    localStorage.setItem("lens-portfolio-mode-v1", "personal");
    localStorage.setItem("lens-personal-portfolio-v1", JSON.stringify({ version: 1, assets, transactions }));
  }, { assets, transactions });
  let marketRequests = 0;
  await page.route("**/api/market/status", (route) => route.fulfill({ json: { provider: "twelvedata", configured: true } }));
  await page.route("**/api/market/search?*", (route) => { marketRequests++; return route.fulfill({ json: { assets: [spy] } }); });
  await page.route("**/api/market/quotes", async (route) => { marketRequests++; const body = route.request().postDataJSON() as { assets: typeof assets }; return route.fulfill({ json: { quotes: body.assets.map((asset, index) => ({ assetId: asset.id, price: 130 + index, currency: asset.currency, timestamp: "2026-09-14T16:00:00.000Z", marketState: "closed", freshness: "lastClose", source: "network" })) } }); });
  await page.route("**/api/market/history?*", (route) => { marketRequests++; const asset = JSON.parse(new URL(route.request().url()).searchParams.get("asset")!) as typeof assets[number]; return route.fulfill({ json: { asset, range: { from: "2026-09-10", to: "2026-09-14", interval: "1day" }, points: ["2026-09-10", "2026-09-11", "2026-09-14"].map((date, index) => ({ assetId: asset.id, date, close: 100 + index * 8, currency: asset.currency, adjustedForSplits: true })), source: "network" } }); });
  await page.route("**/api/market/fx?*", (route) => { marketRequests++; const url = new URL(route.request().url()); const base = url.searchParams.get("from")!; return route.fulfill({ json: { base, quote: "CZK", range: { from: "2026-09-10", to: "2026-09-14", interval: "1day" }, points: ["2026-09-10", "2026-09-11", "2026-09-14"].map((date) => ({ base, quote: "CZK", date, rate: base === "EUR" ? 25 : 22.5 })), source: "network" } }); });

  await page.goto("/cs-CZ/dashboard");
  await expect(page.getByRole("heading", { name: /Pozice/ })).toContainText("30");
  await page.getByRole("heading", { name: /Pozice/ }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/lens-30-holdings.png", fullPage: false });
  const requestsAfterHydration = marketRequests;
  await page.getByLabel("Hledat pozici").fill("AAPL");
  await expect(page.getByRole("link", { name: "Detail AAPL" })).toHaveCount(1);
  await page.getByLabel("Hledat pozici").fill("");
  await page.getByLabel("Řazení pozic", { exact: true }).selectOption("contribution:desc");
  await expect(page.getByLabel("Typ aktiva")).not.toBeVisible();
  await page.locator(".holdings-filter-disclosure > summary").click();
  await expect(page.getByLabel("Typ aktiva")).toBeVisible();
  expect(marketRequests).toBe(requestsAfterHydration);
  await page.getByRole("button", { name: "Příspěvky" }).click();
  expect(await page.locator(".contribution-row").count()).toBeLessThanOrEqual(11);
  await page.getByRole("button", { name: "Zobrazit všech 30 pozic" }).click();
  expect(await page.locator(".contribution-row").count()).toBeGreaterThanOrEqual(30);
});

test("personal portfolio shows a controlled unavailable state", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("lens-portfolio-mode-v1", "personal"));
  await page.route("**/api/market/status", (route) => route.fulfill({ json: { provider: "twelvedata", configured: false } }));
  await page.goto("/cs-CZ/dashboard");
  await expect(page.getByText(/Pro vlastní portfolio zatím nejsou dostupná market data/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Přidat první aktivum" })).toBeVisible();
});
