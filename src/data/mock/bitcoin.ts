import type { PricePoint } from "@/types/finance";

export const bitcoinFeed = {
  symbol: "BTC",
  quoteCurrency: "USD",
  price: 108500,
  change24hPct: 2.4,
  updatedAt: "2026-09-07T12:00:00.000Z",
  source: "mock" as const,
};

export const bitcoinSeries: PricePoint[] = [
  85200, 88300, 86750, 91200, 94800, 93100, 97500, 100200, 98400, 102800, 105100, 103900, 107200,
  106100, 108500,
].map((value, index) => ({
  timestamp: new Date(Date.UTC(2026, index + 6, 1)).toISOString(),
  value,
}));
