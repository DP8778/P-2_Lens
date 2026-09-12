import type {
  AnalysisPoint,
  ChartDisplay,
  PortfolioAnalysis,
  Transaction,
} from "@/lib/finance/portfolio-engine";

export type HeroChartScale = "value" | "performance";

export interface HeroSeriesPoint {
  date: string;
  portfolio: number;
  benchmark: number | null;
  compareAsset: number | null;
  source: AnalysisPoint;
}

export function resolveChartScale(
  display: ChartDisplay,
  compareAssetId?: string,
  showBenchmark = false,
): HeroChartScale {
  return compareAssetId || showBenchmark || display === "percent" ? "performance" : "value";
}

/** Převádí už hotový PortfolioAnalysis na hodnoty pro vykreslení; finance znovu nepočítá. */
export function buildHeroChartSeries(
  analysis: PortfolioAnalysis,
  display: ChartDisplay,
  showBenchmark: boolean,
  compareAssetId?: string,
): HeroSeriesPoint[] {
  const scale = resolveChartScale(display, compareAssetId, showBenchmark);
  return analysis.points.map((point) => ({
    date: point.timestamp,
    portfolio: scale === "value" ? point.portfolioValue : point.portfolioIndex,
    benchmark: showBenchmark ? point.benchmarkIndex : null,
    compareAsset: compareAssetId ? point.assetIndex : null,
    source: point,
  }));
}

export function mapDateToPointIndex(
  points: Pick<AnalysisPoint, "timestamp">[],
  date: string | null,
) {
  if (!date || !points.length) return null;
  const exact = points.findIndex((point) => point.timestamp === date);
  if (exact >= 0) return exact;
  const target = Date.parse(date);
  if (!Number.isFinite(target)) return null;
  return points.reduce(
    (closest, point, index) =>
      Math.abs(Date.parse(point.timestamp) - target) <
      Math.abs(Date.parse(points[closest].timestamp) - target)
        ? index
        : closest,
    0,
  );
}

export function mapClientXToPointIndex(
  clientX: number,
  rectLeft: number,
  rectWidth: number,
  pointCount: number,
  plotLeft = 0.016,
  plotRight = 0.08,
) {
  if (pointCount <= 1 || rectWidth <= 0) return 0;
  const ratio = (clientX - rectLeft) / rectWidth;
  const plotRatio = Math.max(0, Math.min(1, (ratio - plotLeft) / (1 - plotLeft - plotRight)));
  return Math.round(plotRatio * (pointCount - 1));
}

export function mapSelectedRangeToIndices(
  selectedRange: [string, string],
  dates: string[],
): [number, number] {
  if (!dates.length) return [0, 0];
  const start = mapDateToPointIndex(
    dates.map((timestamp) => ({ timestamp })),
    selectedRange[0],
  );
  const end = mapDateToPointIndex(
    dates.map((timestamp) => ({ timestamp })),
    selectedRange[1],
  );
  return [start ?? 0, Math.max(start ?? 0, end ?? dates.length - 1)];
}

export function alignSeriesByDate(
  primary: { date: string; value: number }[],
  secondary: { date: string; value: number }[],
) {
  const secondaryByDate = new Map(secondary.map((point) => [point.date, point.value]));
  return primary.map((point) => ({
    date: point.date,
    primary: point.value,
    secondary: secondaryByDate.get(point.date) ?? null,
  }));
}

export interface TransactionAnnotation {
  id: string;
  index: number;
  date: string;
  type: "buy" | "sell";
  assetId: string;
  quantity: number;
  unitPrice: number;
  currency: string;
}

export function mapTransactionsToAnnotations(
  transactions: Transaction[],
  points: Pick<AnalysisPoint, "timestamp">[],
): TransactionAnnotation[] {
  const byDate = new Map(points.map((point, index) => [point.timestamp.slice(0, 10), index]));
  return transactions.flatMap((transaction) => {
    if (transaction.type !== "buy" && transaction.type !== "sell") return [];
    const index = byDate.get(transaction.occurredAt);
    return index === undefined
      ? []
      : [
          {
            id: transaction.id,
            index,
            date: transaction.occurredAt,
            type: transaction.type,
            assetId: transaction.assetId,
            quantity: transaction.quantity,
            unitPrice: transaction.unitPrice,
            currency: transaction.currency,
          },
        ];
  });
}

export function formatChartAxisTick(value: number, scale: HeroChartScale, locale = "cs-CZ") {
  if (scale === "performance")
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}
