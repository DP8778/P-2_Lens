import type { FundamentalsRecord, IndustryView } from "@/lib/finance/industry-data";
import type { MarketAsset } from "@/lib/market-data/types";

/** UI contract is independent of SEC tags, vendor fields and transport. */
export interface FundamentalsSource {
  getInstrument(assetId: string): MarketAsset | undefined;
  getCompany(assetId: string): FundamentalsRecord | undefined;
  getIndustries(): Record<string, IndustryView>;
}
