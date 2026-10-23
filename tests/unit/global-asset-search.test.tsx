import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GlobalAssetSearch } from "@/components/layout/GlobalAssetSearch";
import { searchMarketAssets } from "@/lib/market-data/client";
import { loadQuotePreview } from "@/lib/market-data/service";
import type { MarketAsset } from "@/lib/market-data/types";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("@/lib/market-data/client", () => ({ searchMarketAssets: jest.fn() }));
jest.mock("@/lib/market-data/service", () => ({ loadQuotePreview: jest.fn() }));

const aapl: MarketAsset = {
  id: "twelvedata:XNGS:AAPL", provider: "twelvedata", providerSymbol: "AAPL", symbol: "AAPL",
  name: "Apple Inc.", type: "stock", exchange: "NASDAQ", micCode: "XNGS", currency: "USD",
};
const aaplBmv: MarketAsset = {
  ...aapl, id: "twelvedata:XMEX:AAPL", exchange: "BMV", micCode: "XMEX", currency: "MXN",
};

describe("GlobalAssetSearch", () => {
  beforeEach(() => {
    push.mockReset();
    jest.mocked(searchMarketAssets).mockResolvedValue([aapl, aaplBmv]);
    jest.mocked(loadQuotePreview).mockResolvedValue({
      assetId: aapl.id, price: 234.56, currency: "USD", timestamp: "2026-09-18T13:30:00.000Z",
      marketState: "open", freshness: "fresh", source: "network",
    });
  });

  test("loads a quote only for the active result and Enter navigates by provider-aware id", async () => {
    const user = userEvent.setup();
    render(<GlobalAssetSearch locale="cs-CZ" />);
    const input = screen.getByRole("combobox", { name: "Globální hledání aktiv" });
    await user.type(input, "AAPL");
    expect((await screen.findAllByRole("option", { name: /AAPL Apple Inc/ }))[0]).toBeVisible();
    await waitFor(() => expect(loadQuotePreview).toHaveBeenCalledTimes(1));
    expect(loadQuotePreview).toHaveBeenCalledWith(aapl, expect.any(AbortSignal));
    expect(await screen.findByText("234,56 USD")).toBeVisible();
    await user.keyboard("{Enter}");
    expect(push).toHaveBeenCalledWith("/cs-CZ/assets/twelvedata%3AXNGS%3AAAPL");
    expect(screen.queryByRole("listbox", { name: "Globální výsledky hledání" })).not.toBeInTheDocument();
  });
});
