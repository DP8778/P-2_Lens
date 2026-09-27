import type { DateRange, MarketAsset, MarketPricePoint } from "@/lib/market-data/types";
import capitalization from "./industry-capitalization.json";
import { buildThemePerformance } from "./theme-performance";

export type CompanySize = "Large" | "Mid" | "Small" | "Unknown";
export const capitalizationSource = capitalization;
export function companySize(marketCap?: number): CompanySize {
  if (marketCap === undefined || !Number.isFinite(marketCap) || marketCap <= 0) return "Unknown";
  return marketCap >= 10e9 ? "Large" : marketCap >= 2e9 ? "Mid" : "Small";
}
export function buildIndustryOverview(assets: MarketAsset[], basket: MarketAsset[], histories: Map<string, MarketPricePoint[]>, range: DateRange) {
  const caps: Record<string, number> = capitalization.marketCaps;
  const basketIds = new Set(basket.map((asset) => asset.id));
  const basketPerformance = buildThemePerformance(basket, histories, range);
  const contributions = new Map(basketPerformance.status === "complete" ? basketPerformance.contributors.map((item) => [item.asset.id, item.contributionPctPoints]) : []);
  const rows = assets.map((asset) => {
    const result = buildThemePerformance([asset], histories, range);
    const marketCap = caps[asset.symbol];
    return { asset, marketCap, contributionPctPoints: contributions.get(asset.id), size: companySize(marketCap), inBasket: basketIds.has(asset.id), returnPct: result.status === "complete" ? result.returnPct : undefined,
      from: result.status === "complete" ? result.points[0].date : undefined,
      to: result.status === "complete" ? result.points.at(-1)!.date : undefined };
  });
  const measured = rows.filter((row) => row.returnPct !== undefined).sort((a, b) => b.returnPct! - a.returnPct! || a.asset.name.localeCompare(b.asset.name));
  const universe = buildThemePerformance(assets, histories, range);
  return { rows, measured: measured.length, total: rows.length,
    positive: measured.filter((row) => row.returnPct! > 0).length,
    negative: measured.filter((row) => row.returnPct! < 0).length,
    unchanged: measured.filter((row) => row.returnPct === 0).length,
    leaders: measured.slice(0, 3), laggards: measured.slice(-3).reverse(),
    universeReturn: universe.status === "complete" ? universe.returnPct : undefined,
    capitalizationTotal: rows.reduce((sum, row) => sum + (row.marketCap ?? 0), 0),
    capitalizationCoverage: rows.filter((row) => row.marketCap !== undefined).length };
}
export type IndustryOverview = ReturnType<typeof buildIndustryOverview>;
export function filterIndustryCompanies(rows: IndustryOverview["rows"], query: string, size: string, sort: string) {
  const normalized = query.trim().toLocaleLowerCase();
  return rows.filter((row) => (size === "all" || row.size === size) && `${row.asset.symbol} ${row.asset.name}`.toLocaleLowerCase().includes(normalized))
    .sort((a, b) => {
      if (sort === "name") return a.asset.name.localeCompare(b.asset.name);
      if (a.returnPct === undefined) return b.returnPct === undefined ? a.asset.name.localeCompare(b.asset.name) : 1;
      if (b.returnPct === undefined) return -1;
      return (sort === "worst" ? a.returnPct - b.returnPct : b.returnPct - a.returnPct) || a.asset.name.localeCompare(b.asset.name);
    });
}
