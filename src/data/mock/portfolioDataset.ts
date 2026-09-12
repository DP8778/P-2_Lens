import type {
  Asset,
  Benchmark,
  Currency,
  FxRate,
  PortfolioDataset,
  PricePoint,
  Transaction,
} from "@/lib/finance/domain";

export const MOCK_AS_OF = "2026-09-07";
const DAY_MS = 86_400_000;
const end = Date.parse(`${MOCK_AS_OF}T12:00:00.000Z`);

interface DemoAsset extends Asset {
  demoPrice: number;
  demoDrift: number;
  demoVolatility: number;
}

export const demoAssets: DemoAsset[] = [
  {
    id: "btc",
    symbol: "BTC",
    name: "Bitcoin",
    type: "crypto",
    currency: "USD",
    quoteCurrency: "USD",
    sector: "Digitální aktiva",
    demoPrice: 108_500,
    demoDrift: 0.0041,
    demoVolatility: 0.045,
  },
  {
    id: "eth",
    symbol: "ETH",
    name: "Ethereum",
    type: "crypto",
    currency: "USD",
    quoteCurrency: "USD",
    sector: "Digitální aktiva",
    demoPrice: 4_280,
    demoDrift: 0.0033,
    demoVolatility: 0.042,
  },
  {
    id: "aapl",
    symbol: "AAPL",
    name: "Apple",
    type: "stock",
    currency: "USD",
    quoteCurrency: "USD",
    sector: "Technologie",
    exchange: "NASDAQ",
    demoPrice: 229.3,
    demoDrift: -0.0009,
    demoVolatility: 0.019,
  },
  {
    id: "nvda",
    symbol: "NVDA",
    name: "NVIDIA",
    type: "stock",
    currency: "USD",
    quoteCurrency: "USD",
    sector: "Polovodiče",
    exchange: "NASDAQ",
    demoPrice: 166.4,
    demoDrift: 0.003,
    demoVolatility: 0.024,
  },
  {
    id: "msft",
    symbol: "MSFT",
    name: "Microsoft",
    type: "stock",
    currency: "USD",
    quoteCurrency: "USD",
    sector: "Technologie",
    exchange: "NASDAQ",
    demoPrice: 508,
    demoDrift: 0.0014,
    demoVolatility: 0.021,
  },
  {
    id: "spy",
    symbol: "SPY",
    name: "SPDR S&P 500 ETF",
    type: "etf",
    currency: "USD",
    quoteCurrency: "USD",
    sector: "Široký trh",
    exchange: "NYSE Arca",
    demoPrice: 638.5,
    demoDrift: 0.001,
    demoVolatility: 0.015,
  },
  {
    id: "qqq",
    symbol: "QQQ",
    name: "Invesco Nasdaq 100 ETF",
    type: "etf",
    currency: "USD",
    quoteCurrency: "USD",
    sector: "Široký trh",
    exchange: "NASDAQ",
    demoPrice: 582,
    demoDrift: 0.0014,
    demoVolatility: 0.018,
  },
  {
    id: "cash",
    symbol: "CZK",
    name: "Hotovost",
    type: "cash",
    currency: "CZK",
    quoteCurrency: "CZK",
    sector: "Hotovost",
    demoPrice: 1,
    demoDrift: 0,
    demoVolatility: 0,
  },
] as const;

function demoClose(asset: DemoAsset, day: number) {
  if (asset.type === "cash") return 1;
  const distance = day - 730;
  const phase = demoAssets.indexOf(asset) * 0.7;
  const wave = (value: number) =>
    Math.sin(((value - 730) * Math.PI) / 15 + phase) * asset.demoVolatility +
    Math.sin(((value - 730) * Math.PI) / 5 + phase) * asset.demoVolatility * 0.25;
  return asset.demoPrice * Math.exp(distance * asset.demoDrift + wave(day) - wave(730));
}

export const demoTimeline = Array.from({ length: 731 }, (_, index) =>
  new Date(end - (730 - index) * DAY_MS).toISOString(),
);

export const demoPrices: PricePoint[] = demoAssets.flatMap((asset) =>
  demoTimeline.map((date, day) => ({
    assetId: asset.id,
    date,
    close: demoClose(asset, day),
    currency: asset.currency,
  })),
);

const rates: Record<Currency, number> = { CZK: 1, USD: 22.4, EUR: 24.8 };
export const demoFxRates: FxRate[] = demoTimeline.flatMap((date) =>
  (Object.entries(rates) as [Currency, number][]).map(([currency, czkPerUnit]) => ({
    date,
    currency,
    czkPerUnit,
  })),
);

export const demoTransactions: Transaction[] = [
  {
    id: "tx-deposit",
    type: "deposit",
    occurredAt: "2024-09-07",
    amount: 3_250_000,
    currency: "CZK",
    fee: 0,
  },
  {
    id: "tx-spy-1",
    type: "buy",
    occurredAt: "2024-09-09",
    assetId: "spy",
    quantity: 58,
    unitPrice: 510.8,
    currency: "USD",
    fee: 12,
  },
  {
    id: "tx-aapl-1",
    type: "buy",
    occurredAt: "2024-10-04",
    assetId: "aapl",
    quantity: 92,
    unitPrice: 191.4,
    currency: "USD",
    fee: 10,
  },
  {
    id: "tx-btc-1",
    type: "buy",
    occurredAt: "2024-11-18",
    assetId: "btc",
    quantity: 0.14,
    unitPrice: 78_200,
    currency: "USD",
    fee: 18,
  },
  {
    id: "tx-nvda-1",
    type: "buy",
    occurredAt: "2025-01-15",
    assetId: "nvda",
    quantity: 110,
    unitPrice: 121.2,
    currency: "USD",
    fee: 14,
  },
  {
    id: "tx-msft-1",
    type: "buy",
    occurredAt: "2025-03-11",
    assetId: "msft",
    quantity: 18,
    unitPrice: 391,
    currency: "USD",
    fee: 8,
  },
  {
    id: "tx-msft-2",
    type: "buy",
    occurredAt: "2025-06-20",
    assetId: "msft",
    quantity: 7,
    unitPrice: 442,
    currency: "USD",
    fee: 15,
  },
  {
    id: "tx-btc-2",
    type: "buy",
    occurredAt: "2025-08-08",
    assetId: "btc",
    quantity: 0.084,
    unitPrice: 101_000,
    currency: "USD",
    fee: 9,
  },
  {
    id: "tx-nvda-2",
    type: "buy",
    occurredAt: "2026-02-12",
    assetId: "nvda",
    quantity: 55,
    unitPrice: 139,
    currency: "USD",
    fee: 8,
  },
  {
    id: "tx-nvda-sell",
    type: "sell",
    occurredAt: "2026-05-06",
    assetId: "nvda",
    quantity: 15,
    unitPrice: 158,
    currency: "USD",
    fee: 7,
  },
  {
    id: "tx-withdrawal",
    type: "withdrawal",
    occurredAt: "2026-06-01",
    amount: 80_000,
    currency: "CZK",
    fee: 0,
  },
  {
    id: "tx-aapl-2",
    type: "buy",
    occurredAt: "2026-08-12",
    assetId: "aapl",
    quantity: 5,
    unitPrice: 221,
    currency: "USD",
    fee: 4,
  },
];

export const demoBenchmarks: Benchmark[] = [
  { id: "spy", name: "S&P 500", symbol: "SPY", assetId: "spy", currency: "USD" },
  { id: "qqq", name: "Nasdaq 100", symbol: "QQQ", assetId: "qqq", currency: "USD" },
];

export const portfolioDataset: PortfolioDataset = {
  version: "lens-demo-2026.09-v1",
  asOf: MOCK_AS_OF,
  baseCurrency: "CZK",
  assets: demoAssets,
  transactions: demoTransactions,
  prices: demoPrices,
  benchmarks: demoBenchmarks,
  fxRates: demoFxRates,
};

export const demoPriceFor = (assetId: string, day: number) => {
  const asset = demoAssets.find((candidate) => candidate.id === assetId);
  return asset ? demoClose(asset, day) : 0;
};
