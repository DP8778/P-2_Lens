import type { AssetType } from "@/lib/finance/domain";

export type MarketDataProviderId = "twelvedata" | "mock" | "demo";
export type MarketFreshness = "fresh" | "stale" | "lastClose" | "unavailable";
export type MarketState = "open" | "closed" | "unknown";

export interface MarketAsset {
  id: string;
  provider: MarketDataProviderId;
  providerSymbol: string;
  symbol: string;
  name: string;
  type: AssetType;
  exchange: string;
  micCode?: string;
  currency: string;
  country?: string;
  timezone?: string;
}

export interface MarketQuote {
  assetId: string;
  price: number;
  currency: string;
  change?: number;
  changePercent?: number;
  timestamp: string;
  marketState: MarketState;
  freshness: MarketFreshness;
  source: "network" | "cache";
}

export interface MarketPricePoint {
  assetId: string;
  date: string;
  close: number;
  currency: string;
  adjustedForSplits: boolean;
}

/** Kolik jednotek quote měny stojí jedna jednotka base měny. */
export interface FxQuote {
  base: string;
  quote: string;
  rate: number;
  timestamp: string;
  freshness: MarketFreshness;
  source: "network" | "cache";
}

export interface FxRatePoint {
  base: string;
  quote: string;
  date: string;
  rate: number;
}

export interface DateRange {
  from: string;
  to: string;
  interval: "1day";
}

export interface HistoryResult {
  asset: MarketAsset;
  range: DateRange;
  points: MarketPricePoint[];
  source: "network" | "cache";
}

export interface FxHistoryResult {
  base: string;
  quote: string;
  range: DateRange;
  points: FxRatePoint[];
  source: "network" | "cache";
}

export const marketAssetIdentity = (
  provider: MarketDataProviderId,
  symbol: string,
  micCode?: string,
  exchange?: string,
) =>
  [provider, (micCode || exchange || "UNKNOWN").toUpperCase(), symbol.toUpperCase()].join(":");

