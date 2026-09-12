import { useState } from "react";
import type { PortfolioAnalysis } from "@/lib/finance/portfolio-engine";
import { dateLabel, percent } from "./chart-formatters";
export type ChartEventType = "buy" | "sell" | "asset-added" | "drawdown" | "portfolio";
export function ChartAnnotations({
  analysis,
  onSelect,
}: {
  analysis: PortfolioAnalysis;
  onSelect: (index: number) => void;
}) {
  const [open, setOpen] = useState(false);
  if (analysis.trough.drawdown >= 0) return null;
  return (
    <div className="chart-annotations">
      <button
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          onSelect(analysis.points.indexOf(analysis.trough));
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <span className="event-marker">↓</span> Největší pokles{" "}
        <span className="tertiary">{dateLabel(analysis.trough.timestamp)}</span>
      </button>
      {open && (
        <div className="annotation-popover glass">
          {percent(analysis.trough.drawdown)} od předchozího maxima.{" "}
          {analysis.recovery
            ? `Zotavení ${dateLabel(analysis.recovery.timestamp)}.`
            : "Do konce období bez zotavení."}
        </div>
      )}
    </div>
  );
}
