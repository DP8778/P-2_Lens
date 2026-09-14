import type { MarketDataProvider } from "../provider";
import { MarketDataError } from "../errors";
import { marketAssetIdentity, type DateRange, type MarketAsset } from "../types";

const assets: MarketAsset[] = [
  ["AAPL", "Apple Inc.", "Common Stock", "NASDAQ", "XNAS", "USD"],
  ["NVDA", "NVIDIA Corporation", "Common Stock", "NASDAQ", "XNAS", "USD"],
  ["SPY", "SPDR S&P 500 ETF Trust", "ETF", "NYSE Arca", "ARCX", "USD"],
  ["VWCE", "Vanguard FTSE All-World UCITS ETF", "ETF", "Xetra", "XETR", "EUR"],
  ["VUSA", "Vanguard S&P 500 UCITS ETF", "ETF", "London Stock Exchange", "XLON", "GBP"],
].map(([symbol, name, providerType, exchange, micCode, currency]) => ({
  id: marketAssetIdentity("mock", symbol, micCode, exchange),
  provider: "mock",
  providerSymbol: symbol,
  symbol,
  name,
  type: providerType === "ETF" ? "etf" : "stock",
  exchange,
  micCode,
  currency,
}));

const day = 86_400_000;
const dates = (range: DateRange) => {
  const values: string[] = [];
  for (let time = Date.parse(`${range.from}T00:00:00Z`); time <= Date.parse(`${range.to}T00:00:00Z`); time += day) {
    const date = new Date(time);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) values.push(date.toISOString().slice(0, 10));
  }
  return values;
};

export class MockMarketDataProvider implements MarketDataProvider {
  readonly id = "mock" as const;
  quoteBump = 0;
  failWith?: MarketDataError;
  async searchAssets(query: string) {
    if (this.failWith) throw this.failWith;
    const needle = query.toLowerCase();
    return assets.filter((asset) => `${asset.symbol} ${asset.name}`.toLowerCase().includes(needle));
  }
  async getQuote(asset: MarketAsset) {
    if (this.failWith) throw this.failWith;
    const base = asset.currency === "EUR" ? 110 : asset.symbol === "AAPL" ? 200 : 100;
    return {
      assetId: asset.id,
      price: base + this.quoteBump,
      currency: asset.currency,
      timestamp: "2026-09-14T16:00:00.000Z",
      marketState: "closed" as const,
      freshness: "lastClose" as const,
      source: "network" as const,
    };
  }
  getQuotes(input: MarketAsset[]) {
    return Promise.all(input.map((asset) => this.getQuote(asset)));
  }
  async getHistory(asset: MarketAsset, range: DateRange) {
    const points = dates(range).map((date, index) => ({
      assetId: asset.id,
      date,
      close: 90 + index * 0.4,
      currency: asset.currency,
      adjustedForSplits: true,
    }));
    return { asset, range, points, source: "network" as const };
  }
  async getFxRate(from: string, to: string) {
    const rate = from === to ? 1 : from === "EUR" && to === "CZK" ? 25 : from === "GBP" ? 29 : 22.5;
    return { base: from, quote: to, rate, timestamp: "2026-09-14T16:00:00.000Z", freshness: "fresh" as const, source: "network" as const };
  }
  async getFxHistory(from: string, to: string, range: DateRange) {
    const current = await this.getFxRate(from, to);
    return {
      base: from,
      quote: to,
      range,
      points: dates(range).map((date, index) => ({ base: from, quote: to, date, rate: current.rate + index * 0.002 })),
      source: "network" as const,
    };
  }
}

export const mockMarketAssets = assets;

