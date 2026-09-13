import type { AnalysisPoint, ChartMode } from "@/lib/finance/portfolio-engine";
import { money, percent, points, dateLabel } from "./chart-formatters";
export function HeroChartTooltip({
  point,
  benchmark,
  compare,
  selected,
  locale,
  positionPercent,
  mode,
}: {
  point: AnalysisPoint;
  benchmark?: string;
  compare?: string;
  selected: boolean;
  locale: string;
  positionPercent: number;
  mode: ChartMode;
}) {
  const nearRightEdge = positionPercent > 64;
  return (
    <div
      className="hero-tooltip glass"
      role="status"
      style={{
        left: `${Math.max(2, Math.min(98, positionPercent))}%`,
        transform: nearRightEdge ? "translateX(calc(-100% - 14px))" : "translateX(14px)",
      }}
    >
      <div className="tooltip-date">
        {dateLabel(point.timestamp, locale)}
        <span>{selected ? "Vybraný bod" : "Portfolio"}</span>
      </div>
      <div className="tooltip-primary">
        <span>Portfolio</span>
        <strong>{money(point.portfolioValue, locale)}</strong>
        <b className={(mode === "drawdown" ? point.drawdown : point.portfolioReturnPct) >= 0 ? "positive" : "negative"}>
          {mode === "drawdown" ? percent(point.drawdown, locale) : percent(point.portfolioReturnPct, locale)}
        </b>
      </div>
      {mode === "drawdown" && (
        <div className="tooltip-secondary"><span>Pokles od maxima</span><b>{percent(point.drawdown, locale)}</b></div>
      )}
      {benchmark && mode !== "drawdown" && (
        <div className="tooltip-secondary">
          <span>
            {benchmark} {percent(point.benchmarkReturnPct, locale)}
          </span>
          <b>{percent(point.benchmarkReturnPct, locale)}</b>
        </div>
      )}
      {compare && mode !== "drawdown" && (
        <div className="tooltip-secondary">
          <span>{compare}</span>
          <b>{percent(point.assetReturnPct, locale)}</b>
        </div>
      )}
      {benchmark && mode !== "drawdown" && (
        <div className="tooltip-delta">
          <span>vs {benchmark}</span>
          <b>{points(point.benchmarkDeltaPct, locale)}</b>
        </div>
      )}
    </div>
  );
}
