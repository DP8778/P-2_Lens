import { industryEconomics, rankIndustryMembers } from "@/lib/finance/industry-data";
import type { FundamentalsRecord } from "@/lib/finance/industry-data";
import { marketThemes } from "@/data/market-themes";
import type { FinancialStatement } from "@/lib/finance/financial-anatomy";
const assets = marketThemes[0].constituents;
const source = "https://example.com/test-caps";

test("Top 100 is dynamic, cap-ranked, issuer-deduplicated and excludes invalid candidates", () => {
  const listings = new Map(Array.from({ length: 105 }, (_, i) => [`S${i}`, { ...assets[0], symbol: `S${i}`, id: `asset-${i}`, name: `Company ${i}` }]));
  const caps = new Map([...listings].map(([symbol, asset], i) => [symbol, { value: i + 1, name: asset.name, source }]));
  const first = rankIndustryMembers([...listings.keys(), "MISSING"], listings, caps);
  expect(first.members).toHaveLength(100);
  expect(first.members[0].asset.symbol).toBe("S104");
  expect(first.excluded.find((row) => row.symbol === "MISSING")?.reason).toMatch(/listing/);
  caps.set("S0", { value: 1000, name: "Company 0", source });
  const updated = rankIndustryMembers([...listings.keys()], listings, caps);
  expect(updated.members[0].asset.symbol).toBe("S0");
  expect(updated.members.some((row) => row.asset.symbol === "S5")).toBe(false);
  caps.set("S1", { value: 0, name: "Company 1", source });
  caps.set("S2", { value: 1000, name: "Company 0", source });
  const small = rankIndustryMembers(["S0", "S1", "S2"], listings, caps);
  expect(small.members).toHaveLength(1);
  expect(small.excluded).toHaveLength(2);
});

test("industry economics compares paired fiscal reports and never treats missing revenue as zero", () => {
  const members = assets.map((asset, i) => ({ asset, marketCap: (i + 1) * 100, marketCapSource: source }));
  const statement = (assetId: string, period: string, revenue: number): FinancialStatement => ({ assetId, period, revenue, currency: "USD", durationMonths: 12, source, costOfRevenue: 0, grossProfit: revenue, operatingExpenses: 0, operatingIncome: revenue, netIncome: revenue });
  const record = (i: number, statements: FinancialStatement[]): FundamentalsRecord => ({ symbol: assets[i].symbol, fetchedAt: "2026-09-28T00:00:00Z", provider: "fixture", statements });
  const reports = { [assets[0].symbol]: record(0, [statement(assets[0].id, "2025-12-31", 120), statement(assets[0].id, "2024-12-31", 100)]), [assets[1].symbol]: record(1, [statement(assets[1].id, "2025-06-30", 500)]) };
  const result = industryEconomics(members, reports, 2025);
  expect(result.totalMarketCap).toBe(1000);
  expect(result.aggregateRevenue).toBe(620);
  expect(result.revenueCoverage).toBe(2);
  expect(result.growthCoverage).toBe(1);
  expect(result.revenueGrowth).toBeCloseTo(20);
  expect(industryEconomics(members, {}, 2025).aggregateRevenue).toBeUndefined();
});
