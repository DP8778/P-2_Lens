import {
  alignSeriesByDate,
  buildHeroChartSeries,
  formatChartAxisTick,
  mapClientXToPointIndex,
  mapDateToPointIndex,
  mapSelectedRangeToIndices,
  mapTransactionsToAnnotations,
  resolveChartScale,
} from "@/lib/chart/chart-series";
import {
  buildAnalysis,
  initialTransactions,
  timeframeRange,
  timeline,
} from "@/lib/finance/portfolio-engine";

describe("transformace Portfolio Hero Chart", () => {
  test("mapuje všechna podporovaná období na společnou timeline", () => {
    expect(timeframeRange("1W")).toEqual([723, 730]);
    expect(timeframeRange("1M")).toEqual([700, 730]);
    expect(timeframeRange("3M")).toEqual([640, 730]);
    expect(timeframeRange("1Y")).toEqual([365, 730]);
    expect(timeframeRange("ALL")).toEqual([0, 730]);
    expect(timeline[timeframeRange("YTD")[0]].slice(0, 10)).toBe("2026-01-01");
  });

  test("asset comparison vynutí normalizovanou škálu se základem 100", () => {
    const analysis = buildAnalysis(initialTransactions, timeframeRange("1M"), "spy", "btc");
    const series = buildHeroChartSeries(analysis, "value", true, "btc");
    expect(resolveChartScale("value", "btc", true)).toBe("performance");
    expect(series[0]).toMatchObject({ portfolio: 100, benchmark: 100, compareAsset: 100 });
    expect(series.at(-1)!.portfolio).toBeCloseTo(100 + analysis.metrics.returnPct);
  });

  test("benchmark v hodnotovém režimu používá index 100, ne zdánlivou CZK hodnotu", () => {
    const analysis = buildAnalysis(initialTransactions, timeframeRange("1M"), "spy");
    const series = buildHeroChartSeries(analysis, "value", true);
    expect(resolveChartScale("value", undefined, true)).toBe("performance");
    expect(series[0]).toMatchObject({ portfolio: 100, benchmark: 100 });
  });

  test("zachová chybějící datum sekundární řady jako null", () => {
    expect(
      alignSeriesByDate(
        [
          { date: "2026-09-01", value: 100 },
          { date: "2026-09-02", value: 102 },
        ],
        [{ date: "2026-09-02", value: 99 }],
      ),
    ).toEqual([
      { date: "2026-09-01", primary: 100, secondary: null },
      { date: "2026-09-02", primary: 102, secondary: 99 },
    ]);
  });

  test("mapuje datum a pointer na nejbližší datový bod", () => {
    const points = [
      { timestamp: timeline[700] },
      { timestamp: timeline[701] },
      { timestamp: timeline[702] },
    ];
    expect(mapDateToPointIndex(points, timeline[701])).toBe(1);
    expect(mapDateToPointIndex(points, "2026-08-09T18:00:00.000Z")).toBe(1);
    expect(mapClientXToPointIndex(500, 0, 1000, 11, 0, 0)).toBe(5);
  });

  test("mapuje selectedRange a transakce do viditelného grafu", () => {
    const dates = timeline.slice(0, 31);
    expect(mapSelectedRangeToIndices([dates[5], dates[20]], dates)).toEqual([5, 20]);
    const analysis = buildAnalysis(initialTransactions, timeframeRange("ALL"));
    const events = mapTransactionsToAnnotations(initialTransactions, analysis.points);
    expect(events.some((event) => event.type === "buy" && event.assetId === "btc")).toBe(true);
    expect(events.some((event) => event.type === "sell" && event.assetId === "nvda")).toBe(true);
  });

  test("formátuje osu podle hodnotové a performance škály", () => {
    expect(formatChartAxisTick(1_250_000, "value", "cs-CZ")).toMatch(/mil/);
    expect(formatChartAxisTick(106.45, "performance", "cs-CZ")).toBe("106,5");
  });
});
