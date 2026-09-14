import {
  MemoryMarketDataCache,
  mergeFxPoints,
  mergePricePoints,
  missingHistoryRanges,
} from "@/lib/market-data/cache/market-cache";

describe("market data cache", () => {
  test("detects full hits and missing historical edges", () => {
    const record = { from: "2026-01-10", to: "2026-01-20" };
    expect(missingHistoryRanges(record, "2026-01-12", "2026-01-18")).toEqual([]);
    expect(missingHistoryRanges(record, "2026-01-01", "2026-01-25")).toEqual([
      { from: "2026-01-01", to: "2026-01-10" },
      { from: "2026-01-20", to: "2026-01-25" },
    ]);
  });

  test("merges history and stale tails without duplicate dates", () => {
    const asset = { assetId: "a", currency: "USD", adjustedForSplits: true };
    const merged = mergePricePoints(
      [{ ...asset, date: "2026-01-01", close: 10 }, { ...asset, date: "2026-01-02", close: 11 }],
      [{ ...asset, date: "2026-01-02", close: 12 }, { ...asset, date: "2026-01-03", close: 13 }],
    );
    expect(merged.map((point) => [point.date, point.close])).toEqual([["2026-01-01", 10], ["2026-01-02", 12], ["2026-01-03", 13]]);
    expect(mergeFxPoints([{ base: "USD", quote: "CZK", date: "2026-01-01", rate: 22 }], [{ base: "USD", quote: "CZK", date: "2026-01-01", rate: 23 }])[0].rate).toBe(23);
  });

  test("clearing market cache does not touch user transactions", async () => {
    const cache = new MemoryMarketDataCache();
    const transactions = [{ id: "user-buy" }];
    await cache.putQuote({ key: "a", updatedAt: "2026-01-01", quote: { assetId: "a", price: 1, currency: "USD", timestamp: "2026-01-01T00:00:00Z", marketState: "closed", freshness: "lastClose", source: "cache" } });
    await cache.clearMarketData();
    expect(await cache.getQuote("a")).toBeUndefined();
    expect(transactions).toEqual([{ id: "user-buy" }]);
  });
});

