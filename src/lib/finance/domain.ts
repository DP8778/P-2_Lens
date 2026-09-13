export type Currency = "CZK" | "USD" | "EUR";
export type AssetType = "stock" | "etf" | "crypto" | "cash";
export type TimeRange = "1W" | "1M" | "3M" | "YTD" | "1Y" | "ALL";

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  type: AssetType;
  currency: Currency;
  quoteCurrency: Currency;
  sector: string;
  exchange?: string;
}

interface TransactionBase {
  id: string;
  occurredAt: string;
  currency: Currency;
  fee: number;
}

export type Transaction =
  | (TransactionBase & {
      type: "buy";
      assetId: string;
      quantity: number;
      unitPrice: number;
    })
  | (TransactionBase & {
      type: "sell";
      assetId: string;
      quantity: number;
      unitPrice: number;
    })
  | (TransactionBase & {
      type: "deposit";
      amount: number;
    })
  | (TransactionBase & {
      type: "withdrawal";
      amount: number;
    });

export interface PricePoint {
  assetId: string;
  date: string;
  close: number;
  currency: Currency;
}

export interface FxRate {
  date: string;
  currency: Currency;
  czkPerUnit: number;
}

export interface Benchmark {
  id: string;
  name: string;
  symbol: string;
  assetId: string;
  currency: Currency;
}

/** Odvozená pozice. averageCost je v měně aktiva, totalCostCzk v základní měně. */
export interface Holding {
  assetId: string;
  quantity: number;
  averageCost: number;
  totalCostCzk: number;
  fees: number;
  date: string;
}

export interface PortfolioSnapshot {
  asOf: string;
  baseCurrency: "CZK";
  holdings: Holding[];
  totalValue: number;
  missingPriceAssetIds: string[];
}

export interface PortfolioDataset {
  version: string;
  asOf: string;
  baseCurrency: "CZK";
  assets: Asset[];
  transactions: Transaction[];
  prices: PricePoint[];
  benchmarks: Benchmark[];
  fxRates: FxRate[];
}
