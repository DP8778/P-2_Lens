import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { FinancialAnatomy } from "@/components/assets/FinancialAnatomy";
import { buildFinancialAnatomy, type FinancialStatement } from "@/lib/finance/financial-anatomy";

// Deterministic test-only statements; never production financial data.
const statement: FinancialStatement = { assetId: "test", period: "2025-12-31", currency: "USD", durationMonths: 12,
  source: "https://example.com/test-statement", revenue: 1000, costOfRevenue: 400, grossProfit: 600,
  operatingExpenses: 300, operatingIncome: 300, netIncome: 200,
  segments: [{ name: "Test products", revenue: 700 }, { name: "Test services", revenue: 300 }],
  expenses: { salesMarketing: 100, researchDevelopment: 120, generalAdministrative: 80 } };

test("statement flow conserves reported revenue, gross profit and operating income", () => {
  const data = buildFinancialAnatomy("test", [statement]);
  if (data.status !== "available") throw new Error("missing statement");
  for (const node of ["revenue", "grossProfit", "operatingExpenses", "operatingIncome"]) {
    const incoming = data.links.filter((link) => link.to === node).reduce((sum, link) => sum + link.value, 0);
    const outgoing = data.links.filter((link) => link.from === node).reduce((sum, link) => sum + link.value, 0);
    expect(incoming).toBeCloseTo(outgoing);
  }
  expect(data.grossMargin).toBe(60);
  expect(data.operatingMargin).toBe(30);
  expect(data.revenueGrowth).toBeUndefined();
  expect(data.links.find((link) => link.to === "netDeductions")?.value).toBe(100);
});

test("revenue growth uses comparable fiscal periods and net additions are explicit", () => {
  const data = buildFinancialAnatomy("test", [{ ...statement, period: "2024-12-31" }, { ...statement, revenue: 1200, costOfRevenue: 600, netIncome: 350 }]);
  if (data.status !== "available") throw new Error("missing statement");
  expect(data.revenueGrowth).toBeCloseTo(20);
  expect(data.links.find((link) => link.from === "netAdditions")?.value).toBe(50);
});

test("missing, wrong-asset and inconsistent statements cannot fabricate a financial flow", () => {
  expect(buildFinancialAnatomy("test").status).toBe("unavailable");
  expect(buildFinancialAnatomy("another", [statement]).status).toBe("unavailable");
  expect(buildFinancialAnatomy("test", [{ ...statement, grossProfit: 100 }]).status).toBe("unavailable");
  expect(buildFinancialAnatomy("test", [{ ...statement, revenue: NaN }]).status).toBe("unavailable");
  render(<FinancialAnatomy assetId="test" locale="cs-CZ" />);
  expect(screen.getByRole("status")).toHaveTextContent("Finanční výkazy nejsou dostupné");
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Finanční přehled")).not.toBeInTheDocument();
  expect(screen.queryByText(/0 %/)).not.toBeInTheDocument();
});

test("available statements render source, revenue structure and accessible flow amounts", async () => {
  render(<FinancialAnatomy assetId="test" locale="cs-CZ" statements={[statement]} />);
  expect(screen.getByRole("img")).toHaveAccessibleName(/Od tržeb k zisku/);
  await userEvent.click(screen.getByText(/Ověřené výkazy · zdroje/));
  expect(screen.getByRole("link", { name: "Zdroj výkazu" })).toHaveAttribute("href", statement.source);
  expect(screen.getAllByText("Test products").length).toBeGreaterThan(0);
  await userEvent.click(screen.getByText("Podrobná historie hospodaření"));
  expect(screen.getByRole("table")).toHaveTextContent("Čistý zisk");
});

test("losses remain signed and never become negative-width flows", () => {
  const data = buildFinancialAnatomy("test", [{ ...statement, netIncome: -20 }]);
  if (data.status !== "available") throw new Error("missing statement");
  expect(data.latest.netIncome).toBe(-20);
  expect(data.flowAvailable).toBe(false);
  expect(data.links).toEqual([]);
});

test("financial snapshot uses verified period, comparable growth and existing margin", () => {
  render(<FinancialAnatomy assetId="test" locale="cs-CZ" statements={[
    { ...statement, period: "2024-12-31" },
    { ...statement, revenue: 1200, costOfRevenue: 600 },
  ]} />);
  const snapshot = screen.getByLabelText("Finanční přehled");
  expect(snapshot).toHaveTextContent("Ověřené období: 12 měsíců do 31. 12. 2025");
  expect(snapshot).toHaveTextContent(/Tržby meziročně \+20,0\s*%/);
  expect(snapshot).toHaveTextContent(/Provozní marže \+25,0\s*%/);
});

test("financial snapshot omits unavailable growth instead of presenting zero", () => {
  render(<FinancialAnatomy assetId="test" locale="cs-CZ" statements={[statement]} />);
  const snapshot = screen.getByLabelText("Finanční přehled");
  expect(snapshot).not.toHaveTextContent("Tržby meziročně");
  expect(snapshot).toHaveTextContent(/Provozní marže \+30,0\s*%/);
});
