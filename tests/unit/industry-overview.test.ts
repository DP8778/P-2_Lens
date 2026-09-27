import { marketThemes } from "@/data/market-themes";
import { industryCompanies } from "@/data/market-industries";
import { buildIndustryOverview, companySize, filterIndustryCompanies } from "@/lib/finance/industry-overview";

const theme = marketThemes[0];
const range = { from: "2026-09-21", to: "2026-09-23", interval: "1day" as const };
const histories = new Map(theme.constituents.map((asset, index) => [asset.id, [100, 90 + index * 10].map((close, day) => ({ assetId: asset.id, close, date: day ? range.to : range.from, currency: "USD", adjustedForSplits: true }))]));

test("all five industry universes expand beyond the unchanged four-stock baskets", () => {
  for (const theme of marketThemes) {
    const companies = industryCompanies(theme);
    expect(companies.length).toBeGreaterThanOrEqual(18);
    expect(new Set(companies.map((asset) => asset.id)).size).toBe(companies.length);
    expect(theme.constituents).toHaveLength(4);
    expect(companies).toEqual(expect.arrayContaining(theme.constituents));
    const overview = buildIndustryOverview(companies, theme.constituents, new Map(), range);
    for (const size of ["Large", "Mid", "Small"]) expect(overview.rows.some((row) => row.size === size)).toBe(true);
  }
});

test("sample coverage is explicit and never advertised as full-industry performance", () => {
  const overview = buildIndustryOverview(industryCompanies(theme), theme.constituents, histories, range);
  expect(overview.total).toBe(18);
  expect(overview.measured).toBe(4);
  expect(overview.positive).toBe(2);
  expect(overview.negative).toBe(1);
  expect(overview.unchanged).toBe(1);
  expect(overview.universeReturn).toBeUndefined();
  expect(overview.rows.find((row) => row.asset.symbol === "AI")?.returnPct).toBeUndefined();
  expect(overview.rows.find((row) => row.asset.symbol === "GOOGL")?.marketCap).toBeUndefined();
  expect(overview.rows.find((row) => row.asset.symbol === "GOOGL")?.size).toBe("Unknown");
  expect(overview.rows.find((row) => row.asset.symbol === "NVDA")?.contributionPctPoints).toBeCloseTo(-2.5);
});

test("size filters and return sorts keep missing history last instead of treating it as zero", () => {
  const overview = buildIndustryOverview(industryCompanies(theme), theme.constituents, histories, range);
  expect(filterIndustryCompanies(overview.rows, "", "all", "best")[0].asset.symbol).toBe("GOOGL");
  expect(filterIndustryCompanies(overview.rows, "", "all", "worst")[0].asset.symbol).toBe("NVDA");
  expect(filterIndustryCompanies(overview.rows, "", "Small", "name").every((row) => row.size === "Small")).toBe(true);
  expect(filterIndustryCompanies(overview.rows, "nvidia", "all", "name").map((row) => row.asset.symbol)).toEqual(["NVDA"]);
  expect(filterIndustryCompanies(overview.rows, "", "Unknown", "name").map((row) => row.asset.symbol)).toEqual(["GOOGL"]);
  expect(companySize(undefined)).toBe("Unknown");
  expect(companySize(0)).toBe("Unknown");
  expect(companySize(2e9)).toBe("Mid");
  expect(companySize(10e9)).toBe("Large");
});
