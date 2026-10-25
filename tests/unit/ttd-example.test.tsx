import { render, screen } from "@testing-library/react";
import { fundamentalsSource, createSnapshotSource } from "@/lib/fundamentals/snapshot-source";
import snapshot from "@/lib/fundamentals/snapshots/current.json";
import { buildFinancialAnatomy, type FinancialStatement } from "@/lib/finance/financial-anatomy";
import { buildCompanyHistory } from "@/lib/finance/company-history";
import { mergeFinancialHistory, parseTtdAnnual } from "@/lib/finance/fundamentals-normalizers";
import { FinancialAnatomy } from "@/components/assets/FinancialAnatomy";
import { PlatformEconomics, AdvertisingMarketContext } from "@/components/assets/PlatformEconomics";
import { readFileSync } from "node:fs";
import path from "node:path";
const id = "twelvedata:XNGM:TTD";
const record = fundamentalsSource.getCompany(id)!;

test("TTD is a verified Global Market Class A listing outside all index memberships", () => {
  expect(fundamentalsSource.getInstrument(id)).toMatchObject({ symbol: "TTD", micCode: "XNGM", providerSymbol: "TTD", currency: "USD" });
  expect(fundamentalsSource.getInstrument("twelvedata:XNGS:TTD")).toBeUndefined();
  expect(Object.values(fundamentalsSource.getIndustries()).every((industry) => !industry.members.some((member) => member.asset.id === id))).toBe(true);
  const without = { ...snapshot, instruments: [], fundamentals: { ...snapshot.fundamentals, TTD: undefined } };
  delete without.fundamentals.TTD;
  expect(createSnapshotSource(without).getIndustries()).toEqual(fundamentalsSource.getIndustries());
});

test("annual statements use native USD, reconcile expenses once and do not invent gross profit", () => {
  expect(record.statements).toHaveLength(3);
  expect(record.statements[0]).toMatchObject({ period: "2025-12-31", revenue: 2_896_284_000, operatingIncome: 589_321_000, netIncome: 443_304_000, grossSpend: { value: 13_394_683_000 }, sourceScale: 1000 });
  const data = buildFinancialAnatomy(id, record.statements);
  expect(data.status).toBe("available");
  if (data.status !== "available") throw new Error("Missing data");
  expect(data.grossMargin).toBeUndefined();
  expect(data.history).toHaveLength(3);
  for (const s of record.statements) {
    expect(s.grossProfit).toBeUndefined();
    expect(s.costOfRevenue).toBeUndefined();
    expect(s.revenue - s.operatingExpenses).toBe(s.operatingIncome);
    expect(Object.values(s.expenses!).reduce((sum, value) => sum + value, 0)).toBe(s.operatingExpenses);
  }
  expect(data.links.filter((link) => link.from === "revenue").reduce((sum, link) => sum + link.value, 0)).toBe(data.latest.revenue);
  expect(data.links.some((link) => /grossProfit|costOfRevenue/.test(`${link.from}:${link.to}`))).toBe(false);
  expect(buildCompanyHistory(id, record.statements)?.periods).toHaveLength(3);
});

test("invalid totals, invented zero gross profit and mixed presentations are rejected", () => {
  const s = record.statements[0];
  expect(buildFinancialAnatomy(id, [{ ...s, operatingExpenses: 1 }]).status).toBe("unavailable");
  expect(buildFinancialAnatomy(id, [{ ...s, grossProfit: 0 } as unknown as FinancialStatement]).status).toBe("unavailable");
  const bad = JSON.parse(JSON.stringify(snapshot));
  Object.assign(bad.fundamentals.TTD.statements[0], { grossProfit: 0 });
  expect(() => createSnapshotSource(bad)).toThrow();
});

test("secondary refresh cannot replace primary TTD periods, provenance or reporting basis", () => {
  const primary = record.statements[0];
  const secondary: FinancialStatement = { ...primary, source: "https://example.com/secondary", revenue: primary.revenue + 1, grossSpend: undefined };
  expect(mergeFinancialHistory([primary], [secondary])).toEqual([primary]);
  const rechecked = { ...primary, grossSpend: undefined };
  expect(mergeFinancialHistory([primary], [rechecked])[0].grossSpend).toEqual(primary.grossSpend);
  const quarter: FinancialStatement = { ...primary, durationMonths: 3 };
  expect(mergeFinancialHistory([primary], [quarter])).toHaveLength(2);
});

test("the direct-expense UI has history and source values without a fabricated gross margin or donut", () => {
  render(<><FinancialAnatomy assetId={id} locale="cs-CZ" statements={record.statements} /><PlatformEconomics locale="cs-CZ" statements={record.statements} /><AdvertisingMarketContext locale="cs-CZ" /></>);
  expect(screen.queryByText("Hrubá marže")).not.toBeInTheDocument();
  expect(screen.getByText("Objem reklamy není tržba firmy")).toBeInTheDocument();
  expect(screen.getByText("13 394 683 000", { exact: false })).toBeInTheDocument();
  expect(screen.getByText(/Poměr odvozuje Lens/)).toBeInTheDocument();
  expect(screen.getByText("Google Display & Video 360")).toBeInTheDocument();
  expect(screen.getByRole("img", { name: /Od tržeb k zisku/ })).toBeInTheDocument();
});

test("primary TTD adapter reads the statement table in source scale and rejects incomplete rows", () => {
  const html = readFileSync(path.join(process.cwd(), "tests/fixtures/ttd-2025-table.html"), "utf8");
  const asset = fundamentalsSource.getInstrument(id)!;
  const parsed = parseTtdAnnual(html, asset, record.statements[0].source, record.fetchedAt);
  expect(parsed).toHaveLength(3);
  expect(parsed[0]).toMatchObject({ revenue: 2_896_284_000, operatingIncome: 589_321_000, presentation: "operating-expenses" });
  expect(parseTtdAnnual(html.replace("2,306,963", "3,306,963"), asset, record.statements[0].source, record.fetchedAt)).toHaveLength(2);
});
