import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { parseAmdAnnual, parseSecAnnual, parseIncomeStatement, mergeFinancialHistory } from "@/lib/finance/fundamentals-normalizers";
import { fundamentalsSource, createSnapshotSource } from "@/lib/fundamentals/snapshot-source";
import { FinancialAnatomy } from "@/components/assets/FinancialAnatomy";
import { marketThemes } from "@/data/market-themes";
const asset = marketThemes[0].constituents.find((row) => row.symbol === "PLTR")!;
const source = "https://www.sec.gov/Archives/edgar/data/1321655/000132165526000011/pltr-20251231.htm";

test("SEC units, scales and dimensions yield real annual PLTR values and reported segments", () => {
  const html = readFileSync(path.join(process.cwd(), "tests/fixtures/pltr-2025-ixbrl.html"), "utf8");
  const statements = parseSecAnnual(html, asset, source);
  expect(statements).toHaveLength(1);
  expect(statements[0]).toMatchObject({ revenue: 4475446000, operatingIncome: 1414015000,
    expenses: { salesMarketing: 1056859000, researchDevelopment: 557677000, generalAdministrative: 657718000 },
    segments: [{ name: "Government", revenue: 2402287000 }, { name: "Commercial", revenue: 2073159000 }] });
  const secondary = { ...statements[0], source: "https://example.com/secondary", expenses: {} };
  expect(mergeFinancialHistory(statements, [secondary])[0].source).toBe(source);
  expect(mergeFinancialHistory(statements, [{ ...secondary, netIncome: 100 }])[0].source).toBe(source);
});

test("AMD filing parser keeps GAAP statements and retrospectively adjusted segments on one basis", () => {
  const periods = [
    { context: "y25", start: "2024-12-29", end: "2025-12-27", values: [34639, 17487, 17152, 13458, 3694, 4335, 8091], adjustedCost: 16456, segments: [16635, 14550, 3454] },
    { context: "y24", start: "2023-12-31", end: "2024-12-28", values: [25785, 13060, 12725, 10825, 1900, 1641, 6456], adjustedCost: 12114, segments: [12579, 9649, 3557] },
    { context: "y23", start: "2023-01-01", end: "2023-12-30", values: [22680, 12220, 10460, 10059, 401, 854, 5872], adjustedCost: 11278, segments: [6496, 10863, 5321] },
  ];
  const names = ["RevenueFromContractWithCustomerExcludingAssessedTax", "CostOfGoodsAndServicesSold", "GrossProfit", "OperatingExpenses", "OperatingIncomeLoss", "NetIncomeLoss", "ResearchAndDevelopmentExpense"];
  const members = ["amd:DatacenterMember", "amd:ClientAndGamingMember", "amd:EmbeddedMember"];
  const context = (id: string, start: string, end: string, member?: string) => `<xbrli:context id="${id}"><xbrli:entity>${member ? `<xbrli:segment><xbrldi:explicitMember>us-gaap:OperatingSegmentsMember</xbrldi:explicitMember><xbrldi:explicitMember>${member}</xbrldi:explicitMember></xbrli:segment>` : ""}</xbrli:entity><xbrli:period><xbrli:startDate>${start}</xbrli:startDate><xbrli:endDate>${end}</xbrli:endDate></xbrli:period></xbrli:context>`;
  const fact = (id: string, name: string, value: number) => `<ix:nonFraction unitRef="usd" contextRef="${id}" scale="6" name="us-gaap:${name}">${value}</ix:nonFraction>`;
  const html = `<xbrli:unit id="usd"><xbrli:measure>iso4217:USD</xbrli:measure></xbrli:unit>${periods.map((period) =>
    context(period.context, period.start, period.end)
    + members.map((member, index) => context(`${period.context}s${index}`, period.start, period.end, member)).join("")
    + names.map((name, index) => fact(period.context, name, period.values[index])).join("")
    + fact(period.context, "CostOfRevenue", period.adjustedCost)
    + members.map((_, index) => fact(`${period.context}s${index}`, "RevenueFromContractWithCustomerExcludingAssessedTax", period.segments[index])).join("")).join("")}`;
  const amd = fundamentalsSource.getInstrument("twelvedata:XNGS:AMD")!;
  const amdSource = "https://ir.amd.com/financial-information/sec-filings/content/0000002488-26-000018/amd-20251227.htm";
  const statements = parseAmdAnnual(html, amd, amdSource);
  expect(statements).toHaveLength(3);
  expect(statements[0]).toMatchObject({ period: "2025-12-27", revenue: 34_639_000_000, costOfRevenue: 17_487_000_000,
    grossProfit: 17_152_000_000, operatingExpenses: 13_458_000_000, operatingIncome: 3_694_000_000,
    segments: [{ name: "Data Center", revenue: 16_635_000_000 }, { name: "Client and Gaming", revenue: 14_550_000_000 }, { name: "Embedded", revenue: 3_454_000_000 }],
    segmentBasis: "reported", sourceScale: 1_000_000 });
  expect(statements[1].segmentBasis).toBe("retrospectively-adjusted");
  const secondary = { ...statements[0], source: "https://example.com/secondary", grossProfit: 18_183_000_000 };
  expect(mergeFinancialHistory(statements, [secondary])[0].grossProfit).toBe(17_152_000_000);
});

test("missing and malformed sources cannot become financial statements", () => {
  expect(parseIncomeStatement("<html>Unavailable</html>", asset, source)).toEqual([]);
  expect(parseSecAnnual("<html>Unavailable</html>", asset, source)).toEqual([]);
  expect(() => createSnapshotSource({})).toThrow();
  expect(fundamentalsSource.getCompany("twelvedata:FAKE:PLTR")).toBeUndefined();
});

test("published data supplies Financial Anatomy, not a permanent unavailable placeholder", () => {
  const report = fundamentalsSource.getCompany(asset.id)!;
  expect(report.statements.length).toBeGreaterThanOrEqual(3);
  expect(report.statements[0].segments?.map((row) => row.name)).toEqual(["Government", "Commercial"]);
  render(<FinancialAnatomy assetId={asset.id} locale="cs-CZ" statements={report.statements} fetchedAt={report.fetchedAt} />);
  expect(screen.queryByText("Finanční výkazy nejsou dostupné")).not.toBeInTheDocument();
  expect(screen.getByRole("img", { name: /Od tržeb k zisku/ })).toBeInTheDocument();
  expect(screen.getByRole("table")).toHaveTextContent("2025-12-31");
  expect(screen.getAllByText("Government").length).toBeGreaterThan(0);
});

test("published AMD periods use primary GAAP totals and reconciled three-segment revenue", () => {
  const report = fundamentalsSource.getCompany("twelvedata:XNGS:AMD")!;
  expect(report.provider).toContain("amd-sec-ixbrl");
  expect(report.statements.slice(0, 3).map((statement) => statement.source)).toEqual(Array(3).fill("https://ir.amd.com/financial-information/sec-filings/content/0000002488-26-000018/amd-20251227.htm"));
  expect(report.statements[0]).toMatchObject({ revenue: 34_639_000_000, grossProfit: 17_152_000_000, operatingIncome: 3_694_000_000, netIncome: 4_335_000_000 });
  for (const statement of report.statements.slice(0, 3)) {
    expect(statement.segments?.reduce((sum, segment) => sum + segment.revenue, 0)).toBe(statement.revenue);
  }
});

test("published AI universe has provenance, ranked caps and honest sub-100 membership", () => {
  const ai = fundamentalsSource.getIndustries().ai;
  expect(ai.members.length).toBeGreaterThan(18);
  expect(ai.members.length).toBeLessThanOrEqual(100);
  expect(ai.version).toBeTruthy();
  expect(ai.sourceDates).not.toEqual({});
  expect(ai.members.map((row) => row.marketCap)).toEqual(ai.members.map((row) => row.marketCap).sort((a, b) => b - a));
  expect(ai.economics.revenueCoverage).toBeLessThanOrEqual(ai.members.length);
});


test("secondary provider parses exact annual amounts, excluding TTM without scaling displayed millions", () => {
  const raw = readFileSync(path.join(process.cwd(), "tests/fixtures/pltr-income-data.txt"), "utf8");
  const reports = parseIncomeStatement(raw, asset, "https://stockanalysis.com/stocks/pltr/financials/income-statement/");
  expect(reports).toHaveLength(5);
  expect(reports[0].period).toBe("2025-12-31");
  expect(reports[0].revenue).toBe(4475446000);
  expect(parseIncomeStatement(raw.replace("millions USD", "millions EUR"), asset, source)).toEqual([]);
});
