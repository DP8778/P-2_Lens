import {
  buildAnalysis,
  initialHoldings,
  timeframeRange,
  saveHolding,
  positionPreview,
  positionSchema,
  mockFx,
  toUsd,
} from "@/lib/finance/portfolio-engine";
import type { Timeframe } from "@/types/finance";
describe("unified portfolio calculations", () => {
  test.each<Timeframe>(["1W", "1M", "3M", "YTD", "1Y", "ALL"])(
    "reconciles chart, holdings, contributions and benchmark for %s",
    (timeframe) => {
      const a = buildAnalysis(initialHoldings, timeframeRange(timeframe), "spy", "btc");
      expect(a.holdings.reduce((sum, p) => sum + p.marketValue, 0)).toBeCloseTo(
        a.metrics.endValue,
        7,
      );
      expect(a.holdings.reduce((sum, p) => sum + p.allocationPct, 0)).toBeCloseTo(100, 10);
      expect(a.holdings.reduce((sum, p) => sum + p.contributionPctPoints, 0)).toBeCloseTo(
        a.metrics.returnPct,
        10,
      );
      expect(a.points.at(-1)!.benchmarkReturnPct).toBe(a.metrics.benchmarkReturnPct);
      expect(a.metrics.maxDrawdownPct).toBe(Math.min(...a.points.map((p) => p.drawdown)));
      expect(a.points[0].portfolioIndex).toBe(100);
      expect(a.points[0].benchmarkIndex).toBe(100);
      expect(a.points[0].assetIndex).toBe(100);
      expect(a.points[0].portfolioReturnPct).toBe(0);
    },
  );
  test("uses calendar YTD and rebases a custom range", () => {
    const ytd = buildAnalysis(initialHoldings, timeframeRange("YTD"));
    expect(ytd.metrics.startDate.slice(0, 10)).toBe("2026-01-01");
    const a = buildAnalysis(initialHoldings, [400, 510], "qqq", "aapl");
    expect(a.points).toHaveLength(111);
    expect(a.points[0].portfolioIndex).toBe(100);
    expect(a.points[0].assetIndex).toBe(100);
    expect(a.metrics.benchmarkReturnPct).not.toBe(
      buildAnalysis(initialHoldings, [400, 510], "spy").metrics.benchmarkReturnPct,
    );
  });
  test("add, merge, edit and removal change the same valuation", () => {
    const added = { assetId: "eth", quantity: 2, averageCost: 3000, fees: 10, date: "2026-09-01" };
    const rows = saveHolding(initialHoldings, added);
    const before = buildAnalysis(initialHoldings, timeframeRange("1M"));
    const after = buildAnalysis(rows, timeframeRange("1M"));
    expect(after.metrics.endValue - before.metrics.endValue).toBeCloseTo(
      positionPreview(added, initialHoldings).value,
      7,
    );
    const merged = saveHolding(rows, { ...added, quantity: 1, averageCost: 4500, fees: 5 });
    const eth = merged.find((p) => p.assetId === "eth")!;
    expect(eth.quantity).toBe(3);
    expect(eth.averageCost).toBe(3500);
    expect(eth.fees).toBe(15);
    expect(merged.filter((p) => p.assetId === "eth")).toHaveLength(1);
    const edited = saveHolding(merged, { ...added, quantity: 4 }, true);
    expect(edited.find((p) => p.assetId === "eth")!.quantity).toBe(4);
    const removed = edited.filter((p) => p.assetId !== "eth");
    expect(buildAnalysis(removed, timeframeRange("1M")).metrics.endValue).toBe(
      before.metrics.endValue,
    );
  });
  test("fees affect cost basis and the preview includes an existing holding", () => {
    const added = {
      assetId: "btc",
      quantity: 0.1,
      averageCost: 100000,
      fees: 20,
      date: "2026-09-01",
    };
    const rows = saveHolding(initialHoldings, added);
    const a = buildAnalysis(rows, timeframeRange("1M"));
    const btc = a.holdings.find((p) => p.assetId === "btc")!;
    expect(positionPreview(added, initialHoldings).allocation).toBeCloseTo(btc.allocationPct);
    expect(btc.pnl).toBeCloseTo(
      btc.marketValue - (btc.quantity * btc.averageCost + btc.fees) * mockFx.USD,
    );
    expect(toUsd(2240, "CZK")).toBeCloseTo(100);
  });
  test("rejects invalid input and handles an empty portfolio without NaN", () => {
    const row = initialHoldings[0];
    for (const changed of [
      { quantity: -1 },
      { quantity: Infinity },
      { averageCost: 0 },
      { fees: -1 },
      { date: "2027-01-01" },
      { assetId: "unknown" },
    ])
      expect(positionSchema.safeParse({ ...row, ...changed }).success).toBe(false);
    const empty = buildAnalysis([], [700, 730]);
    expect(empty.metrics.endValue).toBe(0);
    expect(empty.metrics.returnPct).toBe(0);
    expect(empty.metrics.maxDrawdownPct).toBe(0);
    expect(JSON.stringify(empty)).not.toMatch(/NaN|Infinity/);
  });
});
