import { act, fireEvent, render, screen, within } from "@testing-library/react";
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
  expect(screen.getByText("Historické ceny akcie nejsou dostupné.")).toBeVisible();
  expect(container.querySelector(".company-chart-heading .company-price-notice")).toHaveTextContent("Historické ceny akcie nejsou dostupné.");
  expect(container.querySelector(".company-price-state")).not.toBeInTheDocument();
  await userEvent.click(screen.getByText("Zdroje výkazů"));
  expect(screen.getByRole("link", { name: "FY2025 · výkaz ↗" })).toHaveAttribute("href", statements[0].source);
  expect(screen.queryByTestId("asset-price-chart")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Cena akcie" }));
  expect(screen.queryByRole("graphics-document")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Zpět na Hospodaření" }));
  expect(screen.getByRole("graphics-document")).toBeVisible();
});

test("hero chart supports pinned keyboard selection, index comparison and navigator range", async () => {
  const { container } = render(<CompanyHistoryChart {...props} />);
  const graph = screen.getByRole("graphics-document");
  act(() => graph.focus());
  await userEvent.keyboard("{Home}{Enter}");
  expect(container.querySelector(".company-chart-readout")).toHaveTextContent("FY2021");
  act(() => graph.blur());
  expect(container.querySelector(".company-chart-readout")).toHaveTextContent("FY2021");
  act(() => graph.focus()); await userEvent.keyboard("{Escape}");
  expect(container.querySelector(".company-chart-readout")).toHaveTextContent("FY2025");
  await userEvent.click(screen.getByRole("button", { name: "Index 100" }));
  const indexedGraph = screen.getByRole("graphics-document"); act(() => indexedGraph.focus());
  await userEvent.keyboard("{Home}");
  expect(within(container.querySelector(".company-chart-readout") as HTMLElement).getAllByText("100")).toHaveLength(3);
  fireEvent.change(screen.getByRole("slider", { name: "Začátek období" }), { target: { value: "2" } });
  expect(screen.getByRole("slider", { name: "Začátek období" })).toHaveValue("2");
  act(() => indexedGraph.focus()); await userEvent.keyboard("{Home}");
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

const pricePoints = [
  { assetId: id, date: "2026-09-01", close: 180, currency: "USD", adjustedForSplits: true },
  { assetId: id, date: "2026-09-02", close: 185, currency: "USD", adjustedForSplits: true },
];

test.each([
  ["cs-CZ", "Cena akcie", "Hospodaření", "Načítám historické ceny akcie…", "Historické ceny akcie nejsou dostupné.", "Zpět na Hospodaření"],
  ["en-US", "Share price", "Business performance", "Loading historical share prices…", "Historical share prices are unavailable.", "Back to business performance"],
])("%s distinguishes price loading and failure while financial statements remain usable", async (locale, price, financial, loading, unavailable, back) => {
  const { rerender, container } = render(<CompanyHistoryChart {...props} locale={locale} priceLoading priceError={false} />);
  expect(screen.getByRole("graphics-document")).toBeVisible();
  expect(screen.queryByText(unavailable)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: price }));
  expect(screen.getByRole("status")).toHaveTextContent(loading);
  rerender(<CompanyHistoryChart {...props} locale={locale} />);
  expect(screen.getByRole("button", { name: price })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("status")).toHaveTextContent(unavailable);
  expect(screen.queryByRole("graphics-document")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: back }));
  expect(screen.getByRole("button", { name: financial })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("graphics-document")).toBeVisible();
  expect(container.querySelector(".company-chart-metrics")).toHaveTextContent("FY2025");
});

test("an explicit financial choice survives a successful price request", async () => {
  const { rerender } = render(<CompanyHistoryChart {...props} priceLoading priceError={false} />);
  await userEvent.click(screen.getByRole("button", { name: "Hospodaření" }));
  rerender(<CompanyHistoryChart {...props} priceError={false} priceData={pricePoints} />);
  expect(screen.getByRole("graphics-document", { name: /roční hospodaření/ })).toBeVisible();
  expect(screen.queryByTestId("asset-price-chart")).not.toBeInTheDocument();
});

test.each(["cs-CZ", "en-US"])("%s offers no statements or return action when reports are missing", async locale => {
  const { rerender, container } = render(<CompanyHistoryChart {...props} locale={locale} statements={[]} />);
  expect(screen.queryByRole("button", { name: /Hospodaření|Business performance|Zpět|Back/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("graphics-document")).not.toBeInTheDocument();
  expect(container.querySelector(".company-chart-sources")).not.toBeInTheDocument();
  rerender(<CompanyHistoryChart {...props} locale={locale} statements={[]} priceError={false} priceData={pricePoints} />);
  expect(screen.getByTestId("asset-price-chart")).toBeVisible();
  expect(screen.queryByRole("button", { name: /Hospodaření|Business performance/ })).not.toBeInTheDocument();
});

test("an explicit price choice survives late reports and a missing financial selection is honest", async () => {
  const { rerender } = render(<CompanyHistoryChart {...props} statements={[]} priceLoading priceError={false} />);
  await userEvent.click(screen.getByRole("button", { name: "Cena akcie" }));
  rerender(<CompanyHistoryChart {...props} />);
  expect(screen.getByRole("button", { name: "Cena akcie" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByRole("graphics-document")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Hospodaření" }));
  rerender(<CompanyHistoryChart {...props} statements={[]} />);
  expect(screen.getByText("Ověřená historie hospodaření není dostupná.")).toBeVisible();
  expect(screen.getByRole("button", { name: "Hospodaření" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByText("Zpět na Hospodaření")).not.toBeInTheDocument();
});
