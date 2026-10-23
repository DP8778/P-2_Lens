import { act, render, screen, waitFor } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { usePortfolio } from "@/components/portfolio/PortfolioProvider";
import { getDictionary } from "@/i18n/getDictionary";
import { fetchMarketStatus, searchMarketAssets } from "@/lib/market-data/client";
import { loadHistory, loadFxHistory, loadQuotes } from "@/lib/market-data/service";
import { marketDataConfig } from "@/lib/market-data/config";
import { marketThemes } from "@/data/market-themes";
import type { MarketAsset } from "@/lib/market-data/types";

jest.mock("next/navigation", () => ({ usePathname: jest.fn() }));
jest.mock("@/components/layout/GlobalAssetSearch", () => ({ GlobalAssetSearch: () => null }));
jest.mock("@/lib/market-data/client", () => ({ fetchMarketStatus: jest.fn(), searchMarketAssets: jest.fn() }));
jest.mock("@/lib/market-data/service", () => ({ loadHistory: jest.fn(), loadFxHistory: jest.fn(), loadQuotes: jest.fn(), storeMarketQuote: jest.fn() }));
const asset = marketThemes[0].constituents[0];
const spy: MarketAsset = { ...asset, id: "twelvedata:ARCX:SPY", symbol: "SPY", providerSymbol: "SPY", type: "etf" };
function Consumer() {
  const { mode, market } = usePortfolio();
  return <output>{mode}:{market.state}</output>;
}
const shell = () => <AppShell locale="cs-CZ" dictionary={getDictionary("cs-CZ")}><Consumer /></AppShell>;

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.setItem("lens-portfolio-mode-v1", "personal");
  localStorage.setItem("lens-personal-portfolio-v1", JSON.stringify({ version: 1, assets: [asset], transactions: [{ id: "buy-test", type: "buy", assetId: asset.id, quantity: 1, unitPrice: 100, currency: "USD", occurredAt: "2026-09-01", fee: 0 }] }));
  jest.mocked(fetchMarketStatus).mockResolvedValue({ provider: "twelvedata", configured: true });
  jest.mocked(searchMarketAssets).mockResolvedValue([spy]);
  jest.mocked(loadHistory).mockImplementation(async (asset, range) => ({ asset, range, points: [], source: "cache" }));
  jest.mocked(loadFxHistory).mockImplementation(async (base, quote, range) => ({ base, quote, range, points: [], source: "cache" }));
  jest.mocked(loadQuotes).mockResolvedValue([]);
});
afterEach(() => { jest.useRealTimers(); localStorage.clear(); });

test.each(["/cs-CZ/markets", "/en-US/markets/"])("%s does not hydrate personal benchmark/history/FX or poll quotes", async (path) => {
  jest.useFakeTimers();
  jest.mocked(usePathname).mockReturnValue(path);
  render(shell());
  await act(async () => { jest.advanceTimersByTime(marketDataConfig.quotePollMs * 2); window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange")); });
  expect(screen.getByText("personal:idle")).toBeInTheDocument();
  expect(fetchMarketStatus).not.toHaveBeenCalled();
  expect(searchMarketAssets).not.toHaveBeenCalled();
  expect(loadHistory).not.toHaveBeenCalled();
  expect(loadFxHistory).not.toHaveBeenCalled();
  expect(loadQuotes).not.toHaveBeenCalled();
});

test("navigation to dashboard hydrates portfolio and returning to Markets stops background requests", async () => {
  jest.mocked(usePathname).mockReturnValue("/cs-CZ/markets");
  const { rerender } = render(shell());
  await act(async () => {});
  expect(loadHistory).not.toHaveBeenCalled();
  jest.mocked(usePathname).mockReturnValue("/cs-CZ/dashboard");
  rerender(shell());
  await screen.findByText("personal:ready");
  expect(searchMarketAssets).toHaveBeenCalledWith("SPY");
  expect(loadHistory).toHaveBeenCalledWith(spy, expect.any(Object));
  expect(loadHistory).toHaveBeenCalledWith(asset, expect.any(Object));
  expect(loadFxHistory).toHaveBeenCalledWith("USD", "CZK", expect.any(Object));
  jest.mocked(usePathname).mockReturnValue("/cs-CZ/markets");
  rerender(shell());
  await act(async () => {});
  jest.clearAllMocks();
  jest.useFakeTimers();
  await act(async () => { jest.advanceTimersByTime(marketDataConfig.quotePollMs * 2); window.dispatchEvent(new Event("focus")); });
  expect(loadHistory).not.toHaveBeenCalled();
  expect(loadFxHistory).not.toHaveBeenCalled();
  expect(loadQuotes).not.toHaveBeenCalled();
});

test("leaving dashboard during benchmark lookup prevents later history/FX requests on Markets", async () => {
  let resolveSearch!: (assets: MarketAsset[]) => void;
  jest.mocked(searchMarketAssets).mockReturnValue(new Promise((resolve) => { resolveSearch = resolve; }));
  jest.mocked(usePathname).mockReturnValue("/cs-CZ/dashboard");
  const { rerender } = render(shell());
  await waitFor(() => expect(searchMarketAssets).toHaveBeenCalledWith("SPY"));
  jest.mocked(usePathname).mockReturnValue("/cs-CZ/markets");
  rerender(shell());
  await act(async () => resolveSearch([spy]));
  expect(loadHistory).not.toHaveBeenCalled();
  expect(loadFxHistory).not.toHaveBeenCalled();
  expect(loadQuotes).not.toHaveBeenCalled();
});
