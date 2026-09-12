import { getContributions, getPerformanceSeries, timeframeConfig } from "@/data/mock/portfolio";
import type { PortfolioMetrics, Timeframe } from "@/types/finance";
import { calculateMaxDrawdown } from "./calculateDrawdown";
import { calculateReturn } from "./calculateReturn";

export function buildPortfolioMetrics(timeframe: Timeframe): PortfolioMetrics {
  const config = timeframeConfig[timeframe];
  const series = getPerformanceSeries(timeframe);
  const contributions = getContributions(timeframe);
  const returnPct = calculateReturn(config.start, config.end);
  const sorted = [...contributions].sort(
    (a, b) => b.contributionPctPoints - a.contributionPctPoints,
  );
  return {
    startDate: series[0].timestamp,
    endDate: series.at(-1)!.timestamp,
    startValue: config.start,
    endValue: config.end,
    absolutePnl: config.end - config.start,
    returnPct,
    benchmarkReturnPct: config.benchmark,
    benchmarkDeltaPct: returnPct - config.benchmark,
    maxDrawdownPct: Math.min(
      config.drawdown,
      calculateMaxDrawdown(series.map((p) => p.portfolioValue)),
    ),
    btcExposurePct: 18.4,
    largestPositionPct: 28,
    topContributors: sorted.filter((item) => item.contributionPctPoints > 0).slice(0, 3),
    topDetractors: sorted
      .filter((item) => item.contributionPctPoints < 0)
      .reverse()
      .slice(0, 3),
  };
}
