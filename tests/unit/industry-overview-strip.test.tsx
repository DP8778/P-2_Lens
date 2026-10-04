jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
import { render, screen } from "@testing-library/react";
import { IndustryOverviewStrip } from "@/components/markets/IndustryCompanies";
import { marketThemes } from "@/data/market-themes";
import { industryEconomics, type FundamentalsRecord, type IndustryView } from "@/lib/finance/industry-data";
import { buildIndustryOverview } from "@/lib/finance/industry-overview";
import type { FinancialStatement } from "@/lib/finance/financial-anatomy";

// Deterministic fixture statements, never a public-company financial assertion.
const members = marketThemes[0].constituents.map((asset, i) => ({ asset, marketCap: (i + 1) * 100, marketCapSource: "https://example.com/test-caps" }));
const statement = (index: number, year: number, revenue: number): FinancialStatement => ({ assetId: members[index].asset.id, period: `${year}-12-31`, revenue, currency: "USD", durationMonths: 12, source: "https://example.com/test-statement", costOfRevenue: 0, grossProfit: revenue, operatingExpenses: 0, operatingIncome: revenue, netIncome: revenue });
const record = (index: number, statements: FinancialStatement[]): FundamentalsRecord => ({ symbol: members[index].asset.symbol, fetchedAt: "2026-09-20T00:00:00Z", provider: "fixture", statements });
const overview = buildIndustryOverview(members.map(({ asset }) => asset), [], new Map(), { from: "2026-09-01", to: "2026-09-25", interval: "1day" }, Object.fromEntries(members.map(({ asset, marketCap }) => [asset.symbol, marketCap])));
const industry = (records: Record<string, FundamentalsRecord>): IndustryView => ({ id: "ai", version: "fixture-version", updatedAt: "2026-09-28T00:00:00Z", rebalancedAt: "2026-09-28T00:00:00Z", sourceDates: {}, sources: [], candidateCount: members.length, excluded: [], members, economics: industryEconomics(members, records, 2025) });

test("partial annual economics show denominators beside values and freshness outside disclosure", () => {
  const view = industry({ [members[0].asset.symbol]: record(0, [statement(0, 2025, 120), statement(0, 2024, 100)]), [members[1].asset.symbol]: record(1, [statement(1, 2025, 500)]) });
  render(<IndustryOverviewStrip overview={overview} industry={view} locale="cs-CZ" />);
  expect(screen.getByText("Součet dostupných ročních tržeb")).toBeVisible();
  const revenue = screen.getByText("Částečné výkazy · 2/4 firem");
  expect(revenue).toBeVisible();
  expect(revenue.parentElement).toHaveAttribute("data-coverage", "partial");
  expect(revenue.parentElement?.querySelector("strong")).toHaveTextContent("620");
  expect(screen.getByText("Částečné srovnání · 1/4 firem")).toBeVisible();
  expect(screen.getByText(/FY 2025/)).toBeVisible();
  expect(screen.getByText(/Nejstarší aktualizace výkazů/).closest("details")).toBeNull();
  expect(screen.getByText("2026-09-20")).toBeVisible();
  expect(screen.getByText("Sledované firmy").parentElement?.querySelector("strong")).toHaveTextContent(/^4$/);
});

test("missing financial values stay unavailable with zero-report coverage, not zero revenue or growth", () => {
  render(<IndustryOverviewStrip overview={overview} industry={industry({})} locale="cs-CZ" />);
  expect(screen.getByText("Částečné výkazy · 0/4 firem").parentElement?.querySelector("strong")).toHaveTextContent(/^—$/);
  expect(screen.getByText("Částečné srovnání · 0/4 firem").parentElement?.querySelector("strong")).toHaveTextContent(/^—$/);
  expect(screen.queryByText(/Nejstarší aktualizace výkazů/)).not.toBeInTheDocument();
});

test("complete financial coverage is explicit without a partial warning", () => {
  const view = industry(Object.fromEntries(members.map(({ asset }, index) => [asset.symbol, record(index, [statement(index, 2025, 120), statement(index, 2024, 100)])])));
  render(<IndustryOverviewStrip overview={overview} industry={view} locale="en-US" />);
  expect(screen.getByText("Reports · 4/4 companies")).toBeVisible();
  expect(screen.getByText("Comparable reports · 4/4 companies")).toBeVisible();
  expect(screen.queryByText(/Partial/)).not.toBeInTheDocument();
});
