import type { DateRange, MarketAsset, MarketPricePoint } from "@/lib/market-data/types";
import { buildThemePerformance } from "./theme-performance";

export type IndustryWeighting = "equal" | "capitalization";

/** Observed prices only. Fixed starting weights; snapshot caps are not historical caps. */
export function buildIndustryIndex(
  assets: MarketAsset[], histories: Map<string, MarketPricePoint[]>, range: DateRange,
  weighting: IndustryWeighting, caps: Record<string, number> = {},
) {
  const eligible = assets.filter((asset) => buildThemePerformance([asset], histories, range).status === "complete"
    && (weighting === "equal" || (Number.isFinite(caps[asset.symbol]) && caps[asset.symbol] > 0)));
  const aligned = buildThemePerformance(eligible, histories, range);
  const base = { weighting, total: assets.length, coverage: eligible.length, partial: eligible.length < assets.length };
  if (aligned.status !== "complete") return { ...base, coverage: 0, partial: true, status: "unavailable" as const };
  const denominator = weighting === "equal" ? eligible.length : eligible.reduce((sum, asset) => sum + caps[asset.symbol], 0);
  const firstDate = aligned.points[0].date;
  const prices = new Map(eligible.map((asset) => [asset.id, new Map(histories.get(asset.id)!.map((point) => [point.date, point.close]))]));
  const weights = new Map(eligible.map((asset) => [asset.id, (weighting === "equal" ? 1 : caps[asset.symbol]) / denominator]));
  const points = aligned.points.map(({ date }) => ({ date, value: eligible.reduce((sum, asset) => {
    const series = prices.get(asset.id)!;
    return sum + series.get(date)! / series.get(firstDate)! * 100 * weights.get(asset.id)!;
  }, 0) }));
  const contributors = aligned.contributors.map((item) => ({ ...item,
    weight: weights.get(item.asset.id)!, contributionPctPoints: item.returnPct * weights.get(item.asset.id)!,
  })).sort((a, b) => b.contributionPctPoints - a.contributionPctPoints || a.asset.symbol.localeCompare(b.asset.symbol));
  return { ...base, status: "complete" as const, points, contributors,
    returnPct: points.at(-1)!.value - 100, positive: aligned.positive };
}
export type IndustryIndex = ReturnType<typeof buildIndustryIndex>;
