import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PortfolioProvider, usePortfolio } from "@/components/portfolio/PortfolioProvider";
import { localDateISO } from "@/lib/date/local-date";
import { fetchMarketStatus, searchMarketAssets } from "@/lib/market-data/client";
import { loadFxHistory, loadHistory, loadQuotes, storeMarketQuote } from "@/lib/market-data/service";
import type { MarketAsset, MarketQuote } from "@/lib/market-data/types";

jest.mock("@/lib/market-data/client", () => ({ fetchMarketStatus: jest.fn(), searchMarketAssets: jest.fn() }));
jest.mock("@/lib/market-data/service", () => ({
  loadFxHistory: jest.fn(),
  loadHistory: jest.fn(),
  loadQuotes: jest.fn(),
  storeMarketQuote: jest.fn(),
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
};
const quote: MarketQuote = {
  assetId: asset.id,
  price: 331.34,
  currency: "USD",
  timestamp: new Date().toISOString(),
  marketState: "open",
  freshness: "fresh",
  source: "network",
};

function Harness() {
  const portfolio = usePortfolio();
  const [result, setResult] = useState("idle");
  return (
    <>
      <button onClick={() => void portfolio.savePersonal(
        asset,
        { assetId: asset.id, quantity: 3, averageCost: quote.price, fees: 0, date: localDateISO() },
        false,
        { quote, fxRate: 24 },
      ).then(() => setResult("saved")).catch(() => setResult("failed"))}>save</button>
      <output>{result}</output>
      <span data-testid="transactions">{portfolio.transactions.filter((row) => "assetId" in row && row.assetId === asset.id).length}</span>
      <span data-testid="quote-point">{portfolio.market.prices.some((point) => point.assetId === asset.id && point.date === localDateISO()) ? "yes" : "no"}</span>
    </>
  );
}

test("same-day current-price purchase succeeds when daily history is unavailable", async () => {
  localStorage.clear();
  localStorage.setItem("lens-portfolio-mode-v1", "personal");
  jest.mocked(fetchMarketStatus).mockResolvedValue({ provider: "twelvedata", configured: true });
  jest.mocked(searchMarketAssets).mockResolvedValue([]);
  jest.mocked(loadHistory).mockRejectedValue(new Error("No data is available on the specified dates."));
  jest.mocked(loadFxHistory).mockRejectedValue(new Error("No FX history"));
  jest.mocked(loadQuotes).mockResolvedValue([quote]);
  jest.mocked(storeMarketQuote).mockResolvedValue(undefined);

  render(<PortfolioProvider><Harness /></PortfolioProvider>);
  await userEvent.click(screen.getByRole("button", { name: "save" }));

  expect(await screen.findByText("saved")).toBeVisible();
  await waitFor(() => expect(screen.getByTestId("transactions")).toHaveTextContent("1"));
  expect(screen.getByTestId("quote-point")).toHaveTextContent("yes");
  expect(storeMarketQuote).toHaveBeenCalledWith(quote);
});
