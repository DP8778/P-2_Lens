export type AssetType = "stock" | "etf" | "crypto" | "cash";
export type Timeframe = "1D" | "1W" | "1M" | "3M" | "YTD" | "1Y" | "ALL";

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  type: AssetType;
  quoteCurrency: string;
  sector: string;
}

export interface Position {
  assetId: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
  previousPrice: number;
  marketValue: number;
  allocationPct: number;
}

export interface PricePoint {
  timestamp: string;
  value: number;
}

export interface PortfolioPerformancePoint {
  timestamp: string;
  portfolioValue: number;
  portfolioReturnPct: number;
  benchmarkReturnPct: number;
}

export interface ContributionMetric {
  symbol: string;
  name: string;
  contributionPctPoints: number;
  returnPct: number;
}

export interface PortfolioMetrics {
  startDate: string;
  endDate: string;
  startValue: number;
  endValue: number;
  absolutePnl: number;
  returnPct: number;
  benchmarkReturnPct: number;
  benchmarkDeltaPct: number;
  maxDrawdownPct: number;
  btcExposurePct: number;
  largestPositionPct: number;
  topContributors: ContributionMetric[];
  topDetractors: ContributionMetric[];
}
