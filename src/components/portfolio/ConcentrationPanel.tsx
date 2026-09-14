import { useState } from "react";
import type { PortfolioAnalysis } from "@/lib/finance/portfolio-engine";
import { allocation } from "@/components/charts/chart-formatters";

export function ConcentrationPanel({ analysis, locale }: { analysis: PortfolioAnalysis; locale: string }) {
  const c = analysis.concentration;
  const [showAll, setShowAll] = useState(false);
  const allPositions = analysis.holdings.filter((item) => item.assetId !== "cash");
  const positions = showAll ? allPositions : allPositions.slice(0, 5);
  return (
    <div className="concentration-panel">
      <h2>Koncentrace portfolia</h2>
      <dl className="concentration-metrics">
        <div><dt>Největší pozice</dt><dd>{c.largestPosition ? `${c.largestPosition.symbol} · ${allocation(c.largestPosition.allocationPct, locale)}` : "—"}</dd></div>
        <div><dt>Top 3</dt><dd>{allocation(c.top3Share, locale)}</dd></div>
        <div><dt>Počet aktiv</dt><dd>{c.assetCount}</dd></div>
        <div><dt>Hotovost</dt><dd>{allocation(c.cashShare, locale)}</dd></div>
      </dl>
      <div className="concentration-list" aria-label="Seznam alokací aktiv">
        {positions.map((position) => (
          <div key={position.assetId}>
            <span>{position.asset.symbol}</span>
            <i><b style={{ width: `${Math.min(100, position.allocationPct)}%` }} /></i>
            <strong>{allocation(position.allocationPct, locale)}</strong>
          </div>
        ))}
      </div>
      {allPositions.length > 5 && <button className="panel-disclosure" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>{showAll ? "Zobrazit Top 5" : `Zobrazit všech ${allPositions.length}`}</button>}
      <p>Top 3 pozice tvoří {allocation(c.top3Share, locale)} hodnoty celého portfolia; hotovost sledujeme samostatně.</p>
    </div>
  );
}
