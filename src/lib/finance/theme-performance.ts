import type { DateRange, MarketAsset, MarketPricePoint } from "@/lib/market-data/types";

export const themeTimeframes = ["1W", "1M", "3M", "1Y"] as const;
export type ThemeTimeframe = (typeof themeTimeframes)[number];
const day = 86_400_000;
const days: Record<ThemeTimeframe, number> = { "1W": 7, "1M": 30, "3M": 90, "1Y": 365 };

export function themeHistoryRange(timeframe: ThemeTimeframe, now = new Date()): DateRange {
  // Daily closes only: exclude the unfinished current UTC day.
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - day;
  return { from: new Date(end - days[timeframe] * day).toISOString().slice(0, 10), to: new Date(end).toISOString().slice(0, 10), interval: "1day" };
}

/** Fixed equal starting weights; price return, no dividends, FX or daily rebalancing. */
export function buildThemePerformance(
  assets: MarketAsset[],
  histories: Map<string, MarketPricePoint[]>,
  range: DateRange,
) {
  const series = assets.map((asset) => (histories.get(asset.id) ?? [])
    .filter((point) => point.date >= range.from && point.date <= range.to)
    .sort((a, b) => a.date.localeCompare(b.date)));
  const dates = [...new Set(series.flatMap((points) => points.map((point) => point.date)))].sort();
  const valid = series.map((points, index) => points.length >= 2 && points.every((point) =>
    point.assetId === assets[index].id && point.currency === assets[index].currency && Number.isFinite(point.close) && point.close > 0,
  ) && new Set(points.map((point) => point.date)).size === points.length);
  const coverage = valid.filter(Boolean).length;
  // Never shrink to an intersection or fill gaps: every constituent must cover every date.
  // Four calendar days allow ordinary weekends/holiday closures at the range boundaries.
  const complete = assets.length > 0 && coverage === assets.length && dates.length >= 2
    && series.every((points) => points.length === dates.length && points.every((point, index) => point.date === dates[index]))
    && dates.every((date, index) => index === 0 || Date.parse(date) - Date.parse(dates[index - 1]) <= 4 * day)
    && Date.parse(dates[0]) - Date.parse(range.from) <= 4 * day
    && Date.parse(range.to) - Date.parse(dates.at(-1)!) <= 4 * day;
  if (!complete) return { status: "partial" as const, coverage, total: assets.length };

  const points = dates.map((date, index) => ({
    date,
    value: series.reduce((sum, prices) => sum + prices[index].close / prices[0].close * 100, 0) / assets.length,
  }));
  const ranked = assets.map((asset, index) => ({ asset, returnPct: (series[index].at(-1)!.close / series[index][0].close - 1) * 100 }))
    .sort((a, b) => b.returnPct - a.returnPct || a.asset.symbol.localeCompare(b.asset.symbol));
  return {
    status: "complete" as const, coverage, total: assets.length, points,
    returnPct: points.at(-1)!.value - 100,
    positive: ranked.filter((item) => item.returnPct > 0).length,
    leaders: ranked.slice(0, 2), laggards: ranked.slice(-2).reverse(),
  };
}
