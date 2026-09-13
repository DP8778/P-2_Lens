import type { PortfolioAnalysis, TimeRange } from "@/lib/finance/portfolio-engine";
import { money, percent, points } from "./chart-formatters";

export function ChartSummary({
  analysis,
  timeframe,
  showBenchmark,
  locale,
}: {
  analysis: PortfolioAnalysis;
  timeframe: TimeRange | "CUSTOM";
  showBenchmark: boolean;
  locale: string;
}) {
  const metrics = analysis.metrics;
  return (
    <header className="chart-summary" aria-label="Souhrn vybraného období">
      <div className="chart-summary-change">
        <b className={metrics.returnPct >= 0 ? "positive" : "negative"}>
          {metrics.absolutePnl > 0 ? "+" : ""}
          {money(metrics.absolutePnl, locale)}
        </b>
        <b className={metrics.returnPct >= 0 ? "positive" : "negative"}>
          {percent(metrics.returnPct, locale)}
        </b>
        <span>{analysis.timeframe === "CUSTOM" ? "Vlastní období" : timeframe}</span>
      </div>
      {showBenchmark && (
        <div className="chart-summary-benchmark">
          <span>vs {analysis.benchmark}</span>
          <strong>{points(metrics.benchmarkDeltaPct, locale)}</strong>
        </div>
      )}
    </header>
  );
}
