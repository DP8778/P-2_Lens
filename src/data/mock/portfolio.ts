import type { ContributionMetric, PortfolioPerformancePoint, Timeframe } from "@/types/finance";

const configs: Record<
  Timeframe,
  { days: number; start: number; end: number; benchmark: number; drawdown: number }
> = {
  "1D": { days: 8, start: 130910, end: 132128, benchmark: 0.5, drawdown: -0.4 },
  "1W": { days: 10, start: 128772, end: 132128, benchmark: 1.6, drawdown: -1.2 },
  "1M": { days: 18, start: 124063, end: 132128, benchmark: 3.1, drawdown: -4.2 },
  "3M": { days: 22, start: 119562, end: 132128, benchmark: 6.8, drawdown: -6.4 },
  YTD: { days: 24, start: 112940, end: 132128, benchmark: 9.6, drawdown: -8.1 },
  "1Y": { days: 28, start: 101638, end: 132128, benchmark: 14.9, drawdown: -11.7 },
  ALL: { days: 32, start: 84220, end: 132128, benchmark: 28.2, drawdown: -18.3 },
};

const durationDays: Record<Timeframe, number> = {
  "1D": 1,
  "1W": 7,
  "1M": 30,
  "3M": 90,
  YTD: 250,
  "1Y": 365,
  ALL: 730,
};

const shape = [
  0, 0.05, 0.12, 0.08, 0.19, 0.25, 0.2, 0.34, 0.43, 0.38, 0.51, 0.49, 0.61, 0.57, 0.72, 0.68, 0.8,
  0.91, 0.87, 1,
];

export function getPerformanceSeries(timeframe: Timeframe): PortfolioPerformancePoint[] {
  const config = configs[timeframe];
  const startDate = new Date("2026-09-07T12:00:00.000Z");
  const returnPct = ((config.end - config.start) / config.start) * 100;
  return Array.from({ length: config.days }, (_, index) => {
    const progress = index / (config.days - 1);
    const shaped = shape[Math.round(progress * (shape.length - 1))];
    const wave = Math.sin(index * 1.61) * 0.012 * (1 - progress);
    const ratio = Math.max(0, Math.min(1, shaped + wave));
    const elapsedRatio = (config.days - 1 - index) / (config.days - 1);
    const timestamp = new Date(
      startDate.getTime() - durationDays[timeframe] * elapsedRatio * 86_400_000,
    );
    return {
      timestamp: timestamp.toISOString(),
      portfolioValue:
        index === config.days - 1
          ? config.end
          : Math.round(config.start + (config.end - config.start) * ratio),
      portfolioReturnPct: index === config.days - 1 ? returnPct : returnPct * ratio,
      benchmarkReturnPct: config.benchmark * (progress * 0.86 + Math.sin(index * 0.72) * 0.04),
    };
  });
}

const timeframeFactor: Record<Timeframe, number> = {
  "1D": 0.12,
  "1W": 0.32,
  "1M": 1,
  "3M": 1.35,
  YTD: 1.7,
  "1Y": 2.2,
  ALL: 3.1,
};

export function getContributions(timeframe: Timeframe): ContributionMetric[] {
  const factor = timeframeFactor[timeframe];
  return [
    {
      symbol: "BTC",
      name: "Bitcoin",
      contributionPctPoints: 2.1 * factor,
      returnPct: 11.4 * factor,
    },
    {
      symbol: "NVDA",
      name: "NVIDIA",
      contributionPctPoints: 1.8 * factor,
      returnPct: 8.6 * factor,
    },
    {
      symbol: "SPY",
      name: "S&P 500 ETF",
      contributionPctPoints: 1.1 * factor,
      returnPct: 3.9 * factor,
    },
    {
      symbol: "AAPL",
      name: "Apple",
      contributionPctPoints: -0.4 * factor,
      returnPct: -2.5 * factor,
    },
    {
      symbol: "NVO",
      name: "Novo Nordisk",
      contributionPctPoints: -0.3 * factor,
      returnPct: -6.1 * factor,
    },
  ];
}

export const timeframeConfig = configs;
