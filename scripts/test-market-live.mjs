import { createServer } from "node:http";
import { mkdir } from "node:fs/promises";
import nextEnv from "@next/env";
import { chromium } from "@playwright/test";
import next from "next";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

if (!process.env.TWELVE_DATA_API_KEY?.trim()) {
  console.log("SKIP market-live: TWELVE_DATA_API_KEY není dostupný.");
  process.exit(0);
}

const port = Number(process.env.LENS_MARKET_LIVE_PORT ?? 3107);
const baseUrl = `http://127.0.0.1:${port}`;
const app = next({ dev: false, dir: process.cwd() });
let server;
let browser;

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const date = (value) => value.toISOString().slice(0, 10);
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForProviderWindow(startedAt, label) {
  const remaining = Math.max(0, 62_000 - (Date.now() - startedAt));
  if (!remaining) return;
  console.log(`WAIT market-live: ${label} (${Math.ceil(remaining / 1000)} s, ochrana provider quota).`);
  let pending = remaining;
  while (pending > 0) {
    const chunk = Math.min(pending, 30_000);
    await sleep(chunk);
    pending -= chunk;
  }
}

async function json(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const normalized = body?.error?.code ? ` ${body.error.code}` : "";
    throw new Error(`${path} vrátil HTTP ${response.status}${normalized}: ${body?.error?.message ?? "bez JSON chyby"}`);
  }
  return body;
}

function validateAsset(asset, expectedSymbol) {
  assert(asset?.symbol === expectedSymbol, `Chybí relevantní ${expectedSymbol} listing`);
  assert(["stock", "etf"].includes(asset.type), `${expectedSymbol} má neplatný typ`);
  assert(typeof asset.name === "string" && asset.name.length > 0, `${expectedSymbol} nemá název`);
  assert(typeof asset.exchange === "string" && asset.exchange.length > 0, `${expectedSymbol} nemá burzu`);
  assert(/^[A-Z]{3}$/.test(asset.currency), `${expectedSymbol} nemá platnou měnu`);
  const identityVenue = (asset.micCode || asset.exchange || "UNKNOWN").toUpperCase();
  assert(asset.id === `twelvedata:${identityVenue}:${expectedSymbol}`, `${expectedSymbol} nemá stabilní ID`);
}

function validateHistory(history, asset) {
  assert(Array.isArray(history.points) && history.points.length > 0, `${asset.symbol} history je prázdná`);
  const dates = history.points.map((point) => point.date);
  assert(dates.every((value, index) => index === 0 || dates[index - 1] < value), `${asset.symbol} history není seřazená nebo obsahuje duplicity`);
  assert(history.points.every((point) => point.assetId === asset.id), `${asset.symbol} history má chybné assetId`);
  assert(history.points.every((point) => point.currency === asset.currency), `${asset.symbol} history má chybnou měnu`);
  assert(history.points.every((point) => Number.isFinite(point.close) && point.close > 0), `${asset.symbol} history obsahuje neplatnou cenu`);
}

async function historyFor(asset, from, to) {
  const query = new URLSearchParams({ asset: JSON.stringify(asset), from, to, interval: "1day" });
  return json(`/api/market/history?${query}`);
}

async function quoteFor(asset) {
  const response = await json("/api/market/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assets: [asset] }),
  });
  return response.quotes?.[0];
}

async function quoteOutcome(asset) {
  try {
    const quote = await quoteFor(asset);
    return { available: Number.isFinite(quote?.price) && quote.price > 0, quote };
  } catch (error) {
    return { available: false, error: error instanceof Error ? error.message : String(error) };
  }
}

try {
  await app.prepare();
  const handle = app.getRequestHandler();
  server = createServer((request, response) => handle(request, response));
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });

  const status = await json("/api/market/status");
  assert(status.provider === "twelvedata" && status.configured === true, "/api/market/status není configured:true");

  const coreWindowStarted = Date.now();
  const pltr = await json("/api/market/search?q=PLTR");
  const pltrAsset = pltr.assets?.find((asset) => asset.symbol === "PLTR");
  validateAsset(pltrAsset, "PLTR");

  const aapl = await json("/api/market/search?q=AAPL");
  const aaplAsset = aapl.assets?.find((asset) => asset.symbol === "AAPL");
  validateAsset(aaplAsset, "AAPL");

  const duol = await json("/api/market/search?q=DUOL");
  const duolListings = duol.assets?.filter((asset) => asset.symbol === "DUOL") ?? [];
  const duolNasdaq = duolListings.find((asset) => asset.currency === "USD" && /NASDAQ/i.test(asset.exchange));
  const duolBmv = duolListings.find((asset) => asset.currency === "MXN" && /BMV/i.test(asset.exchange));
  validateAsset(duolNasdaq, "DUOL");
  validateAsset(duolBmv, "DUOL");
  assert(duolListings[0]?.id === duolNasdaq.id, "DUOL NASDAQ není preferred listing");

  const spcx = await json("/api/market/search?q=SPCX");
  const spcxAsset = spcx.assets?.find((asset) => asset.symbol === "SPCX");
  validateAsset(spcxAsset, "SPCX");

  const quote = await quoteFor(aaplAsset);
  assert(Number.isFinite(quote?.price) && quote.price > 0, "AAPL quote není konečná kladná cena");
  assert(quote.currency === aaplAsset.currency, "AAPL quote má chybnou měnu");
  assert(!Number.isNaN(Date.parse(quote.timestamp)), "AAPL quote má neplatný timestamp");
  assert(["open", "closed", "unknown"].includes(quote.marketState), "AAPL quote má neplatný marketState");
  assert(["fresh", "stale", "lastClose", "unavailable"].includes(quote.freshness), "AAPL quote má neplatnou freshness");

  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 90);
  const history = await historyFor(aaplAsset, date(start), date(end));
  validateHistory(history, aaplAsset);

  const fx = await json("/api/market/fx?from=USD&to=CZK");
  assert(fx.base === "USD" && fx.quote === "CZK", "Current FX má obrácenou orientaci");
  assert(Number.isFinite(fx.rate) && fx.rate > 0, "USD/CZK není konečný kladný kurz");

  const fxQuery = new URLSearchParams({ from: "USD", to: "CZK", start: date(start), end: date(end) });
  const fxHistory = await json(`/api/market/fx?${fxQuery}`);
  assert(fxHistory.base === "USD" && fxHistory.quote === "CZK", "Historical FX má obrácenou orientaci");
  assert(Array.isArray(fxHistory.points) && fxHistory.points.length > 0, "USD/CZK history je prázdná");
  assert(fxHistory.points.every((point) => point.base === "USD" && point.quote === "CZK" && Number.isFinite(point.rate) && point.rate > 0), "USD/CZK history má neplatný bod");

  await waitForProviderWindow(coreWindowStarted, "evropské listingy a split audit");
  const auditWindowStarted = Date.now();
  const duolNasdaqQuote = await quoteOutcome(duolNasdaq);
  const duolBmvQuote = await quoteOutcome(duolBmv);
  const spcxQuote = await quoteOutcome(spcxAsset);
  assert(duolNasdaqQuote.available, "DUOL NASDAQ quote není dostupný");
  assert(spcxQuote.available, "SPCX quote není dostupný");
  const europe = {};
  for (const symbol of ["VWCE", "CSPX"]) {
    const response = await json(`/api/market/search?q=${symbol}`);
    const listings = response.assets?.filter((asset) => asset.symbol === symbol) ?? [];
    listings.forEach((asset) => {
      validateAsset(asset, symbol);
      assert(asset.type === "etf", `${symbol} listing není ETF`);
    });
    europe[symbol] = listings.map((asset) => ({ id: asset.id, exchange: asset.exchange, micCode: asset.micCode, currency: asset.currency }));
  }

  const splitHistory = await historyFor(aaplAsset, "2020-08-20", "2020-09-10");
  validateHistory(splitHistory, aaplAsset);
  const splitRatios = splitHistory.points.slice(1).map((point, index) => point.close / splitHistory.points[index].close);
  const largestSplitWindowMove = Math.max(...splitRatios.map((value) => Math.max(value, 1 / value)));
  assert(largestSplitWindowMove < 2, "AAPL split window obsahuje neočekávaný neadjustovaný cenový skok");

  const apiSummary = {
    status,
    pltr: {
      count: pltr.assets.length,
      listing: { symbol: pltrAsset.symbol, name: pltrAsset.name, type: pltrAsset.type, exchange: pltrAsset.exchange, micCode: pltrAsset.micCode, currency: pltrAsset.currency, country: pltrAsset.country, id: pltrAsset.id },
    },
    aapl: {
      count: aapl.assets.length,
      listing: { symbol: aaplAsset.symbol, name: aaplAsset.name, exchange: aaplAsset.exchange, currency: aaplAsset.currency, id: aaplAsset.id },
      quote: { price: quote.price, currency: quote.currency, timestamp: quote.timestamp, marketState: quote.marketState, freshness: quote.freshness },
      historyPoints: history.points.length,
    },
    duol: {
      preferred: duolListings[0]?.id,
      nasdaq: { id: duolNasdaq.id, exchange: duolNasdaq.exchange, currency: duolNasdaq.currency, ...duolNasdaqQuote },
      bmv: { id: duolBmv.id, exchange: duolBmv.exchange, currency: duolBmv.currency, ...duolBmvQuote },
    },
    spcx: { listing: { id: spcxAsset.id, exchange: spcxAsset.exchange, currency: spcxAsset.currency }, ...spcxQuote },
    fx: { current: fx.rate, historyPoints: fxHistory.points.length, orientation: `${fxHistory.base}/${fxHistory.quote}` },
    europe,
    splitAudit: { symbol: "AAPL", points: splitHistory.points.length, largestAdjacentMoveFactor: largestSplitWindowMove },
  };

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    if (!sessionStorage.getItem("lens-market-live-initialized")) {
      localStorage.setItem("lens-portfolio-mode-v1", "personal");
      localStorage.setItem("lens-personal-portfolio-v1", JSON.stringify({ version: 1, assets: [], transactions: [] }));
      localStorage.removeItem("lens-recent-market-assets-v1");
      sessionStorage.setItem("lens-market-live-initialized", "true");
    }
  });
  const page = await context.newPage();
  const requestCounts = { search: 0, quotes: 0, history: 0, fx: 0, status: 0 };
  const failedMarketResponses = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    const key = url.pathname.split("/").at(-1);
    if (key in requestCounts) requestCounts[key] += 1;
  });
  page.on("response", async (response) => {
    const url = new URL(response.url());
    if (!url.pathname.startsWith("/api/market/") || response.ok()) return;
    const body = await response.json().catch(() => ({}));
    failedMarketResponses.push({
      path: url.pathname,
      status: response.status(),
      code: body?.error?.code ?? "UNKNOWN",
    });
  });
  const screenshotDir = "test-results/market-live";
  const addPriceScreenshotDir = "test-results/add-price";
  await mkdir(screenshotDir, { recursive: true });
  await mkdir(addPriceScreenshotDir, { recursive: true });
  const screenshot = (name) => page.screenshot({ path: `${screenshotDir}/${name}.png`, fullPage: false });
  const addPriceScreenshot = (name) => page.screenshot({ path: `${addPriceScreenshotDir}/${name}.png`, fullPage: false });

  await page.goto(`${baseUrl}/cs-CZ/dashboard`);
  await page.getByRole("heading", { name: "Moje portfolio" }).waitFor();
  await screenshot("01-personal-empty");
  await page.getByRole("button", { name: "Přidat první aktivum" }).click();
  const search = page.getByLabel("Hledat akcii nebo ETF");
  await search.waitFor();
  assert(await search.isEnabled(), "Add Investment search je při configured:true zakázaný");
  assert(await page.getByText("Live market data nejsou nakonfigurována.").count() === 0, "Configured UI ukazuje not-configured stav");
  await screenshot("02-add-idle");
  await addPriceScreenshot("before-search");

  await search.fill("LENSNORESULT987654321");
  await page.getByText("Žádné výsledky. Zkuste jiný ticker nebo název.").waitFor({ timeout: 20_000 });
  await waitForProviderWindow(auditWindowStarted, "AAPL a VWCE price preview");
  const priceWindowStarted = Date.now();

  await search.fill("AAPL");
  const aaplOption = page.getByRole("option").filter({ hasText: "AAPL" }).first();
  await aaplOption.waitFor({ timeout: 20_000 });
  await aaplOption.locator(".asset-search-price").filter({ hasText: "USD" }).waitFor({ timeout: 20_000 });
  await aaplOption.click();
  await page.locator(".simple-add-quote strong").filter({ hasText: "USD" }).waitFor({ timeout: 20_000 });
  const aaplUiPrice = await page.locator(".simple-add-quote strong").innerText();
  await page.getByRole("button", { name: "Změnit instrument" }).click();

  await search.fill("VWCE");
  const vwceOption = page.getByRole("option").filter({ hasText: "VWCE" }).first();
  await vwceOption.waitFor({ timeout: 20_000 });
  assert((await vwceOption.innerText()).includes("EUR"), "VWCE search result nezobrazuje native EUR měnu");
  const vwcePrice = vwceOption.locator(".asset-search-price").filter({ hasText: "EUR" });
  const vwceUnavailable = vwceOption.getByText("Cena nedostupná");
  const vwcePreviewAvailable = await Promise.race([
    vwcePrice.waitFor({ timeout: 20_000 }).then(() => true),
    vwceUnavailable.waitFor({ timeout: 20_000 }).then(() => false),
  ]);
  await vwceOption.click();
  const selectedVwceQuote = page.locator(".simple-add-quote strong");
  await selectedVwceQuote.waitFor({ timeout: 20_000 });
  await page.waitForFunction(
    () => !document.querySelector(".simple-add-quote strong")?.textContent?.includes("Načítám"),
    undefined,
    { timeout: 20_000 },
  );
  const vwceUiPrice = await selectedVwceQuote.innerText();
  const vwceSelectedAvailable = vwceUiPrice.includes("EUR");
  await page.getByRole("button", { name: "Změnit instrument" }).click();

  await waitForProviderWindow(priceWindowStarted, "PLTR add flow a portfolio analytics");
  await search.fill("PLTR");
  const pltrOption = page.getByRole("option").filter({ hasText: "PLTR" }).first();
  await pltrOption.waitFor({ timeout: 20_000 });
  await pltrOption.locator(".asset-search-price").filter({ hasText: "USD" }).waitFor({ timeout: 20_000 });
  await screenshot("03-pltr-results");
  await addPriceScreenshot("after-search-with-price");
  await pltrOption.click();
  await page.getByLabel("Množství", { exact: true }).waitFor();
  await page.locator(".simple-add-quote strong").waitFor({ state: "visible" });
  await page.waitForFunction(
    () => !document.querySelector(".simple-add-quote strong")?.textContent?.includes("Načítám"),
    undefined,
    { timeout: 20_000 },
  );
  await screenshot("04-pltr-selected");
  await addPriceScreenshot("selected-stock");
  const pltrUiPrice = await page.locator(".simple-add-quote strong").innerText();

  await page.getByLabel("Množství", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Přidat do portfolia" }).click();
  const saveError = page.locator(".form-error");
  const saveOutcome = await Promise.race([
    page.locator(".portfolio-toast").waitFor({ timeout: 40_000 }).then(() => ({ ok: true })),
    saveError.waitFor({ timeout: 40_000 }).then(async () => ({
      ok: false,
      message: await saveError.innerText(),
    })),
  ]);
  if (!saveOutcome.ok) {
    await screenshot("05-add-error");
    throw new Error(
      `Uložení PLTR selhalo: ${saveOutcome.message}; market failures=${JSON.stringify(failedMarketResponses)}`,
    );
  }
  await page.getByTestId("portfolio-value").waitFor();
  const dashboardText = await page.locator("main").innerText();
  assert(!/NaN|Infinity/.test(dashboardText), "Dashboard po add obsahuje NaN nebo Infinity");
  await page.locator(".hero-chart").waitFor();
  await page.getByRole("heading", { name: "Lens Insight" }).waitFor();
  await page.getByRole("link", { name: "Detail PLTR" }).waitFor();
  await screenshot("05-personal-after-add");

  await page.getByRole("button", { name: "Příspěvky", exact: true }).click();
  await page.getByRole("img", { name: "Příspěvky aktiv k výnosu" }).waitFor();
  await page.getByRole("button", { name: "Poklesy", exact: true }).click();
  assert(!/NaN|Infinity/.test(await page.locator(".hero-chart").innerText()), "Analytické pohledy obsahují NaN nebo Infinity");
  await page.locator("#holdings").evaluate((element) => element.scrollIntoView({ block: "start" }));
  await page.locator(".holdings-concentration > summary").click();
  assert(!/NaN|Infinity/.test(await page.locator("#holdings").innerText()), "Holdings nebo koncentrace obsahují NaN nebo Infinity");
  await screenshot("06-holdings-concentration");

  const beforeLocalControls = { ...requestCounts };
  await page.getByRole("link", { name: "Detail PLTR" }).hover();
  await page.getByLabel("Řazení pozic").selectOption("value:asc");
  await page.waitForTimeout(500);
  assert(JSON.stringify(requestCounts) === JSON.stringify(beforeLocalControls), "Hover nebo lokální sort spustil market request");

  await page.locator(".hero-chart").scrollIntoViewIfNeeded();
  await page.locator(".compare-trigger").click();
  await page.getByLabel("Hledat instrument pro porovnání").fill("SPY");
  const spyOption = page.getByRole("option").filter({ hasText: "SPY" }).first();
  await spyOption.waitFor({ timeout: 20_000 });
  await screenshot("07-compare-spy-results");
  await page.getByLabel("Zavřít porovnání").click();
  assert(await page.getByRole("link", { name: "Detail SPY" }).count() === 0, "Externí compare přidal SPY do Holdings");

  await page.reload();
  await page.getByRole("link", { name: "Detail PLTR" }).waitFor({ timeout: 30_000 });
  const persisted = await page.evaluate(async () => ({
    portfolio: JSON.parse(localStorage.getItem("lens-personal-portfolio-v1") ?? "null"),
    databases: typeof indexedDB.databases === "function" ? (await indexedDB.databases()).map((item) => item.name) : [],
  }));
  assert(persisted.portfolio?.transactions?.length >= 2, "Transakce po reloadu nezůstaly uložené");
  assert(persisted.databases.includes("lens-market-data-v1"), "Market cache po reloadu nebyla nalezena");
  assert(!/NaN|Infinity/.test(await page.locator("main").innerText()), "Reloadovaný dashboard obsahuje NaN nebo Infinity");
  await screenshot("08-after-reload");

  const uiSummary = {
    realAdd: true,
    portfolioAnalysisFinite: true,
    contribution: true,
    drawdown: true,
    lensInsight: true,
    externalCompareSearch: true,
    cacheAfterReload: true,
    livePrices: {
      PLTR: { display: pltrUiPrice, available: true },
      AAPL: { display: aaplUiPrice, available: true },
      VWCE: { display: vwceUiPrice, searchPreviewAvailable: vwcePreviewAvailable, available: vwceSelectedAvailable, nativeCurrency: "EUR" },
    },
    requestCounts,
  };

  console.log(JSON.stringify({ api: apiSummary, ui: uiSummary }, null, 2));
  console.log("PASS market-live: reálný Twelve Data řetězec i lokální portfolio analytics fungují.");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  if (server) await new Promise((resolve) => server.close(resolve));
  await app.close();
}
