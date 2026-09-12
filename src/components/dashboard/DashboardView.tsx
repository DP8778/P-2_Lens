"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, ChevronDown } from "lucide-react";
import type { Dictionary, Locale } from "@/i18n/getDictionary";
import {
  buildAnalysis,
  timeline,
  timeframeRange,
  type Holding,
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
import { dateLabel } from "@/components/charts/chart-formatters";

export function DashboardView({
  locale,
  initialAssetId,
}: {
  locale: Locale;
  dictionary?: Dictionary;
  initialAssetId?: string;
}) {
  const { holdings, transactions, warning } = usePortfolio();
  const { state, dispatch } = useAnalysisContext();
  const [detailId, setDetailId] = useState<string | undefined>(initialAssetId);
  const [add, setAdd] = useState<{ assetId?: string; edit?: Holding }>();
  useEffect(() => {
    if (initialAssetId) dispatch({ type: "settings", value: { compareAssetId: initialAssetId } });
  }, [dispatch, initialAssetId]);
  const dateRange = (dates: [string, string]): [number, number] => {
    const start = timeline.findIndex((date) => date === dates[0]);
    const end = timeline.findIndex((date) => date === dates[1]);
    return [Math.max(0, start), end < 1 ? 730 : end];
  };
  const range = useMemo<[number, number]>(
    () =>
      state.selectedRange
        ? dateRange(state.selectedRange)
        : timeframeRange(state.timeframe === "CUSTOM" ? "1M" : state.timeframe),
    [state.selectedRange, state.timeframe],
  );
  const viewportRange = useMemo<[number, number]>(
    () => dateRange(state.viewportRange),
    [state.viewportRange],
  );
  const analysis = useMemo(
    () =>
      buildAnalysis(
        transactions,
        range,
        state.benchmarkId,
        state.compareAssetId,
        state.selectedPoint,
      ),
    [transactions, range, state.benchmarkId, state.compareAssetId, state.selectedPoint],
  );
  const overview = useMemo(() => buildAnalysis(transactions, [0, 730]), [transactions]);
  const visibleAnalysis = useMemo(
    () =>
      buildAnalysis(
        transactions,
        viewportRange,
        state.benchmarkId,
        state.compareAssetId,
        state.selectedPoint,
      ),
    [transactions, viewportRange, state.benchmarkId, state.compareAssetId, state.selectedPoint],
  );
  const detail = analysis.holdings.find((position) => position.assetId === detailId);
  const period = state.selectedRange ? "vlastní období" : state.timeframe;
  const closeAdd = () => {
    setAdd(undefined);
    dispatch({ type: "point", value: null });
  };
  return (
    <div className="portfolio-page page-enter">
      <header className="portfolio-heading">
        <div className="portfolio-heading-left">
          <details className="portfolio-picker">
            <summary>
              <span className="portfolio-dot" />
              Osobní portfolio
              <ChevronDown size={14} />
            </summary>
            <div className="glass">
              <strong>Osobní portfolio ✓</strong>
              <p>Lokální demo · změny se ukládají v prohlížeči</p>
            </div>
          </details>
          <span className="demo-label">Demo</span>
        </div>
        <button className="primary-button" onClick={() => setAdd({})}>
          <Plus size={17} />
          Přidat aktivum
        </button>
      </header>
      {warning && (
        <p role="status" className="inline-notice">
          {warning}
        </p>
      )}
      <PortfolioSummary
        analysis={analysis}
        locale={locale}
        period={period}
        showBenchmark={state.showBenchmark}
      />
      <div className="analytics-heading">
        <h2>Portfolio v souvislostech</h2>
        <span>
          {dateLabel(analysis.metrics.startDate, locale)} —{" "}
          {dateLabel(analysis.metrics.endDate, locale)}
        </span>
      </div>
      <div className="hero-analytics">
        <PortfolioHeroChart
          analysis={analysis}
          visibleAnalysis={visibleAnalysis}
          overview={overview}
          locale={locale}
        />
        <LensInsight
          analysis={analysis}
          locale={locale}
          context={{
            transactions,
            selectedRange: state.selectedRange,
            timeframe: state.timeframe,
            mode: state.mode,
            benchmarkId: state.benchmarkId,
            compareAssetId: state.compareAssetId,
            showBenchmark: state.showBenchmark,
            selectedPoint: state.selectedPoint,
          }}
        />
      </div>
      <PortfolioDrivers analysis={analysis} locale={locale} />
      <HoldingsTable
        holdings={analysis.holdings}
        locale={locale}
        onSelect={(position) => setDetailId(position.assetId)}
        onAdd={() => setAdd({})}
        period={period}
      />
      <footer className="portfolio-footer">
        <span>Lens · portfolio intelligence</span>
        <p>
          Verze dat lens-demo-2026.09-v1 · CZK, pevné demo ceny a kurzy. Historie respektuje data
          nákupů, prodejů, vkladů a výběrů.
        </p>
      </footer>
      <AnalysisInspector state={state} analysis={analysis} />
      {detail && (
        <HoldingDetail
          holding={detail}
          locale={locale}
          onClose={() => setDetailId(undefined)}
          onCompare={() => {
            dispatch({
              type: "settings",
              value: { compareAssetId: detail.assetId, mode: "performance" },
            });
            setDetailId(undefined);
            document
              .querySelector(".hero-analytics")
              ?.scrollIntoView({ behavior: "instant", block: "start" });
          }}
          onEdit={() => {
            setAdd({ edit: holdings.find((position) => position.assetId === detail.assetId) });
            setDetailId(undefined);
          }}
          onAdd={() => {
            setAdd({ assetId: detail.assetId });
            setDetailId(undefined);
          }}
        />
      )}
      {add && <AddAssetDialog onClose={closeAdd} initialAssetId={add.assetId} edit={add.edit} />}
    </div>
  );
}
