import { loadIndustryHistories, type IndustryHistoryProgress } from "@/lib/market-data/industry-history";
import { loadHistory } from "@/lib/market-data/service";
import { fetchMarketHistory } from "@/lib/market-data/client";
import { MemoryMarketDataCache } from "@/lib/market-data/cache/market-cache";
import { MarketDataError } from "@/lib/market-data/errors";
import { marketThemes } from "@/data/market-themes";
import type { DateRange, MarketAsset } from "@/lib/market-data/types";

jest.mock("@/lib/market-data/client", () => ({ fetchMarketHistory: jest.fn() }));
const fetchHistory = jest.mocked(fetchMarketHistory);
const assets = marketThemes[0].constituents;
const range: DateRange = { from: "2026-01-01", to: "2026-09-25", interval: "1day" };
const response = (asset: MarketAsset, from = range.from, to = range.to) => ({ asset, range: { from, to, interval: "1day" as const }, source: "network" as const,
  points: [from, to].map((date, i) => ({ assetId: asset.id, date, close: 100 + i * 10, currency: asset.currency, adjustedForSplits: true })) });
let now = Date.parse("2026-10-01T12:00:00Z");
beforeEach(() => { jest.useFakeTimers(); now += 86400000; jest.setSystemTime(now); fetchHistory.mockReset(); fetchHistory.mockImplementation(async (asset, from, to) => response(asset, from, to)); });
afterEach(() => jest.useRealTimers());
async function seed(cache: MemoryMarketDataCache, asset: MarketAsset, stale = false, from = range.from, to = range.to) {
  await cache.putHistory({ key: asset.id, assetId: asset.id, ...range, from, to, points: response(asset, from, to).points, updatedAt: new Date(Date.now() - (stale ? 86400000 : 0)).toISOString(), provider: asset.provider, version: 1 });
}

test("bounds all simultaneous industry jobs to two and progressively persists success", async () => {
  const cache = new MemoryMarketDataCache();
  const progress: IndustryHistoryProgress[] = [];
  const release: (() => void)[] = [];
  fetchHistory.mockImplementation((asset, from, to) => new Promise((resolve) => release.push(() => resolve(response(asset, from, to)))));
  const pending = loadIndustryHistories({ assets, range, cache, onProgress: (p) => progress.push(p) });
  await jest.advanceTimersByTimeAsync(0);
  expect(fetchHistory).toHaveBeenCalledTimes(2);
  release[0](); await jest.advanceTimersByTimeAsync(0);
  expect(cache.histories.size).toBe(1);
  expect(progress.some((p) => p.ready === 1 && !p.done)).toBe(true);
  expect(fetchHistory).toHaveBeenCalledTimes(3);
  release[1](); await jest.advanceTimersByTimeAsync(0);
  release[2](); release[3]();
  const result = await pending;
  expect(result).toMatchObject({ ready: 4, failed: 0, loading: 0, done: true });
  expect(Math.max(...progress.map((p) => p.loading))).toBe(2);
  expect(cache.histories.size).toBe(4);
  await loadIndustryHistories({ assets, range, cache });
  expect(fetchHistory).toHaveBeenCalledTimes(4);
});

test("full cache makes zero requests; mixed cache requests only missing assets", async () => {
  const cache = new MemoryMarketDataCache();
  await seed(cache, assets[0]); await seed(cache, assets[1]);
  const progress: IndustryHistoryProgress[] = [];
  await loadIndustryHistories({ assets, range, cache, onProgress: (p) => progress.push(p) });
  expect(progress[0].ready).toBe(2);
  expect(fetchHistory.mock.calls.map(([asset]) => asset.id)).toEqual(assets.slice(2).map((asset) => asset.id));
  fetchHistory.mockClear();
  await loadIndustryHistories({ assets, range, cache });
  expect(fetchHistory).not.toHaveBeenCalled();
});

test("permanent missing symbol fails once, keeps other companies, never creates zero returns", async () => {
  const cache = new MemoryMarketDataCache();
  fetchHistory.mockImplementation(async (asset) => { if (asset.id === assets[0].id) throw new MarketDataError("NO_HISTORY", "missing", false, 404); return response(asset); });
  const result = await loadIndustryHistories({ assets, range, cache });
  expect(result).toMatchObject({ ready: 3, failed: 1, done: true });
  expect(result.histories.has(assets[0].id)).toBe(false);
  expect(fetchHistory.mock.calls.filter(([a]) => a.id === assets[0].id)).toHaveLength(1);
  expect(cache.histories.size).toBe(3);
});

test("temporary failures have bounded exponential retries", async () => {
  const cache = new MemoryMarketDataCache();
  fetchHistory.mockRejectedValue(new MarketDataError("UNAVAILABLE", "temporary", true, 503));
  const pending = loadIndustryHistories({ assets: assets.slice(0, 1), range, cache });
  await jest.advanceTimersByTimeAsync(0);
  expect(fetchHistory).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(999); expect(fetchHistory).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1); expect(fetchHistory).toHaveBeenCalledTimes(2);
  await jest.advanceTimersByTimeAsync(2000);
  expect(await pending).toMatchObject({ failed: 1, ready: 0, done: true });
  expect(fetchHistory).toHaveBeenCalledTimes(3);
});

test("rate limiting pauses the queue, then recovers without an uncontrolled burst", async () => {
  const cache = new MemoryMarketDataCache();
  fetchHistory.mockRejectedValueOnce(new MarketDataError("RATE_LIMIT", "slow down", true, 429));
  const pending = loadIndustryHistories({ assets, range, cache });
  await jest.advanceTimersByTimeAsync(0);
  const initial = fetchHistory.mock.calls.length;
  expect(initial).toBeLessThanOrEqual(2);
  await jest.advanceTimersByTimeAsync(64_999); expect(fetchHistory).toHaveBeenCalledTimes(initial);
  await jest.advanceTimersByTimeAsync(1);
  expect(await pending).toMatchObject({ ready: 4, failed: 0 });
  expect(fetchHistory).toHaveBeenCalledTimes(5);
});

test("stale cache is exposed immediately, and refresh failure preserves every observation", async () => {
  const cache = new MemoryMarketDataCache(); await seed(cache, assets[0], true);
  const old = cache.histories.get(assets[0].id)!;
  const progress: IndustryHistoryProgress[] = [];
  fetchHistory.mockRejectedValue(new MarketDataError("NOT_FOUND", "gone", false, 404));
  const result = await loadIndustryHistories({ assets: assets.slice(0, 1), range, cache, onProgress: (p) => progress.push(p) });
  expect(progress[0].ready).toBe(1); expect(progress[0].stale.has(assets[0].id)).toBe(true);
  expect(result.histories.get(assets[0].id)).toEqual(old.points);
  expect(cache.histories.get(assets[0].id)).toEqual(old);
  expect(fetchHistory.mock.calls[0].slice(1, 3)).toEqual(["2026-09-18", range.to]);
});

test("successful prefix is persisted even when a later suffix fails", async () => {
  const cache = new MemoryMarketDataCache(); await seed(cache, assets[0], false, "2026-02-01", "2026-09-01");
  fetchHistory.mockImplementation(async (asset, from, to) => { if (from === "2026-09-01") throw new MarketDataError("NO_HISTORY", "no tail", false); return response(asset, from, to); });
  await loadIndustryHistories({ assets: assets.slice(0, 1), range, cache });
  expect(cache.histories.get(assets[0].id)).toMatchObject({ from: range.from, to: "2026-09-01" });
  fetchHistory.mockClear();
  await loadIndustryHistories({ assets: assets.slice(0, 1), range, cache });
  expect(fetchHistory.mock.calls.map((call) => call[1])).toEqual(["2026-09-01"]);
});

test("duplicate consumers share transport; cancelling one preserves the remaining reader", async () => {
  const cache = new MemoryMarketDataCache();
  let release!: () => void;
  fetchHistory.mockImplementation((asset, from, to) => new Promise((resolve) => { release = () => resolve(response(asset, from, to)); }));
  const controller = new AbortController();
  const first = loadHistory(assets[0], range, cache, controller.signal).catch((error) => error);
  const second = loadHistory(assets[0], range, cache);
  await jest.advanceTimersByTimeAsync(0); expect(fetchHistory).toHaveBeenCalledTimes(1);
  controller.abort(); expect((await first).name).toBe("AbortError");
  expect(fetchHistory.mock.calls[0][3]?.aborted).toBe(false);
  release(); expect((await second).points).toHaveLength(2);
});

test("industry cancellation aborts transports and removes queued work without late progress", async () => {
  const cache = new MemoryMarketDataCache(); const controller = new AbortController(); const progress = jest.fn();
  fetchHistory.mockImplementation((_asset, _from, _to, signal) => new Promise((_resolve, reject) => signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true })));
  const pending = loadIndustryHistories({ assets, range, cache, signal: controller.signal, onProgress: progress }).catch((error) => error);
  await jest.advanceTimersByTimeAsync(0); expect(fetchHistory).toHaveBeenCalledTimes(2);
  const count = progress.mock.calls.length;
  controller.abort(); expect((await pending).name).toBe("AbortError");
  expect(fetchHistory.mock.calls.every((call) => call[3]?.aborted)).toBe(true);
  expect(fetchHistory).toHaveBeenCalledTimes(2); expect(progress).toHaveBeenCalledTimes(count);
});

test("persistent rate limits stop after three attempts", async () => {
  const cache = new MemoryMarketDataCache();
  fetchHistory.mockRejectedValue(new MarketDataError("RATE_LIMIT", "quota", true, 429));
  const pending = loadIndustryHistories({ assets: assets.slice(0, 1), range, cache });
  await jest.advanceTimersByTimeAsync(0);
  await jest.advanceTimersByTimeAsync(65_000);
  await jest.advanceTimersByTimeAsync(130_000);
  expect(await pending).toMatchObject({ done: true, ready: 0, failed: 1 });
  expect(fetchHistory).toHaveBeenCalledTimes(3);
});

test("cancelling a retry wait prevents another attempt", async () => {
  const cache = new MemoryMarketDataCache(); const controller = new AbortController();
  fetchHistory.mockRejectedValue(new MarketDataError("UNAVAILABLE", "offline", true, 503));
  const pending = loadIndustryHistories({ assets, range, cache, signal: controller.signal }).catch((error) => error);
  await jest.advanceTimersByTimeAsync(0);
  controller.abort();
  expect((await pending).name).toBe("AbortError");
  await jest.advanceTimersByTimeAsync(3000);
  expect(fetchHistory).toHaveBeenCalledTimes(2);
});

test("stale tail failure cannot mark earlier cached observations fresh", async () => {
  const cache = new MemoryMarketDataCache(); await seed(cache, assets[0], true, "2026-02-01", range.to);
  const previousTimestamp = cache.histories.get(assets[0].id)!.updatedAt;
  fetchHistory.mockImplementation(async (asset, from, to) => { if (from === "2026-09-18") throw new MarketDataError("NO_HISTORY", "tail", false); return response(asset, from, to); });
  await loadIndustryHistories({ assets: assets.slice(0, 1), range, cache });
  expect(cache.histories.get(assets[0].id)).toMatchObject({ from: range.from, updatedAt: previousTimestamp });
  fetchHistory.mockClear();
  await loadIndustryHistories({ assets: assets.slice(0, 1), range, cache });
  expect(fetchHistory.mock.calls.map((call) => call[1])).toEqual(["2026-09-18"]);
});
