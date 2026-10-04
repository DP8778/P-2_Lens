import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeDetail } from "@/components/markets/ThemeDetail";
import { marketThemes } from "@/data/market-themes";
import { fundamentalsSource } from "@/lib/fundamentals/snapshot-source";
import { loadHistory } from "@/lib/market-data/service";
import { getBrowserMarketDataCache } from "@/lib/market-data/cache/market-cache";
import { hasReliableIndustryCoverage } from "@/lib/finance/industry-coverage";
import type { DateRange, MarketAsset } from "@/lib/market-data/types";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/lib/market-data/service", () => ({ ...jest.requireActual("@/lib/market-data/service"), loadHistory: jest.fn() }));
jest.mock("@/components/markets/ThemeHistoryChart", () => ({ ThemeHistoryChart: () => <div data-testid="industry-chart" /> }));
const load = jest.mocked(loadHistory);
function history(asset: MarketAsset, range: DateRange) {
  const from = Date.parse(range.from), count = (Date.parse(range.to) - from) / 86400000 + 1;
  return { asset, range, source: "network" as const, points: Array.from({ length: count }, (_, i) => ({ assetId: asset.id, date: new Date(from + i * 86400000).toISOString().slice(0, 10), close: 100 + i, currency: asset.currency, adjustedForSplits: true })) };
}
beforeEach(async () => { load.mockReset(); await getBrowserMarketDataCache().clearMarketData(); });

test("4/49 hides industry analytics; 40/49 unlocks while remaining histories are still queued", async () => {
  const industry = fundamentalsSource.getIndustries().semiconductors;
  const theme = marketThemes.find((item) => item.id === industry.id)!;
  expect(industry.members).toHaveLength(49);
  const release: (() => void)[] = [];
  let calls = 0;
  load.mockImplementation((asset, range, _cache, signal) => {
    if (++calls <= 4) return Promise.resolve(history(asset, range));
    return new Promise((resolve, reject) => {
      release.push(() => resolve(history(asset, range)));
      signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    });
  });
  const bounds = jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 800, height: 360, top: 0, left: 0, bottom: 360, right: 800, x: 0, y: 0, toJSON: () => ({}) });
  try {
    render(<ThemeDetail theme={theme} industry={industry} locale="cs-CZ" />);
    await screen.findByText("4 z 49 společností připraveno");
    expect(screen.getByText("Načítáme vývoj tématu")).toBeVisible();
    const progress = screen.getByRole("progressbar", { name: "Příprava cenové historie tématu" });
    expect(progress).toHaveAttribute("aria-valuemin", "0");
    expect(progress).toHaveAttribute("aria-valuemax", "49");
    expect(progress).toHaveAttribute("aria-valuenow", "4");
    expect(screen.getByText("· 8 %")).toBeVisible();
    expect(screen.queryByRole("group", { name: "Vážení indexu" })).not.toBeInTheDocument();
    expect(screen.queryByText("Výnos za 1M")).not.toBeInTheDocument();
    expect(screen.queryByText("Podíl rostoucích firem")).not.toBeInTheDocument();
    expect(screen.queryByText("Medián výnosu období")).not.toBeInTheDocument();
    expect(screen.queryByTestId("industry-chart")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Co táhne téma?" })).not.toBeInTheDocument();
    expect(screen.getByText("49/49 známých kapitalizací")).toBeVisible();
    const map = screen.getByRole("region", { name: "Mapa univerza" });
    expect(within(map).getAllByRole("link")).toHaveLength(49);
    expect(within(map).getAllByRole("link", { name: /Výnos nedostupný/ })).toHaveLength(45);
    await userEvent.click(screen.getByText(/Prozkoumat šíři růstu/));
    const distributions = screen.getByRole("region", { name: "Struktura univerza" });
    expect(within(distributions).queryByRole("img", { name: /Roste/ })).not.toBeInTheDocument();
    expect(distributions.querySelector(".industry-histogram")).toBeNull();
    await userEvent.click(screen.getByText(/Prozkoumat všechny firmy/));
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row").slice(1).every((row) => row.lastElementChild?.textContent === "—")).toBe(true);
    expect(load).toHaveBeenCalledTimes(6);
    await userEvent.click(screen.getByRole("button", { name: "3M" }));
    await userEvent.click(screen.getByRole("button", { name: "1Y" }));
    expect(load).toHaveBeenCalledTimes(6);
    // Release exactly enough completed observations to cross the shared 80% threshold.
    for (const [from, to, count, percentage] of [[0, 9, 13, 27], [9, 17, 21, 43], [17, 35, 39, 80]]) {
      await act(async () => { for (let i = from; i < to; i++) { while (!release[i]) await Promise.resolve(); release[i](); } });
      expect(await screen.findByText(`${count} z 49 společností připraveno`)).toBeVisible();
      expect(progress).toHaveAttribute("aria-valuenow", String(count));
      expect(screen.getByText(`· ${percentage} %`)).toBeVisible();
      expect(screen.queryByRole("group", { name: "Vážení indexu" })).not.toBeInTheDocument();
    }
    expect(screen.queryByTestId("industry-chart")).not.toBeInTheDocument();
    await act(async () => release[35]());
    await screen.findByTestId("industry-chart");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText(/společností připraveno/)).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Vážení indexu" })).toBeVisible();
    expect(screen.getByTestId("industry-chart")).toBeVisible();
    expect(screen.getByText("Výnos za 1Y").parentElement?.querySelector("strong")).not.toHaveTextContent("—");
    expect(screen.getByText(/Neúplný index: 40\/49/)).toBeVisible();
    expect(screen.queryByText("Načítáme vývoj tématu")).not.toBeInTheDocument();
    load.mockImplementation(async (asset, range) => history(asset, range));
    await act(async () => release.slice(36).forEach((resolve) => resolve()));
    await waitFor(() => expect(screen.getByText(/Index 100 →/)).toHaveTextContent("49/49"));
    expect(screen.getByText(/Index 100 →/)).toHaveTextContent("49/49");
  } finally { bounds.mockRestore(); }
}, 15000);

test("shared policy enforces both proportional and absolute coverage", () => {
  expect(hasReliableIndustryCoverage(4, 49)).toBe(false);
  expect(hasReliableIndustryCoverage(39, 49)).toBe(false);
  expect(hasReliableIndustryCoverage(40, 49)).toBe(true);
  expect(hasReliableIndustryCoverage(8, 10)).toBe(false);
  expect(hasReliableIndustryCoverage(4, 4)).toBe(true);
  expect(hasReliableIndustryCoverage(0, 0)).toBe(false);
});

test("weighted capitalization gaps do not masquerade as missing price history", async () => {
  const source = fundamentalsSource.getIndustries().ai;
  const industry = { ...source, members: source.members.map((member, i) => ({ ...member, marketCap: i < 4 ? member.marketCap : 0 })) };
  load.mockImplementation(async (asset, range) => history(asset, range));
  render(<ThemeDetail theme={marketThemes[0]} industry={industry} locale="cs-CZ" initialNavigation={{ industry: "ai", period: "1M", weighting: "capitalization" }} />);
  await screen.findByText("Nedostatečné pokrytí kapitalizací pro vážený index");
  expect(screen.getByText(/Historie je dostupná pro 60 z 60 společností/)).toBeVisible();
  expect(screen.queryByTestId("industry-chart")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Zobrazit Equal-weight" })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Zobrazit Equal-weight" }));
  expect(screen.getByTestId("industry-chart")).toBeVisible();
  expect(load).toHaveBeenCalledTimes(60);
});
