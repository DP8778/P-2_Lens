"use client";

import { useState } from "react";
import type { ContributionItem, PortfolioAnalysis } from "@/lib/finance/portfolio-engine";
import { useAnalysisContext } from "@/components/portfolio/AnalysisProvider";
import { allocation, percent, points } from "./chart-formatters";

export function ContributionView({ analysis, locale }: { analysis: PortfolioAnalysis; locale: string }) {
  const { state, dispatch } = useAnalysisContext();
  const [focused, setFocused] = useState<ContributionItem>();
  const rows = analysis.contribution.items;
  const active = focused ?? rows.find((item) => item.assetId === state.compareAssetId);
  const max = Math.max(...rows.map((item) => Math.abs(item.contributionPctPoints)), 0.001);
  const select = (item: ContributionItem) => {
    if (item.assetId === "cash") return;
    setFocused(item);
    dispatch({ type: "settings", value: { compareAssetId: item.assetId } });
  };
  return (
    <div className="contribution-view">
      <div className="contribution-summary" aria-label="Souhrn příspěvků">
        <span>Výnos portfolia <strong>{percent(analysis.metrics.returnPct, locale)}</strong></span>
        <span>Největší přínos <strong>{analysis.contribution.topContributor?.symbol ?? "—"}</strong></span>
        <span>Největší útlum <strong>{analysis.contribution.topDetractor?.symbol ?? "—"}</strong></span>
      </div>
      <div className="contribution-bars" role="img" aria-label="Příspěvky aktiv k výnosu">
        <span className="contribution-zero" aria-hidden />
        {rows.map((item) => {
          const width = `${(Math.abs(item.contributionPctPoints) / max) * 48}%`;
          const negative = item.contributionPctPoints < 0;
          return (
            <button
              key={item.assetId}
              className="contribution-row"
              aria-pressed={state.compareAssetId === item.assetId}
              aria-label={`${item.symbol}, příspěvek ${points(item.contributionPctPoints, locale)}`}
              onMouseEnter={() => setFocused(item)}
              onMouseLeave={() => setFocused(undefined)}
              onFocus={() => setFocused(item)}
              onBlur={() => setFocused(undefined)}
              onClick={() => select(item)}
            >
              <span className="contribution-symbol"><strong>{item.symbol}</strong><small>{item.name}</small></span>
              <span className="contribution-track" aria-hidden>
                <i className={negative ? "negative" : "positive"} style={{ width, [negative ? "right" : "left"]: "50%" }} />
              </span>
              <b className={negative ? "negative" : "positive"}>{points(item.contributionPctPoints, locale)}</b>
            </button>
          );
        })}
        {Math.abs(analysis.contribution.residual) > 0.005 && (
          <div className="contribution-row residual-row">
            <span className="contribution-symbol"><strong>Ostatní efekt</strong><small>cash-flow, timing, poplatky a skládání</small></span>
            <span className="contribution-track" aria-hidden />
            <b>{points(analysis.contribution.residual, locale)}</b>
          </div>
        )}
      </div>
      {active && (
        <div className="contribution-detail" role="status">
          <strong>{active.symbol}</strong>
          <span>Výnos aktiva {percent(active.periodReturnPct, locale)}</span>
          <span>Průměrná alokace {allocation(active.averageAllocationPct, locale)}</span>
          <span>Příspěvek {points(active.contributionPctPoints, locale)}</span>
          <span>Podíl na absolutních příspěvcích {allocation(active.contributionSharePct, locale)}</span>
          <button onClick={() => dispatch({ type: "settings", value: { mode: "performance" } })}>
            Porovnat ve Vývoji →
          </button>
        </div>
      )}
      {!rows.length && <p className="tertiary">Pro zvolené období není dostupný žádný příspěvek.</p>}
    </div>
  );
}
