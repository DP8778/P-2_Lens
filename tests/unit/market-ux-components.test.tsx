import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssetSearch } from "@/components/portfolio/AssetSearch";
import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { ContributionView } from "@/components/charts/ContributionView";
import { AnalysisProvider } from "@/components/portfolio/AnalysisProvider";
import { buildAnalysis, initialTransactions, timeframeRange, type HoldingMetric } from "@/lib/finance/portfolio-engine";

const instruments = [
  { id: "twelvedata:XNAS:AAA", provider: "twelvedata", providerSymbol: "AAA", symbol: "AAA", name: "Alpha Inc.", type: "stock", exchange: "NASDAQ", micCode: "XNAS", currency: "USD" },
  { id: "twelvedata:XETR:AAA", provider: "twelvedata", providerSymbol: "AAA", symbol: "AAA", name: "Alpha European Listing", type: "stock", exchange: "Xetra", micCode: "XETR", currency: "EUR" },
  { id: "twelvedata:XETR:ETF1", provider: "twelvedata", providerSymbol: "ETF1", symbol: "ETF1", name: "A Very Long Global UCITS ETF Name", type: "etf", exchange: "Xetra", micCode: "XETR", currency: "EUR" },
] as const;

describe("large-universe portfolio UX", () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; localStorage.clear(); jest.restoreAllMocks(); });

  test("renders disambiguated listings, filters ETFs and supports keyboard selection", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ assets: instruments }) } as Response);
    const select = jest.fn();
    const user = userEvent.setup();
    render(<AssetSearch mode="personal" existingIds={[instruments[0].id]} onSelect={select} />);
    const search = screen.getByRole("combobox", { name: "Hledat akcii nebo ETF" });
    await user.type(search, "Alpha");
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(3));
    expect(screen.getByText(/NASDAQ · Akcie · USD/)).toBeInTheDocument();
    expect(screen.getByText(/Xetra · Akcie · EUR/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "ETF" }));
    expect(screen.getAllByRole("option")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Vše" }));
    await user.click(search);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(select).toHaveBeenCalledWith(expect.objectContaining({ id: "twelvedata:XETR:AAA" }));
  });

  test("searches, filters and sorts thirty holdings locally", async () => {
    const baseAnalysis = buildAnalysis(initialTransactions, timeframeRange("1M"));
    const base = baseAnalysis.holdings.find((holding) => holding.assetId !== "cash")!;
    const holdings: HoldingMetric[] = Array.from({ length: 30 }, (_, index) => ({ ...base, assetId: `asset-${index}`, marketValue: (index + 1) * 1000, allocationPct: index + 1, pnl: index * 10, returnPct: index, contributionPctPoints: index / 10, asset: { ...base.asset, id: `asset-${index}`, symbol: index === 17 ? "AAPL" : `UX${index}`, name: `Test instrument ${index}`, currency: index % 2 ? "EUR" : "USD", type: index % 3 ? "stock" : "etf" } }));
    const user = userEvent.setup();
    render(<HoldingsTable analysis={{ ...baseAnalysis, holdings }} holdings={holdings} locale="cs-CZ" onSelect={() => undefined} onAdd={() => undefined} period="1M" />);
    await user.type(screen.getByLabelText("Hledat pozici"), "AAPL");
    expect(screen.getAllByRole("button", { name: "Detail AAPL" })).toHaveLength(1);
    await user.clear(screen.getByLabelText("Hledat pozici"));
    await user.selectOptions(screen.getByLabelText("Měna instrumentu"), "EUR");
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(16);
    await user.selectOptions(screen.getByLabelText("Řazení pozic"), "contribution:desc");
    expect(screen.getByLabelText("Řazení pozic")).toHaveValue("contribution:desc");
  });

  test("shows ranked contribution rows before the full thirty-position truth", async () => {
    const base = buildAnalysis(initialTransactions, timeframeRange("1M"));
    const items = Array.from({ length: 30 }, (_, index) => ({ assetId: `asset-${index}`, symbol: `UX${index}`, name: `Instrument ${index}`, periodReturnPct: index - 15, averageAllocationPct: 100 / 30, contributionPctPoints: (index - 15) / 10, contributionSharePct: 100 / 30 }));
    const analysis = { ...base, contribution: { ...base.contribution, items } };
    const user = userEvent.setup();
    const { container } = render(<AnalysisProvider><ContributionView analysis={analysis} locale="cs-CZ" /></AnalysisProvider>);
    expect(container.querySelectorAll(".contribution-row").length).toBeLessThanOrEqual(11);
    await user.click(screen.getByRole("button", { name: "Zobrazit všech 30 pozic" }));
    expect(container.querySelectorAll(".contribution-row").length).toBeGreaterThanOrEqual(30);
  });
});
