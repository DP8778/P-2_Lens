import { demoAssets, MOCK_AS_OF } from "./portfolioDataset";
import type { Asset } from "@/lib/finance/domain";

export interface CatalogAsset extends Asset {
  price: number;
  drift: number;
  volatility: number;
}

export const assetCatalog: CatalogAsset[] = demoAssets.map((asset) => ({
  ...asset,
  price: asset.demoPrice,
  drift: asset.demoDrift,
  volatility: asset.demoVolatility,
}));

export { MOCK_AS_OF };
export const assetTypeLabels = {
  stock: "Akcie",
  etf: "ETF",
  crypto: "Krypto",
  cash: "Hotovost",
};
