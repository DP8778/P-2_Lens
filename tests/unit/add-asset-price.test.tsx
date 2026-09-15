import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddAssetDialog } from "@/components/portfolio/AddAssetDialog";
import { quotePriceLabel } from "@/components/portfolio/AssetSearchResult";
import { usePortfolio } from "@/components/portfolio/PortfolioProvider";
import { loadFxQuote, loadQuotes } from "@/lib/market-data/service";
import type { MarketAsset, MarketQuote } from "@/lib/market-data/types";

jest.mock("@/components/portfolio/PortfolioProvider", () => ({ usePortfolio: jest.fn() }));
jest.mock("@/lib/market-data/service", () => ({
  loadFxQuote: jest.fn(),
  loadQuotes: jest.fn(),
  loadQuotePreview: jest.fn(),
}));
jest.mock("@/components/ui/Dialog", () => ({
  Dialog: ({ title, children }: { title: string; children: ReactNode }) => (
    <section role="dialog" aria-label={title}>{children}</section>
  ),
}));

const asset: MarketAsset = {
  id: "twelvedata:XNGS:AAPL",
  provider: "twelvedata",
  providerSymbol: "AAPL",
  symbol: "AAPL",
  name: "Apple Inc",
  type: "stock",
  exchange: "NASDAQ",
  micCode: "XNGS",
  currency: "USD",
  country: "United States",
};
const quote: MarketQuote = {
  assetId: asset.id,
  price: 234.56,
  currency: "USD",
  timestamp: "2026-09-15T13:30:00.000Z",
  marketState: "open",
  freshness: "fresh",
  source: "network",
};
const mockedUsePortfolio = jest.mocked(usePortfolio);
const mockedLoadQuotes = jest.mocked(loadQuotes);
const mockedLoadFxQuote = jest.mocked(loadFxQuote);

describe("Add Investment quote reliability", () => {
  const savePersonal = jest.fn();

  beforeEach(() => {
    savePersonal.mockResolvedValue(undefined);
    mockedUsePortfolio.mockReturnValue({
      holdings: [],
      assets: [asset],
      market: { prices: [], fxRates: [] },
      savePersonal,
    } as unknown as ReturnType<typeof usePortfolio>);
    mockedLoadQuotes.mockResolvedValue([quote]);
    mockedLoadFxQuote.mockResolvedValue({
      base: "USD",
      quote: "CZK",
      rate: 24,
      timestamp: "2026-09-15T13:30:00.000Z",
      freshness: "fresh",
      source: "network",
    });
  });

  afterEach(() => jest.clearAllMocks());

  test("keeps a successful native quote visible when FX fails", async () => {
    mockedLoadFxQuote.mockRejectedValue(new Error("FX unavailable"));
    render(<AddAssetDialog initialAssetId={asset.id} onClose={() => undefined} />);

    expect(await screen.findByText("234,56 USD")).toBeVisible();
    expect(await screen.findByText("Přepočet do CZK není dostupný.")).toBeVisible();
    expect(screen.queryByText("Cena nedostupná")).not.toBeInTheDocument();
  });

  test("keeps the transaction form usable when quote fails but FX succeeds", async () => {
    mockedLoadQuotes.mockRejectedValue(new Error("Quote unavailable"));
    const user = userEvent.setup();
    render(<AddAssetDialog initialAssetId={asset.id} onClose={() => undefined} />);

    expect(await screen.findByText("Cena nedostupná")).toBeVisible();
    await user.type(screen.getByLabelText("Množství"), "2");
    await user.type(screen.getByLabelText(/Nákupní cena/), "100");
    await user.click(screen.getByRole("button", { name: "Přidat do portfolia" }));
    await waitFor(() => expect(savePersonal).toHaveBeenCalledTimes(1));
  });

  test("shows native value and secondary CZK conversion when both calls succeed", async () => {
    const user = userEvent.setup();
    render(<AddAssetDialog initialAssetId={asset.id} onClose={() => undefined} />);

    expect(await screen.findByText(/≈.*Kč \/ akcie/)).toBeVisible();
    await user.type(screen.getByLabelText("Množství"), "2");
    await user.type(screen.getByLabelText(/Nákupní cena/), "100");
    expect(await screen.findByText("469,12 USD")).toBeVisible();
    expect(screen.getAllByText(/≈.*Kč/).length).toBeGreaterThanOrEqual(2);
  });

  test("uses the native current price without waiting for FX", async () => {
    mockedLoadFxQuote.mockRejectedValue(new Error("FX unavailable"));
    const user = userEvent.setup();
    render(<AddAssetDialog initialAssetId={asset.id} onClose={() => undefined} />);

    await user.click(await screen.findByRole("button", { name: "Použít aktuální cenu" }));
    expect(screen.getByLabelText(/Nákupní cena/)).toHaveValue("234.56");
  });

  test("labels stale and last-close quotes without a live badge", () => {
    expect(quotePriceLabel({ ...quote, freshness: "stale", source: "cache" })).toBe("Uložená cena");
    expect(quotePriceLabel({ ...quote, marketState: "closed", freshness: "lastClose" })).toBe("Poslední cena");
  });
});
