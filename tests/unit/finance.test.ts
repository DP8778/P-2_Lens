import { calculateAllocation } from "@/lib/finance/calculateAllocation";
import { calculateContribution } from "@/lib/finance/calculateContribution";
import { calculateMaxDrawdown } from "@/lib/finance/calculateDrawdown";
import { calculateReturn } from "@/lib/finance/calculateReturn";
import { buildPortfolioMetrics } from "@/lib/finance/buildPortfolioMetrics";
import { getPerformanceSeries } from "@/data/mock/portfolio";

describe("deterministic finance layer", () => {
  test("calculates return without inventing a denominator", () => {
    expect(calculateReturn(100_000, 106_500)).toBeCloseTo(6.5);
    expect(calculateReturn(0, 10)).toBe(0);
  });
  test("calculates weighted contribution", () => {
    expect(calculateContribution(20, 10)).toBeCloseTo(2);
  });
  test("calculates allocation", () => {
    expect(calculateAllocation(25_000, 100_000)).toBe(25);
  });
  test("finds peak-to-trough drawdown", () => {
    expect(calculateMaxDrawdown([100, 120, 90, 110])).toBe(-25);
  });
  test("builds internally consistent period metrics", () => {
    const metrics = buildPortfolioMetrics("1M");
    expect(metrics.endValue - metrics.startValue).toBe(metrics.absolutePnl);
    expect(metrics.returnPct - metrics.benchmarkReturnPct).toBeCloseTo(metrics.benchmarkDeltaPct);
    expect(metrics.topContributors[0].symbol).toBe("NVDA");
  });
  test("keeps the selected timeframe consistent with chart dates", () => {
    const series = getPerformanceSeries("1M");
    const spanDays =
      (new Date(series.at(-1)!.timestamp).getTime() - new Date(series[0].timestamp).getTime()) /
      86_400_000;
    expect(spanDays).toBeCloseTo(30);
  });
});
