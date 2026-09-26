import { marketDataConfig } from "./config";
import {
  getBrowserMarketDataCache,
  mergeFxPoints,
  mergePricePoints,
  missingHistoryRanges,
  type MarketDataCache,
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
      } catch {
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
