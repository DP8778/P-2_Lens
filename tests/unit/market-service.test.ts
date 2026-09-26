import { MemoryMarketDataCache } from "@/lib/market-data/cache/market-cache";
import { loadFxQuote, loadQuoteAlternative, loadQuotePreview, loadQuotes } from "@/lib/market-data/service";
import type { MarketAsset, MarketQuote } from "@/lib/market-data/types";

const asset: MarketAsset = {
  id: "twelvedata:XNAS:AAPL",
  provider: "twelvedata",
  providerSymbol: "AAPL",
  symbol: "AAPL",
  name: "Apple Inc.",
  type: "stock",
  exchange: "NASDAQ",
  micCode: "XNAS",
  currency: "USD",
};
const quote = (price: number): MarketQuote => ({
  assetId: asset.id,
  price,
  currency: "USD",
  timestamp: "2026-09-14T16:00:00.000Z",
  marketState: "open",
  freshness: "fresh",
  source: "network",
});

describe("market service quote cache", () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test("uses a fresh quote cache without a request", async () => {
    const cache = new MemoryMarketDataCache();
    await cache.putQuote({ key: asset.id, quote: quote(100), updatedAt: new Date().toISOString() });
    global.fetch = jest.fn();
    expect((await loadQuotes([asset], cache))[0].price).toBe(100);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("refreshes only stale and missing assets in one batch, preserving partial results", async () => {
    const cache = new MemoryMarketDataCache();
    const assets = [asset, ...["STALE", "NEW", "MISSING"].map((symbol) => ({ ...asset, id: symbol, symbol, providerSymbol: symbol }))];
    await cache.putQuote({ key: asset.id, quote: quote(100), updatedAt: new Date().toISOString() });
    await cache.putQuote({ key: "STALE", quote: { ...quote(90), assetId: "STALE" }, updatedAt: "2020-01-01T00:00:00Z" });
    const incoming = { ...quote(105), assetId: "NEW" };
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ quotes: [incoming] }) });

    const result = await loadQuotes(assets, cache);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith("/api/market/quotes", expect.objectContaining({
      body: JSON.stringify({ assets: assets.slice(1) }),
    }));
    expect(result).toEqual([quote(100), { ...quote(90), assetId: "STALE", freshness: "stale", source: "cache" }, incoming]);
    expect((await cache.getQuote("STALE"))?.updatedAt).toBe("2020-01-01T00:00:00Z");
    expect((await cache.getQuote("NEW"))?.quote).toEqual(incoming);
  });

  test("failed refresh preserves fresh and stale quotes and omits missing assets", async () => {
    const cache = new MemoryMarketDataCache();
    const stale = { ...asset, id: "stale" };
    await cache.putQuote({ key: asset.id, quote: quote(100), updatedAt: new Date().toISOString() });
    await cache.putQuote({ key: stale.id, quote: { ...quote(90), assetId: stale.id }, updatedAt: "2020-01-01T00:00:00Z" });
    global.fetch = jest.fn().mockRejectedValue(new Error("unavailable"));
    expect(await loadQuotes([asset, stale, { ...asset, id: "missing" }], cache)).toEqual([
      quote(100), { ...quote(90), assetId: stale.id, freshness: "stale", source: "cache" },
    ]);
    await expect(loadQuotes([{ ...asset, id: "missing" }], cache)).resolves.toEqual([]);
  });

  test("uses the same fresh cache for a single-result search preview", async () => {
    const cache = new MemoryMarketDataCache();
    await cache.putQuote({ key: asset.id, quote: quote(101), updatedAt: new Date().toISOString() });
    global.fetch = jest.fn();
    expect((await loadQuotePreview(asset, undefined, cache)).price).toBe(101);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("refreshes a stale quote and updates the value", async () => {
    const cache = new MemoryMarketDataCache();
    await cache.putQuote({ key: asset.id, quote: quote(100), updatedAt: "2020-01-01T00:00:00Z" });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ quotes: [quote(105)] }),
    } as Response);
    expect((await loadQuotes([asset], cache))[0].price).toBe(105);
    expect((await cache.getQuote(asset.id))?.quote.price).toBe(105);
  });

  test("returns a stale cached quote when provider is unavailable", async () => {
    const cache = new MemoryMarketDataCache();
    await cache.putQuote({ key: asset.id, quote: quote(100), updatedAt: "2020-01-01T00:00:00Z" });
    global.fetch = jest.fn().mockRejectedValue(new Error("timeout"));
    const result = await loadQuotes([asset], cache);
    expect(result[0]).toMatchObject({ price: 100, freshness: "stale", source: "cache" });
  });

  test("deduplicates current FX through its ten-minute cache", async () => {
    const cache = new MemoryMarketDataCache();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ base: "EUR", quote: "CZK", rate: 24.8, timestamp: "2026-09-14T16:00:00.000Z", freshness: "fresh", source: "network" }),
    } as Response);
    expect((await loadFxQuote("EUR", "CZK", cache)).rate).toBe(24.8);
    expect((await loadFxQuote("EUR", "CZK", cache)).rate).toBe(24.8);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("offers an available primary listing when a secondary listing has no quote", async () => {
    const selected: MarketAsset = { ...asset, id: "twelvedata:XMEX:DUOL", providerSymbol: "DUOL", symbol: "DUOL", name: "Duolingo, Inc.", exchange: "BMV", micCode: "XMEX", currency: "MXN" };
    const primary: MarketAsset = { ...selected, id: "twelvedata:XNGS:DUOL", name: "Duolingo Inc", exchange: "NASDAQ", micCode: "XNGS", currency: "USD" };
    global.fetch = jest.fn().mockImplementation(async (input, init) => {
      if (String(input).includes("/api/market/search")) return { ok: true, status: 200, json: async () => ({ assets: [primary, selected] }) } as Response;
      const requested = JSON.parse(String(init?.body)).assets[0] as MarketAsset;
      return { ok: true, status: 200, json: async () => ({ quotes: [{ ...quote(234.56), assetId: requested.id }] }) } as Response;
    });
    await expect(loadQuoteAlternative(selected)).resolves.toMatchObject({
      asset: { id: primary.id, exchange: "NASDAQ", currency: "USD" },
      quote: { assetId: primary.id, price: 234.56 },
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
