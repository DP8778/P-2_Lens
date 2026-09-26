import { StrictMode } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
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
    const card = screen.getAllByRole("button")[0];
    expect(card).toHaveTextContent("4 / 4 titulů k dispozici");
    expect(card).not.toHaveTextContent("Částečná data");
    expect(card.querySelector("strong")).toHaveTextContent(/1.*%/);
    expect(card).toHaveTextContent("4 roste · 0 klesá");
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
    const card = screen.getByRole("button", { name: /Cybersecurity/ });
    expect(card).toHaveTextContent("Částečná data · 1/4 titulů");
    expect(card).not.toHaveTextContent(/roste|klesá/);
    expect(card.querySelector("strong")).toHaveTextContent(/^—$/);
    expect(card.querySelector("strong")).not.toHaveClass("positive", "negative");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  test("total refresh failure with empty cache shows the existing notice", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("offline"));
    render(<MarketPulse locale="cs-CZ" variant="full" />);
    expect(await screen.findByRole("status")).toHaveTextContent("Část aktuálních market dat není dostupná.");
    expect(screen.getAllByText("Cena nedostupná")).toHaveLength(4);
    expect(screen.queryByText("Načítám…")).not.toBeInTheDocument();
  });

  test("stale cache stays visible during refresh and after network failure", async () => {
    const asset = marketThemes[0].constituents[0];
    const cache = getBrowserMarketDataCache();
    await cache.putQuote({ key: asset.id, quote: quote(asset), updatedAt: "2020-01-01T00:00:00Z" });
    let rejectRefresh!: (error: Error) => void;
    global.fetch = jest.fn().mockReturnValue(new Promise((_, reject) => { rejectRefresh = reject; }));
    render(<MarketPulse locale="cs-CZ" variant="full" />);
    await screen.findByText("123 USD");
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(screen.getAllByRole("button")[0]).toHaveTextContent("Částečná data · 1/4 titulů");
    await act(async () => rejectRefresh(new Error("offline")));
    expect(screen.getByText("123 USD")).toBeInTheDocument();
    expect(screen.getAllByText("Cena nedostupná")).toHaveLength(3);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect((await cache.getQuote(asset.id))?.quote).toEqual(expect.objectContaining({ price: 123 }));
    expect((await cache.getQuote(asset.id))?.updatedAt).toBe("2020-01-01T00:00:00Z");
  });

  test("uncached selected theme remains loading until its request resolves, also after switching", async () => {
    const user = userEvent.setup();
    let resolveRefresh!: (response: unknown) => void;
    global.fetch = jest.fn().mockImplementation(() => new Promise((resolve) => { resolveRefresh = resolve; }));
    render(<MarketPulse locale="cs-CZ" variant="full" />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const ai = screen.getAllByRole("button")[0];
    expect(ai).toHaveTextContent("Načítám…");
    expect(ai).not.toHaveTextContent("Data nejsou dostupná");
    expect(screen.queryByText("Cena nedostupná")).not.toBeInTheDocument();
    await act(async () => resolveRefresh({ ok: true, json: async () => ({ quotes: marketThemes[0].constituents.map(quote) }) }));
    await user.click(screen.getByRole("button", { name: /Cybersecurity/ }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
    const cyber = screen.getByRole("button", { name: /Cybersecurity/ });
    expect(cyber).toHaveTextContent("Načítám…");
    expect(cyber).not.toHaveTextContent("Data nejsou dostupná");
    expect(ai).toHaveTextContent("4 / 4 titulů k dispozici");
    await act(async () => resolveRefresh({ ok: true, json: async () => ({ quotes: [] }) }));
    expect(cyber).toHaveTextContent("Data nejsou dostupná");
    expect(cyber.querySelector("strong")).toHaveTextContent(/^—$/);
    expect(cyber).not.toHaveTextContent(/Částečná data|roste|klesá/);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  test("compact pulse uses fresh cache and leaves other themes cache-only", async () => {
    const cache = getBrowserMarketDataCache();
    for (const asset of marketThemes[0].constituents) {
      await cache.putQuote({ key: asset.id, quote: quote(asset), updatedAt: new Date().toISOString() });
    }
    render(<MarketPulse locale="cs-CZ" />);
    await screen.findByText("4 / 4 titulů k dispozici · 4 roste · 0 klesá");
    expect(global.fetch).not.toHaveBeenCalled();
    expect(within(screen.getByRole("link", { name: /Cybersecurity/ })).getByText("Data nejsou dostupná")).toBeInTheDocument();
  });

  test("cold compact pulse loads only the default theme", async () => {
    render(<MarketPulse locale="cs-CZ" />);
    await screen.findByText("4 / 4 titulů k dispozici · 4 roste · 0 klesá");
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(requested((global.fetch as jest.Mock).mock.calls[0])).toEqual(marketThemes[0].constituents);
  });
});
