"use client";
import { useEffect, useState } from "react";
import { ArrowUpRight, Focus } from "lucide-react";
import type { PortfolioAnalysis } from "@/lib/finance/portfolio-engine";
import {
  contextInsightSchema,
  type ContextInsight,
  type PortfolioContext,
} from "@/lib/validation/portfolioContext";
import { percent, points, allocation, dateLabel } from "@/components/charts/chart-formatters";
export function LensInsight({
  analysis,
  context,
  locale,
}: {
  analysis: PortfolioAnalysis;
  context: PortfolioContext;
  locale: string;
}) {
  const [result, setResult] = useState<{ key: string; data?: ContextInsight; error?: boolean }>();
  const [expanded, setExpanded] = useState(false);
  const key = JSON.stringify({ ...context, explain: expanded });
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/portfolio/context", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: key,
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("context");
        const data = contextInsightSchema.parse(await response.json());
        setResult({ key, data });
      } catch {
        if (!controller.signal.aborted) setResult({ key, error: true });
      }
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key]);
  const current = result?.key === key ? result : undefined;
  const m = analysis.metrics;
  const lead = m.topContributors[0];
  const drag = m.topDetractors[0];
  const point = context.selected === null ? undefined : analysis.points[context.selected];
  return (
    <aside className="lens-insight glass" id="lens-insight" aria-labelledby="lens-insight-title">
      <header>
        <span className="lens-orbit" aria-hidden />
        <h2 id="lens-insight-title">Lens Insight</h2>
        <Focus size={16} />
      </header>
      <div className="insight-copy" aria-live="polite" aria-busy={!current}>
        <p className="insight-context">
          {current?.data?.context ??
            (point
              ? dateLabel(point.timestamp, locale)
              : context.timeframe === "CUSTOM"
                ? "Vlastní období"
                : context.timeframe)}
        </p>
        <h3>
          {current?.data?.headline ??
            (point
              ? "Vybraný bod portfolia"
              : m.returnPct >= 0
                ? "Portfolio v růstu"
                : "Portfolio v poklesu")}
        </h3>
        <p>
          {current?.data?.summary ??
            `Výnos portfolia ${percent(point?.portfolioReturnPct ?? m.returnPct, locale)}.${context.showBenchmark ? ` Rozdíl proti ${analysis.benchmark}: ${points(point?.benchmarkDeltaPct ?? m.benchmarkDeltaPct, locale)}.` : ""}`}
        </p>
      </div>
      <div className="insight-drivers">
        {lead && (
          <div>
            <span className="insight-driver-icon">↗</span>
            <span>
              <strong>{lead.symbol}</strong>
              <small>Největší přínos za období</small>
            </span>
            <b>{points(lead.contributionPctPoints, locale)}</b>
          </div>
        )}
        {drag && (
          <div>
            <span className="insight-driver-icon">↘</span>
            <span>
              <strong>{drag.symbol}</strong>
              <small>Největší ztráta za období</small>
            </span>
            <b>{points(drag.contributionPctPoints, locale)}</b>
          </div>
        )}
      </div>
      <div className="insight-watchout">
        <span className="watchout-label">Riziko období</span>
        <dl>
          <div>
            <dt>Největší pozice</dt>
            <dd>{allocation(m.largestPositionPct, locale)}</dd>
          </div>
          <div>
            <dt>Maximální pokles</dt>
            <dd>{percent(m.maxDrawdownPct, locale)}</dd>
          </div>
        </dl>
      </div>
      <button
        className="insight-more"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        Jak číst tyto souvislosti
        <ArrowUpRight size={15} />
      </button>
      {expanded && current?.data?.explanation && (
        <p className="insight-method">{current.data.explanation}</p>
      )}
      {expanded && (
        <p className="insight-method">
          Příspěvek zohledňuje velikost pozice na začátku období i její výnos. Drawdown měří propad
          od průběžného maxima. Porovnání aktiv začíná na indexu 100. Výsledky simulují dnešní
          složení portfolia v minulosti.
        </p>
      )}
      <footer>
        {current?.error
          ? "Vysvětlení je dočasně nedostupné. Aktuální metriky zůstávají zobrazené."
          : "Demo data · nejde o investiční doporučení"}
      </footer>
    </aside>
  );
}
