import { MarketDataError } from "./errors";
import { marketDataConfig } from "./config";
import {
  getBrowserMarketDataCache,
  mergeFxPoints,
  mergePricePoints,
  missingHistoryRanges,
  type MarketDataCache,
  type HistoryCacheRecord,
} from "./cache/market-cache";
import { fetchFxHistory, fetchFxRate, fetchMarketHistory, fetchMarketQuotes, searchMarketAssets } from "./client";
import { isSameCompanyListing } from "./listing-ranking";
import type { DateRange, FxQuote, MarketAsset, MarketQuote } from "./types";

const quoteRequests = new Map<string, Promise<MarketQuote[]>>();
const fxRequests = new Map<string, Promise<FxQuote>>();

export async function loadFxQuote(
  base: string,
  quote: string,
  cache: MarketDataCache = getBrowserMarketDataCache(),
) {
  if (base === quote)
    return { base, quote, rate: 1, timestamp: new Date().toISOString(), freshness: "fresh" as const, source: "cache" as const };
  const key = `${base}:${quote}`;
  const existing = fxRequests.get(key);
  if (existing) return existing;
  const request = (async () => {
    const cached = await cache.getFxQuote(base, quote);
    if (cached && Date.now() - Date.parse(cached.updatedAt) <= marketDataConfig.fxFreshMs)
      return cached.quote;
    try {
      const result = await fetchFxRate(base, quote);
      await cache.putFxQuote({ key, quote: result, updatedAt: new Date().toISOString() });
      return result;
    } catch (error) {
      if (cached) return { ...cached.quote, freshness: "stale" as const, source: "cache" as const };
      throw error;
    }
  })().finally(() => fxRequests.delete(key));
  fxRequests.set(key, request);
  return request;
}

export async function loadQuotePreview(
  asset: MarketAsset,
  signal?: AbortSignal,
  cache: MarketDataCache = getBrowserMarketDataCache(),
) {
  const cached = await cache.getQuote(asset.id);
  if (cached && Date.now() - Date.parse(cached.updatedAt) <= marketDataConfig.quoteFreshMs)
    return cached.quote;
  try {
    const quote = (await fetchMarketQuotes([asset], signal))[0];
    if (!quote) throw new Error("Quote is unavailable.");
    await cache.putQuote({ key: asset.id, quote, updatedAt: new Date().toISOString() });
    return quote;
  } catch (error) {
    if (cached) return { ...cached.quote, freshness: "stale" as const, source: "cache" as const };
    throw error;
  }
}

export async function loadQuoteAlternative(asset: MarketAsset, signal?: AbortSignal) {
  const listings = await searchMarketAssets(asset.symbol, signal);
  for (const candidate of listings) {
    if (candidate.id === asset.id || !isSameCompanyListing(asset, candidate)) continue;
    try {
      const quote = await loadQuotePreview(candidate, signal);
      return { asset: candidate, quote };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
    }
  }
  return undefined;
}

export async function storeMarketQuote(
  quote: MarketQuote,
  cache: MarketDataCache = getBrowserMarketDataCache(),
) {
  await cache.putQuote({ key: quote.assetId, quote, updatedAt: new Date().toISOString() });
}

/** Requested ranges, not inferred trading dates, determine cache coverage. */
export function historyRefreshRanges(cached: HistoryCacheRecord | undefined, range: DateRange) {
  const ranges = missingHistoryRanges(cached?.points.length ? cached : undefined, range.from, range.to);
  if (cached?.points.length && Date.now() - Date.parse(cached.updatedAt) > marketDataConfig.historyFreshMs) {
    const tail = new Date(Date.parse(`${range.to}T12:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10);
    ranges.push({ from: tail < range.from ? range.from : tail, to: range.to });
  }
  const merged: { from: string; to: string }[] = [];
  for (const part of ranges.sort((a, b) => a.from.localeCompare(b.from))) {
    const previous = merged.at(-1);
    if (previous && part.from <= previous.to) previous.to = previous.to > part.to ? previous.to : part.to;
    else merged.push({ ...part });
  }
  return merged;
}

type LoadedHistory = { asset: MarketAsset; range: DateRange; points: import("./types").MarketPricePoint[]; source: "network" | "cache" };
type HistoryRequest = { controller: AbortController; promise: Promise<LoadedHistory>; consumers: number };
const historyRequests = new WeakMap<MarketDataCache, Map<string, HistoryRequest>>();

/** Single flight per cache/asset/range; cancel transport only after the last reader leaves. */
export function loadHistory(asset: MarketAsset, range: DateRange, cache: MarketDataCache = getBrowserMarketDataCache(), signal?: AbortSignal): Promise<LoadedHistory> {
  if (signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  let requests = historyRequests.get(cache);
  if (!requests) { requests = new Map(); historyRequests.set(cache, requests); }
  const key = `${asset.id}:${range.interval}:${range.from}:${range.to}`;
  let request = requests.get(key);
  if (!request) {
    const controller = new AbortController();
    const entry: HistoryRequest = { controller, consumers: 0, promise: undefined! };
    entry.promise = refreshHistory(asset, range, cache, controller.signal).finally(() => {
      if (requests.get(key) === entry) requests.delete(key);
    });
    requests.set(key, entry);
    request = entry;
  }
  const shared = request;
  shared.consumers++;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return false;
      settled = true;
      signal?.removeEventListener("abort", abort);
      shared.consumers--;
      return true;
    };
    const abort = () => {
      if (!finish()) return;
      if (shared.consumers === 0) {
        if (requests.get(key) === shared) requests.delete(key);
        shared.controller.abort();
      }
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    shared.promise.then((result) => { if (finish()) resolve(result); }, (error) => { if (finish()) reject(error); });
  });
}

async function refreshHistory(asset: MarketAsset, range: DateRange, cache: MarketDataCache, signal: AbortSignal): Promise<LoadedHistory> {
  let cached = await cache.getHistory(asset.id);
  signal.throwIfAborted();
  const missing = historyRefreshRanges(cached, range);
  let points = cached?.points ?? [];
  let source: "network" | "cache" = "cache";
  for (const [index, part] of missing.entries()) {
    signal.throwIfAborted();
    const response = await fetchMarketHistory(asset, part.from, part.to, signal);
    signal.throwIfAborted();
    if (!response.points.length) throw new MarketDataError("NO_HISTORY", "Historie není dostupná.", false, 404);
    // Re-read before merging: another range may have completed while this request was in flight.
    cached = await cache.getHistory(asset.id);
    points = mergePricePoints(cached?.points ?? points, response.points);
    source = "network";
    await cache.putHistory({
      key: asset.id, assetId: asset.id, interval: "1day",
      from: cached ? [cached.from, part.from].sort()[0] : part.from,
      to: cached ? [cached.to, part.to].sort().at(-1)! : part.to,
      points, updatedAt: index === missing.length - 1 ? new Date().toISOString() : cached?.updatedAt ?? new Date().toISOString(), provider: asset.provider, version: 1,
    });
    // Persist each successful extension even if a later part fails.
  }
  return { asset, range, points: points.filter((point) => point.date >= range.from && point.date <= range.to), source };
}

export async function loadFxHistory(
  base: string,
  quote: string,
  range: DateRange,
  cache: MarketDataCache = getBrowserMarketDataCache(),
) {
  if (base === quote)
    return {
      base,
      quote,
      range,
      points: [{ base, quote, date: range.from, rate: 1 }],
      source: "cache" as const,
    };
  const cached = await cache.getFxHistory(base, quote);
  const staleTail =
    cached &&
    Date.now() - Date.parse(cached.updatedAt) > marketDataConfig.historyFreshMs &&
    range.to >= new Date().toISOString().slice(0, 10)
      ? [{ from: new Date(Date.parse(`${range.to}T12:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10), to: range.to }]
      : [];
  const missing = [...missingHistoryRanges(cached, range.from, range.to), ...staleTail];
  let points = cached?.points ?? [];
  let source: "network" | "cache" = "cache";
  for (const part of missing) {
    const response = await fetchFxHistory(base, quote, part.from, part.to);
    points = mergeFxPoints(points, response.points);
    source = "network";
  }
  if (missing.length) {
    await cache.putFxHistory({
      key: `${base}:${quote}`,
      base,
      quote,
      from: cached ? [cached.from, range.from].sort()[0] : range.from,
      to: cached ? [cached.to, range.to].sort().at(-1)! : range.to,
      points,
      updatedAt: new Date().toISOString(),
      provider: "twelvedata",
      version: 1,
    });
  }
  return {
    base,
    quote,
    range,
    points: points.filter((point) => point.date >= range.from && point.date <= range.to),
    source,
  } as const;
}

export async function loadQuotes(
  assets: MarketAsset[],
  cache: MarketDataCache = getBrowserMarketDataCache(),
) {
  if (!assets.length) return [];
  const key = assets.map((asset) => asset.id).sort().join("|");
  const existing = quoteRequests.get(key);
  if (existing) return existing;
  const request = (async () => {
    const cached = await Promise.all(assets.map((asset) => cache.getQuote(asset.id)));
    const now = Date.now();
    const isFresh = cached.map(
      (record) => !!record && now - Date.parse(record.updatedAt) <= marketDataConfig.quoteFreshMs,
    );
    const missing = assets.filter((_, index) => !isFresh[index]);
    const byId = new Map<string, MarketQuote>();
    cached.forEach((record, index) => {
      if (record) byId.set(assets[index].id, isFresh[index]
        ? record.quote
        : { ...record.quote, freshness: "stale", source: "cache" });
    });
    if (missing.length) {
      try {
        const quotes = await fetchMarketQuotes(missing);
        quotes.forEach((quote) => byId.set(quote.assetId, quote));
        await Promise.all(
          quotes.map((quote) => cache.putQuote({ key: quote.assetId, quote, updatedAt: new Date().toISOString() })),
        );
      } catch (error) {
        if (!byId.size) throw error;
        // Keep every available quote, including stale fallbacks, if refresh fails.
      }
    }
    return assets.flatMap((asset) => {
      const quote = byId.get(asset.id);
      return quote ? [quote] : [];
    });
  })().finally(() => quoteRequests.delete(key));
  quoteRequests.set(key, request);
  return request;
}
