import { buildFinancialAnatomy } from "./financial-anatomy";
import type { FundamentalsRecord, IndustryView } from "./industry-data";
import type { MarketAsset } from "../market-data/types";
import { marketThemes } from "@/data/market-themes";

/** Small public, verified summary. No raw statements, positions or client financial values. */
export function buildCompanyResearchContext(asset: MarketAsset, record?: FundamentalsRecord, industry?: IndustryView) {
  const anatomy = buildFinancialAnatomy(asset.id, record?.statements);
  const memberIndex = industry?.members.findIndex(member => member.asset.id === asset.id) ?? -1;
  return {
    identity: { assetId: asset.id, symbol: asset.symbol, companyName: asset.name, exchange: asset.exchange, micCode: asset.micCode, country: asset.country },
    fundamentals: anatomy.status === "available" ? {
      fiscalPeriod: anatomy.latest.period, currency: anatomy.latest.currency,
      revenueGrowth: anatomy.revenueGrowth, grossMargin: anatomy.grossMargin, operatingMargin: anatomy.operatingMargin,
      reportedSegments: anatomy.latest.segments, statementsFetchedAt: record?.fetchedAt,
      stale: !!record?.errors?.length, sources: [anatomy.latest.source, ...(anatomy.latest.segmentSource ? [anatomy.latest.segmentSource] : [])],
    } : undefined,
    // Membership is already ranked by market cap in the verified snapshot.
    theme: industry && memberIndex >= 0 ? { id: industry.id, name: marketThemes.find(t => t.id === industry.id)?.name,
      companies: industry.members.length, marketCapRank: memberIndex + 1, updatedAt: industry.updatedAt, version: industry.version } : undefined,
  };
}
