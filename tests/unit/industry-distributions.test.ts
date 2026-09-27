import { buildIndustryDistributions, buildIndustryOverview } from "@/lib/finance/industry-overview";
import { marketThemes } from "@/data/market-themes";
import { industryCompanies } from "@/data/market-industries";

const theme = marketThemes[0];
const base = () => buildIndustryOverview(industryCompanies(theme), theme.constituents, new Map(), { from: "2026-09-01", to: "2026-09-25", interval: "1day" });

test("donut includes unknown capitalization and shares reconcile to 100 percent", () => {
  const result = buildIndustryDistributions(base());
  expect(result.sizes.reduce((sum, item) => sum + item.count, 0)).toBe(18);
  expect(result.sizes.reduce((sum, item) => sum + item.percent, 0)).toBeCloseTo(100);
  expect(result.sizes.find((item) => item.size === "Unknown")?.count).toBe(1);
  expect(result.histogram.every((item) => item.count === 0)).toBe(true);
});

test("histogram boundaries count every observed return once and omit missing history", () => {
  const overview = base();
  const returns = [-30, -20, -10, 0, 10, 20, 25];
  overview.rows = overview.rows.map((row, index) => ({ ...row, returnPct: returns[index] }));
  overview.measured = 7;
  overview.positive = 3;
  overview.negative = 3;
  overview.unchanged = 1;
  const result = buildIndustryDistributions(overview);
  expect(result.histogram.map((bin) => bin.count)).toEqual([1, 1, 1, 1, 1, 2]);
  expect(result.breadth.reduce((sum, item) => sum + item.count, 0)).toBe(7);
  expect(result.breadth.reduce((sum, item) => sum + item.percent, 0)).toBeCloseTo(100);
});
