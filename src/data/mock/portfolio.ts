import type { ContributionMetric, PortfolioPerformancePoint, Timeframe } from "@/types/finance";
import { buildAnalysis, initialTransactions, timeframeRange } from "@/lib/finance/portfolio-engine";

const analysisFor = (timeframe: Timeframe) =>
  buildAnalysis(initialTransactions, timeframeRange(timeframe));

export function getPerformanceSeries(timeframe: Timeframe): PortfolioPerformancePoint[] {
  return analysisFor(timeframe).points.map((point) => ({
    timestamp: point.timestamp,
    portfolioValue: point.portfolioValue,
    portfolioReturnPct: point.portfolioReturnPct,
    benchmarkReturnPct: point.benchmarkReturnPct,
  }));
}

export function getContributions(timeframe: Timeframe): ContributionMetric[] {
  const analysis = analysisFor(timeframe);
  return [...analysis.metrics.topContributors, ...analysis.metrics.topDetractors];
}

export const timeframeConfig = Object.fromEntries(
  (["1W", "1M", "3M", "YTD", "1Y", "ALL"] as Timeframe[]).map((timeframe) => {
    const metrics = analysisFor(timeframe).metrics;
    return [
      timeframe,
      {
        days: timeframeRange(timeframe)[1] - timeframeRange(timeframe)[0] + 1,
        start: metrics.startValue,
        end: metrics.endValue,
        benchmark: metrics.benchmarkReturnPct,
        drawdown: metrics.maxDrawdownPct,
      },
    ];
  }),
) as Record<
  Timeframe,
  { days: number; start: number; end: number; benchmark: number; drawdown: number }
>;
