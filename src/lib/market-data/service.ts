import { marketDataConfig } from "./config";
import {
  getBrowserMarketDataCache,
  mergeFxPoints,
  mergePricePoints,
  missingHistoryRanges,
  type MarketDataCache,
} from "./cache/market-cache";
import { fetchFxHistory, fetchFxRate, fetchMarketHistory, fetchMarketQuotes } from "./client";
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

export async function loadHistory(
  asset: MarketAsset,
  range: DateRange,
  cache: MarketDataCache = getBrowserMarketDataCache(),
) {
  const cached = await cache.getHistory(asset.id);
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
    const response = await fetchMarketHistory(asset, part.from, part.to);
    points = mergePricePoints(points, response.points);
    source = "network";
  }
  const relevant = points.filter((point) => point.date >= range.from && point.date <= range.to);
  if (missing.length) {
    await cache.putHistory({
      key: asset.id,
      assetId: asset.id,
      interval: "1day",
      from: cached ? [cached.from, range.from].sort()[0] : range.from,
      to: cached ? [cached.to, range.to].sort().at(-1)! : range.to,
      points,
      updatedAt: new Date().toISOString(),
      provider: asset.provider,
      version: 1,
    });
  }
  return { asset, range, points: relevant, source } as const;
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
    const fresh = cached.filter(
      (record) => record && now - Date.parse(record.updatedAt) <= marketDataConfig.quoteFreshMs,
    );
    if (fresh.length === assets.length) return fresh.map((record) => record!.quote);
    try {
      const quotes = await fetchMarketQuotes(assets);
      await Promise.all(
        quotes.map((quote) => cache.putQuote({ key: quote.assetId, quote, updatedAt: new Date().toISOString() })),
      );
      const byId = new Map(quotes.map((quote) => [quote.assetId, quote]));
      return assets.flatMap((asset, index) => {
        const quote = byId.get(asset.id);
        if (quote) return [quote];
        const fallback = cached[index]?.quote;
        return fallback ? [{ ...fallback, freshness: "stale" as const, source: "cache" as const }] : [];
      });
    } catch (error) {
      const fallback = cached.flatMap((record) =>
        record ? [{ ...record.quote, freshness: "stale" as const, source: "cache" as const }] : [],
      );
      if (fallback.length) return fallback;
      throw error;
    }
  })().finally(() => quoteRequests.delete(key));
  quoteRequests.set(key, request);
  return request;
}
