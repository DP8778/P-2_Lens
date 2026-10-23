import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { CompanyRevenueMix } from "@/components/assets/CompanyRevenueMix";
import { buildRevenueBreakdown } from "@/lib/finance/revenue-breakdown";
import type { FinancialStatement } from "@/lib/finance/financial-anatomy";
import { fundamentalsSource } from "@/lib/fundamentals/snapshot-source";

const amdId = "twelvedata:XNGS:AMD";

test("AMD segment amounts use USD units, reconcile to revenue and compare matching fiscal years", () => {
  const report = fundamentalsSource.getCompany(amdId)!;
  const data = buildRevenueBreakdown(amdId, report.statements);
  expect(data.status).toBe("available");
  if (data.status !== "available") return;
  expect(data.periods.map((period) => period.period)).toEqual(["2025-12-27", "2024-12-28"]);
  expect(data.latest.segments.reduce((sum, segment) => sum + segment.revenue, 0)).toBe(34_639_000_000);
  expect(data.prior.segments.reduce((sum, segment) => sum + segment.revenue, 0)).toBe(25_785_000_000);
  expect(data.latest.segments[0]).toMatchObject({ name: "Data Center", revenue: 16_635_000_000 });
  expect(data.latest.segments[0].sharePct).toBeCloseTo(48.024);
  expect(data.latest.segments[0].changePct).toBeCloseTo(32.244);
  expect(data.prior.segmentBasis).toBe("retrospectively-adjusted");
  expect(data.latest.sourceScale).toBe(1_000_000);
});

test("period switch keeps segment order, visible values and explains the recast without hover", async () => {
  const data = buildRevenueBreakdown(amdId, fundamentalsSource.getCompany(amdId)!.statements);
  if (data.status !== "available") throw new Error("AMD breakdown unavailable");
  render(<CompanyRevenueMix periods={data.periods} locale="cs-CZ" companyLabel="AMD" />);
  expect(screen.getByRole("heading", { name: "Čím AMD vydělává" })).toBeInTheDocument();
  expect(screen.getByText(/Textový přehled pro FY2025/).closest("figcaption")).toHaveTextContent(/Data Center/);
  const labels2025 = screen.getAllByRole("listitem").map((item) => item.querySelector("strong")?.textContent);
  await userEvent.click(screen.getByRole("button", { name: "FY2024" }));
  expect(screen.getByText(/FY2024 je zobrazen ve struktuře/)).toBeInTheDocument();
  expect(screen.getAllByText(/Srovnávací základ pro FY2025/)).toHaveLength(3);
  const labels2024 = screen.getAllByRole("listitem").map((item) => item.querySelector("strong")?.textContent);
  expect(labels2024).toEqual(labels2025);
  expect(screen.getByRole("button", { name: "FY2024" })).toHaveAttribute("aria-pressed", "true");
});

test("missing, inconsistent and incomparable segment data stay unavailable instead of becoming zero", () => {
  const base: FinancialStatement = { assetId: "test", period: "2025-12-31", currency: "USD", durationMonths: 12,
    source: "https://example.com/statement", segmentSource: "https://example.com/segments", revenue: 100,
    costOfRevenue: 40, grossProfit: 60, operatingExpenses: 30, operatingIncome: 30, netIncome: 20 };
  expect(buildRevenueBreakdown("test", [base])).toMatchObject({ status: "unavailable", reason: "missing-segments" });
  const latest = { ...base, segments: [{ name: "One", revenue: 80 }, { name: "Two", revenue: 10 }] };
  expect(buildRevenueBreakdown("test", [latest])).toMatchObject({ status: "unavailable", reason: "missing-segments" });
  const reconciled = { ...latest, segments: [{ name: "One", revenue: 80 }, { name: "Two", revenue: 20 }] };
  const prior = { ...reconciled, period: "2024-12-31", segments: [{ name: "Legacy", revenue: 80 }, { name: "Two", revenue: 20 }] };
  expect(buildRevenueBreakdown("test", [reconciled, prior])).toMatchObject({ status: "unavailable", reason: "incomparable-segments" });
});
