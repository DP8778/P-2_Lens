import type { AnalysisPoint } from "@/lib/finance/portfolio-engine";
import { money, percent, points, dateLabel } from "./chart-formatters";
export function HeroChartTooltip({
  point,
  benchmark,
  compare,
  selected,
  locale,
}: {
  point: AnalysisPoint;
  benchmark?: string;
  compare?: string;
  selected: boolean;
  locale: string;
}) {
  return (
    <div className="hero-tooltip glass" role="status">
      <div className="tooltip-date">
        {dateLabel(point.timestamp, locale)}
        <span>{selected ? "Vybraný bod" : "Portfolio"}</span>
      </div>
      <strong>{money(point.portfolioValue, locale)}</strong>
      <div className={point.absolutePnl >= 0 ? "positive" : "negative"}>
        {point.absolutePnl > 0 ? "+" : ""}
        {money(point.absolutePnl, locale)}{" "}
        <span>· {percent(point.portfolioReturnPct, locale)}</span>
      </div>
      {benchmark && (
        <div className="tooltip-secondary">
          <span>
            {benchmark} {percent(point.benchmarkReturnPct, locale)}
          </span>
          <b>{points(point.benchmarkDeltaPct, locale)}</b>
        </div>
      )}
      {compare && (
        <div className="tooltip-secondary">
          <span>{compare}</span>
          <b>{percent(point.assetReturnPct, locale)}</b>
        </div>
      )}
    </div>
  );
}
