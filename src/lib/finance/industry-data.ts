import type { MarketAsset } from "../market-data/types";
import type { FinancialStatement } from "./financial-anatomy";

export interface IndustryMember { asset: MarketAsset; marketCap: number; marketCapSource: string }
export interface IndustrySnapshot {
  id: string; version: string; updatedAt: string; rebalancedAt: string; sourceDates: Record<string, string>;
  sources: string[]; candidateCount: number; excluded: { symbol: string; reason: string }[];
  members: IndustryMember[];
}
export interface FundamentalsRecord {
  symbol: string; fetchedAt: string; provider: string; statements: FinancialStatement[];
  errors?: string[];
}
export interface IndustryDataSnapshot {
  schemaVersion: 1; version: string; updatedAt: string;
  industries: Record<string, IndustrySnapshot>; fundamentals: Record<string, FundamentalsRecord>;
}

/** Ranking never uses ETF position values as company market caps. One issuer per universe. */
export function rankIndustryMembers(candidates: string[], listings: Map<string, MarketAsset>, caps: Map<string, { value: number; name: string; source: string }>) {
  const excluded: IndustrySnapshot["excluded"] = [];
  const valid = [...new Set(candidates)].flatMap((symbol) => {
    const asset = listings.get(symbol), cap = caps.get(symbol);
    if (!asset) { excluded.push({ symbol, reason: "No verified supported common-stock listing" }); return []; }
    if (!cap || !Number.isFinite(cap.value) || cap.value <= 0) { excluded.push({ symbol, reason: "No valid USD market capitalization" }); return []; }
    return [{ asset: { ...asset, name: cap.name }, marketCap: cap.value, marketCapSource: cap.source }];
  }).sort((a, b) => b.marketCap - a.marketCap || a.asset.symbol.localeCompare(b.asset.symbol));
  const issuers = new Set<string>();
  const members = valid.filter((row) => {
    const issuer = row.asset.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (issuers.has(issuer)) { excluded.push({ symbol: row.asset.symbol, reason: "Duplicate issuer/share class" }); return false; }
    issuers.add(issuer); return true;
  });
  members.slice(100).forEach((row) => excluded.push({ symbol: row.asset.symbol, reason: "Ranked below Top 100" }));
  return { members: members.slice(0, 100), excluded, candidateCount: new Set(candidates).size };
}

export function industryEconomics(members: IndustryMember[], records: Record<string, FundamentalsRecord>, year: number) {
  const totalMarketCap = members.reduce((sum, row) => sum + row.marketCap, 0);
  const ordered = [...members].sort((a, b) => b.marketCap - a.marketCap);
  const reports = members.flatMap(({ asset }) => {
    const periods = records[asset.symbol]?.statements ?? [];
    const latest = periods.find((s) => s.currency === "USD" && s.durationMonths === 12 && s.period.startsWith(`${year}-`));
    const prior = latest && periods.find((s) => s.currency === latest.currency && s.durationMonths === 12
      && s.period.startsWith(`${year - 1}-`) && Math.abs((Date.parse(latest.period) - Date.parse(s.period)) / 86400000 - 365) < 20);
    return latest ? [{ latest, prior }] : [];
  });
  const paired = reports.filter((row) => row.prior);
  const priorRevenue = paired.reduce((sum, row) => sum + row.prior!.revenue, 0);
  return { totalMarketCap, companies: members.length,
    top10Concentration: totalMarketCap ? ordered.slice(0, 10).reduce((sum, row) => sum + row.marketCap, 0) / totalMarketCap * 100 : undefined,
    fiscalYear: year, revenueCoverage: reports.length,
    aggregateRevenue: reports.length ? reports.reduce((sum, row) => sum + row.latest.revenue, 0) : undefined,
    growthCoverage: paired.length,
    revenueGrowth: priorRevenue > 0 ? (paired.reduce((sum, row) => sum + row.latest.revenue, 0) / priorRevenue - 1) * 100 : undefined,
    oldestFetchedAt: members.map(({ asset }) => records[asset.symbol]?.fetchedAt).filter((value): value is string => !!value).sort()[0],
  };
}
export type IndustryEconomics = ReturnType<typeof industryEconomics>;
export type IndustryView = IndustrySnapshot & { economics: IndustryEconomics };
