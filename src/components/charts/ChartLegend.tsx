import type { PortfolioAnalysis } from "@/lib/finance/portfolio-engine";
import { percent } from "./chart-formatters";

export function ChartLegend({
  analysis,
  showBenchmark,
  compareAssetId,
  onBenchmark,
  onClearCompare,
  locale,
}: {
  analysis: PortfolioAnalysis;
  showBenchmark: boolean;
  compareAssetId: string;
  onBenchmark: () => void;
  onClearCompare: () => void;
  locale: string;
}) {
  const point = analysis.selectedPoint ?? analysis.points.at(-1);
  return (
    <div className="chart-legend" aria-label="Legenda grafu">
      <span>
        <i className="legend-line" />
        <b>Portfolio</b>
        <em>{percent(point?.portfolioReturnPct ?? 0, locale)}</em>
      </span>
      <button aria-pressed={showBenchmark} onClick={onBenchmark}>
        <i className="legend-line dashed" />
        <b>{analysis.benchmark}</b>
        <em>{percent(point?.benchmarkReturnPct ?? 0, locale)}</em>
      </button>
      {compareAssetId && analysis.compare && (
        <button onClick={onClearCompare} aria-label={`Odebrat porovnání ${analysis.compare}`}>
          <i className="legend-line compare" />
          <b>{analysis.compare}</b>
          <em>
            {percent(point?.assetReturnPct ?? analysis.points.at(-1)?.assetReturnPct ?? 0, locale)}
          </em>
          <span aria-hidden>×</span>
        </button>
      )}
      <small>
        {compareAssetId || showBenchmark
          ? "Index 100 · srovnání relativního vývoje"
          : "Výnos od začátku období"}
      </small>
    </div>
  );
}
