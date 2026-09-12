import { z } from "zod";
import { assetCatalog, MOCK_AS_OF, type CatalogAsset } from "@/data/mock/catalog";
import { positions } from "@/data/mock/assets";
import type { Timeframe, PortfolioMetrics } from "@/types/finance";
import { calculateReturn } from "./calculateReturn";

export const mockFx = { USD: 22.4, CZK: 1, EUR: 24.8 } as const;
export type PositionCurrency = keyof typeof mockFx;
export const positionSchema = z
  .object({
    assetId: z.string().refine((id) => assetCatalog.some((a) => a.id === id)),
    quantity: z.number().finite().positive().max(1e9),
    averageCost: z.number().finite().positive().max(1e9),
    fees: z.number().finite().nonnegative().max(1e9),
    date: z.iso.date().refine((date) => date <= MOCK_AS_OF && date >= "1900-01-01"),
  })
  .strict();
export type Holding = z.infer<typeof positionSchema>;
export const holdingsSchema = z
  .array(positionSchema)
  .max(100)
  .refine((rows) => new Set(rows.map((r) => r.assetId)).size === rows.length);
export const initialHoldings: Holding[] = positions.map((p) => ({
  assetId: p.assetId,
  quantity: p.assetId === "cash" ? p.marketValue : p.quantity,
  averageCost: p.assetId === "cash" ? 1 : p.averageCost,
  fees: 0,
  date: "2024-09-07",
}));
export type ChartMode = "performance" | "contribution" | "drawdown";
export type ChartDisplay = "value" | "percent";
export interface AnalysisPoint {
  timestamp: string;
  portfolioValue: number;
  portfolioReturnPct: number;
  absolutePnl: number;
  benchmarkReturnPct: number;
  benchmarkDeltaPct: number;
  assetReturnPct: number;
  portfolioIndex: number;
  benchmarkIndex: number;
  assetIndex: number;
  benchmarkValue: number;
  drawdown: number;
}
export interface HoldingMetric extends Holding {
  asset: CatalogAsset;
  marketValue: number;
  allocationPct: number;
  costValue: number;
  pnl: number;
  pnlPct: number;
  averageCostCzk: number;
  returnPct: number;
  contributionPctPoints: number;
}
export interface PortfolioAnalysis {
  points: AnalysisPoint[];
  holdings: HoldingMetric[];
  metrics: PortfolioMetrics;
  trough: AnalysisPoint;
  recovery?: AnalysisPoint;
  benchmark: string;
  compare?: string;
}
const endTime = Date.parse(`${MOCK_AS_OF}T12:00:00.000Z`);
const dayMs = 86_400_000;
export const timeline = Array.from({ length: 731 }, (_, i) =>
  new Date(endTime - (730 - i) * dayMs).toISOString(),
);
// Synthetic, fixed price paths. No randomness, network prices or claimed historical trades.
export function mockPrice(asset: CatalogAsset, day: number) {
  const distance = day - 730;
  const phase = assetCatalog.indexOf(asset) * 0.7;
  const wave = (t: number) =>
    Math.sin(((t - 730) * Math.PI) / 15 + phase) * asset.volatility +
    Math.sin(((t - 730) * Math.PI) / 5 + phase) * asset.volatility * 0.25;
  return asset.price * Math.exp(distance * asset.drift + wave(day) - wave(730));
}
export function timeframeRange(timeframe: Timeframe): [number, number] {
  const days: Record<Timeframe, number> = {
    "1D": 1,
    "1W": 7,
    "1M": 30,
    "3M": 90,
    YTD: Math.round((endTime - Date.parse("2026-01-01T12:00:00.000Z")) / dayMs),
    "1Y": 365,
    ALL: 730,
  };
  return [730 - days[timeframe], 730];
}
export function toUsd(value: number, currency: PositionCurrency) {
  return (value * mockFx[currency]) / mockFx.USD;
}
export function positionPreview(holding: Holding, existing: Holding[], edit = false) {
  const asset = assetCatalog.find((a) => a.id === holding.assetId)!;
  const addedValue = holding.quantity * asset.price * mockFx.USD;
  const currentValue = existing
    .filter((p) => !edit || p.assetId !== holding.assetId)
    .reduce(
      (sum, p) =>
        sum + p.quantity * assetCatalog.find((a) => a.id === p.assetId)!.price * mockFx.USD,
      0,
    );
  const previousValue = edit
    ? 0
    : existing
        .filter((p) => p.assetId === holding.assetId)
        .reduce((sum, p) => sum + p.quantity * asset.price * mockFx.USD, 0);
  return {
    value: addedValue,
    allocation: ((addedValue + previousValue) / (currentValue + addedValue)) * 100,
  };
}
export function saveHolding(rows: Holding[], incoming: Holding, edit = false): Holding[] {
  const valid = positionSchema.parse(incoming);
  const current = rows.find((p) => p.assetId === valid.assetId);
  const merged =
    !edit && current
      ? {
          ...valid,
          quantity: current.quantity + valid.quantity,
          averageCost:
            (current.quantity * current.averageCost + valid.quantity * valid.averageCost) /
            (current.quantity + valid.quantity),
          fees: current.fees + valid.fees,
          date: current.date < valid.date ? current.date : valid.date,
        }
      : valid;
  return holdingsSchema.parse([...rows.filter((p) => p.assetId !== valid.assetId), merged]);
}
export function buildAnalysis(
  rows: Holding[],
  range: [number, number],
  benchmark = "spy",
  compare?: string,
): PortfolioAnalysis {
  const start = Math.max(0, Math.min(729, range[0]));
  const end = Math.max(start + 1, Math.min(730, range[1]));
  const benchmarkAsset =
    assetCatalog.find((a) => a.id === benchmark) ?? assetCatalog.find((a) => a.id === "spy")!;
  const compareAsset = assetCatalog.find((a) => a.id === compare);
  const valueAt = (day: number) =>
    rows.reduce(
      (sum, p) =>
        sum +
        p.quantity *
          mockPrice(
            assetCatalog.find((a) => a.id === p.assetId)!,
            day,
          ) *
          mockFx.USD,
      0,
    );
  const startValue = valueAt(start);
  const endValue = valueAt(end);
  let peak = startValue;
  const points = timeline.slice(start, end + 1).map((timestamp, index): AnalysisPoint => {
    const day = start + index;
    const portfolioValue = valueAt(day);
    peak = Math.max(peak, portfolioValue);
    const portfolioReturnPct = calculateReturn(startValue, portfolioValue);
    const benchmarkReturnPct = calculateReturn(
      mockPrice(benchmarkAsset, start),
      mockPrice(benchmarkAsset, day),
    );
    const assetReturnPct = compareAsset
      ? calculateReturn(mockPrice(compareAsset, start), mockPrice(compareAsset, day))
      : 0;
    return {
      timestamp,
      portfolioValue,
      portfolioReturnPct,
      absolutePnl: portfolioValue - startValue,
      benchmarkReturnPct,
      benchmarkDeltaPct: portfolioReturnPct - benchmarkReturnPct,
      assetReturnPct,
      portfolioIndex: 100 + portfolioReturnPct,
      benchmarkIndex: 100 + benchmarkReturnPct,
      assetIndex: 100 + assetReturnPct,
      benchmarkValue: startValue * (1 + benchmarkReturnPct / 100),
      drawdown: calculateReturn(peak, portfolioValue),
    };
  });
  const holdings = rows
    .map((p): HoldingMetric => {
      const asset = assetCatalog.find((a) => a.id === p.assetId)!;
      const marketValue = p.quantity * mockPrice(asset, end) * mockFx.USD;
      const positionStart = p.quantity * mockPrice(asset, start) * mockFx.USD;
      const costValue = (p.quantity * p.averageCost + p.fees) * mockFx.USD;
      return {
        ...p,
        asset,
        marketValue,
        allocationPct: endValue ? (marketValue / endValue) * 100 : 0,
        costValue,
        pnl: marketValue - costValue,
        pnlPct: calculateReturn(costValue, marketValue),
        averageCostCzk: p.averageCost * mockFx.USD,
        returnPct: calculateReturn(positionStart, marketValue),
        contributionPctPoints: startValue ? ((marketValue - positionStart) / startValue) * 100 : 0,
      };
    })
    .sort((a, b) => b.marketValue - a.marketValue);
  const contributions = holdings
    .map((p) => ({
      symbol: p.asset.symbol,
      name: p.asset.name,
      returnPct: p.returnPct,
      contributionPctPoints: p.contributionPctPoints,
    }))
    .sort((a, b) => b.contributionPctPoints - a.contributionPctPoints);
  const last = points.at(-1)!;
  const trough = points.reduce((low, p) => (p.drawdown < low.drawdown ? p : low));
  const recovery =
    trough.drawdown < 0
      ? points.find((p) => p.timestamp > trough.timestamp && p.drawdown >= -1e-10)
      : undefined;
  return {
    points,
    holdings,
    trough,
    recovery,
    benchmark: benchmarkAsset.symbol,
    compare: compareAsset?.symbol,
    metrics: {
      startDate: points[0].timestamp,
      endDate: last.timestamp,
      startValue,
      endValue,
      absolutePnl: endValue - startValue,
      returnPct: last.portfolioReturnPct,
      benchmarkReturnPct: last.benchmarkReturnPct,
      benchmarkDeltaPct: last.benchmarkDeltaPct,
      maxDrawdownPct: trough.drawdown,
      btcExposurePct: holdings.find((p) => p.assetId === "btc")?.allocationPct ?? 0,
      largestPositionPct: holdings[0]?.allocationPct ?? 0,
      topContributors: contributions.filter((p) => p.contributionPctPoints > 0),
      topDetractors: contributions.filter((p) => p.contributionPctPoints < 0).reverse(),
    },
  };
}
