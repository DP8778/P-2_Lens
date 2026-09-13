import type { Asset, Position } from "@/types/finance";
import { assetCatalog } from "./catalog";
import { buildAnalysis, initialTransactions, timeframeRange } from "@/lib/finance/portfolio-engine";

/** Kompatibilní pohled pro starší prezentační komponenty; data počítá hlavní engine. */
export const assets: Asset[] = assetCatalog;
const analysis = buildAnalysis(initialTransactions, timeframeRange("1M"));
export const positions: Position[] = assetCatalog.flatMap((asset) => {
  const holding = analysis.holdings.find((candidate) => candidate.assetId === asset.id);
  if (!holding) return [];
  return [
    {
      assetId: holding.assetId,
      quantity: holding.quantity,
      averageCost: holding.averageCostCzk,
      currentPrice: holding.quantity ? holding.marketValue / holding.quantity : 0,
      previousPrice: holding.quantity
        ? holding.marketValue / holding.quantity / (1 + holding.returnPct / 100)
        : 0,
      marketValue: holding.marketValue,
      allocationPct: holding.allocationPct,
    },
  ];
});
export const enrichedPositions = positions.map((position) => ({
  ...position,
  asset: assets.find((asset) => asset.id === position.assetId)!,
}));
