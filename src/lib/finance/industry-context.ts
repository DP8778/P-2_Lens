import { hasReliableIndustryCoverage } from "./industry-coverage";
import type { IndustryView } from "./industry-data";
import type { MarketPricePoint } from "../market-data/types";
import type { IndustryNavigation } from "../markets/industry-navigation";
import { buildIndustryIndex } from "./industry-index";
import { buildThemePerformance, themeHistoryRange } from "./theme-performance";

export function buildCompanyIndustryContext(assetId: string, industry: IndustryView, histories: Map<string, MarketPricePoint[]>, navigation: IndustryNavigation) {
  const member = industry.members.find((row) => row.asset.id === assetId);
  if (!member) return undefined;
  const caps = Object.fromEntries(industry.members.map((row) => [row.asset.symbol, row.marketCap]));
  const sorted = [...industry.members].sort((a, b) => b.marketCap - a.marketCap || a.asset.symbol.localeCompare(b.asset.symbol));
  const total = sorted.reduce((sum, row) => sum + row.marketCap, 0);
  const rank = sorted.findIndex((row) => row.asset.id === assetId) + 1;
  const base = { rank, sharePct: total > 0 ? member.marketCap / total * 100 : undefined, total: industry.members.length };
  if (navigation.version && navigation.version !== industry.version) return { ...base, changed: true as const };
  const range = themeHistoryRange(navigation.period, navigation.asOf ? new Date(`${navigation.asOf}T12:00:00Z`) : new Date());
  const index = buildIndustryIndex(industry.members.map((row) => row.asset), histories, range, navigation.weighting, caps);
  const reliable = hasReliableIndustryCoverage(index.coverage, index.total);
  const contribution = reliable && index.status === "complete" ? index.contributors.find((row) => row.asset.id === assetId) : undefined;
  const single = buildThemePerformance([member.asset], histories, range);
  const leaders = index.status === "complete" ? index.contributors.filter((row) => row.contributionPctPoints > 0).slice(0, 3) : [];
  const laggards = index.status === "complete" ? index.contributors.filter((row) => row.contributionPctPoints < 0).slice(-3) : [];
  return { ...base, changed: false as const, coverage: index.coverage, partial: index.partial,
    returnPct: contribution?.returnPct ?? (single.status === "complete" ? single.returnPct : undefined),
    contribution: contribution?.contributionPctPoints,
    industryReturn: reliable && index.status === "complete" ? index.returnPct : undefined,
    driver: contribution && leaders.includes(contribution) ? "positive" as const : contribution && laggards.includes(contribution) ? "negative" as const : undefined,
  };
}
