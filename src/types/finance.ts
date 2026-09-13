import type { Asset as DomainAsset, AssetType, TimeRange } from "@/lib/finance/domain";

export type { AssetType };
export type Timeframe = TimeRange;

export type Asset = DomainAsset;

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
