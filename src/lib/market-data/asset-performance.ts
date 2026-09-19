import { addLocalDays } from "@/lib/date/local-date";
import type { MarketPricePoint } from "./types";

export interface AssetPerformanceMetrics {
  week?: number;
  month?: number;
  year?: number;
  high52Week?: number;
  low52Week?: number;
  fromHigh?: number;
}

const changeFrom = (points: MarketPricePoint[], cutoff: string, currentPrice: number) => {
  const baseline = points.find((point) => point.date >= cutoff)?.close;
  return baseline && baseline > 0 ? ((currentPrice / baseline) - 1) * 100 : undefined;
};

export function calculateAssetPerformance(
  points: MarketPricePoint[],
  currentPrice: number | undefined,
  asOfDate: string,
): AssetPerformanceMetrics {
  const sorted = [...points].sort((left, right) => left.date.localeCompare(right.date));
  const latest = currentPrice ?? sorted.at(-1)?.close;
  if (!latest || !sorted.length) return {};
  const values = [...sorted.map((point) => point.close), latest];
  const high52Week = Math.max(...values);
  const low52Week = Math.min(...values);
  return {
    week: changeFrom(sorted, addLocalDays(asOfDate, -7), latest),
    month: changeFrom(sorted, addLocalDays(asOfDate, -30), latest),
    year: changeFrom(sorted, addLocalDays(asOfDate, -365), latest),
    high52Week,
    low52Week,
    fromHigh: ((latest / high52Week) - 1) * 100,
  };
}
