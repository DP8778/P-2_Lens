jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeDetail } from "@/components/markets/ThemeDetail";
import { industryCompanies } from "@/data/market-industries";
import { marketThemes } from "@/data/market-themes";
import { themeHistoryRange } from "@/lib/finance/theme-performance";
import { loadHistory } from "@/lib/market-data/service";
import { getBrowserMarketDataCache } from "@/lib/market-data/cache/market-cache";
import type { DateRange, MarketAsset } from "@/lib/market-data/types";

jest.mock("@/lib/market-data/service", () => ({ ...jest.requireActual("@/lib/market-data/service"), loadHistory: jest.fn() }));
jest.mock("@/components/markets/ThemeHistoryChart", () => ({ ThemeHistoryChart: () => <div data-testid="theme-chart" /> }));
const load = jest.mocked(loadHistory);
const history = (asset: MarketAsset, range: DateRange) => {
  const from = Date.parse(range.from);
  const length = Math.round((Date.parse(range.to) - from) / 86400000) + 1;
  return { asset, range, source: "network" as const, points: Array.from({ length }, (_, index) => ({ assetId: asset.id, date: new Date(from + index * 86400000).toISOString().slice(0, 10), close: 100 + index, currency: asset.currency, adjustedForSplits: true })) };
};

beforeEach(async () => { load.mockReset(); load.mockImplementation(async (asset, range) => history(asset, range)); await getBrowserMarketDataCache().clearMarketData(); });

test("loads the full selected universe once; 1M → 3M → 1Y and 1W are derived locally", async () => {
  const user = userEvent.setup();
  const { rerender } = render(<ThemeDetail theme={marketThemes[0]} locale="cs-CZ" />);
  await screen.findByTestId("theme-chart");
  await waitFor(() => expect(screen.getByText(/Index 100 →/)).toHaveTextContent(`${industryCompanies(marketThemes[0]).length}/${industryCompanies(marketThemes[0]).length}`));
  expect(load.mock.calls.map(([asset]) => asset.id)).toEqual(industryCompanies(marketThemes[0]).map((asset) => asset.id));
  expect(screen.getByText("Změřeno 18/18 sledovaných firem")).toBeInTheDocument();
  await user.click(screen.getByText("Prozkoumat šíři růstu a rozdělení výnosů"));
  expect(within(screen.getByRole("region", { name: "Šíře tématu" })).getAllByRole("link")).toHaveLength(6);
  expect(screen.getByText(/Index 100 →/)).toHaveTextContent("18/18 firem zahrnuto");
  expect(load).toHaveBeenCalledTimes(18);
  expect(load.mock.calls.every(([, range]) => JSON.stringify(range) === JSON.stringify(themeHistoryRange("1Y")))).toBe(true);
  let previousSummary = screen.getByText(/Index 100 →/).textContent;
  for (const period of ["3M", "1Y", "1W"]) {
    await user.click(screen.getByRole("button", { name: period }));
    await screen.findByTestId("theme-chart");
    await waitFor(() => expect(screen.getByText(/Index 100 →/)).toHaveTextContent(`${industryCompanies(marketThemes[0]).length}/${industryCompanies(marketThemes[0]).length}`));
    expect(screen.getByRole("button", { name: period })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(`Výnos za ${period}`)).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(18);
    expect(screen.getByText(/Index 100 →/).textContent).not.toBe(previousSummary);
    previousSummary = screen.getByText(/Index 100 →/).textContent;
  }
  expect(load).toHaveBeenCalledTimes(18);
  rerender(<ThemeDetail theme={marketThemes[4]} locale="cs-CZ" />);
  await screen.findByTestId("theme-chart");
  await waitFor(() => expect(screen.getByText(/Index 100 →/)).toHaveTextContent(`${industryCompanies(marketThemes[4]).length}/${industryCompanies(marketThemes[4]).length}`));
  expect(load.mock.calls.slice(18).map(([asset]) => asset.id)).toEqual(industryCompanies(marketThemes[4]).map((asset) => asset.id));
  expect(screen.getByRole("region", { name: "Historie tématu Cybersecurity" })).toBeInTheDocument();
});

test.each(["missing", "failure"])("%s history leaves an explicitly partial industry index", async (reason) => {
  load.mockImplementation(async (asset, range) => {
    const result = history(asset, range);
    if (asset.id === marketThemes[0].constituents[0].id) {
      if (reason === "failure") throw new Error("offline");
      result.points = [];
    }
    return result;
  });
  render(<ThemeDetail theme={marketThemes[0]} locale="cs-CZ" />);
  await screen.findByTestId("theme-chart");
  await waitFor(() => expect(screen.getByText(/Index 100 →/)).toHaveTextContent("17/18"));
  expect(screen.getByText(/Index 100 →/)).toHaveTextContent("17/18 firem zahrnuto · částečné pokrytí");
  expect(screen.getByRole("button", { name: "1Y" })).toBeEnabled();
});

test("total history failure displays an unavailable state and retains controls", async () => {
  load.mockRejectedValue(new Error("offline"));
  render(<ThemeDetail theme={marketThemes[0]} locale="cs-CZ" />);
  await screen.findByText("Nedostatečné pokrytí historických dat");
  expect(screen.queryByTestId("theme-chart")).not.toBeInTheDocument();
  expect(screen.queryByText("Výnos za 1M")).not.toBeInTheDocument();
  expect(screen.queryByRole("group", { name: "Vážení indexu" })).not.toBeInTheDocument();
  expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
});

test("rapid theme switching cancels queued work and ignores late old responses", async () => {
  const resolvers: (() => void)[] = [];
  load.mockImplementation((asset, range, _cache, signal) => new Promise((resolve, reject) => {
    resolvers.push(() => resolve(history(asset, range)));
    signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  }));
  const { rerender } = render(<ThemeDetail theme={marketThemes[0]} locale="cs-CZ" />);
  await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  const oldSignals = load.mock.calls.map((call) => call[3]);
  rerender(<ThemeDetail theme={marketThemes[4]} locale="cs-CZ" />);
  await waitFor(() => expect(load).toHaveBeenCalledTimes(4));
  expect(oldSignals.every((signal) => signal?.aborted)).toBe(true);
  await act(async () => resolvers.slice(0, 2).forEach((resolve) => resolve()));
  expect(screen.getByText("Načítáme vývoj tématu")).toBeVisible();
  expect(screen.queryByTestId("theme-chart")).not.toBeInTheDocument();
  load.mockImplementation(async (asset, range) => history(asset, range));
  await act(async () => resolvers.slice(2).forEach((resolve) => resolve()));
  await waitFor(() => expect(screen.getByText(/Index 100 →/)).toHaveTextContent(`${industryCompanies(marketThemes[4]).length}/${industryCompanies(marketThemes[4]).length}`));
  expect(load).toHaveBeenCalledTimes(22);
  expect(within(screen.getByRole("region", { name: "Historie tématu Cybersecurity" })).getByTestId("theme-chart")).toBeInTheDocument();
});

test("failed refresh can display a complete cached history with an explicit stale notice", async () => {
  const cache = getBrowserMarketDataCache();
  load.mockImplementation(async (asset, range) => {
    await cache.putHistory({ key: asset.id, assetId: asset.id, ...range, points: history(asset, range).points, updatedAt: "2020-01-01T00:00:00Z", provider: asset.provider, version: 1 });
    throw new Error("offline");
  });
  render(<ThemeDetail theme={marketThemes[0]} locale="cs-CZ" />);
  await screen.findByTestId("theme-chart");
  await waitFor(() => expect(screen.getByText(/Index 100 →/)).toHaveTextContent(`${industryCompanies(marketThemes[0]).length}/${industryCompanies(marketThemes[0]).length}`));
  expect(await screen.findByText(/Zobrazuji dostupná data/)).toBeVisible();
  expect(screen.getByText("Změřeno 18/18 sledovaných firem")).toBeInTheDocument();
});

test("existing history cache serves shorter periods and revisits without network requests", async () => {
  const realService = jest.requireActual<typeof import("@/lib/market-data/service")>("@/lib/market-data/service");
  load.mockImplementation(realService.loadHistory);
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockImplementation(async (input: string) => {
    const url = new URL(input, "http://localhost");
    const asset = JSON.parse(url.searchParams.get("asset")!) as MarketAsset;
    const range: DateRange = { from: url.searchParams.get("from")!, to: url.searchParams.get("to")!, interval: "1day" };
    return { ok: true, json: async () => history(asset, range) };
  });
  try {
    const user = userEvent.setup();
    const { rerender } = render(<ThemeDetail theme={marketThemes[0]} locale="cs-CZ" />);
    await screen.findByTestId("theme-chart");
    await waitFor(() => expect(screen.getByText(/Index 100 →/)).toHaveTextContent(`${industryCompanies(marketThemes[0]).length}/${industryCompanies(marketThemes[0]).length}`));
    expect(global.fetch).toHaveBeenCalledTimes(18);
    for (const period of ["3M", "1Y", "1W", "1M"]) {
      await user.click(screen.getByRole("button", { name: period }));
      await screen.findByTestId("theme-chart");
      await waitFor(() => expect(screen.getByText(/Index 100 →/)).toHaveTextContent(`${industryCompanies(marketThemes[0]).length}/${industryCompanies(marketThemes[0]).length}`));
      expect(global.fetch).toHaveBeenCalledTimes(18);
      expect(load).toHaveBeenCalledTimes(18);
    }
    // Shared constituents reuse the existing history cache.
    rerender(<ThemeDetail theme={marketThemes[1]} locale="cs-CZ" />);
    await screen.findByTestId("theme-chart");
    await waitFor(() => expect(screen.getByText(/Index 100 →/)).toHaveTextContent(`${industryCompanies(marketThemes[1]).length}/${industryCompanies(marketThemes[1]).length}`));
    expect(global.fetch).toHaveBeenCalledTimes(new Set([...industryCompanies(marketThemes[0]), ...industryCompanies(marketThemes[1])].map((asset) => asset.id)).size);
    rerender(<ThemeDetail theme={marketThemes[0]} locale="cs-CZ" />);
    await screen.findByTestId("theme-chart");
    await waitFor(() => expect(screen.getByText(/Index 100 →/)).toHaveTextContent(`${industryCompanies(marketThemes[0]).length}/${industryCompanies(marketThemes[0]).length}`));
    expect(global.fetch).toHaveBeenCalledTimes(new Set([...industryCompanies(marketThemes[0]), ...industryCompanies(marketThemes[1])].map((asset) => asset.id)).size);
  } finally { global.fetch = originalFetch; }
});

test("switching period during the initial load reuses the same pending universe histories", async () => {
  const user = userEvent.setup();
  const resolvers: (() => void)[] = [];
  load.mockImplementation((asset, range, _cache, signal) => new Promise((resolve, reject) => { resolvers.push(() => resolve(history(asset, range))); signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true }); }));
  render(<ThemeDetail theme={marketThemes[0]} locale="cs-CZ" />);
  await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  await user.click(screen.getByRole("button", { name: "3M" }));
  await user.click(screen.getByRole("button", { name: "1Y" }));
  expect(load).toHaveBeenCalledTimes(2);
  load.mockImplementation(async (asset, range) => history(asset, range));
  await act(async () => resolvers.forEach((resolve) => resolve()));
  await waitFor(() => expect(screen.getByText(/Index 100 →/)).toHaveTextContent(`${industryCompanies(marketThemes[0]).length}/${industryCompanies(marketThemes[0]).length}`));
  expect(load).toHaveBeenCalledTimes(18);
  expect(screen.getByTestId("theme-chart")).toBeInTheDocument();
  expect(screen.getByText("Výnos za 1Y")).toBeInTheDocument();
});

test("an incomplete constituent remains unavailable across periods without refetching", async () => {
  const user = userEvent.setup();
  load.mockImplementation(async (asset, range) => {
    if (asset.id === marketThemes[0].constituents[0].id) throw new Error("offline");
    return history(asset, range);
  });
  render(<ThemeDetail theme={marketThemes[0]} locale="cs-CZ" />);
  await screen.findByTestId("theme-chart");
  await waitFor(() => expect(screen.getByText(/Index 100 →/)).toHaveTextContent("17/18"));
  for (const period of ["3M", "1Y", "1W"]) {
    await user.click(screen.getByRole("button", { name: period }));
    expect(screen.getByText(/Index 100 →/)).toHaveTextContent("17/18 firem zahrnuto");
    expect(screen.getByTestId("theme-chart")).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(18);
  }
});


test.each(["cs-CZ", "en-US"])("industry company rows navigate to Asset Detail and update periods locally for %s", async (locale) => {
  render(<ThemeDetail theme={marketThemes[0]} locale={locale} />);
  await screen.findByTestId("theme-chart");
  await waitFor(() => expect(screen.getByText(/Index 100 →/)).toHaveTextContent(`${industryCompanies(marketThemes[0]).length}/${industryCompanies(marketThemes[0]).length}`));
  await userEvent.click(screen.getByText(locale === "en-US" ? /Explore all companies/ : /Prozkoumat všechny firmy/));
  const table = screen.getByRole("region", { name: locale === "en-US" ? "Universe companies" : "Firmy v univerzu" });
  for (const asset of marketThemes[0].constituents) {
    expect(within(table).getByRole("link", { name: new RegExp(asset.symbol) })).toHaveAttribute("href", `/${locale}/assets/${encodeURIComponent(asset.id)}?industry=ai&period=1M&weighting=equal&asOf=${new Date().toISOString().slice(0, 10)}`);
  }
  const nvda = within(table).getByRole("link", { name: /NVDA/ }).closest("tr")!;
  const previous = nvda.textContent;
  await userEvent.click(screen.getByRole("button", { name: "1Y" }));
  expect(nvda.textContent).not.toBe(previous);
  expect(load).toHaveBeenCalledTimes(18);
});


test("weighting switches use the same loaded universe and show cap coverage", async () => {
  render(<ThemeDetail theme={marketThemes[0]} locale="cs-CZ" />);
  await screen.findByTestId("theme-chart");
  await waitFor(() => expect(screen.getByText(/Index 100 →/)).toHaveTextContent(`${industryCompanies(marketThemes[0]).length}/${industryCompanies(marketThemes[0]).length}`));
  const group = screen.getByRole("group", { name: "Vážení indexu" });
  await userEvent.click(within(group).getByRole("button", { name: /Váženo kapitalizací/ }));
  expect(screen.getByText(/Index 100 →/)).toHaveTextContent("17/18 firem zahrnuto");
  expect(load).toHaveBeenCalledTimes(18);
});
