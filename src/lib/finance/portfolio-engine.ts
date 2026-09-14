import { z } from "zod";
import { assetCatalog } from "@/data/mock/catalog";
import { demoPriceFor, demoTimeline, portfolioDataset } from "@/data/mock/portfolioDataset";
import type {
  Currency,
  Asset,
  Benchmark,
  FxRate,
  Holding as DomainHolding,
  PortfolioSnapshot,
  PricePoint,
  TimeRange,
  Transaction,
} from "./domain";
import type { PortfolioMetrics } from "@/types/finance";
import { calculateReturn } from "./calculateReturn";

export type { Currency, PricePoint, TimeRange, Transaction } from "./domain";
export const mockFx: Readonly<Record<string, number>> = { USD: 22.4, CZK: 1, EUR: 24.8 };
export type PositionCurrency = keyof typeof mockFx;
export const timeline = demoTimeline;
export const initialTransactions = portfolioDataset.transactions;

const dated = z.iso.date().refine((date) => date <= portfolioDataset.asOf && date >= "1900-01-01");
const transactionBase = {
  id: z.string().min(1).max(80),
  occurredAt: dated,
  currency: z.string().regex(/^[A-Z]{3}$/),
  fee: z.number().finite().nonnegative().max(1e9),
};
export const transactionSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...transactionBase,
      type: z.literal("buy"),
      assetId: z.string(),
      quantity: z.number().finite().positive(),
      unitPrice: z.number().finite().positive(),
    })
    .strict(),
  z
    .object({
      ...transactionBase,
      type: z.literal("sell"),
      assetId: z.string(),
      quantity: z.number().finite().positive(),
      unitPrice: z.number().finite().positive(),
    })
    .strict(),
  z
    .object({
      ...transactionBase,
      type: z.literal("deposit"),
      amount: z.number().finite().positive(),
    })
    .strict(),
  z
    .object({
      ...transactionBase,
      type: z.literal("withdrawal"),
      amount: z.number().finite().positive(),
    })
    .strict(),
]);
export const transactionsSchema = z
  .array(transactionSchema)
  .max(500)
  .refine((rows) => new Set(rows.map((row) => row.id)).size === rows.length)
  .refine((rows) =>
    rows.every(
      (row) => !("assetId" in row) || assetCatalog.some((asset) => asset.id === row.assetId),
    ),
  );

/** Vstup formuláře. Ukládá se jako nákupní transakce, nikoli jako druhý zdroj pozic. */
export const positionSchema = z
  .object({
    assetId: z.string().refine((id) => assetCatalog.some((asset) => asset.id === id)),
    quantity: z.number().finite().positive().max(1e9),
    averageCost: z.number().finite().positive().max(1e9),
    fees: z.number().finite().nonnegative().max(1e9),
    date: dated,
  })
  .strict();
export type HoldingDraft = z.infer<typeof positionSchema>;
export type Holding = DomainHolding;

const dateOnly = (value: string) => value.slice(0, 10);
const defaultPriceIndex = new Map(
  portfolioDataset.prices.map((point) => [`${point.assetId}:${dateOnly(point.date)}`, point]),
);
const fxAt = (currency: Currency, date: string, rates: FxRate[] = portfolioDataset.fxRates) => {
  if (rates === portfolioDataset.fxRates) return mockFx[currency] ?? (currency === "CZK" ? 1 : 0);
  const match = rates
    .filter((rate) => rate.currency === currency && dateOnly(rate.date) <= dateOnly(date))
    .at(-1);
  return match?.czkPerUnit ?? (currency === "CZK" ? 1 : 0);
};
const priceAt = (assetId: string, date: string, prices: PricePoint[] = portfolioDataset.prices) => {
  if (prices === portfolioDataset.prices)
    return defaultPriceIndex.get(`${assetId}:${dateOnly(date)}`);
  return prices
    .filter((point) => point.assetId === assetId && dateOnly(point.date) <= dateOnly(date))
    .at(-1);
};

/** Prodeje snižují agregovanou průměrnou nákladovou bázi poměrem prodaného množství. */
export function buildHoldings(
  transactions: Transaction[],
  asOfDate = portfolioDataset.asOf,
  rates: FxRate[] = portfolioDataset.fxRates,
): Holding[] {
  const positions = new Map<string, Holding>();
  let cashCzk = 0;
  for (const transaction of [...transactions]
    .filter((row) => row.occurredAt <= dateOnly(asOfDate))
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id))) {
    const fx = fxAt(transaction.currency, transaction.occurredAt, rates);
    const feeCzk = transaction.fee * fx;
    if (transaction.type === "deposit") {
      cashCzk += transaction.amount * fx - feeCzk;
      continue;
    }
    if (transaction.type === "withdrawal") {
      cashCzk -= transaction.amount * fx + feeCzk;
      continue;
    }
    const current = positions.get(transaction.assetId) ?? {
      assetId: transaction.assetId,
      quantity: 0,
      averageCost: 0,
      totalCostCzk: 0,
      fees: 0,
      date: transaction.occurredAt,
    };
    if (transaction.type === "buy") {
      const newQuantity = current.quantity + transaction.quantity;
      const tradeCzk = transaction.quantity * transaction.unitPrice * fx;
      positions.set(transaction.assetId, {
        ...current,
        quantity: newQuantity,
        averageCost:
          (current.quantity * current.averageCost + transaction.quantity * transaction.unitPrice) /
          newQuantity,
        totalCostCzk: current.totalCostCzk + tradeCzk + feeCzk,
        fees: current.fees + transaction.fee,
        date: current.quantity ? current.date : transaction.occurredAt,
      });
      cashCzk -= tradeCzk + feeCzk;
    } else {
      const sold = Math.min(transaction.quantity, current.quantity);
      const ratio = current.quantity ? sold / current.quantity : 0;
      const remaining = current.quantity - sold;
      if (remaining > 1e-10)
        positions.set(transaction.assetId, {
          ...current,
          quantity: remaining,
          totalCostCzk: current.totalCostCzk * (1 - ratio),
        });
      else positions.delete(transaction.assetId);
      cashCzk += sold * transaction.unitPrice * fx - feeCzk;
    }
  }
  if (Math.abs(cashCzk) > 1e-8)
    positions.set("cash", {
      assetId: "cash",
      quantity: cashCzk,
      averageCost: 1,
      totalCostCzk: cashCzk,
      fees: 0,
      date: transactions[0]?.occurredAt ?? dateOnly(asOfDate),
    });
  return [...positions.values()].sort((a, b) => a.assetId.localeCompare(b.assetId));
}

export function getPortfolioValue(
  holdings: Holding[],
  date = portfolioDataset.asOf,
  prices: PricePoint[] = portfolioDataset.prices,
  rates: FxRate[] = portfolioDataset.fxRates,
) {
  return holdings.reduce((sum, holding) => {
    const price = priceAt(holding.assetId, date, prices);
    if (!price) return sum;
    return sum + holding.quantity * price.close * fxAt(price.currency, date, rates);
  }, 0);
}

export function buildSnapshot(
  transactions: Transaction[],
  date = portfolioDataset.asOf,
  prices: PricePoint[] = portfolioDataset.prices,
  rates: FxRate[] = portfolioDataset.fxRates,
): PortfolioSnapshot {
  const holdings = buildHoldings(transactions, date, rates);
  const missingPriceAssetIds = holdings
    .filter((holding) => !priceAt(holding.assetId, date, prices))
    .map((holding) => holding.assetId);
  return {
    asOf: dateOnly(date),
    baseCurrency: "CZK",
    holdings,
    totalValue: getPortfolioValue(holdings, date, prices, rates),
    missingPriceAssetIds,
  };
}

export interface ValuePoint {
  date: string;
  value: number;
  returnPct: number;
}
export function getPortfolioSeries(
  transactions: Transaction[],
  from: string,
  to: string,
  prices: PricePoint[] = portfolioDataset.prices,
  rates: FxRate[] = portfolioDataset.fxRates,
  dates: string[] = demoTimeline,
): ValuePoint[] {
  const selectedDates = dates.filter(
    (date) => dateOnly(date) >= dateOnly(from) && dateOnly(date) <= dateOnly(to),
  );
  let index = 100;
  let previousValue = 0;
  return selectedDates.map((date, position) => {
    const value = getPortfolioValue(buildHoldings(transactions, date, rates), date, prices, rates);
    if (position > 0 && previousValue > 0) {
      const externalFlow = transactions.reduce((sum, row) => {
        if (
          row.occurredAt !== dateOnly(date) ||
          (row.type !== "deposit" && row.type !== "withdrawal")
        )
          return sum;
        return (
          sum + (row.type === "deposit" ? 1 : -1) * row.amount * fxAt(row.currency, date, rates)
        );
      }, 0);
      index *= (value - externalFlow) / previousValue;
    }
    previousValue = value;
    return { date, value, returnPct: position === 0 ? 0 : index - 100 };
  });
}

export const getAbsolutePnL = (startValue: number, endValue: number, netExternalFlow = 0) =>
  endValue - startValue - netExternalFlow;
export const getPeriodReturn = (series: ValuePoint[]) => series.at(-1)?.returnPct ?? 0;
export const getBenchmarkReturn = (series: { normalized: number }[]) =>
  (series.at(-1)?.normalized ?? 100) - 100;
export const getBenchmarkDelta = (portfolioReturn: number, benchmarkReturn: number) =>
  portfolioReturn - benchmarkReturn;
export const getAllocation = (
  holdings: Holding[],
  date = portfolioDataset.asOf,
  prices: PricePoint[] = portfolioDataset.prices,
  rates: FxRate[] = portfolioDataset.fxRates,
) => {
  const total = getPortfolioValue(holdings, date, prices, rates);
  return holdings
    .map((holding) => {
      const value = getPortfolioValue([holding], date, prices, rates);
      return { assetId: holding.assetId, value, percentage: total ? (value / total) * 100 : 0 };
    })
    .sort((a, b) => b.value - a.value);
};
export const getLargestPosition = (allocation: ReturnType<typeof getAllocation>) => allocation[0];
export const normalizeSeriesToBase100 = <T extends { value: number }>(series: T[]) => {
  const base = series[0]?.value ?? 0;
  return series.map((point) => ({ ...point, normalized: base ? (point.value / base) * 100 : 100 }));
};
export function getMaxDrawdown(values: number[]) {
  let peak = values[0] ?? 0;
  return values.reduce((lowest, value) => {
    peak = Math.max(peak, value);
    return Math.min(lowest, peak ? ((value - peak) / peak) * 100 : 0);
  }, 0);
}

export interface ContributionItem {
  assetId: string;
  symbol: string;
  name: string;
  periodReturnPct: number;
  averageAllocationPct: number;
  contributionPctPoints: number;
  contributionSharePct: number;
}

export interface ContributionAnalysis {
  items: ContributionItem[];
  topContributor?: ContributionItem;
  topDetractor?: ContributionItem;
  residual: number;
}

export interface DrawdownPoint {
  date: string;
  value: number;
  drawdownPct: number;
}

export interface DrawdownAnalysis {
  series: DrawdownPoint[];
  maxDrawdown: number;
  currentDrawdown: number;
  peak?: DrawdownPoint;
  trough?: DrawdownPoint;
  recovery?: DrawdownPoint;
  recoveryDays?: number;
  status: "no-drawdown" | "recovered" | "unrecovered";
}

export interface ConcentrationAnalysis {
  largestPosition?: { assetId: string; symbol: string; allocationPct: number };
  top3Share: number;
  assetCount: number;
  cashShare: number;
}

const unitValueCzk = (
  assetId: string,
  date: string,
  prices: PricePoint[],
  rates: FxRate[],
) => {
  if (assetId === "cash") return 1;
  const price = priceAt(assetId, date, prices);
  return price ? price.close * fxAt(price.currency, date, rates) : undefined;
};

/**
 * Denní atribuce: váha aktiva na začátku dne × jeho CZK výnos.
 * Transakce se považují za události na konci dne. Poplatky, timing cash-flow,
 * geometrické skládání a chybějící ceny zůstávají transparentně v residualu.
 */
export function getContributionAnalysis(
  transactions: Transaction[],
  from: string,
  to: string,
  portfolioReturnPct?: number,
  prices: PricePoint[] = portfolioDataset.prices,
  rates: FxRate[] = portfolioDataset.fxRates,
  dates: string[] = demoTimeline,
  assets: Asset[] = assetCatalog,
): ContributionAnalysis {
  const selectedDates = dates.filter(
    (date) => dateOnly(date) >= dateOnly(from) && dateOnly(date) <= dateOnly(to),
  );
  const totals = new Map<
    string,
    { contribution: number; weightSum: number; firstUnit?: number; lastUnit?: number }
  >();
  const intervalCount = Math.max(0, selectedDates.length - 1);
  for (let index = 1; index < selectedDates.length; index += 1) {
    const previousDate = selectedDates[index - 1];
    const date = selectedDates[index];
    const holdings = buildHoldings(transactions, previousDate, rates);
    const totalValue = getPortfolioValue(holdings, previousDate, prices, rates);
    for (const holding of holdings) {
      const before = unitValueCzk(holding.assetId, previousDate, prices, rates);
      const after = unitValueCzk(holding.assetId, date, prices, rates);
      if (before === undefined || after === undefined || before === 0 || totalValue === 0) continue;
      const beginningValue = holding.quantity * before;
      const aggregate = totals.get(holding.assetId) ?? { contribution: 0, weightSum: 0 };
      aggregate.contribution += (beginningValue / totalValue) * (after / before - 1) * 100;
      aggregate.weightSum += (beginningValue / totalValue) * 100;
      aggregate.firstUnit ??= before;
      aggregate.lastUnit = after;
      totals.set(holding.assetId, aggregate);
    }
  }
  const rawItems = [...totals].map(([assetId, aggregate]) => {
    const asset = assets.find((candidate) => candidate.id === assetId);
    return {
      assetId,
      symbol: asset?.symbol ?? assetId,
      name: asset?.name ?? assetId,
      periodReturnPct:
        aggregate.firstUnit && aggregate.lastUnit
          ? calculateReturn(aggregate.firstUnit, aggregate.lastUnit)
          : 0,
      averageAllocationPct: intervalCount ? aggregate.weightSum / intervalCount : 0,
      contributionPctPoints: aggregate.contribution,
      contributionSharePct: 0,
    } satisfies ContributionItem;
  });
  const absoluteTotal = rawItems.reduce(
    (sum, item) => sum + Math.abs(item.contributionPctPoints),
    0,
  );
  const items = rawItems
    .map((item) => ({
      ...item,
      contributionSharePct: absoluteTotal
        ? (Math.abs(item.contributionPctPoints) / absoluteTotal) * 100
        : 0,
    }))
    .sort((a, b) => b.contributionPctPoints - a.contributionPctPoints);
  const actualReturn =
    portfolioReturnPct ?? getPeriodReturn(getPortfolioSeries(transactions, from, to, prices, rates));
  const attributed = items.reduce((sum, item) => sum + item.contributionPctPoints, 0);
  return {
    items,
    topContributor: items.find((item) => item.contributionPctPoints > 0),
    topDetractor: [...items].reverse().find((item) => item.contributionPctPoints < 0),
    residual: actualReturn - attributed,
  };
}

export function getDrawdownAnalysis(series: ValuePoint[]): DrawdownAnalysis {
  let peakIndex = 0;
  let maxPeakIndex = 0;
  let troughIndex = 0;
  let maximum = 0;
  const points = series.map((point, index) => {
    const level = 100 + point.returnPct;
    if (level >= 100 + (series[peakIndex]?.returnPct ?? 0)) peakIndex = index;
    const peakLevel = 100 + (series[peakIndex]?.returnPct ?? 0);
    const drawdownPct = peakLevel ? ((level - peakLevel) / peakLevel) * 100 : 0;
    if (drawdownPct < maximum) {
      maximum = drawdownPct;
      maxPeakIndex = peakIndex;
      troughIndex = index;
    }
    return { date: point.date, value: point.value, drawdownPct };
  });
  if (maximum >= -1e-10)
    return {
      series: points,
      maxDrawdown: 0,
      currentDrawdown: points.at(-1)?.drawdownPct ?? 0,
      status: "no-drawdown",
    };
  const recoveryIndex = points.findIndex(
    (point, index) => index > troughIndex && point.drawdownPct >= -1e-10,
  );
  const recovery = recoveryIndex >= 0 ? points[recoveryIndex] : undefined;
  return {
    series: points,
    maxDrawdown: maximum,
    currentDrawdown: points.at(-1)?.drawdownPct ?? 0,
    peak: points[maxPeakIndex],
    trough: points[troughIndex],
    recovery,
    recoveryDays: recovery
      ? Math.round((Date.parse(recovery.date) - Date.parse(points[maxPeakIndex].date)) / 86_400_000)
      : undefined,
    status: recovery ? "recovered" : "unrecovered",
  };
}

export function getConcentrationAnalysis(
  allocation: ReturnType<typeof getAllocation>,
  assets: Asset[] = assetCatalog,
): ConcentrationAnalysis {
  const positions = allocation.filter((item) => item.assetId !== "cash" && item.percentage > 0);
  const largest = positions[0];
  const asset = largest && assets.find((candidate) => candidate.id === largest.assetId);
  return {
    largestPosition:
      largest && asset
        ? { assetId: largest.assetId, symbol: asset.symbol, allocationPct: largest.percentage }
        : undefined,
    top3Share: positions.slice(0, 3).reduce((sum, item) => sum + item.percentage, 0),
    assetCount: positions.length,
    cashShare: allocation.find((item) => item.assetId === "cash")?.percentage ?? 0,
  };
}

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
  drawdown: number;
}
export interface HoldingMetric extends Holding {
  asset: Asset;
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
  timeframe: TimeRange | "CUSTOM";
  points: AnalysisPoint[];
  portfolioSeries: ValuePoint[];
  benchmarkSeries: { date: string; value: number; normalized: number }[];
  normalizedSeries: { date: string; value: number; returnPct: number; normalized: number }[];
  holdings: HoldingMetric[];
  metrics: PortfolioMetrics;
  summary: PortfolioMetrics;
  allocation: ReturnType<typeof getAllocation>;
  contributors: PortfolioMetrics["topContributors"];
  detractors: PortfolioMetrics["topDetractors"];
  maxDrawdown: number;
  selectedPeriod: { from: string; to: string };
  selectedPoint?: AnalysisPoint;
  missingPriceAssetIds: string[];
  trough: AnalysisPoint;
  recovery?: AnalysisPoint;
  benchmark: string;
  compare?: string;
  contribution: ContributionAnalysis;
  drawdown: DrawdownAnalysis;
  concentration: ConcentrationAnalysis;
}

export function timeframeRange(timeframe: TimeRange): [number, number] {
  const endTime = Date.parse(`${portfolioDataset.asOf}T12:00:00.000Z`);
  const days: Record<TimeRange, number> = {
    "1W": 7,
    "1M": 30,
    "3M": 90,
    YTD: Math.round((endTime - Date.parse("2026-01-01T12:00:00.000Z")) / 86_400_000),
    "1Y": 365,
    ALL: 730,
  };
  return [730 - days[timeframe], 730];
}

export function toUsd(value: number, currency: PositionCurrency) {
  return (value * (mockFx[currency] ?? 0)) / mockFx.USD;
}
export function positionPreview(holding: HoldingDraft, existing: Holding[], edit = false) {
  const asset = assetCatalog.find((candidate) => candidate.id === holding.assetId)!;
  const addedValue = holding.quantity * asset.price * (mockFx[asset.currency] ?? 0);
  const currentValue = existing
    .filter((row) => !edit || row.assetId !== holding.assetId)
    .reduce((sum, row) => sum + getPortfolioValue([row]), 0);
  const previousValue = edit
    ? 0
    : existing
        .filter((row) => row.assetId === holding.assetId)
        .reduce((sum, row) => sum + getPortfolioValue([row]), 0);
  return {
    value: addedValue,
    allocation:
      currentValue + addedValue
        ? ((addedValue + previousValue) / (currentValue + addedValue)) * 100
        : 0,
  };
}
export function draftToTransaction(draft: HoldingDraft, id = `local-${Date.now()}`): Transaction {
  const asset = assetCatalog.find((candidate) => candidate.id === draft.assetId)!;
  return {
    id,
    type: "buy",
    occurredAt: draft.date,
    assetId: draft.assetId,
    quantity: draft.quantity,
    unitPrice: draft.averageCost,
    currency: asset.currency,
    fee: draft.fees,
  };
}

export const initialHoldings = buildHoldings(initialTransactions);

export function buildAnalysis(
  transactions: Transaction[],
  range: [number, number],
  benchmark = "spy",
  compare?: string,
  selectedDate?: string | null,
): PortfolioAnalysis {
  const start = Math.max(0, Math.min(729, range[0]));
  const end = Math.max(start + 1, Math.min(730, range[1]));
  const from = timeline[start];
  const to = timeline[end];
  const series = getPortfolioSeries(transactions, from, to);
  const benchmarkAsset =
    assetCatalog.find((asset) => asset.id === benchmark) ??
    assetCatalog.find((asset) => asset.id === "spy")!;
  const compareAsset = assetCatalog.find((asset) => asset.id === compare);
  const benchmarkRaw = timeline
    .slice(start, end + 1)
    .map((date, offset) => ({ date, value: demoPriceFor(benchmarkAsset.id, start + offset) }));
  const benchmarkSeries = normalizeSeriesToBase100(benchmarkRaw);
  const compareRaw = compareAsset
    ? normalizeSeriesToBase100(
        timeline
          .slice(start, end + 1)
          .map((date, offset) => ({ date, value: demoPriceFor(compareAsset.id, start + offset) })),
      )
    : [];
  let peak = 100;
  const points = series.map((valuePoint, index): AnalysisPoint => {
    const portfolioIndex = 100 + valuePoint.returnPct;
    peak = Math.max(peak, portfolioIndex);
    const benchmarkReturnPct = benchmarkSeries[index].normalized - 100;
    const assetReturnPct = compareRaw[index]?.normalized - 100 || 0;
    return {
      timestamp: valuePoint.date,
      portfolioValue: valuePoint.value,
      portfolioReturnPct: valuePoint.returnPct,
      absolutePnl: valuePoint.value - series[0].value,
      benchmarkReturnPct,
      benchmarkDeltaPct: valuePoint.returnPct - benchmarkReturnPct,
      assetReturnPct,
      portfolioIndex,
      benchmarkIndex: benchmarkSeries[index].normalized,
      assetIndex: compareRaw[index]?.normalized ?? 100,
      drawdown: calculateReturn(peak, portfolioIndex),
    };
  });
  const endSnapshot = buildSnapshot(transactions, to);
  const startSnapshot = buildSnapshot(transactions, from);
  const allocation = getAllocation(endSnapshot.holdings, to);
  const startValue = series[0]?.value ?? 0;
  const endValue = series.at(-1)?.value ?? 0;
  const periodReturn = getPeriodReturn(series);
  const contribution = getContributionAnalysis(transactions, from, to, periodReturn);
  const drawdown = getDrawdownAnalysis(series);
  const concentration = getConcentrationAnalysis(allocation);
  const netExternalFlow = transactions.reduce((sum, row) => {
    if (
      row.occurredAt <= dateOnly(from) ||
      row.occurredAt > dateOnly(to) ||
      (row.type !== "deposit" && row.type !== "withdrawal")
    )
      return sum;
    return (
      sum + (row.type === "deposit" ? 1 : -1) * row.amount * fxAt(row.currency, row.occurredAt)
    );
  }, 0);
  const holdingMetrics = endSnapshot.holdings
    .map((holding): HoldingMetric => {
      const asset = assetCatalog.find((candidate) => candidate.id === holding.assetId)!;
      const marketValue = getPortfolioValue([holding], to);
      const startHolding = startSnapshot.holdings.find(
        (candidate) => candidate.assetId === holding.assetId,
      );
      const positionStart = startHolding ? getPortfolioValue([startHolding], from) : marketValue;
      const attributed = contribution.items.find((item) => item.assetId === holding.assetId);
      return {
        ...holding,
        asset,
        marketValue,
        allocationPct: endValue ? (marketValue / endValue) * 100 : 0,
        costValue: holding.totalCostCzk,
        pnl: marketValue - holding.totalCostCzk,
        pnlPct: calculateReturn(holding.totalCostCzk, marketValue),
        averageCostCzk: holding.averageCost * (mockFx[asset.currency] ?? 0),
        returnPct: calculateReturn(positionStart, marketValue),
        contributionPctPoints: attributed?.contributionPctPoints ?? 0,
      };
    })
    .sort((a, b) => b.marketValue - a.marketValue);
  const contributions = contribution.items.map((item) => ({
    symbol: item.symbol,
    name: item.name,
    returnPct: item.periodReturnPct,
    contributionPctPoints: item.contributionPctPoints,
  }));
  const last = points.at(-1)!;
  const trough = points.find((point) => point.timestamp === drawdown.trough?.date) ?? points[0];
  const recovery = points.find((point) => point.timestamp === drawdown.recovery?.date);
  const metrics: PortfolioMetrics = {
    startDate: points[0].timestamp,
    endDate: last.timestamp,
    startValue,
    endValue,
    absolutePnl: getAbsolutePnL(startValue, endValue, netExternalFlow),
    returnPct: periodReturn,
    benchmarkReturnPct: getBenchmarkReturn(benchmarkSeries),
    benchmarkDeltaPct: getBenchmarkDelta(periodReturn, getBenchmarkReturn(benchmarkSeries)),
    maxDrawdownPct: drawdown.maxDrawdown,
    btcExposurePct: holdingMetrics.find((holding) => holding.assetId === "btc")?.allocationPct ?? 0,
    largestPositionPct: concentration.largestPosition?.allocationPct ?? 0,
    topContributors: contributions.filter((item) => item.contributionPctPoints > 0),
    topDetractors: contributions.filter((item) => item.contributionPctPoints < 0).reverse(),
  };
  return {
    timeframe:
      (["1W", "1M", "3M", "YTD", "1Y", "ALL"] as TimeRange[]).find((candidate) => {
        const expected = timeframeRange(candidate);
        return expected[0] === start && expected[1] === end;
      }) ?? "CUSTOM",
    points,
    portfolioSeries: series,
    benchmarkSeries,
    normalizedSeries: normalizeSeriesToBase100(series),
    holdings: holdingMetrics,
    metrics,
    summary: metrics,
    allocation,
    contributors: metrics.topContributors,
    detractors: metrics.topDetractors,
    maxDrawdown: metrics.maxDrawdownPct,
    selectedPeriod: { from, to },
    selectedPoint: selectedDate
      ? points.find((point) => dateOnly(point.timestamp) === dateOnly(selectedDate))
      : undefined,
    missingPriceAssetIds: endSnapshot.missingPriceAssetIds,
    trough,
    recovery,
    benchmark:
      portfolioDataset.benchmarks.find((item) => item.assetId === benchmarkAsset.id)?.name ??
      benchmarkAsset.name,
    compare: compareAsset?.symbol,
    contribution,
    drawdown,
    concentration,
  };
}

/** Provider-neutral input for a personal portfolio. All monetary rates are historical CZK/unit. */
export interface AnalysisDataset {
  asOf: string;
  timeline: string[];
  assets: Asset[];
  prices: PricePoint[];
  fxRates: FxRate[];
  benchmarks: Benchmark[];
}

export function buildAnalysisFromDataset(
  transactions: Transaction[],
  range: [number, number],
  dataset: AnalysisDataset,
  benchmark = "spy",
  compare?: string,
  selectedDate?: string | null,
  timeframe: TimeRange | "CUSTOM" = "CUSTOM",
): PortfolioAnalysis {
  const asTimestamp = (date: string) =>
    dateOnly(date) === date ? `${date}T12:00:00.000Z` : date;
  const lastIndex = dataset.timeline.length - 1;
  if (lastIndex < 1) throw new Error("Personal analysis vyžaduje alespoň dva kalendářní dny.");
  const start = Math.max(0, Math.min(lastIndex - 1, range[0]));
  const end = Math.max(start + 1, Math.min(lastIndex, range[1]));
  const from = dataset.timeline[start];
  const to = dataset.timeline[end];
  const series = getPortfolioSeries(
    transactions,
    from,
    to,
    dataset.prices,
    dataset.fxRates,
    dataset.timeline,
  );
  const benchmarkDefinition =
    dataset.benchmarks.find((candidate) => candidate.id === benchmark) ?? dataset.benchmarks[0];
  const benchmarkAsset = dataset.assets.find(
    (asset) => asset.id === benchmarkDefinition?.assetId || asset.symbol === "SPY",
  );
  const compareAsset = dataset.assets.find((asset) => asset.id === compare);
  const benchmarkRaw = dataset.timeline.slice(start, end + 1).map((date) => ({
    date,
    value: benchmarkAsset ? (unitValueCzk(benchmarkAsset.id, date, dataset.prices, dataset.fxRates) ?? 0) : 0,
  }));
  const validBenchmark = benchmarkRaw.some((point) => point.value > 0)
    ? normalizeSeriesToBase100(benchmarkRaw)
    : series.map((point) => ({ date: point.date, value: point.value, normalized: 100 }));
  const compareRaw = compareAsset
    ? normalizeSeriesToBase100(
        dataset.timeline.slice(start, end + 1).map((date) => ({
          date,
          value: unitValueCzk(compareAsset.id, date, dataset.prices, dataset.fxRates) ?? 0,
        })),
      )
    : [];
  let peak = 100;
  const points = series.map((valuePoint, index): AnalysisPoint => {
    const portfolioIndex = 100 + valuePoint.returnPct;
    peak = Math.max(peak, portfolioIndex);
    const benchmarkReturnPct = (validBenchmark[index]?.normalized ?? 100) - 100;
    const assetReturnPct = (compareRaw[index]?.normalized ?? 100) - 100;
    return {
      timestamp: asTimestamp(valuePoint.date),
      portfolioValue: valuePoint.value,
      portfolioReturnPct: valuePoint.returnPct,
      absolutePnl: valuePoint.value - (series[0]?.value ?? 0),
      benchmarkReturnPct,
      benchmarkDeltaPct: valuePoint.returnPct - benchmarkReturnPct,
      assetReturnPct,
      portfolioIndex,
      benchmarkIndex: validBenchmark[index]?.normalized ?? 100,
      assetIndex: compareRaw[index]?.normalized ?? 100,
      drawdown: calculateReturn(peak, portfolioIndex),
    };
  });
  const endSnapshot = buildSnapshot(transactions, to, dataset.prices, dataset.fxRates);
  const startSnapshot = buildSnapshot(transactions, from, dataset.prices, dataset.fxRates);
  const allocation = getAllocation(endSnapshot.holdings, to, dataset.prices, dataset.fxRates);
  const startValue = series[0]?.value ?? 0;
  const endValue = series.at(-1)?.value ?? 0;
  const periodReturn = getPeriodReturn(series);
  const contribution = getContributionAnalysis(
    transactions,
    from,
    to,
    periodReturn,
    dataset.prices,
    dataset.fxRates,
    dataset.timeline,
    dataset.assets,
  );
  const drawdown = getDrawdownAnalysis(series);
  const timestampedDrawdown: DrawdownAnalysis = {
    ...drawdown,
    peak: drawdown.peak ? { ...drawdown.peak, date: asTimestamp(drawdown.peak.date) } : undefined,
    trough: drawdown.trough
      ? { ...drawdown.trough, date: asTimestamp(drawdown.trough.date) }
      : undefined,
    recovery: drawdown.recovery
      ? { ...drawdown.recovery, date: asTimestamp(drawdown.recovery.date) }
      : undefined,
  };
  const concentration = getConcentrationAnalysis(allocation, dataset.assets);
  const netExternalFlow = transactions.reduce((sum, row) => {
    if (
      row.occurredAt <= dateOnly(from) ||
      row.occurredAt > dateOnly(to) ||
      (row.type !== "deposit" && row.type !== "withdrawal")
    )
      return sum;
    return (
      sum +
      (row.type === "deposit" ? 1 : -1) *
        row.amount *
        fxAt(row.currency, row.occurredAt, dataset.fxRates)
    );
  }, 0);
  const holdingMetrics = endSnapshot.holdings
    .flatMap((holding): HoldingMetric[] => {
      const asset = dataset.assets.find((candidate) => candidate.id === holding.assetId);
      if (!asset) return [];
      const marketValue = getPortfolioValue([holding], to, dataset.prices, dataset.fxRates);
      const startHolding = startSnapshot.holdings.find(
        (candidate) => candidate.assetId === holding.assetId,
      );
      const positionStart = startHolding
        ? getPortfolioValue([startHolding], from, dataset.prices, dataset.fxRates)
        : marketValue;
      const attributed = contribution.items.find((item) => item.assetId === holding.assetId);
      const purchaseFx = fxAt(asset.currency, holding.date, dataset.fxRates);
      return [
        {
          ...holding,
          asset,
          marketValue,
          allocationPct: endValue ? (marketValue / endValue) * 100 : 0,
          costValue: holding.totalCostCzk,
          pnl: marketValue - holding.totalCostCzk,
          pnlPct: calculateReturn(holding.totalCostCzk, marketValue),
          averageCostCzk: holding.averageCost * purchaseFx,
          returnPct: calculateReturn(positionStart, marketValue),
          contributionPctPoints: attributed?.contributionPctPoints ?? 0,
        },
      ];
    })
    .sort((a, b) => b.marketValue - a.marketValue);
  const contributions = contribution.items.map((item) => ({
    symbol: item.symbol,
    name: item.name,
    returnPct: item.periodReturnPct,
    contributionPctPoints: item.contributionPctPoints,
  }));
  const fallbackPoint: AnalysisPoint = {
    timestamp: asTimestamp(to),
    portfolioValue: 0,
    portfolioReturnPct: 0,
    absolutePnl: 0,
    benchmarkReturnPct: 0,
    benchmarkDeltaPct: 0,
    assetReturnPct: 0,
    portfolioIndex: 100,
    benchmarkIndex: 100,
    assetIndex: 100,
    drawdown: 0,
  };
  const last = points.at(-1) ?? fallbackPoint;
  const trough = points.find((point) => dateOnly(point.timestamp) === dateOnly(drawdown.trough?.date ?? "")) ?? points[0] ?? fallbackPoint;
  const recovery = points.find((point) => dateOnly(point.timestamp) === dateOnly(drawdown.recovery?.date ?? ""));
  const benchmarkReturn = getBenchmarkReturn(validBenchmark);
  const metrics: PortfolioMetrics = {
    startDate: points[0]?.timestamp ?? from,
    endDate: last.timestamp,
    startValue,
    endValue,
    absolutePnl: getAbsolutePnL(startValue, endValue, netExternalFlow),
    returnPct: periodReturn,
    benchmarkReturnPct: benchmarkReturn,
    benchmarkDeltaPct: getBenchmarkDelta(periodReturn, benchmarkReturn),
    maxDrawdownPct: drawdown.maxDrawdown,
    btcExposurePct:
      holdingMetrics.find((holding) => holding.asset.type === "crypto" || holding.asset.symbol === "BTC")
        ?.allocationPct ?? 0,
    largestPositionPct: concentration.largestPosition?.allocationPct ?? 0,
    topContributors: contributions.filter((item) => item.contributionPctPoints > 0),
    topDetractors: contributions.filter((item) => item.contributionPctPoints < 0).reverse(),
  };
  return {
    timeframe,
    points,
    portfolioSeries: series,
    benchmarkSeries: validBenchmark,
    normalizedSeries: normalizeSeriesToBase100(series),
    holdings: holdingMetrics,
    metrics,
    summary: metrics,
    allocation,
    contributors: metrics.topContributors,
    detractors: metrics.topDetractors,
    maxDrawdown: metrics.maxDrawdownPct,
    selectedPeriod: { from, to },
    selectedPoint: selectedDate
      ? points.find((point) => dateOnly(point.timestamp) === dateOnly(selectedDate))
      : undefined,
    missingPriceAssetIds: endSnapshot.missingPriceAssetIds,
    trough,
    recovery,
    benchmark: benchmarkDefinition?.name ?? benchmarkAsset?.name ?? "Benchmark",
    compare: compareAsset?.symbol,
    contribution,
    drawdown: timestampedDrawdown,
    concentration,
  };
}
