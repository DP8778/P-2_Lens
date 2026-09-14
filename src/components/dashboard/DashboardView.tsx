"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, ChevronDown, RefreshCw } from "lucide-react";
import type { Dictionary, Locale } from "@/i18n/getDictionary";
import {
  buildAnalysis,
  buildAnalysisFromDataset,
  timeline as demoTimeline,
  timeframeRange,
  type Holding,
  type TimeRange,
} from "@/lib/finance/portfolio-engine";
import { PortfolioSummary } from "./PortfolioSummary";
import { PortfolioHeroChart } from "@/components/charts/PortfolioHeroChart";
import { LensInsight } from "@/components/insights/LensInsight";
import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { PortfolioDrivers } from "@/components/portfolio/PortfolioDrivers";
import { HoldingDetail } from "@/components/portfolio/HoldingDetail";
import { AddAssetDialog } from "@/components/portfolio/AddAssetDialog";
import { usePortfolio } from "@/components/portfolio/PortfolioProvider";
import { useAnalysisContext } from "@/components/portfolio/AnalysisProvider";
import { AnalysisInspector } from "@/components/portfolio/AnalysisInspector";
import { MarketDataInspector } from "@/components/portfolio/MarketDataInspector";
import { dateLabel } from "@/components/charts/chart-formatters";

const daysFor: Record<TimeRange, number> = { "1W": 7, "1M": 30, "3M": 90, YTD: 366, "1Y": 365, ALL: 100_000 };
const freshnessLabel = (timestamp: string) => {
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(timestamp)) / 1000));
  if (seconds < 60) return `Aktualizováno před ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `Aktualizováno před ${minutes} min` : `Aktualizováno ${new Date(timestamp).toLocaleString("cs-CZ")}`;
};
function liveRange(timeline: string[], timeframe: TimeRange | "CUSTOM", selected: [string, string] | null) {
  if (selected) {
    const start = timeline.findIndex((date) => date >= selected[0]);
    const end = timeline.findLastIndex((date) => date <= selected[1]);
    return [Math.max(0, start), Math.max(start + 1, end)] as [number, number];
  }
  const last = timeline.length - 1;
  if (timeframe === "ALL" || timeframe === "CUSTOM") return [0, last] as [number, number];
  const endTime = Date.parse(`${timeline[last]}T12:00:00Z`);
  const cutoff = new Date(endTime - daysFor[timeframe] * 86_400_000).toISOString().slice(0, 10);
  const start = Math.max(0, timeline.findIndex((date) => date >= cutoff));
  return [start, last] as [number, number];
}

export function DashboardView({ locale, initialAssetId }: { locale: Locale; dictionary?: Dictionary; initialAssetId?: string }) {
  const { mode, setMode, holdings, transactions, warning, market, analysisDataset, refreshQuotes } = usePortfolio();
  const { state, dispatch } = useAnalysisContext();
  const [detailId, setDetailId] = useState<string | undefined>(initialAssetId);
  const [add, setAdd] = useState<{ assetId?: string; edit?: Holding }>();
  const [confirmation, setConfirmation] = useState("");
  useEffect(() => {
    if (initialAssetId) dispatch({ type: "settings", value: { compareAssetId: initialAssetId } });
  }, [dispatch, initialAssetId]);

  const personalReady = mode === "personal" && Boolean(analysisDataset && transactions.length);
  const activeTimeline = personalReady ? analysisDataset!.timeline : demoTimeline;
  useEffect(() => {
    if (!personalReady) return;
    const next = liveRange(activeTimeline, state.timeframe, null);
    const viewport: [string, string] = [activeTimeline[next[0]], activeTimeline[next[1]]];
    if (state.viewportRange[0] !== viewport[0] || state.viewportRange[1] !== viewport[1])
      dispatch({ type: "viewport", value: viewport });
  }, [activeTimeline, dispatch, personalReady, state.timeframe, state.viewportRange]);
  const range = useMemo<[number, number]>(() => {
    if (personalReady) return liveRange(activeTimeline, state.timeframe, state.selectedRange);
    if (state.selectedRange) {
      const start = demoTimeline.findIndex((date) => date === state.selectedRange![0]);
      const end = demoTimeline.findIndex((date) => date === state.selectedRange![1]);
      return [Math.max(0, start), end < 1 ? 730 : end];
    }
    return timeframeRange(state.timeframe === "CUSTOM" ? "1M" : state.timeframe);
  }, [activeTimeline, personalReady, state.selectedRange, state.timeframe]);
  const analysis = useMemo(() => {
    if (personalReady)
      return buildAnalysisFromDataset(transactions, range, analysisDataset!, "spy", state.compareAssetId, state.selectedPoint, state.timeframe);
    if (mode === "personal") return undefined;
    return buildAnalysis(transactions, range, state.benchmarkId, state.compareAssetId, state.selectedPoint);
  }, [analysisDataset, mode, personalReady, range, state.benchmarkId, state.compareAssetId, state.selectedPoint, state.timeframe, transactions]);
  const overview = useMemo(() => {
    if (personalReady)
      return buildAnalysisFromDataset(transactions, [0, activeTimeline.length - 1], analysisDataset!, "spy", state.compareAssetId, state.selectedPoint, "ALL");
    if (mode === "personal") return undefined;
    return buildAnalysis(transactions, [0, 730]);
  }, [activeTimeline.length, analysisDataset, mode, personalReady, state.compareAssetId, state.selectedPoint, transactions]);
  const visibleAnalysis = analysis;
  const detail = analysis?.holdings.find((position) => position.assetId === detailId);
  const period = state.selectedRange ? "vlastní období" : state.timeframe;
  const closeAdd = () => { setAdd(undefined); dispatch({ type: "point", value: null }); };
  const switchMode = (next: "demo" | "personal") => {
    setMode(next);
    dispatch({ type: "timeframe", value: state.timeframe === "CUSTOM" ? "1M" : state.timeframe });
    dispatch({ type: "settings", value: { compareAssetId: "", benchmarkId: "spy" } });
    setDetailId(undefined);
  };

  return (
    <div className="portfolio-page page-enter">
      <header className="portfolio-heading">
        <div className="portfolio-heading-left">
          <details className="portfolio-picker">
            <summary><span className="portfolio-dot" />{mode === "demo" ? "Demo portfolio" : "Moje portfolio"}<ChevronDown size={14} /></summary>
            <div className="glass portfolio-mode-menu">
              <button aria-pressed={mode === "demo"} onClick={() => switchMode("demo")}><strong>Demo portfolio</strong><small>Deterministická case study · lens-demo-2026.09-v2</small></button>
              <button aria-pressed={mode === "personal"} onClick={() => switchMode("personal")}><strong>Moje portfolio</strong><small>Vaše transakce · market data Twelve Data</small></button>
            </div>
          </details>
          <span className="demo-label">{mode === "demo" ? "Demo data" : "Osobní · CZK"}</span>
        </div>
        {mode === "personal" ? <button className="primary-button" onClick={() => setAdd({})}><Plus size={17} />Přidat investici</button> : <button className="quiet-button" onClick={() => switchMode("personal")}>Použít vlastní portfolio</button>}
      </header>
      {confirmation && <div className="portfolio-toast" role="status">{confirmation}</div>}
      {warning && <p role="status" className="inline-notice">{warning}</p>}
      {mode === "personal" && (
        <div className={`market-data-strip ${market.state}`} role="status">
          <span>{market.state === "loading" ? "Načítám market data…" : market.state === "stale" ? `Data nejsou aktuální · ${market.lastRefresh ? freshnessLabel(market.lastRefresh).toLowerCase() : "poslední uložené ceny"}` : market.state === "unavailable" ? market.error : market.lastRefresh ? freshnessLabel(market.lastRefresh) : "Twelve Data"}</span>
          {market.lastRefresh && <small>{market.quotes.some((quote) => quote.marketState === "open") ? "● Trh otevřen" : `Poslední dostupné ceny · ${market.quotes[0] ? new Date(market.quotes[0].timestamp).toLocaleString(locale) : "trh zavřen"}`}</small>}
          {holdings.length > 0 && <button className="icon-control" onClick={() => void refreshQuotes()} aria-label="Aktualizovat ceny"><RefreshCw size={14} /></button>}
        </div>
      )}
      {mode === "personal" && !analysis ? (
        <section className="personal-empty surface" aria-labelledby="personal-empty-title">
          <span className="portfolio-dot" />
          <h1 id="personal-empty-title">Moje portfolio</h1>
          <p>{holdings.length
            ? market.state === "loading"
              ? "Načítám historii a kurzy pro vaše portfolio…"
              : "Portfolio je uložené, ale market data teď nejsou dostupná."
            : "Sledujte výkon a strukturu vlastního portfolia."}</p>
          {market.configured === false && <small>Live market data nejsou nakonfigurována. Přidejte TWELVE_DATA_API_KEY do .env.local.</small>}
          <button className="primary-button" onClick={() => setAdd({})}><Plus size={17} />Přidat první investici</button>
          <button className="quiet-button" onClick={() => switchMode("demo")}>Zobrazit demo portfolio</button>
        </section>
      ) : analysis && overview && visibleAnalysis ? (
        <>
          <PortfolioSummary analysis={analysis} locale={locale} period={period} showBenchmark={state.showBenchmark} />
          <div className="analytics-heading"><h2>Portfolio v souvislostech</h2><span>{dateLabel(analysis.metrics.startDate, locale)} — {dateLabel(analysis.metrics.endDate, locale)}</span></div>
          <div className="hero-analytics">
            <PortfolioHeroChart analysis={analysis} visibleAnalysis={visibleAnalysis} overview={overview} locale={locale} timelineDates={activeTimeline} />
            <LensInsight analysis={analysis} locale={locale} dataSource={mode === "personal" ? "live" : "mock"} context={{ transactions, selectedRange: state.selectedRange, timeframe: state.timeframe, mode: state.mode, benchmarkId: state.benchmarkId, compareAssetId: state.compareAssetId, showBenchmark: state.showBenchmark, selectedPoint: state.selectedPoint }} />
          </div>
          <PortfolioDrivers analysis={analysis} locale={locale} />
          <HoldingsTable holdings={analysis.holdings} locale={locale} onSelect={(position) => setDetailId(position.assetId)} onAdd={() => setAdd({})} period={period} quotes={market.quotes} editable={mode === "personal"} />
          <footer className="portfolio-footer"><span>Lens · portfolio intelligence</span><p>{mode === "demo" ? "Verze dat lens-demo-2026.09-v2 · CZK, deterministické demo ceny a kurzy." : `Twelve Data · price-based return · ${market.lastRefresh ? `aktualizováno ${new Date(market.lastRefresh).toLocaleString(locale)}` : "market data"}.`}</p></footer>
          <AnalysisInspector state={state} analysis={analysis} />
          <MarketDataInspector mode={mode} assets={analysisDataset?.assets ?? []} market={market} />
        </>
      ) : null}
      {detail && (
        <HoldingDetail holding={detail} locale={locale} onClose={() => setDetailId(undefined)} onCompare={() => { dispatch({ type: "settings", value: { compareAssetId: detail.assetId, mode: "performance" } }); setDetailId(undefined); document.querySelector(".hero-analytics")?.scrollIntoView({ behavior: "instant", block: "start" }); }} onAdd={() => { setAdd({ assetId: detail.assetId }); setDetailId(undefined); }} />
      )}
      {add && <AddAssetDialog onClose={closeAdd} initialAssetId={add.assetId} edit={add.edit} onSaved={(symbol) => { setConfirmation(`${symbol} bylo přidáno do portfolia.`); window.setTimeout(() => setConfirmation(""), 3200); }} />}
    </div>
  );
}
