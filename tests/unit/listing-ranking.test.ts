import { rankMarketListings } from "@/lib/market-data/listing-ranking";
import type { MarketAsset } from "@/lib/market-data/types";

const listing = (venue: "BMV" | "NASDAQ", access: string): MarketAsset => ({
  id: `twelvedata:${venue === "NASDAQ" ? "XNGS" : "XMEX"}:DUOL`,
  provider: "twelvedata",
  providerSymbol: "DUOL",
  symbol: "DUOL",
  name: "Duolingo, Inc.",
  type: "stock",
  exchange: venue,
  micCode: venue === "NASDAQ" ? "XNGS" : "XMEX",
  currency: venue === "NASDAQ" ? "USD" : "MXN",
  country: venue === "NASDAQ" ? "United States" : "Mexico",
  access: { global: access, plan: access },
});

describe("preferred market listing ranking", () => {
  test("keeps cross-listings but ranks accessible primary NASDAQ DUOL before BMV", () => {
    const ranked = rankMarketListings([listing("BMV", "Grow"), listing("NASDAQ", "Basic")], "DUOL");
    expect(ranked.map((asset) => `${asset.exchange}:${asset.currency}`)).toEqual(["NASDAQ:USD", "BMV:MXN"]);
  });

  test("uses venue ranking deterministically when plan access is equal", () => {
    const ranked = rankMarketListings([listing("BMV", "Basic"), listing("NASDAQ", "Basic")], "DUOL");
    expect(ranked[0].id).toBe("twelvedata:XNGS:DUOL");
    expect(ranked).toHaveLength(2);
  });
});
