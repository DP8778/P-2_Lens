import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { parseSecAnnual, parseIncomeStatement, mergeFinancialHistory } from "@/lib/finance/fundamentals-normalizers";
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
  expect(mergeFinancialHistory(statements, [{ ...secondary, netIncome: 100 }])[0].source).toBe(secondary.source);
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
