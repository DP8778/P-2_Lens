"use client";

import { industryAssetHref, type IndustryNavigation } from "@/lib/markets/industry-navigation";
import { hasReliableIndustryCoverage } from "@/lib/finance/industry-coverage";
import Link from "next/link";
import { percent, points } from "@/components/charts/chart-formatters";
import { buildIndustryDistributions, capitalizationSource, type IndustryOverview } from "@/lib/finance/industry-overview";
import type { IndustryIndex } from "@/lib/finance/industry-index";

type CompletePerformance = Extract<IndustryIndex, { status: "complete" }>;

export function ThemeDrivers({ performance, timeframe, locale, navigation }: { performance: CompletePerformance; timeframe: string; locale: string; navigation?: IndustryNavigation }) {
  const en = locale === "en-US";
  return <section className="theme-drivers" aria-label={en ? "What drives this theme?" : "Co táhne téma?"}>
    <header><div><h4>{en ? "What drives this theme?" : "Co táhne téma?"}</h4><p>Lens Pulse · {performance.coverage}/{performance.total} {en ? "companies" : "firem"} · {performance.weighting === "equal" ? (en ? "Equal-weight" : "Stejné váhy") : (en ? "Market-cap weighted" : "Podle kapitalizace")} · {timeframe}</p></div><span>{percent(performance.returnPct, locale)}</span></header>
    <div className="theme-driver-groups">
      {[{ title: en ? "Top 3 contributors" : "Nejlepší přispěvatelé · top 3", items: performance.contributors.filter((item) => item.contributionPctPoints > 0).slice(0, 3) }, { title: en ? "Bottom 3 contributors" : "Nejhorší přispěvatelé · bottom 3", items: performance.contributors.filter((item) => item.contributionPctPoints < 0).slice(-3).reverse() }].map((group) => <div className="theme-driver-group" key={group.title}><h5>{group.title}</h5><div className="theme-driver-columns" aria-hidden="true"><span>{en ? "Company" : "Firma"}</span><span>{en ? "Return" : "Výnos"}</span><span>{en ? "Contribution" : "Příspěvek"}</span></div>{!group.items.length && <p>{en ? "No contributors in this direction." : "V tomto směru žádný přispěvatel."}</p>}{group.items.map((item) => <Link className="theme-driver-row" key={item.asset.id} href={industryAssetHref(locale, item.asset.id, navigation)}><span><strong>{item.asset.symbol}</strong><small>{item.asset.name}</small></span><span>{percent(item.returnPct, locale)}</span><b>{en ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2, signDisplay: "exceptZero" }).format(item.contributionPctPoints)} pp` : points(item.contributionPctPoints, locale)}</b></Link>)}</div>)}
    </div>
    <p className="theme-driver-note">{en ? "Contribution in percentage points = stock return × starting weight. All constituents sum to the index return before rounding." : "Příspěvek v procentních bodech = výnos akcie × počáteční váha. Součet všech titulů odpovídá výnosu indexu před zaokrouhlením."}</p>
  </section>;
}

export function IndustryVisualizations({ overview, timeframe, locale, capDate = capitalizationSource.observedOn }: { overview: IndustryOverview; timeframe: string; locale: string; capDate?: string }) {
  const en = locale === "en-US";
  const data = buildIndustryDistributions(overview);
  const reliable = hasReliableIndustryCoverage(overview.measured, overview.total);
  const number = (value: number) => value.toLocaleString(locale, { maximumFractionDigits: 1 });
  const breadthNames = en ? ["Rising", "Falling", "Unchanged"] : ["Roste", "Klesá", "Beze změny"];
  const breadthSummary = data.breadth.map((item, index) => `${breadthNames[index]}: ${item.count}`).join("; ");
  const sizeName = (size: string) => size === "Unknown" ? en ? "Unknown" : "Neznámá" : size;
  const sizeSummary = data.sizes.map((item) => `${sizeName(item.size)}: ${item.count} (${number(item.percent)} %)` ).join("; ");
  const histogramSummary = data.histogram.map((item) => `${item.label}: ${item.count}`).join("; ");
  const maximum = Math.max(1, ...data.histogram.map((item) => item.count));
  return <section className="industry-visualizations" aria-label={en ? "Universe structure" : "Struktura univerza"}>
    <header><h4>{en ? "Universe structure" : "Struktura univerza"}</h4><span>{timeframe} · {overview.measured}/{overview.total} {en ? "companies with period history" : "firem s historií období"}</span></header>
    <div className="industry-mini-charts">
      <figure><figcaption>{en ? "Breadth" : "Šíře růstu"}</figcaption>{reliable ? <><div className="industry-breadth-bars" role="img" aria-label={breadthSummary}>{data.breadth.map((item, index) => <div key={item.key}><span>{breadthNames[index]}</span><div><i style={{ width: `${item.percent}%` }} /></div><b>{item.count}</b></div>)}</div><p className="industry-data-note">{breadthSummary}. {en ? "Missing history" : "Bez historie"}: {overview.total - overview.measured}.</p></> : <p>{en ? "Insufficient price history coverage." : "Nedostatečné pokrytí cenové historie."} {overview.measured}/{overview.total}</p>}</figure>
      <figure><figcaption>{en ? "Company sizes · count" : "Velikost firem · počty"}</figcaption><div className="industry-size-chart"><svg viewBox="0 0 120 120" role="img" aria-label={sizeSummary}><circle cx="60" cy="60" r="44" fill="none" stroke="#292c2e" strokeWidth="16" />{data.sizes.map((item, index) => {
        const start = data.sizes.slice(0, index).reduce((sum, segment) => sum + segment.percent, 0);
        return <circle key={item.size} cx="60" cy="60" r="44" pathLength="100" fill="none" stroke={["#d9dddf", "#969da1", "#60696e", "#34393d"][index]} strokeWidth="16" strokeDasharray={`${item.percent} ${100 - item.percent}`} strokeDashoffset={-start} transform="rotate(-90 60 60)" />;
      })}<text x="60" y="64" textAnchor="middle" fill="currentColor" fontSize="18">{overview.total}</text></svg><ul>{data.sizes.map((item) => <li key={item.size}><span>{sizeName(item.size)}</span><b>{item.count} · {number(item.percent)} %</b></li>)}</ul></div><p className="industry-data-note">{en ? "Share of company count, not market value. Market-cap snapshot" : "Podíl počtu firem, nikoli jejich tržní hodnoty. Snapshot kapitalizací"} · {capDate}.</p></figure>
      <figure><figcaption>{en ? "Return distribution" : "Rozdělení výnosů"} · {timeframe}</figcaption>{reliable ? <><div className="industry-histogram" role="img" aria-label={histogramSummary}>{data.histogram.map((item) => <div key={item.label}><b>{item.count}</b><i style={{ height: `${item.count / maximum * 72}px` }} /><span>{en ? item.label.replace("až", "to") : item.label}</span></div>)}</div><p className="sr-only">{histogramSummary}</p></> : <p className="industry-no-distribution">{en ? "Insufficient price history coverage." : "Nedostatečné pokrytí cenové historie."}</p>}<p className="industry-data-note">{en ? "Available company returns only; missing values are excluded." : "Jen dostupné výnosy firem; chybějící hodnoty se nezapočítávají."}</p></figure>
    </div>
  </section>;
}
