import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddAssetDialog } from "@/components/portfolio/AddAssetDialog";
import { quotePriceLabel } from "@/components/portfolio/AssetSearchResult";
import { usePortfolio } from "@/components/portfolio/PortfolioProvider";
import { localDateISO } from "@/lib/date/local-date";
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
  change: 1.7,
  changePercent: 0.73,
  currency: "USD",
  timestamp: "2026-09-15T13:30:00.000Z",
  marketState: "open",
  freshness: "fresh",
  source: "network",
};
const mockedUsePortfolio = jest.mocked(usePortfolio);
const mockedLoadQuotes = jest.mocked(loadQuotes);
const mockedLoadFxQuote = jest.mocked(loadFxQuote);

describe("simplified current-price Add Asset flow", () => {
  const savePersonal = jest.fn();

  beforeEach(() => {
    savePersonal.mockResolvedValue(undefined);
    mockedUsePortfolio.mockReturnValue({ holdings: [], assets: [asset], savePersonal } as unknown as ReturnType<typeof usePortfolio>);
    mockedLoadQuotes.mockResolvedValue([quote]);
    mockedLoadFxQuote.mockResolvedValue({ base: "USD", quote: "CZK", rate: 24, timestamp: quote.timestamp, freshness: "fresh", source: "network" });
  });

  afterEach(() => jest.clearAllMocks());

  test("shows live price and computes native and CZK preview from quantity only", async () => {
    const user = userEvent.setup();
    render(<AddAssetDialog initialAssetId={asset.id} onClose={() => undefined} />);

    expect(await screen.findByText("234,56 USD")).toBeVisible();
    expect(screen.getByText("+0,73 % dnes")).toBeVisible();
    await user.type(screen.getByLabelText("Množství"), "3");
    expect(screen.getByText("703,68 USD")).toBeVisible();
    expect(screen.getByText(/≈.*Kč/)).toBeVisible();
    expect(screen.queryByLabelText(/Nákupní cena/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Datum")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Poplatek/)).not.toBeInTheDocument();
  });

  test("saves today's local-date transaction at the current quote", async () => {
    const user = userEvent.setup();
    render(<AddAssetDialog initialAssetId={asset.id} onClose={() => undefined} />);
    await screen.findByText("234,56 USD");
    await user.type(screen.getByLabelText("Množství"), "3");
    await user.click(screen.getByRole("button", { name: "Přidat do portfolia" }));

    await waitFor(() => expect(savePersonal).toHaveBeenCalledWith(
      asset,
      { assetId: asset.id, quantity: 3, averageCost: quote.price, fees: 0, date: localDateISO() },
      false,
      { quote, fxRate: 24 },
    ));
  });

  test("blocks the transaction when a valid quote is unavailable and hides provider text", async () => {
    mockedLoadQuotes.mockRejectedValue(new Error("No data is available on the specified dates. Try setting a different time range."));
    render(<AddAssetDialog initialAssetId={asset.id} onClose={() => undefined} />);

    expect((await screen.findAllByText("Cena momentálně není dostupná.")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Přidat do portfolia" })).toBeDisabled();
    expect(screen.queryByText(/No data is available/i)).not.toBeInTheDocument();
  });

  test("keeps FX secondary and does not block a native-price transaction", async () => {
    mockedLoadFxQuote.mockRejectedValue(new Error("FX unavailable"));
    const user = userEvent.setup();
    render(<AddAssetDialog initialAssetId={asset.id} onClose={() => undefined} />);
    await user.type(await screen.findByLabelText("Množství"), "2");
    expect(await screen.findByText("Přepočet do CZK není dostupný.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Přidat do portfolia" })).toBeEnabled();
  });

  test("uses explicit last-close semantics for a closed market", () => {
    expect(quotePriceLabel({ ...quote, marketState: "closed", freshness: "lastClose" })).toBe("Poslední cena");
    expect(quotePriceLabel({ ...quote, freshness: "stale", source: "cache" })).toBe("Uložená cena");
  });
});
