import { MarketDataError, type MarketDataErrorCode } from "./errors";
import type {
  FxHistoryResult,
  FxQuote,
  HistoryResult,
  MarketAsset,
  MarketQuote,
} from "./types";

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: { code?: MarketDataErrorCode; message?: string; retryable?: boolean };
  };
  if (!response.ok)
    throw new MarketDataError(
      body.error?.code ?? "UNAVAILABLE",
      body.error?.message ?? "Market data nejsou dostupná.",
      body.error?.retryable ?? response.status >= 500,
      response.status,
    );
  return body;
}

export async function searchMarketAssets(query: string, signal?: AbortSignal) {
  const response = await fetchJson<{ assets: MarketAsset[] }>(
    `/api/market/search?q=${encodeURIComponent(query)}`,
    { signal },
  );
  return response.assets;
}

export async function fetchMarketQuotes(assets: MarketAsset[], signal?: AbortSignal) {
  const response = await fetchJson<{ quotes: MarketQuote[] }>("/api/market/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assets }),
    signal,
  });
  return response.quotes;
}

export function fetchMarketHistory(asset: MarketAsset, from: string, to: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ asset: JSON.stringify(asset), from, to, interval: "1day" });
  return fetchJson<HistoryResult>(`/api/market/history?${query}`, { signal });
}

export function fetchFxRate(from: string, to: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ from, to });
  return fetchJson<FxQuote>(`/api/market/fx?${query}`, { signal });
}

export function fetchFxHistory(from: string, to: string, start: string, end: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ from, to, start, end });
  return fetchJson<FxHistoryResult>(`/api/market/fx?${query}`, { signal });
}

export function fetchMarketStatus(signal?: AbortSignal) {
  return fetchJson<{ provider: string; configured: boolean }>("/api/market/status", { signal });
}

