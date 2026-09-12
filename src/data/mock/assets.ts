import type { Asset, Position } from "@/types/finance";

export const assets: Asset[] = [
  {
    id: "btc",
    symbol: "BTC",
    name: "Bitcoin",
    type: "crypto",
    quoteCurrency: "USD",
    sector: "Digital asset",
  },
  {
    id: "nvda",
    symbol: "NVDA",
    name: "NVIDIA",
    type: "stock",
    quoteCurrency: "USD",
    sector: "Semiconductors",
  },
  {
    id: "spy",
    symbol: "SPY",
    name: "SPDR S&P 500 ETF",
    type: "etf",
    quoteCurrency: "USD",
    sector: "Broad market",
  },
  {
    id: "aapl",
    symbol: "AAPL",
    name: "Apple",
    type: "stock",
    quoteCurrency: "USD",
    sector: "Technology",
  },
  {
    id: "novo",
    symbol: "NVO",
    name: "Novo Nordisk",
    type: "stock",
    quoteCurrency: "USD",
    sector: "Healthcare",
  },
  {
    id: "cash",
    symbol: "USD",
    name: "Cash reserve",
    type: "cash",
    quoteCurrency: "USD",
    sector: "Cash",
  },
];

export const positions: Position[] = [
  {
    assetId: "btc",
    quantity: 0.224,
    averageCost: 78200,
    currentPrice: 108500,
    previousPrice: 105955,
    marketValue: 24304,
    allocationPct: 18.4,
  },
  {
    assetId: "nvda",
    quantity: 165,
    averageCost: 121.2,
    currentPrice: 166.4,
    previousPrice: 159.3,
    marketValue: 27456,
    allocationPct: 20.8,
  },
  {
    assetId: "spy",
    quantity: 58,
    averageCost: 510.8,
    currentPrice: 638.5,
    previousPrice: 632.1,
    marketValue: 37033,
    allocationPct: 28.0,
  },
  {
    assetId: "aapl",
    quantity: 92,
    averageCost: 191.4,
    currentPrice: 229.3,
    previousPrice: 231.8,
    marketValue: 21096,
    allocationPct: 16.0,
  },
  {
    assetId: "novo",
    quantity: 120,
    averageCost: 69.5,
    currentPrice: 54.1,
    previousPrice: 55.8,
    marketValue: 6492,
    allocationPct: 4.9,
  },
  {
    assetId: "cash",
    quantity: 1,
    averageCost: 15747,
    currentPrice: 15747,
    previousPrice: 15747,
    marketValue: 15747,
    allocationPct: 11.9,
  },
];

export const enrichedPositions = positions.map((position) => ({
  ...position,
  asset: assets.find((asset) => asset.id === position.assetId)!,
}));
