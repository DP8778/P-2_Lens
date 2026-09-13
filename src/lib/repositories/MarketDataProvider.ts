import type { PricePoint } from "@/types/finance";

export interface BitcoinQuote {
  symbol: string;
  quoteCurrency: string;
  price: number;
  change24hPct: number;
  updatedAt: string;
  source: "mock" | "live";
}

export interface MarketDataProvider {
  getBitcoinQuote(): Promise<BitcoinQuote>;
  getBitcoinSeries(): Promise<PricePoint[]>;
}
