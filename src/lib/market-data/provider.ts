import type {
  DateRange,
  FxHistoryResult,
  FxQuote,
  HistoryResult,
  MarketAsset,
  MarketQuote,
  MarketState,
} from "./types";

export interface MarketDataProvider {
  readonly id: MarketAsset["provider"];
  searchAssets(query: string): Promise<MarketAsset[]>;
  getQuote(asset: MarketAsset): Promise<MarketQuote>;
  getQuotes(assets: MarketAsset[]): Promise<MarketQuote[]>;
  getHistory(asset: MarketAsset, range: DateRange): Promise<HistoryResult>;
  getFxRate(from: string, to: string): Promise<FxQuote>;
  getFxHistory(from: string, to: string, range: DateRange): Promise<FxHistoryResult>;
  getMarketState?(asset: MarketAsset): Promise<MarketState>;
}

