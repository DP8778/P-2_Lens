import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssetSearch } from "@/components/portfolio/AssetSearch";
import { getBrowserMarketDataCache } from "@/lib/market-data/cache/market-cache";
import type { MarketAsset, MarketQuote } from "@/lib/market-data/types";

const assets: MarketAsset[] = Array.from({ length: 20 }, (_, index) => ({
  id: `twelvedata:XNGS:P${index}`,
  provider: "twelvedata",
  providerSymbol: `P${index}`,
  symbol: `P${index}`,
  name: `Preview Company ${index}`,
  type: "stock",
  exchange: "NASDAQ",
  micCode: "XNGS",
  currency: "USD",
}));

const quoteFor = (asset: MarketAsset, price = 100): MarketQuote => ({
  assetId: asset.id,
  price,
  currency: asset.currency,
  timestamp: "2026-09-15T13:30:00.000Z",
  marketState: "open",
  freshness: "fresh",
  source: "network",
});

const ok = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
}) as Response;

function requestedAsset(init?: RequestInit) {
  return (JSON.parse(String(init?.body)) as { assets: MarketAsset[] }).assets[0];
}

describe("AssetSearch active quote preview", () => {
  const originalFetch = global.fetch;

  afterEach(async () => {
    await getBrowserMarketDataCache().clearMarketData();
    global.fetch = originalFetch;
    localStorage.clear();
    jest.restoreAllMocks();
  });

  test("renders result metadata before the active quote resolves", async () => {
    global.fetch = jest.fn().mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes("/status")) return Promise.resolve(ok({ provider: "twelvedata", configured: true }));
      if (url.includes("/search")) return Promise.resolve(ok({ assets }));
      return new Promise((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError"))));
    });
    const view = render(<AssetSearch mode="personal" existingIds={[]} onSelect={() => undefined} />);
    const user = userEvent.setup();
    const search = screen.getByLabelText("Hledat akcii nebo ETF");
    await waitFor(() => expect(search).toBeEnabled());
    await user.type(search, "Preview");

    expect(await screen.findByText("Preview Company 0")).toBeVisible();
    expect(screen.getAllByText(/NASDAQ · Akcie · USD/)).toHaveLength(20);
    view.unmount();
  });

  test("twenty results load a quote only for the active instrument", async () => {
    let quoteRequests = 0;
    global.fetch = jest.fn().mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/status")) return ok({ provider: "twelvedata", configured: true });
      if (url.includes("/search")) return ok({ assets });
      quoteRequests += 1;
      const asset = requestedAsset(init);
      return ok({ quotes: [quoteFor(asset, 100 + Number(asset.symbol.slice(1)))] });
    });
    const user = userEvent.setup();
    render(<AssetSearch mode="personal" existingIds={[]} onSelect={() => undefined} />);
    const search = screen.getByLabelText("Hledat akcii nebo ETF");
    await waitFor(() => expect(search).toBeEnabled());
    await user.type(search, "Preview");

    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(20));
    expect(await screen.findByText("100 USD")).toBeVisible();
    expect(quoteRequests).toBe(1);
  });

  test("ArrowDown changes the debounced active quote preview", async () => {
    let quoteRequests = 0;
    global.fetch = jest.fn().mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/status")) return ok({ provider: "twelvedata", configured: true });
      if (url.includes("/search")) return ok({ assets: assets.slice(0, 3) });
      quoteRequests += 1;
      const asset = requestedAsset(init);
      return ok({ quotes: [quoteFor(asset, 100 + Number(asset.symbol.slice(1)))] });
    });
    const user = userEvent.setup();
    render(<AssetSearch mode="personal" existingIds={[]} onSelect={() => undefined} />);
    const search = screen.getByLabelText("Hledat akcii nebo ETF");
    await waitFor(() => expect(search).toBeEnabled());
    await user.type(search, "Preview");
    expect(await screen.findByText("100 USD")).toBeVisible();

    await user.click(search);
    await user.keyboard("{ArrowDown}");
    expect(await screen.findByText("101 USD")).toBeVisible();
    expect(quoteRequests).toBe(2);
  });

  test("rapid active changes debounce old previews and abort an in-flight request", async () => {
    let quoteRequests = 0;
    let aborted = 0;
    global.fetch = jest.fn().mockImplementation((input, init) => {
      const url = String(input);
      if (url.includes("/status")) return Promise.resolve(ok({ provider: "twelvedata", configured: true }));
      if (url.includes("/search")) return Promise.resolve(ok({ assets: assets.slice(0, 5) }));
      quoteRequests += 1;
      const asset = requestedAsset(init);
      if (asset.symbol !== "P4")
        return new Promise((_, reject) => init?.signal?.addEventListener("abort", () => {
          aborted += 1;
          reject(new DOMException("Aborted", "AbortError"));
        }));
      return Promise.resolve(ok({ quotes: [quoteFor(asset, 104)] }));
    });
    const user = userEvent.setup();
    render(<AssetSearch mode="personal" existingIds={[]} onSelect={() => undefined} />);
    const search = screen.getByLabelText("Hledat akcii nebo ETF");
    await waitFor(() => expect(search).toBeEnabled());
    await user.type(search, "Preview");
    await screen.findByText("Načítám cenu…");

    await user.click(search);
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}");
    expect(await screen.findByText("104 USD")).toBeVisible();
    expect(aborted).toBe(1);
    expect(quoteRequests).toBe(2);
  });
});
