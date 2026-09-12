import { assets, positions } from "./assets";
import type { Asset } from "@/types/finance";

export interface CatalogAsset extends Asset {
  price: number;
  drift: number;
  volatility: number;
}
const extra: Asset[] = [
  {
    id: "eth",
    symbol: "ETH",
    name: "Ethereum",
    type: "crypto",
    quoteCurrency: "USD",
    sector: "Digital asset",
  },
  ...[
    ["msft", "Microsoft"],
    ["googl", "Alphabet"],
    ["amzn", "Amazon"],
    ["meta", "Meta Platforms"],
    ["tsla", "Tesla"],
  ].map(([id, name]) => ({
    id,
    symbol: id.toUpperCase(),
    name,
    type: "stock" as const,
    quoteCurrency: "USD",
    sector: "Technology",
  })),
  {
    id: "qqq",
    symbol: "QQQ",
    name: "Invesco Nasdaq 100 ETF",
    type: "etf",
    quoteCurrency: "USD",
    sector: "Broad market",
  },
];
const quotes: Record<string, number> = {
  eth: 4280,
  msft: 508,
  googl: 211,
  amzn: 232,
  meta: 738,
  tsla: 346,
  qqq: 582,
};
const drift: Record<string, number> = {
  btc: 0.0041,
  nvda: 0.003,
  spy: 0.001,
  aapl: -0.0009,
  novo: -0.002,
  cash: 0,
  eth: 0.0033,
};
export const assetCatalog: CatalogAsset[] = [...assets, ...extra].map((asset, index) => ({
  ...asset,
  name: asset.type === "cash" ? "Hotovost USD" : asset.name,
  price:
    asset.type === "cash"
      ? 1
      : (positions.find((p) => p.assetId === asset.id)?.currentPrice ?? quotes[asset.id]),
  drift: drift[asset.id] ?? 0.0014,
  volatility:
    asset.type === "cash" ? 0 : asset.type === "crypto" ? 0.045 : 0.019 + (index % 3) * 0.004,
}));
export const MOCK_AS_OF = "2026-09-07";
export const assetTypeLabels = { stock: "Akcie", etf: "ETF", crypto: "Krypto", cash: "Hotovost" };
