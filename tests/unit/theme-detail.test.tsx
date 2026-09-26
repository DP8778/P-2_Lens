import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeDetail } from "@/components/markets/ThemeDetail";
import { marketThemes } from "@/data/market-themes";
import { themeHistoryRange } from "@/lib/finance/theme-performance";
import { loadHistory } from "@/lib/market-data/service";
import { getBrowserMarketDataCache } from "@/lib/market-data/cache/market-cache";
import type { DateRange, MarketAsset } from "@/lib/market-data/types";

jest.mock("@/lib/market-data/service", () => ({ loadHistory: jest.fn() }));
jest.mock("@/components/markets/ThemeHistoryChart", () => ({ ThemeHistoryChart: () => <div data-testid="theme-chart" /> }));
const load = jest.mocked(loadHistory);
const history = (asset: MarketAsset, range: DateRange) => {
  const from = Date.parse(range.from);
  const length = Math.round((Date.parse(range.to) - from) / 86400000) + 1;
  return { asset, range, source: "network" as const, points: Array.from({ length }, (_, index) => ({ assetId: asset.id, date: new Date(from + index * 86400000).toISOString().slice(0, 10), close: 100 + index, currency: asset.currency, adjustedForSplits: true })) };
};

beforeEach(async () => { load.mockReset(); load.mockImplementation(async (asset, range) => history(asset, range)); await getBrowserMarketDataCache().clearMarketData(); });

test("loads four annual histories once; 1M → 3M → 1Y and 1W are derived locally", async () => {
  const user = userEvent.setup();
  const { rerender } = render(<ThemeDetail theme={marketThemes[0]} locale="cs-CZ" />);
  await screen.findByTestId("theme-chart");
  expect(load.mock.calls.map(([asset]) => asset.id)).toEqual(marketThemes[0].constituents.map((asset) => asset.id));
  expect(screen.getByText("4 / 4 titulů v plusu")).toBeInTheDocument();
  expect(screen.getByText("2 nejsilnější tituly").parentElement!.querySelectorAll("p")).toHaveLength(2);
  expect(screen.getByText("2 nejslabší tituly").parentElement!.querySelectorAll("p")).toHaveLength(2);
  expect(screen.getByText(/Index 100 →/)).toHaveTextContent("4/4 titulů");
  expect(load).toHaveBeenCalledTimes(4);
  expect(load.mock.calls.every(([, range]) => JSON.stringify(range) === JSON.stringify(themeHistoryRange("1Y")))).toBe(true);
  let previousSummary = screen.getByText(/Index 100 →/).textContent;
  for (const period of ["3M", "1Y", "1W"]) {
    await user.click(screen.getByRole("button", { name: period }));
    await screen.findByTestId("theme-chart");
    expect(screen.getByRole("button", { name: period })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(`Výnos za ${period}`)).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(4);
    expect(screen.getByText(/Index 100 →/).textContent).not.toBe(previousSummary);
    previousSummary = screen.getByText(/Index 100 →/).textContent;
  }
  expect(load).toHaveBeenCalledTimes(4);
  rerender(<ThemeDetail theme={marketThemes[4]} locale="cs-CZ" />);
  await screen.findByTestId("theme-chart");
  expect(load.mock.calls.slice(4).map(([asset]) => asset.id)).toEqual(marketThemes[4].constituents.map((asset) => asset.id));
  expect(screen.getByRole("region", { name: "Historie tématu Cybersecurity" })).toBeInTheDocument();
});

test.each(["missing", "failure"])("%s history hides chart, return and rankings without hiding controls", async (reason) => {
  load.mockImplementation(async (asset, range) => {
    const result = history(asset, range);
    if (asset.id === marketThemes[0].constituents[0].id) {
      if (reason === "failure") throw new Error("offline");
      if (reason === "missing") result.points = [];
    }
    return result;
  });
  render(<ThemeDetail theme={marketThemes[0]} locale="cs-CZ" />);
  await screen.findByText(/Výkonnost vyžaduje úplnou historii/);
  expect(screen.queryByTestId("theme-chart")).not.toBeInTheDocument();
  expect(screen.queryByText("2 nejsilnější tituly")).not.toBeInTheDocument();
  expect(screen.getByText("Výnos za 1M").parentElement).toHaveTextContent("—");
  expect(screen.getByRole("button", { name: "1Y" })).toBeEnabled();
});

test("rapid theme switching ignores a late response for the previous theme", async () => {
  const resolvers: (() => void)[] = [];
  load.mockImplementation((asset, range) => new Promise((resolve) => { resolvers.push(() => resolve(history(asset, range))); }));
  const { rerender } = render(<ThemeDetail theme={marketThemes[0]} locale="cs-CZ" />);
  await waitFor(() => expect(load).toHaveBeenCalledTimes(4));
  rerender(<ThemeDetail theme={marketThemes[4]} locale="cs-CZ" />);
  await waitFor(() => expect(load).toHaveBeenCalledTimes(8));
  await act(async () => resolvers.slice(0, 4).forEach((resolve) => resolve()));
  expect(screen.getByText("Načítám historii tématu…")).toBeInTheDocument();
  expect(screen.queryByTestId("theme-chart")).not.toBeInTheDocument();
  await act(async () => resolvers.slice(4).forEach((resolve) => resolve()));
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
  expect(screen.getByRole("status")).toHaveTextContent("Zobrazuji uložená data");
  expect(screen.getByText("4 / 4 titulů v plusu")).toBeInTheDocument();
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
    expect(global.fetch).toHaveBeenCalledTimes(4);
    for (const period of ["3M", "1Y", "1W", "1M"]) {
      await user.click(screen.getByRole("button", { name: period }));
      await screen.findByTestId("theme-chart");
      expect(global.fetch).toHaveBeenCalledTimes(4);
      expect(load).toHaveBeenCalledTimes(4);
    }
    // Infrastructure shares NVDA: only its other three histories need the network.
    rerender(<ThemeDetail theme={marketThemes[1]} locale="cs-CZ" />);
    await screen.findByTestId("theme-chart");
    expect(global.fetch).toHaveBeenCalledTimes(7);
    rerender(<ThemeDetail theme={marketThemes[0]} locale="cs-CZ" />);
    await screen.findByTestId("theme-chart");
    expect(global.fetch).toHaveBeenCalledTimes(7);
  } finally { global.fetch = originalFetch; }
});

test("switching period during the initial load reuses the same four pending histories", async () => {
  const user = userEvent.setup();
  const resolvers: (() => void)[] = [];
  load.mockImplementation((asset, range) => new Promise((resolve) => { resolvers.push(() => resolve(history(asset, range))); }));
  render(<ThemeDetail theme={marketThemes[0]} locale="cs-CZ" />);
  await waitFor(() => expect(load).toHaveBeenCalledTimes(4));
  await user.click(screen.getByRole("button", { name: "3M" }));
  await user.click(screen.getByRole("button", { name: "1Y" }));
  expect(load).toHaveBeenCalledTimes(4);
  await act(async () => resolvers.forEach((resolve) => resolve()));
  expect(screen.getByTestId("theme-chart")).toBeInTheDocument();
  expect(screen.getByText("Šíře růstu za 1Y")).toBeInTheDocument();
});

test("an incomplete constituent remains unavailable across periods without refetching", async () => {
  const user = userEvent.setup();
  load.mockImplementation(async (asset, range) => {
    if (asset.id === marketThemes[0].constituents[0].id) throw new Error("offline");
    return history(asset, range);
  });
  render(<ThemeDetail theme={marketThemes[0]} locale="cs-CZ" />);
  await screen.findByText(/Výkonnost vyžaduje úplnou historii/);
  for (const period of ["3M", "1Y", "1W"]) {
    await user.click(screen.getByRole("button", { name: period }));
    expect(screen.getByText(/Výkonnost vyžaduje úplnou historii/)).toBeInTheDocument();
    expect(screen.queryByTestId("theme-chart")).not.toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(4);
  }
});
