import { MemoryMarketDataCache } from "@/lib/market-data/cache/market-cache";
import { loadFxQuote, loadQuotes } from "@/lib/market-data/service";
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
});
