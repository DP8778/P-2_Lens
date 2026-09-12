import type { InsightInput } from "@/lib/validation/insightSchemas";
import type { PortfolioMetrics, Timeframe } from "@/types/finance";

export function buildInsightInput(metrics: PortfolioMetrics, timeframe: Timeframe): InsightInput {
  return {
    period: { from: metrics.startDate, to: metrics.endDate, label: timeframe },
    portfolio: {
      startValue: metrics.startValue,
      endValue: metrics.endValue,
      absolutePnl: metrics.absolutePnl,
      returnPct: metrics.returnPct,
    },
    benchmark: {
      name: "Demo benchmark",
      returnPct: metrics.benchmarkReturnPct,
      deltaPct: metrics.benchmarkDeltaPct,
    },
    risk: { maxDrawdownPct: metrics.maxDrawdownPct },
    exposure: { btcPct: metrics.btcExposurePct, largestPositionPct: metrics.largestPositionPct },
    contributors: metrics.topContributors.slice(0, 5).map(({ symbol, contributionPctPoints }) => ({
      symbol,
      contributionPctPoints,
    })),
    detractors: metrics.topDetractors.slice(0, 5).map(({ symbol, contributionPctPoints }) => ({
      symbol,
      contributionPctPoints,
    })),
    dataQuality: { source: "mock", estimated: true },
  };
}
