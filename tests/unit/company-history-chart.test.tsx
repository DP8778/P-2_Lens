import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompanyHistoryChart } from "@/components/assets/CompanyHistoryChart";
import { CompanyResearchSections } from "@/components/assets/CompanyResearch";
import { buildCompanyHistory, companyHistoryIndex } from "@/lib/finance/company-history";
import { fundamentalsSource } from "@/lib/fundamentals/snapshot-source";

const id = "twelvedata:XNGS:AMD";
const statements = fundamentalsSource.getCompany(id)!.statements;
const props = { assetId: id, symbol: "AMD", currency: "USD", locale: "cs-CZ", statements,
  priceData: [], priceLoading: false, priceError: true, priceControls: <button>1Y</button> };

test("offline company detail plots reported annual statements and retains an explicit price failure", async () => {
  const { container } = render(<CompanyHistoryChart {...props} />);
  expect(screen.getByRole("graphics-document", { name: /AMD · roční hospodaření/ })).toBeVisible();
  expect(container.querySelector(".company-chart-metrics")).toHaveTextContent("34,64");
  expect(screen.getByText("Historická data momentálně nejsou dostupná.")).toBeVisible();
  expect(screen.queryByTestId("asset-price-chart")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Cena akcie" }));
  expect(screen.queryByRole("graphics-document")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Prohlédnout ověřené výkazy" }));
  expect(screen.getByRole("graphics-document")).toBeVisible();
});

test("hero chart supports pinned keyboard selection, index comparison and navigator range", async () => {
  const { container } = render(<CompanyHistoryChart {...props} />);
  const graph = screen.getByRole("graphics-document");
  graph.focus();
  await userEvent.keyboard("{Home}{Enter}");
  expect(container.querySelector(".company-chart-readout")).toHaveTextContent("FY2021");
  graph.blur();
  expect(container.querySelector(".company-chart-readout")).toHaveTextContent("FY2021");
  graph.focus(); await userEvent.keyboard("{Escape}");
  expect(container.querySelector(".company-chart-readout")).toHaveTextContent("FY2025");
  await userEvent.click(screen.getByRole("button", { name: "Index 100" }));
  const indexedGraph = screen.getByRole("graphics-document"); indexedGraph.focus();
  await userEvent.keyboard("{Home}");
  expect(within(container.querySelector(".company-chart-readout") as HTMLElement).getAllByText("100")).toHaveLength(3);
  fireEvent.change(screen.getByRole("slider", { name: "Začátek období" }), { target: { value: "2" } });
  expect(screen.getByRole("slider", { name: "Začátek období" })).toHaveValue("2");
  indexedGraph.focus(); await userEvent.keyboard("{Home}");
  expect(container.querySelector(".company-chart-readout")).toHaveTextContent("FY2023");
});

test("available prices remain a distinct price series with their own units", async () => {
  const { container } = render(<CompanyHistoryChart {...props} priceError={false} priceData={[
    { assetId: id, date: "2026-09-01", close: 180, currency: "USD", adjustedForSplits: true },
    { assetId: id, date: "2026-09-02", close: 185, currency: "USD", adjustedForSplits: true },
  ]} />);
  expect(screen.getByRole("graphics-document", { name: /AMD · cena akcie/ })).toBeVisible();
  expect(container.querySelector(".company-chart-readout")).toHaveTextContent("185");
  expect(screen.queryByText(/Graf zobrazuje hospodaření/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Hospodaření" }));
  expect(screen.getByRole("graphics-document", { name: /AMD · roční hospodaření/ })).toBeVisible();
});

test("index rejects nonpositive profit baselines and financial history keeps the comparable basis", () => {
  const history = buildCompanyHistory(id, statements)!;
  expect(history.periods.map(period => period.period)).toEqual(["2021-12-25", "2022-12-31", "2023-12-30", "2024-12-28", "2025-12-27"]);
  expect(history.periods[1].grossProfit).toBe(10_603_000_000);
  expect(companyHistoryIndex(history.periods, ["revenue"])!.at(-1)!.values[0]).toBeCloseTo(34_639 / 16_434 * 100);
  const negative = history.periods.map((period, index) => index === 0 ? { ...period, operatingIncome: -1 } : period);
  expect(companyHistoryIndex(negative, ["operatingIncome"])).toBeUndefined();
});

test("missing AI research is one compact, actionable state", () => {
  render(<CompanyResearchSections locale="cs-CZ" research={{ loading: false, error: "no_key", refresh: jest.fn(), data: undefined }} />);
  expect(screen.getByRole("heading", { name: "Doplňkový webový výzkum" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Obnovit výzkum" })).toBeEnabled();
  expect(screen.getAllByRole("status")).toHaveLength(1);
  expect(screen.queryByRole("heading", { name: "Čím se firma zabývá?" })).not.toBeInTheDocument();
});
