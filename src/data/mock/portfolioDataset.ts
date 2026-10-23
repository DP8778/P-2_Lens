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

const demoAnchors: Record<string, { year: number; month: number; shock: number }> = {
  btc: { year: 0.259, month: 0.055, shock: 0.9 },
  eth: { year: 0.2, month: 0.04, shock: 1 },
  aapl: { year: -0.012, month: 0, shock: 0.55 },
  nvda: { year: 0.18, month: 0.075, shock: 1.15 },
  msft: { year: 0.105, month: 0.11, shock: 0.7 },
  spy: { year: 0.107, month: 0.037, shock: 0.65 },
  qqq: { year: 0.13, month: 0.044, shock: 0.8 },
};

function demoClose(asset: DemoAsset, day: number) {
  if (asset.type === "cash") return 1;
  const anchor = demoAnchors[asset.id];
  const yearStart = asset.demoPrice / (1 + anchor.year);
  const monthStart = asset.demoPrice / (1 + anchor.month);
  const logInterpolate = (from: number, to: number, progress: number) =>
    from * Math.exp(Math.log(to / from) * progress);
  let base: number;
  if (day <= 365) {
    base = yearStart * Math.exp((Math.log1p(anchor.year) * (day - 365)) / 365);
  } else if (day <= 700) {
    base = logInterpolate(yearStart, monthStart, (day - 365) / 335);
  } else {
    base = logInterpolate(monthStart, asset.demoPrice, (day - 700) / 30);
  }
  // A bounded, shared market setback creates a realistic 1Y drawdown while all
  // anchor values (including the monotonic final month) remain exact.
  const setback = day > 365 && day < 700 ? Math.exp(-Math.pow((day - 520) / 34, 2)) : 0;
  return base * (1 - 0.134 * anchor.shock * setback);
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
    amount: 3_083_883,
    currency: "CZK",
    fee: 0,
  },
  {
    id: "tx-spy-1",
    type: "buy",
    occurredAt: "2024-09-09",
    assetId: "spy",
    quantity: 65,
    unitPrice: 510.8,
    currency: "USD",
    fee: 12,
  },
  {
    id: "tx-aapl-1",
    type: "buy",
    occurredAt: "2024-10-04",
    assetId: "aapl",
    quantity: 95,
    unitPrice: 191.4,
    currency: "USD",
    fee: 10,
  },
  {
    id: "tx-btc-1",
    type: "buy",
    occurredAt: "2024-11-18",
    assetId: "btc",
    quantity: 0.2,
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
    quantity: 25,
    unitPrice: 391,
    currency: "USD",
    fee: 8,
  },
  {
    id: "tx-msft-2",
    type: "buy",
    occurredAt: "2025-06-20",
    assetId: "msft",
    quantity: 10,
    unitPrice: 442,
    currency: "USD",
    fee: 15,
  },
  {
    id: "tx-btc-2",
    type: "buy",
    occurredAt: "2025-08-08",
    assetId: "btc",
    quantity: 0.1,
    unitPrice: 101_000,
    currency: "USD",
    fee: 9,
  },
  {
    id: "tx-nvda-2",
    type: "buy",
    occurredAt: "2026-02-12",
    assetId: "nvda",
    quantity: 60,
    unitPrice: 127.8,
    currency: "USD",
    fee: 8,
  },
  {
    id: "tx-nvda-sell",
    type: "sell",
    occurredAt: "2026-05-06",
    assetId: "nvda",
    quantity: 10,
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
  version: "lens-demo-2026.09-v2",
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
