import type { MarketAsset } from "@/lib/market-data/types";

export type KnownDemoInstrument = {
  demoAssetId: "aapl" | "nvda" | "msft";
  instrument: MarketAsset;
};

/**
 * Explicit listing-level aliases for the stock positions in the versioned demo.
 * A symbol match is deliberately not enough: every alias points to one verified
 * provider, MIC and listing identity.
 */
export const knownDemoInstruments: readonly KnownDemoInstrument[] = [
  {
    demoAssetId: "aapl",
    instrument: {
      id: "twelvedata:XNGS:AAPL",
      provider: "twelvedata",
      providerSymbol: "AAPL",
      symbol: "AAPL",
      name: "Apple Inc.",
      type: "stock",
      exchange: "NASDAQ",
      micCode: "XNGS",
      currency: "USD",
      country: "United States",
    },
  },
  {
    demoAssetId: "nvda",
    instrument: {
      id: "twelvedata:XNGS:NVDA",
      provider: "twelvedata",
      providerSymbol: "NVDA",
      symbol: "NVDA",
      name: "NVIDIA Corporation",
      type: "stock",
      exchange: "NASDAQ",
      micCode: "XNGS",
      currency: "USD",
      country: "United States",
    },
  },
  {
    demoAssetId: "msft",
    instrument: {
      id: "twelvedata:XNGS:MSFT",
      provider: "twelvedata",
      providerSymbol: "MSFT",
      symbol: "MSFT",
      name: "Microsoft Corporation",
      type: "stock",
      exchange: "NASDAQ",
      micCode: "XNGS",
      currency: "USD",
      country: "United States",
    },
  },
] as const;

export function knownDemoInstrument(assetId: string) {
  return knownDemoInstruments.find(
    (candidate) => candidate.demoAssetId === assetId || candidate.instrument.id === assetId,
  );
}

export function canonicalInstrumentId(assetId: string) {
  return knownDemoInstrument(assetId)?.instrument.id ?? assetId;
}

export function demoAssetIdForInstrument(assetId: string) {
  return knownDemoInstrument(assetId)?.demoAssetId;
}

export function portfolioAssetHref(locale: string, assetId: string, demo: boolean) {
  const known = knownDemoInstrument(assetId);
  if (!demo || !known) return `/${locale}/assets/${encodeURIComponent(assetId)}`;
  const query = new URLSearchParams({ source: "demo", position: known.demoAssetId });
  return `/${locale}/assets/${encodeURIComponent(known.instrument.id)}?${query}`;
}
