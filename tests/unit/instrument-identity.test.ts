import { fundamentalsSource } from "@/lib/fundamentals/snapshot-source";
import {
  canonicalInstrumentId,
  knownDemoInstruments,
  portfolioAssetHref,
} from "@/lib/instruments/identity";
import { readAssetEntryContext } from "@/lib/markets/industry-navigation";

test.each(knownDemoInstruments)(
  "$demoAssetId has one exact listing identity shared by portfolio and fundamentals",
  ({ demoAssetId, instrument }) => {
    expect(canonicalInstrumentId(demoAssetId)).toBe(instrument.id);
    expect(fundamentalsSource.getInstrument(demoAssetId)).toMatchObject({
      id: instrument.id,
      provider: instrument.provider,
      providerSymbol: instrument.providerSymbol,
      symbol: instrument.symbol,
      exchange: instrument.exchange,
      micCode: instrument.micCode,
      currency: instrument.currency,
    });
    expect(fundamentalsSource.getCompany(demoAssetId)?.statements.length).toBeGreaterThan(1);

    const href = new URL(portfolioAssetHref("cs-CZ", demoAssetId, true), "https://lens.test");
    expect(decodeURIComponent(href.pathname)).toBe(`/cs-CZ/assets/${instrument.id}`);
    expect(Object.fromEntries(href.searchParams)).toEqual({ source: "demo", position: demoAssetId });
    expect(readAssetEntryContext(Object.fromEntries(href.searchParams), instrument.id)).toEqual({
      source: "demo",
      positionAssetId: demoAssetId,
    });
  },
);

test("demo provenance is rejected when the position and listing do not match", () => {
  expect(readAssetEntryContext(
    { source: "demo", position: "aapl", price: "999999" },
    "twelvedata:XNGS:NVDA",
  )).toEqual({ source: "market" });
});

