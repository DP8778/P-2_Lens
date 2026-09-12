import { bitcoinFeed, bitcoinSeries } from "@/data/mock/bitcoin";
import type { MarketDataProvider } from "./MarketDataProvider";

export class MockMarketDataProvider implements MarketDataProvider {
  async getBitcoinQuote() {
    return bitcoinFeed;
  }
  async getBitcoinSeries() {
    return bitcoinSeries;
  }
}
