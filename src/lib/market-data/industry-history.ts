import { getBrowserMarketDataCache, type MarketDataCache } from "./cache/market-cache";
import { marketDataConfig } from "./config";
import { MarketDataError } from "./errors";
import { historyRefreshRanges, loadHistory } from "./service";
import type { DateRange, MarketAsset, MarketPricePoint } from "./types";

export type IndustryHistoryProgress = {
  total: number; ready: number; loading: number; failed: number; done: boolean;
  histories: Map<string, MarketPricePoint[]>; stale: Set<string>;
};

// Shared across industry changes. Retries occupy a slot, so a provider outage cannot
// drain the pending queue into a burst. A rate-limit cooldown applies to all workers.
const concurrency = 2;
const maximumAttempts = 3;
let active = 0;
let blockedUntil = 0;
type Task = { signal: AbortSignal; run: () => Promise<void>; resolve: () => void; reject: (error: unknown) => void; abort: () => void };
const queue: Task[] = [];
const aborted = () => new DOMException("Aborted", "AbortError");
function pump() {
  while (active < concurrency && queue.length) {
    const task = queue.shift()!;
    task.signal.removeEventListener("abort", task.abort);
    if (task.signal.aborted) { task.reject(aborted()); continue; }
    active++;
    void task.run().then(task.resolve, task.reject).finally(() => { active--; pump(); });
  }
}
function enqueue(run: () => Promise<void>, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(aborted()); return; }
    const task: Task = { signal, run, resolve, reject, abort: () => {
      const index = queue.indexOf(task);
      if (index !== -1) queue.splice(index, 1);
      reject(aborted());
    } };
    signal.addEventListener("abort", task.abort, { once: true });
    queue.push(task);
    pump();
  });
}
function delay(ms: number, signal: AbortSignal) {
  if (signal.aborted) return Promise.reject(aborted());
  if (ms <= 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal.removeEventListener("abort", abort); reject(aborted()); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}

/** Cache-first acquisition; ready counts nonempty histories, not analytical eligibility.
 * The finance layer independently checks coverage for the selected period. */
export async function loadIndustryHistories({ assets, range, cache = getBrowserMarketDataCache(), signal = new AbortController().signal, onProgress }: {
  assets: MarketAsset[]; range: DateRange; cache?: MarketDataCache; signal?: AbortSignal;
  onProgress?: (progress: IndustryHistoryProgress) => void;
}): Promise<IndustryHistoryProgress> {
  const unique = [...new Map(assets.map((asset) => [asset.id, asset])).values()];
  const histories = new Map<string, MarketPricePoint[]>();
  let publishedHistories: Map<string, MarketPricePoint[]> | undefined;
  const storeHistory = (id: string, points: MarketPricePoint[]) => { histories.set(id, points); publishedHistories = undefined; };
  const stale = new Set<string>();
  const failures = new Set<string>();
  let loading = 0;
  let done = false;
  const snapshot = (): IndustryHistoryProgress => ({ total: unique.length, ready: histories.size, loading, failed: failures.size, done, histories: publishedHistories ??= new Map(histories), stale: new Set(stale) });
  const emit = () => { if (!signal.aborted) onProgress?.(snapshot()); };
  const pending: MarketAsset[] = [];
  // Read every cache entry before queueing network work. Cached constituents become
  // visible immediately, even while uncached ones are waiting for provider capacity.
  for (const asset of unique) {
    signal.throwIfAborted();
    const record = await cache.getHistory(asset.id).catch(() => undefined);
    signal.throwIfAborted();
    const points = record?.points.filter((point) => point.date >= range.from && point.date <= range.to) ?? [];
    if (points.length) storeHistory(asset.id, points);
    const needsRefresh = !points.length || historyRefreshRanges(record, range).length > 0;
    if (points.length && (needsRefresh || (record && Date.now() - Date.parse(record.updatedAt) > marketDataConfig.historyFreshMs))) stale.add(asset.id);
    if (needsRefresh) pending.push(asset);
  }
  emit();
  await Promise.allSettled(pending.map((asset) => enqueue(async () => {
    loading++; emit();
    try {
      for (let attempt = 0; attempt < maximumAttempts; attempt++) {
        // Recheck after waiting: another worker may have extended the shared cooldown.
        while (blockedUntil > Date.now()) await delay(blockedUntil - Date.now(), signal);
        signal.throwIfAborted();
        try {
          const result = await loadHistory(asset, range, cache, signal);
          if (result.points.length) storeHistory(asset.id, result.points);
          stale.delete(asset.id);
          break;
        } catch (error) {
          if (signal.aborted) throw aborted();
          const retryable = error instanceof MarketDataError && error.retryable;
          if (retryable && error.code === "RATE_LIMIT") blockedUntil = Math.max(blockedUntil, Date.now() + 65_000 * 2 ** Math.min(attempt, 1));
          if (!retryable || attempt === maximumAttempts - 1) throw error;
          if (error.code !== "RATE_LIMIT") await delay(1_000 * 2 ** attempt, signal);
        }
      }
    } catch {
      if (!signal.aborted) {
        failures.add(asset.id);
        // A successful range extension may have been persisted before a later failure.
        const record = await cache.getHistory(asset.id).catch(() => undefined);
        const points = record?.points.filter((point) => point.date >= range.from && point.date <= range.to) ?? [];
        if (points.length) { storeHistory(asset.id, points); stale.add(asset.id); }
      }
    } finally { loading--; emit(); }
  }, signal)));
  signal.throwIfAborted();
  done = true;
  emit();
  return snapshot();
}
