"use client";
import { useMemo, useState } from "react";
import { Plus, ChevronDown } from "lucide-react";
import type { Dictionary, Locale } from "@/i18n/getDictionary";
import type { Timeframe } from "@/types/finance";
import { buildAnalysis, timeframeRange, type Holding } from "@/lib/finance/portfolio-engine";
import { PortfolioSummary } from "./PortfolioSummary";
import { PortfolioHeroChart } from "@/components/charts/PortfolioHeroChart";
import type { ChartSettings } from "@/components/charts/ChartControls";
import { LensInsight } from "@/components/insights/LensInsight";
import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import { PortfolioDrivers } from "@/components/portfolio/PortfolioDrivers";
import { HoldingDetail } from "@/components/portfolio/HoldingDetail";
import { AddAssetDialog } from "@/components/portfolio/AddAssetDialog";
import { usePortfolio } from "@/components/portfolio/PortfolioProvider";
import { dateLabel } from "@/components/charts/chart-formatters";

export function DashboardView({
  locale,
  initialAssetId,
}: {
  locale: Locale;
  dictionary?: Dictionary;
  initialAssetId?: string;
}) {
  const { holdings, warning } = usePortfolio();
  const [timeframe, setTimeframe] = useState<Timeframe | "CUSTOM">("1M");
  const [range, setRange] = useState<[number, number]>(timeframeRange("1M"));
  const [settings, setSettings] = useState<ChartSettings>({
    mode: "performance",
    display: "value",
    benchmark: "spy",
    showBenchmark: true,
    compare: initialAssetId ?? "",
    annotations: false,
    navigator: true,
  });
  const [selected, setSelected] = useState<number | null>(null);
  const [detailId, setDetailId] = useState<string | undefined>(initialAssetId);
  const [add, setAdd] = useState<{ assetId?: string; edit?: Holding }>();
  const analysis = useMemo(
    () => buildAnalysis(holdings, range, settings.benchmark, settings.compare),
    [holdings, range, settings.benchmark, settings.compare],
  );
  const overview = useMemo(() => buildAnalysis(holdings, [0, 730]), [holdings]);
  const detail = analysis.holdings.find((p) => p.assetId === detailId);
  const period = timeframe === "CUSTOM" ? "vlastní období" : timeframe;
  const changeTimeframe = (t: Timeframe) => {
    setTimeframe(t);
    setRange(timeframeRange(t));
    setSelected(null);
  };
  const changeSettings = (s: ChartSettings) => {
    setSettings(s);
    setSelected(null);
  };
  const closeAdd = () => {
    setAdd(undefined);
    setSelected(null);
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
        showBenchmark={settings.showBenchmark}
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
          key={`${settings.mode}-${holdings.length}`}
          analysis={analysis}
          overview={overview}
          settings={settings}
          onSettings={changeSettings}
          range={range}
          onRange={(r) => {
            setRange(r);
            setTimeframe("CUSTOM");
            setSelected(null);
          }}
          timeframe={timeframe}
          onTimeframe={changeTimeframe}
          selected={selected}
          onSelect={setSelected}
          locale={locale}
        />
        <LensInsight
          analysis={analysis}
          locale={locale}
          context={{
            holdings,
            range,
            timeframe,
            mode: settings.mode,
            benchmark: settings.benchmark,
            compare: settings.compare,
            showBenchmark: settings.showBenchmark,
            selected,
          }}
        />
      </div>
      <PortfolioDrivers analysis={analysis} locale={locale} />
      <HoldingsTable
        holdings={analysis.holdings}
        locale={locale}
        onSelect={(p) => setDetailId(p.assetId)}
        onAdd={() => setAdd({})}
        period={period}
      />
      <footer className="portfolio-footer">
        <span>Lens · portfolio intelligence</span>
        <p>
          Demo ceny k 7. 9. 2026 · CZK, pevné demo měnové kurzy. Graf simuluje dnešní složení
          portfolia v minulosti; nejde o historii skutečných transakcí.
        </p>
      </footer>
      {detail && (
        <HoldingDetail
          holding={detail}
          locale={locale}
          onClose={() => setDetailId(undefined)}
          onCompare={() => {
            changeSettings({ ...settings, compare: detail.assetId, mode: "performance" });
            setDetailId(undefined);
            document
              .querySelector(".hero-analytics")
              ?.scrollIntoView({ behavior: "instant", block: "start" });
          }}
          onEdit={() => {
            setAdd({ edit: holdings.find((p) => p.assetId === detail.assetId) });
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
