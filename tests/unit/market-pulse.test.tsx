import { StrictMode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarketPulse } from "@/components/markets/MarketPulse";
import { marketThemes } from "@/data/market-themes";
import { getBrowserMarketDataCache } from "@/lib/market-data/cache/market-cache";
import type { MarketAsset, MarketQuote } from "@/lib/market-data/types";

const quote = (asset: MarketAsset): MarketQuote => ({
  assetId: asset.id, price: 123, currency: "USD", timestamp: new Date().toISOString(),
  marketState: "open", freshness: "fresh", source: "network", changePercent: 1,
});
const requested = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string).assets;

describe("MarketPulse quote budget", () => {
  const originalFetch = global.fetch;
  beforeEach(async () => {
    await getBrowserMarketDataCache().clearMarketData();
    global.fetch = jest.fn().mockImplementation(async (_, init: RequestInit) => ({
      ok: true, json: async () => ({ quotes: JSON.parse(init.body as string).assets.map(quote) }),
    }));
  });
  afterEach(() => { global.fetch = originalFetch; });

  test("initial Markets load batches exactly the selected four symbols, including in StrictMode", async () => {
    render(<StrictMode><MarketPulse locale="cs-CZ" variant="full" /></StrictMode>);
    await screen.findAllByText("123 USD");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(requested((global.fetch as jest.Mock).mock.calls[0])).toEqual(marketThemes[0].constituents);
    expect(screen.getAllByText("123 USD")).toHaveLength(4);
  });

  test("switching themes requests only missing constituents and revisiting uses cache", async () => {
    const user = userEvent.setup();
    render(<MarketPulse locale="cs-CZ" variant="full" />);
    await screen.findAllByText("123 USD");
    await user.click(screen.getByRole("button", { name: /^AI Infrastructure/ }));
    await waitFor(() => expect(screen.getAllByText("123 USD")).toHaveLength(4));
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(requested((global.fetch as jest.Mock).mock.calls[1])).toEqual(marketThemes[1].constituents.slice(1));
    await user.click(screen.getAllByRole("button")[0]);
    await waitFor(() => expect(screen.getAllByText("123 USD")).toHaveLength(4));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  test("honors a linked theme and renders partial prices without a global error", async () => {
    const theme = marketThemes[4];
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ quotes: [quote(theme.constituents[0])] }) });
    render(<MarketPulse locale="cs-CZ" variant="full" initialThemeId={theme.id} />);
    await screen.findByText("123 USD");
    expect(requested((global.fetch as jest.Mock).mock.calls[0])).toEqual(theme.constituents);
    expect(screen.getAllByText("Cena nedostupná")).toHaveLength(3);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  test("compact pulse uses fresh cache and leaves other themes cache-only", async () => {
    const cache = getBrowserMarketDataCache();
    for (const asset of marketThemes[0].constituents) {
      await cache.putQuote({ key: asset.id, quote: quote(asset), updatedAt: new Date().toISOString() });
    }
    render(<MarketPulse locale="cs-CZ" />);
    await screen.findByText("4 / 4 roste · 0 klesá");
    expect(global.fetch).not.toHaveBeenCalled();
    expect(within(screen.getByRole("link", { name: /Cybersecurity/ })).getByText("Data nejsou dostupná")).toBeInTheDocument();
  });

  test("cold compact pulse loads only the default theme", async () => {
    render(<MarketPulse locale="cs-CZ" />);
    await screen.findByText("4 / 4 roste · 0 klesá");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(requested((global.fetch as jest.Mock).mock.calls[0])).toEqual(marketThemes[0].constituents);
  });
});
