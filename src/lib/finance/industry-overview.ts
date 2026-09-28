import type { DateRange, MarketAsset, MarketPricePoint } from "@/lib/market-data/types";
import capitalization from "./industry-capitalization.json";
import { buildThemePerformance, themeHistoryRange, themeTimeframes, type ThemeTimeframe } from "./theme-performance";

export type CompanySize = "Large" | "Mid" | "Small" | "Unknown";
export const capitalizationSource = capitalization;
export function companySize(marketCap?: number): CompanySize {
  if (marketCap === undefined || !Number.isFinite(marketCap) || marketCap <= 0) return "Unknown";
  return marketCap >= 10e9 ? "Large" : marketCap >= 2e9 ? "Mid" : "Small";
}
export function buildIndustryOverview(assets: MarketAsset[], basket: MarketAsset[], histories: Map<string, MarketPricePoint[]>, range: DateRange, caps: Record<string, number> = capitalization.marketCaps) {
  const basketIds = new Set(basket.map((asset) => asset.id));
  const basketPerformance = buildThemePerformance(basket, histories, range);
  const contributions = new Map(basketPerformance.status === "complete" ? basketPerformance.contributors.map((item) => [item.asset.id, item.contributionPctPoints]) : []);
  const referenceDate = new Date(Date.parse(`${range.to}T00:00:00Z`) + 86_400_000);
  const periodRanges = themeTimeframes.map((period) => [period, themeHistoryRange(period, referenceDate)] as const);
  const rows = assets.map((asset) => {
    const result = buildThemePerformance([asset], histories, range);
    const marketCap = caps[asset.symbol];
    const returns = Object.fromEntries(periodRanges.map(([period, periodRange]) => {
      const performance = buildThemePerformance([asset], histories, periodRange);
      return [period, performance.status === "complete" ? performance.returnPct : undefined];
    })) as Record<ThemeTimeframe, number | undefined>;
    return { asset, marketCap, returns, contributionPctPoints: contributions.get(asset.id), size: companySize(marketCap), inBasket: basketIds.has(asset.id), returnPct: result.status === "complete" ? result.returnPct : undefined,
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
    medianReturn: measured.length ? (measured[Math.floor((measured.length - 1) / 2)].returnPct! + measured[Math.ceil((measured.length - 1) / 2)].returnPct!) / 2 : undefined,
    risingPercent: measured.length ? measured.filter((row) => row.returnPct! > 0).length / measured.length * 100 : undefined,
    capitalizationTotal: rows.reduce((sum, row) => sum + (row.marketCap ?? 0), 0),
    capitalizationCoverage: rows.filter((row) => row.marketCap !== undefined).length };
}
export type IndustryOverview = ReturnType<typeof buildIndustryOverview>;
export function filterIndustryCompanies(rows: IndustryOverview["rows"], query: string, size: string, sort: string) {
  const normalized = query.trim().toLocaleLowerCase();
  return rows.filter((row) => (size === "all" || row.size === size) && `${row.asset.symbol} ${row.asset.name}`.toLocaleLowerCase().includes(normalized))
    .sort((a, b) => {
      const order = sort === "best" ? "return:desc" : sort === "worst" ? "return:asc" : sort === "name" ? "name:asc" : sort;
      const [column, direction] = order.split(":");
      const factor = direction === "desc" ? -1 : 1;
      if (column === "name" || column === "symbol") return factor * a.asset[column].localeCompare(b.asset[column]);
      const value = (row: IndustryOverview["rows"][number]) => column === "marketCap" ? row.marketCap
        : column === "contribution" ? row.contributionPctPoints
          : themeTimeframes.includes(column as ThemeTimeframe) ? row.returns[column as ThemeTimeframe] : row.returnPct;
      const left = value(a), right = value(b);
      if (left === undefined) return right === undefined ? a.asset.name.localeCompare(b.asset.name) : 1;
      if (right === undefined) return -1;
      return factor * (left - right) || a.asset.name.localeCompare(b.asset.name);
    });
}


/** Counts describe available observations; unknown size is kept in the denominator. */
export function buildIndustryDistributions(overview: IndustryOverview) {
  const breadth = [
    { key: "positive", count: overview.positive },
    { key: "negative", count: overview.negative },
    { key: "unchanged", count: overview.unchanged },
  ].map((item) => ({ ...item, percent: overview.measured ? item.count / overview.measured * 100 : 0 }));
  const sizes = (["Large", "Mid", "Small", "Unknown"] as const).map((size) => {
    const count = overview.rows.filter((row) => row.size === size).length;
    return { size, count, percent: overview.total ? count / overview.total * 100 : 0 };
  });
  const bounds = [-Infinity, -20, -10, 0, 10, 20, Infinity];
  const labels = ["< −20 %", "−20 až < −10 %", "−10 až < 0 %", "0 až < 10 %", "10 až < 20 %", "≥ 20 %"];
  const histogram = labels.map((label, index) => ({ label,
    count: overview.rows.filter((row) => row.returnPct !== undefined && row.returnPct >= bounds[index] && row.returnPct < bounds[index + 1]).length,
  }));
  return { breadth, sizes, histogram };
}
