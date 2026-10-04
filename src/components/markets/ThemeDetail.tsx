"use client";

import { hasReliableIndustryCoverage, industryPerformanceState } from "@/lib/finance/industry-coverage";
import { interpretIndustryPulse, industryPulseCopy, comparableIndustryIndices } from "@/lib/finance/industry-pulse";
import type { IndustryNavigation } from "@/lib/markets/industry-navigation";
import { useEffect, useMemo, useState } from "react";
import type { IndustryView } from "@/lib/finance/industry-data";
import { IndustryMarketMap } from "./IndustryMarketMap";
import type { MarketTheme } from "@/data/market-themes";
import { themeHistoryRange, themeTimeframes, type ThemeTimeframe } from "@/lib/finance/theme-performance";
import { loadIndustryHistories, type IndustryHistoryProgress } from "@/lib/market-data/industry-history";
import { percent, dateLabel } from "@/components/charts/chart-formatters";
import { industryCompanies, industryDescriptions } from "@/data/market-industries";
import { buildIndustryIndex, type IndustryWeighting } from "@/lib/finance/industry-index";
import { capitalizationSource, buildIndustryOverview } from "@/lib/finance/industry-overview";
import { IndustryOverviewStrip, IndustryBreadth, IndustryCompanies } from "./IndustryCompanies";
import { ThemeDrivers, IndustryVisualizations } from "./IndustryVisualizations";
import { ThemeHistoryChart } from "./ThemeHistoryChart";

type Result = IndustryHistoryProgress & { key: string };

export function ThemeDetail({ theme, locale, industry, initialNavigation, onNavigationChange }: { theme: MarketTheme; locale: string; industry?: IndustryView; initialNavigation?: IndustryNavigation; onNavigationChange?: (navigation: IndustryNavigation) => void }) {
  const english = locale === "en-US";
  const [localTimeframe, setLocalTimeframe] = useState<ThemeTimeframe>(initialNavigation?.period ?? "1M");
  const [localWeighting, setLocalWeighting] = useState<IndustryWeighting>(initialNavigation?.weighting ?? "equal");
  const timeframe = onNavigationChange && initialNavigation ? initialNavigation.period : localTimeframe;
  const weighting = onNavigationChange && initialNavigation ? initialNavigation.weighting : localWeighting;
  const universe = useMemo(() => industry?.members.map((member) => member.asset) ?? industryCompanies(theme), [theme, industry]);
  const caps = useMemo(() => industry ? Object.fromEntries(industry.members.map((member) => [member.asset.symbol, member.marketCap])) : capitalizationSource.marketCaps, [industry]);
  const capDate = industry?.updatedAt.slice(0, 10) ?? capitalizationSource.observedOn;
  const [defaultReferenceDate] = useState(() => new Date());
  const asOf = initialNavigation?.asOf;
  const referenceDate = useMemo(() => asOf ? new Date(`${asOf}T12:00:00Z`) : defaultReferenceDate, [asOf, defaultReferenceDate]);
  const historyRange = useMemo(() => themeHistoryRange("1Y", referenceDate), [referenceDate]);
  const range = useMemo(() => themeHistoryRange(timeframe, referenceDate), [timeframe, referenceDate]);
  const key = `${theme.id}:${industry?.version ?? "legacy"}:${historyRange.from}:${historyRange.to}`;
  const [result, setResult] = useState<Result>();
  const current = result?.key === key ? result : undefined;
  const indices = useMemo(() => ({
    equal: buildIndustryIndex(universe, current?.histories ?? new Map(), range, "equal"),
    capitalization: buildIndustryIndex(universe, current?.histories ?? new Map(), range, "capitalization", caps),
  }), [universe, current?.histories, range, caps]);
  const performance = indices[weighting];
  const loading = !current?.done;
  const stale = !!current?.stale.size;
  const reliability = industryPerformanceState(performance, loading, stale);
  const overview = useMemo(() => {
    const data = buildIndustryOverview(universe, universe, current?.histories ?? new Map(), range, caps);
    const contributions = new Map(reliability.usable && performance.status === "complete" ? performance.contributors.map((item) => [item.asset.id, item.contributionPctPoints]) : []);
    return { ...data, rows: data.rows.map((row) => ({ ...row, inBasket: contributions.has(row.asset.id), contributionPctPoints: contributions.get(row.asset.id) })) };
  }, [universe, current?.histories, range, performance, caps, reliability.usable]);

  const navigation = useMemo<IndustryNavigation>(() => ({ industry: theme.id, period: timeframe, weighting, asOf: referenceDate.toISOString().slice(0, 10), version: industry?.version }), [theme.id, timeframe, weighting, referenceDate, industry?.version]);
  const setTimeframe = (period: ThemeTimeframe) => {
    if (onNavigationChange) onNavigationChange({ ...navigation, period });
    else setLocalTimeframe(period);
  };
  const setWeighting = (next: IndustryWeighting) => {
    if (onNavigationChange) onNavigationChange({ ...navigation, weighting: next });
    else setLocalWeighting(next);
  };
  const versionChanged = !!(initialNavigation?.version && industry && initialNavigation.version !== industry.version);
  const comparable = comparableIndustryIndices(indices.equal, indices.capitalization) && hasReliableIndustryCoverage(indices.equal.coverage, universe.length) && hasReliableIndustryCoverage(indices.capitalization.coverage, universe.length);
  const participationReady = hasReliableIndustryCoverage(overview.measured, overview.total);
  const missingCapitalization = weighting === "capitalization" && hasReliableIndustryCoverage(indices.equal.coverage, universe.length) && !reliability.usable;
  const pulse = interpretIndustryPulse(indices.equal, indices.capitalization, overview, industry?.economics.top10Concentration, stale);

  useEffect(() => {
    const controller = new AbortController();
    void loadIndustryHistories({ assets: universe, range: historyRange, signal: controller.signal,
      onProgress: (progress) => { if (!controller.signal.aborted) setResult({ key, ...progress }); },
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ key, total: universe.length, ready: 0, loading: 0, failed: universe.length, done: true, histories: new Map(), stale: new Set() });
    });
    return () => controller.abort();
  }, [key, historyRange, universe]);

  return (
    <section className="theme-detail" aria-label={`Historie tématu ${theme.name}`} data-performance-state={reliability.state}>
      <header className="theme-detail-header">
        <div><span className="theme-detail-eyebrow">{english ? "Theme · Lens universe" : "Téma · Univerzum Lens"}</span><h3>{theme.name}</h3><p>{industryDescriptions[theme.id]}</p></div>

      </header>
      {versionChanged && <p className="industry-coverage-warning" role="status">{english ? "The linked membership version is no longer current. This view uses the current Lens universe; historical membership is not reconstructed." : "Verze členství v odkazu už není aktuální. Zobrazený vývoj používá nynější univerzum Lens; historické členství se nerekonstruuje."}</p>}
      <IndustryOverviewStrip overview={overview} locale={locale} industry={industry} />
      <section className="industry-pulse" aria-label="Lens Pulse" data-view={reliability.usable ? "ready" : loading ? "loading" : "insufficient"}>
        <div className="industry-trend-label"><h4>Lens Pulse <small>· {reliability.usable ? `${english ? "Lens universe" : "Univerzum Lens"} · ${universe.length} ${english ? "companies" : "firem"}` : timeframe}</small></h4>{reliability.usable && <span>Index 100 · {english ? "Price return · not an official index" : "Cenový výnos · nejde o oficiální index"}</span>}</div>
        <div className="theme-timeframes" role="group" aria-label="Období historie tématu">
          {themeTimeframes.map((value) => <button key={value} aria-pressed={timeframe === value} onClick={() => setTimeframe(value)}>{value}</button>)}
        </div>
        <div className="industry-pulse-content">
          {reliability.usable && performance.status === "complete" ? <div className="industry-pulse-ready">
            <div className="theme-period-return"><span>{english ? "Return over" : "Výnos za"} {timeframe}</span><strong className={performance.returnPct >= 0 ? "positive" : "negative"}>{percent(performance.returnPct, locale)}</strong><small>{english ? "Selected weighting" : "Zvolené vážení"}: {weighting === "equal" ? "Equal-weight" : english ? "Market-cap weighted" : "Váženo kapitalizací"} · {performance.coverage} / {universe.length} {english ? "companies included" : "firem zahrnuto"}{performance.partial ? (english ? " · partial coverage" : " · částečné pokrytí") : ""}</small></div>
            <div className="industry-index-comparison" role="group" aria-label={english ? "Index weighting" : "Vážení indexu"}>
              {(["equal", "capitalization"] as const).map((mode) => <button key={mode} aria-pressed={weighting === mode} onClick={() => setWeighting(mode)}>
                <span>{mode === "equal" ? "Equal-weight" : english ? "Market-cap weighted" : "Váženo kapitalizací"}</span>
                <strong>{hasReliableIndustryCoverage(indices[mode].coverage, universe.length) && indices[mode].status === "complete" ? percent(indices[mode].returnPct, locale) : "—"}</strong>
                <small>{mode === "equal" ? (english ? "Same starting weight for every company" : "Stejná počáteční váha každé firmy") : (english ? "Starting weight proportional to snapshot market cap" : "Počáteční váha podle snapshotu kapitalizace")}</small>
                <small>{indices[mode].coverage}/{universe.length} {english ? "companies" : "firem"}{weighting === mode ? (english ? " · Headline return and contributors" : " · Hlavní výnos a příspěvky") : ""}</small>
              </button>)}
            </div>
            {(stale || !!current?.failed) && <p className="market-pulse-notice" role="status">{loading && stale ? "Zobrazuji uloženou historii; probíhá obnova." : "Část historie se nepodařilo obnovit. Zobrazuji dostupná data včetně uložené historie."}</p>}
            {performance.partial && <p className="industry-coverage-warning" role="status">{english ? "Partial index" : "Neúplný index"}: {performance.coverage}/{universe.length} {english ? "companies included. This is not the return of the full Lens universe." : "firem zahrnuto. Nejde o výnos celého univerza Lens."}</p>}
            <ThemeHistoryChart points={comparable && indices.equal.status === "complete" ? indices.equal.points : performance.points} comparison={comparable && indices.capitalization.status === "complete" ? indices.capitalization.points : undefined} weighting={weighting} locale={locale} />
            <p className="industry-chart-legend">{comparable ? (english ? "Solid: Equal-weight · Dashed: Market-cap weighted. Both lines compare the same companies and dates; the thicker line is selected." : "Plná čára: Equal-weight · přerušovaná: váženo kapitalizací. Obě čáry srovnávají stejné firmy a data; silnější čára je zvolený pohled.") : (english ? "Only the selected weighting is shown; a like-for-like comparison is unavailable." : "Zobrazeno pouze zvolené vážení; srovnání stejných firem a dat není dostupné.")}</p>
            <p className="theme-history-summary">{dateLabel(performance.points[0].date, locale)} – {dateLabel(performance.points.at(-1)!.date, locale)} · Index 100 → {performance.points.at(-1)!.value.toLocaleString(locale, { maximumFractionDigits: 2 })} · výnos {percent(performance.returnPct, locale)} · {performance.coverage}/{performance.total} {english ? "companies included" : "firem zahrnuto"}{performance.partial ? (english ? " · partial coverage" : " · částečné pokrytí") : ""}.</p>
            <p className="industry-pulse-reading" role="status">{industryPulseCopy[pulse.kind][english ? 1 : 0]}</p>
          </div> : <div className="industry-history-progress" role="status">
            <strong>{loading ? (english ? "Preparing theme performance" : "Načítáme vývoj tématu") : missingCapitalization ? (english ? "Insufficient capitalization coverage for the weighted index" : "Nedostatečné pokrytí kapitalizací pro vážený index") : (english ? "Insufficient historical coverage" : "Nedostatečné pokrytí historických dat")}</strong>
            {loading ? <>
              <p className="industry-progress-count"><span>{english ? `${overview.measured} of ${universe.length} companies ready` : `${overview.measured} z ${universe.length} společností připraveno`}</span>{" "}<span>· {universe.length ? Math.round(overview.measured / universe.length * 100) : 0} %</span></p>
              <progress role="progressbar" value={overview.measured} max={universe.length || 1} aria-valuemin={0} aria-valuemax={universe.length || 1} aria-valuenow={overview.measured} aria-label={english ? "Theme price history preparation" : "Příprava cenové historie tématu"} />
              <p>{english ? "The theme return will appear once sufficient coverage is available." : "Výnos tématu zobrazíme po dosažení dostatečného pokrytí."}</p>
            </> : <>
              <p>{english ? `History is available for ${overview.measured} of ${universe.length} companies.` : `Historie je dostupná pro ${overview.measured} z ${universe.length} společností.`}</p>
              <p>{missingCapitalization ? (english ? "The weighted index needs more known market capitalizations." : "Pro vážený index chybí kapitalizace dostatečného počtu firem.") : (english ? "Lens is not yet showing the theme return." : "Lens zatím výnos celého univerza nezobrazuje.")}</p>
            </>}
            {missingCapitalization && <button className="industry-pulse-recovery" onClick={() => setWeighting("equal")}>{english ? "Show Equal-weight" : "Zobrazit Equal-weight"}</button>}
          </div>}
        </div>
      </section>
      <section className="industry-participation" aria-label={english ? "Participation and concentration" : "Účast a koncentrace"}>
        {reliability.usable && participationReady && <>
        <div><span>{english ? "Companies rising" : "Podíl rostoucích firem"}</span><strong>{!participationReady || overview.risingPercent === undefined ? "—" : `${overview.risingPercent.toLocaleString(locale, { maximumFractionDigits: 1 })} %`}</strong><small>{overview.measured}/{overview.total} {english ? "companies measured" : "firem změřeno"}{participationReady ? ` · ${overview.positive} ${english ? "rising" : "roste"}` : ""}</small></div>
        <div><span>{english ? "Median period return" : "Medián výnosu období"}</span><strong>{!participationReady || overview.medianReturn === undefined ? "—" : percent(overview.medianReturn, locale)}</strong><small>{overview.measured}/{overview.total} · {timeframe}</small></div>
        </>}
        <div><span>{english ? "Top 10 concentration" : "Koncentrace Top 10"}</span><strong>{industry?.economics.top10Concentration === undefined ? "—" : `${industry.economics.top10Concentration.toLocaleString(locale, { maximumFractionDigits: 1 })} %`}</strong><small>{english ? "Share of universe capitalization" : "Podíl kapitalizace univerza"}</small></div>
      </section>
      <IndustryMarketMap overview={overview} timeframe={timeframe} locale={locale} navigation={navigation} />
      {reliability.usable && performance.status === "complete" && <ThemeDrivers performance={performance} timeframe={timeframe} locale={locale} navigation={navigation} />}
      <details className="industry-disclosure"><summary>{english ? "Explore participation and return distribution" : "Prozkoumat šíři růstu a rozdělení výnosů"}</summary><IndustryVisualizations overview={overview} timeframe={timeframe} locale={locale} capDate={capDate} />{participationReady && <IndustryBreadth overview={overview} timeframe={timeframe} locale={locale} navigation={navigation} />}</details>
      <details className="industry-disclosure"><summary>{english ? "Explore all companies" : "Prozkoumat všechny firmy"} · {universe.length}</summary>
      <IndustryCompanies navigation={navigation} key={theme.id} overview={overview} timeframe={timeframe} locale={locale} capDate={capDate} capSource={industry?.members[0]?.marketCapSource} />
      </details>
      <details className="industry-disclosure"><summary>{english ? "Index methodology and coverage" : "Metodika indexu a pokrytí"}</summary>
      <p className="industry-data-note">{english ? "Lens themes are source-defined selections and can overlap. Historical charts use current membership and fixed starting weights, not a point-in-time rebalanced index." : "Témata Lens jsou výběry vymezené zdroji a mohou se překrývat. Historický graf používá současné členství a pevné počáteční váhy, nikoli historicky rebalancovaný index."}</p>
      {industry && <p className="industry-data-note">{universe.length} {english ? "companies in the Lens universe; up to 100 eligible US-listed companies per theme" : "firem v univerzu Lens; až 100 způsobilých firem s US listingem na téma"} · {english ? "Updated" : "Aktualizace"} {dateLabel(industry.updatedAt.slice(0, 10), locale)} · {english ? "Membership updated" : "Změna členství"} {dateLabel(industry.rebalancedAt.slice(0, 10), locale)} · v{industry.version.slice(0, 8)}</p>}
      <p className="industry-data-note">{english ? "Each view uses companies with sufficient history; the weighted view also requires a known market cap. Different coverage can affect the comparison." : "Každý pohled zahrnuje firmy s dostatečnou historií; vážený pohled navíc vyžaduje známou kapitalizaci. Rozdílné pokrytí může ovlivnit srovnání."} {english ? "Capitalization weights use a fixed snapshot, not historical caps" : "Kapitalizační váhy vycházejí z pevného snapshotu, nikoli historických kapitalizací"} · {capDate}.</p>
      <p className="theme-methodology">{english ? "Fixed starting weights: equal, or proportional to the market-cap snapshot" : "Pevné počáteční váhy: stejné, nebo úměrné snapshotu kapitalizací"} · {capDate}. {english ? "These are not historical market caps. Price returns without dividends, FX or rebalancing; only observed common dates. Coverage can differ by period. Excluded companies remain in the table." : "Nejde o historické kapitalizace. Cenové výnosy bez dividend, FX a rebalancování; jen společná pozorovaná data. Pokrytí se může lišit podle období. Nezahrnuté firmy zůstávají v tabulce."}</p>
      </details>
      {industry && <details className="industry-data-note"><summary>{english ? "Membership sources & exclusions" : "Zdroje členství a vyřazení kandidáti"} · {industry.candidateCount} → {universe.length}</summary><ul>{industry.sources.map((source) => <li key={source}><a href={source} target="_blank" rel="noreferrer">{source}</a></li>)}</ul><ul>{industry.excluded.map((item) => <li key={item.symbol}>{item.symbol}: {item.reason}</li>)}</ul></details>}
    </section>
  );
}
