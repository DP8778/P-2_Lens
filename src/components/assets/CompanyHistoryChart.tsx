"use client";

import { useState, type ReactNode } from "react";
import { CompanySeriesPlot } from "@/components/charts/CompanySeriesPlot";
import { buildCompanyHistory, companyHistoryIndex, companyHistoryMetrics, type CompanyHistoryMetric } from "@/lib/finance/company-history";
import type { FinancialStatement } from "@/lib/finance/financial-anatomy";
import type { MarketPricePoint } from "@/lib/market-data/types";

const metricLabels: Record<CompanyHistoryMetric, [string, string]> = {
  revenue: ["Tržby", "Revenue"], operatingIncome: ["Provozní zisk", "Operating income"], netIncome: ["Čistý zisk", "Net income"],
};
const colors = { revenue: "var(--chart-revenue)", operatingIncome: "var(--chart-operating)", netIncome: "var(--chart-net)" };

export function CompanyHistoryChart({ assetId, symbol, currency, locale, statements, priceData, priceLoading, priceError, priceControls, priceProvenance }: {
  assetId: string; symbol: string; currency: string; locale: string; statements?: FinancialStatement[];
  priceData: MarketPricePoint[]; priceLoading: boolean; priceError: boolean; priceControls: ReactNode; priceProvenance?: ReactNode;
}) {
  const en = locale === "en-US";
  const history = buildCompanyHistory(assetId, statements);
  const financialAvailable = !!history?.periods.length;
  const [requestedView, setRequestedView] = useState<"financial" | "price" | null>(null);
  const view = requestedView ?? (priceData.length > 1 || !financialAvailable ? "price" : "financial");
  const [metrics, setMetrics] = useState<CompanyHistoryMetric[]>([...companyHistoryMetrics]);
  const [indexed, setIndexed] = useState(false);
  const indexData = history ? companyHistoryIndex(history.periods, metrics) : undefined;
  const useIndex = indexed && !!indexData;
  const formatAmount = (value: number, unit = currency) => new Intl.NumberFormat(locale, { style: "currency", currency: unit, notation: "compact", maximumFractionDigits: 2 }).format(value);
  const financialContent = history && <>
    <div className="company-chart-metrics">{companyHistoryMetrics.map(metric => <div key={metric}><span>{metricLabels[metric][en ? 1 : 0]} · FY{history.latest.period.slice(0, 4)}</span><strong>{formatAmount(history.latest[metric], history.currency)}</strong></div>)}</div>
    <div className="company-chart-options"><div className="company-chart-series-controls" role="group" aria-label={en ? "Financial series" : "Finanční řady"}>
      {companyHistoryMetrics.map(metric => <button key={metric} aria-pressed={metrics.includes(metric)} onClick={() => setMetrics(current => current.includes(metric) ? current.length > 1 ? current.filter(item => item !== metric) : current : [...current, metric])}><i style={{ background: colors[metric] }} aria-hidden="true" />{metricLabels[metric][en ? 1 : 0]}</button>)}
    </div><div className="company-chart-scale" role="group" aria-label={en ? "Chart scale" : "Měřítko grafu"}>
      <button aria-pressed={!useIndex} onClick={() => setIndexed(false)}>{history.currency}</button><button aria-pressed={useIndex} disabled={!indexData} title={!indexData ? (en ? "Index 100 requires positive starting values." : "Index 100 vyžaduje kladné výchozí hodnoty.") : undefined} onClick={() => setIndexed(true)}>Index 100</button>
    </div></div>
    <CompanySeriesPlot annual dates={history.periods.map(period => period.period)} series={metrics.map((metric, index) => ({ label: metricLabels[metric][en ? 1 : 0], color: colors[metric], values: useIndex ? indexData!.map(point => point.values[index]) : history.periods.map(period => period[metric]) }))} locale={locale} label={`${symbol} · ${en ? "annual financial performance" : "roční hospodaření"}`} formatValue={value => useIndex ? new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value) : formatAmount(value, history.currency)} />
    <p className="company-chart-provenance">{en ? "Annual income statements · each point represents a full fiscal year. Lines connect reported periods." : "Roční výsledovky · každý bod představuje celý fiskální rok. Čáry spojují vykázaná období."} {useIndex && (en ? "Index 100 compares growth from the first year of the full series." : "Index 100 porovnává růst vůči prvnímu roku celé řady.")}</p>
    <details className="company-chart-sources"><summary>{en ? "Statement sources" : "Zdroje výkazů"}</summary><ul>{history.periods.map(period => <li key={period.period}><a href={period.source} target="_blank" rel="noreferrer">FY{period.period.slice(0, 4)} · {en ? "primary statement" : "výkaz"} ↗</a></li>)}</ul></details>
  </>;
  return <section className="company-history-chart surface" aria-labelledby="company-history-title">
    <header className="company-chart-heading"><div><span>{en ? "Company in time" : "Firma v čase"}</span><h2 id="company-history-title">{en ? `How is ${symbol} developing?` : `Jak se vyvíjí ${symbol}?`}</h2></div>
      <div className="company-chart-tabs" role="group" aria-label={en ? "Chart content" : "Obsah grafu"}>
        {financialAvailable && <button aria-pressed={view === "financial"} onClick={() => setRequestedView("financial")}>{en ? "Business performance" : "Hospodaření"}</button>}
        <button aria-pressed={view === "price"} onClick={() => setRequestedView("price")}>{en ? "Share price" : "Cena akcie"}</button>
      </div>
    </header>
    {view === "financial" ? financialContent : <>
      <div className="company-price-controls"><h3>{en ? "Price development" : "Vývoj ceny"}</h3>{priceControls}</div>
      {priceLoading ? <p className="company-price-state" role="status">{en ? "Loading price history…" : "Načítám historická data…"}</p> : priceError || !priceData.length ? <div className="company-price-state" role="status"><p className="asset-history-unavailable">{en ? "Price history is currently unavailable." : "Historická data momentálně nejsou dostupná."}</p>{financialAvailable && <button className="primary-button" onClick={() => setRequestedView("financial")}>{en ? "Explore verified statements" : "Prohlédnout ověřené výkazy"}</button>}</div> : <div data-testid="asset-price-chart"><CompanySeriesPlot key={`price:${priceData[0]?.date}:${priceData.at(-1)?.date}`} dates={priceData.map(point => point.date)} series={[{ label: symbol, color: "var(--chart-revenue)", values: priceData.map(point => point.close) }]} locale={locale} label={`${symbol} · ${en ? "share price" : "cena akcie"}`} formatValue={value => formatAmount(value)} /></div>}
      {priceProvenance}
    </>}
    {view === "financial" && priceError && <p className="company-price-notice" role="status"><span>{en ? "Price history is currently unavailable." : "Historická data momentálně nejsou dostupná."}</span> {en ? "The chart shows sourced company statements." : "Graf zobrazuje hospodaření z ověřených výkazů."}</p>}
  </section>;
}
