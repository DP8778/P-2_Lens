"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Focus } from "lucide-react";
import type { PortfolioAnalysis, TimeRange } from "@/lib/finance/portfolio-engine";
import { toLensFacts } from "@/lib/finance/lens-facts";
import {
  buildDeterministicInsight,
  buildInsightContext,
  shouldAcceptInsightResponse,
} from "@/lib/insights/insight-context";
import {
  contextInsightSchema,
  type ContextInsight,
  type PortfolioContext,
} from "@/lib/validation/portfolioContext";
import type { InsightEvidence } from "@/lib/validation/insightSchemas";
import { useAnalysisContext } from "@/components/portfolio/AnalysisProvider";
import { money, percent, points } from "@/components/charts/chart-formatters";

const insightCache = new Map<string, ContextInsight>();

const formatEvidence = (item: InsightEvidence, locale: string) => {
  if (item.unit === "CZK") return money(item.value, locale);
  if (item.unit === "percentage-point") return points(item.value, locale);
  return percent(item.value, locale);
};

export function LensInsight({
  analysis,
  context,
  locale,
}: {
  analysis: PortfolioAnalysis;
  context: PortfolioContext;
  locale: string;
}) {
  const { dispatch } = useAnalysisContext();
  const requestVersion = useRef(0);
  const activeKey = useRef("");
  const [remote, setRemote] = useState<{ key: string; data: ContextInsight }>();
  const [failedKey, setFailedKey] = useState<string>();
  const timeframe: TimeRange = context.timeframe === "CUSTOM" ? "ALL" : context.timeframe;
  const facts = useMemo(
    () =>
      toLensFacts(analysis, timeframe, {
        mode: context.mode,
        benchmarkVisible: context.showBenchmark,
      }),
    [analysis, timeframe, context.mode, context.showBenchmark],
  );
  const verifiedContext = useMemo(
    () => buildInsightContext(analysis, context, facts),
    [analysis, context, facts],
  );
  const deterministic = useMemo(
    () => buildDeterministicInsight(verifiedContext),
    [verifiedContext],
  );
  const key = useMemo(
    () =>
      JSON.stringify({
        datasetVersion: verifiedContext.datasetVersion,
        transactions: context.transactions,
        scope: verifiedContext.scope,
        focus: verifiedContext.focus,
        mode: context.mode,
        benchmarkId: context.benchmarkId,
        showBenchmark: context.showBenchmark,
        selectedAsset: context.compareAssetId,
        selectedPoint: context.selectedPoint,
      }),
    [context, verifiedContext],
  );
  const cached = insightCache.get(key);

  useEffect(() => {
    activeKey.current = key;
    if (cached) {
      return;
    }
    const version = ++requestVersion.current;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch("/api/portfolio/context", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...context, explain: true }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("context");
        const data = contextInsightSchema.parse(await response.json());
        if (
          !controller.signal.aborted &&
          version === requestVersion.current &&
          shouldAcceptInsightResponse(activeKey.current, key)
        ) {
          insightCache.set(key, data);
          setRemote({ key, data });
          setFailedKey(undefined);
        }
      } catch {
        if (!controller.signal.aborted && version === requestVersion.current) setFailedKey(key);
      }
    }, 240);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [cached, context, key]);

  const insight = remote?.key === key ? remote.data : (cached ?? deterministic);
  const loading = remote?.key !== key && !cached && failedKey !== key;
  const act = (item: InsightEvidence) => {
    if (!item.action) return;
    if (item.action.type === "selectAsset") {
      dispatch({
        type: "settings",
        value: { compareAssetId: item.action.assetId, mode: "performance" },
      });
    } else if (item.action.type === "selectDrawdown") {
      dispatch({ type: "settings", value: { mode: "drawdown" } });
      dispatch({ type: "point", value: item.action.timestamp });
    } else {
      dispatch({ type: "settings", value: { showBenchmark: true, display: "percent" } });
    }
    document.querySelector(".hero-chart")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <aside className="lens-insight glass" id="lens-insight" aria-labelledby="lens-insight-title">
      <header>
        <span className="lens-orbit" aria-hidden />
        <h2 id="lens-insight-title">Lens Insight</h2>
        <Focus size={16} aria-hidden />
      </header>

      <div className="insight-scope">
        <span>{insight.scopeLabel}</span>
        {context.selectedRange && (
          <button onClick={() => dispatch({ type: "clearRange" })}>Zrušit rozsah</button>
        )}
      </div>

      <div className="insight-copy" aria-live="polite" aria-atomic="true">
        <h3>{insight.headline}</h3>
        <p>{insight.summary}</p>
      </div>

      {!!insight.drivers.length && (
        <section className="insight-claims" aria-labelledby="insight-drivers-title">
          <h3 id="insight-drivers-title">Co výsledek ovlivnilo</h3>
          <ul>
            {insight.drivers.map((driver) => (
              <li key={`${driver.text}-${driver.evidenceIds.join("-")}`}>{driver.text}</li>
            ))}
          </ul>
        </section>
      )}

      {!!insight.riskNotes.length && (
        <section className="insight-claims" aria-labelledby="insight-risk-title">
          <h3 id="insight-risk-title">Co sledovat v datech</h3>
          <ul>
            {insight.riskNotes.map((note) => (
              <li key={`${note.text}-${note.evidenceIds.join("-")}`}>{note.text}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="insight-evidence" aria-labelledby="insight-evidence-title">
        <h3 id="insight-evidence-title">Evidence</h3>
        <div>
          {insight.evidence.map((item) => {
            const content = (
              <>
                <span><strong>{item.label}</strong>{item.detail && <small>{item.detail}</small>}</span>
                <b>{formatEvidence(item, locale)}</b>
              </>
            );
            return item.action ? (
              <button key={item.id} onClick={() => act(item)} aria-label={`${item.label}: ${formatEvidence(item, locale)}. Zobrazit v grafu.`}>
                {content}<span aria-hidden>↗</span>
              </button>
            ) : (
              <div key={item.id}>{content}</div>
            );
          })}
        </div>
      </section>

      <details className="insight-why">
        <summary>Proč právě tento insight?</summary>
        <p>
          Vysvětlení používá {verifiedContext.scope.type === "range" ? "vybraný rozsah" : `období ${verifiedContext.scope.label}`}, výnos portfolia
          {verifiedContext.performance.benchmark ? ", benchmark" : ""}, příspěvky aktiv a drawdown.
        </p>
        {!!insight.limitations.length && (
          <ul>{insight.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
        )}
        <small>Čísla v Evidence pocházejí z PortfolioAnalysis; formulace je interpretační vrstva.</small>
      </details>

      <footer>
        <span>{loading ? "Aktualizuji formulaci…" : failedKey === key ? "Rozšířená formulace není dostupná; ověřený výklad zůstává aktivní." : "Demo analytics · nejde o investiční doporučení"}</span>
      </footer>
    </aside>
  );
}
