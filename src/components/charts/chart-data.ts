import type { AnalysisPoint, ChartDisplay, ChartMode } from "@/lib/finance/portfolio-engine";
import { chartOptions as o } from "./chart-options";
export function chartGeometry(
  data: AnalysisPoint[],
  mode: ChartMode,
  display: ChartDisplay,
  benchmark: boolean,
  compare: boolean,
) {
  const key =
    mode === "drawdown"
      ? "drawdown"
      : compare
        ? "portfolioIndex"
        : display === "value"
          ? "portfolioValue"
          : "portfolioReturnPct";
  const benchmarkKey = compare
    ? "benchmarkIndex"
    : display === "value"
      ? "benchmarkValue"
      : "benchmarkReturnPct";
  const values = data.flatMap((p) => [
    p[key],
    ...(mode === "performance" && benchmark ? [p[benchmarkKey]] : []),
    ...(mode === "performance" && compare ? [p.assetIndex] : []),
  ]);
  const min = Math.min(...values, ...(mode === "drawdown" ? [0] : []));
  const max = Math.max(...values, ...(mode === "drawdown" ? [0] : []));
  const padding = (max - min || 1) * 0.13;
  const low = min - padding;
  const high = mode === "drawdown" ? 0 : max + padding;
  const x = (index: number) =>
    o.left + (index / Math.max(1, data.length - 1)) * (o.width - o.left - o.right);
  const y = (value: number) =>
    o.top + ((high - value) / (high - low)) * (o.height - o.top - o.bottom);
  const line = (
    field: keyof Pick<
      AnalysisPoint,
      | "portfolioValue"
      | "portfolioReturnPct"
      | "portfolioIndex"
      | "benchmarkIndex"
      | "benchmarkValue"
      | "benchmarkReturnPct"
      | "assetIndex"
      | "drawdown"
    >,
  ) => data.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(2)},${y(p[field]).toFixed(2)}`).join(" ");
  return {
    key,
    benchmarkKey,
    x,
    y,
    line,
    ticks: Array.from({ length: 4 }, (_, i) => high - ((high - low) * i) / 3),
  } as const;
}
