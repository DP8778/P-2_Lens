import type { FundamentalsRecord, IndustryView } from "@/lib/finance/industry-data";

/** UI contract is independent of SEC tags, vendor fields and transport. */
export interface FundamentalsSource {
  getCompany(assetId: string): FundamentalsRecord | undefined;
  getIndustries(): Record<string, IndustryView>;
}
