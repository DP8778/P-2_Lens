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
  const [timeframe, setTimeframe] = useState<ThemeTimeframe>(initialNavigation?.period ?? "1M");
  const [weighting, setWeighting] = useState<IndustryWeighting>(initialNavigation?.weighting ?? "equal");
  const universe = useMemo(() => industry?.members.map((member) => member.asset) ?? industryCompanies(theme), [theme, industry]);
  const caps = useMemo(() => industry ? Object.fromEntries(industry.members.map((member) => [member.asset.symbol, member.marketCap])) : capitalizationSource.marketCaps, [industry]);
  const capDate = industry?.updatedAt.slice(0, 10) ?? capitalizationSource.observedOn;
  const [referenceDate] = useState(() => initialNavigation?.asOf ? new Date(`${initialNavigation.asOf}T12:00:00Z`) : new Date());
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
  useEffect(() => { onNavigationChange?.(navigation); }, [navigation, onNavigationChange]);
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
        <div><span className="theme-detail-eyebrow">{english ? "Industry · Technology" : "Odvětví · Technology"}</span><h3>{theme.name}</h3><p>{industryDescriptions[theme.id]}</p></div>

      </header>
      <IndustryOverviewStrip overview={overview} locale={locale} industry={industry} />
      <div className="industry-trend-label"><h4>Industry Pulse <small>· {industry ? "Lens Top 100" : "Lens Industry Index"}</small></h4><span>Index 100 · {english ? "Tracked universe · not an official index" : "Sledované univerzum · nejde o oficiální index"}</span></div>
        <div className="theme-period-return"><span>Výnos za {timeframe}</span><strong className={reliability.usable && performance.status === "complete" ? performance.returnPct >= 0 ? "positive" : "negative" : ""}>{reliability.usable && performance.status === "complete" ? percent(performance.returnPct, locale) : "—"}</strong><small>{weighting === "equal" ? "Equal-weight" : "Market-cap weighted"} · {performance.coverage} / {universe.length} {english ? "companies included" : "firem zahrnuto"}{performance.partial ? (english ? " · partial coverage" : " · částečné pokrytí") : ""}</small></div>
      <div className="industry-index-comparison" role="group" aria-label={english ? "Index weighting" : "Vážení indexu"}>
        {(["equal", "capitalization"] as const).map((mode) => <button key={mode} aria-pressed={weighting === mode} onClick={() => setWeighting(mode)}>
          <span>{mode === "equal" ? "Equal-weight" : english ? "Market-cap weighted" : "Váženo kapitalizací"}</span>
          <strong>{hasReliableIndustryCoverage(indices[mode].coverage, universe.length) && indices[mode].status === "complete" ? percent(indices[mode].returnPct, locale) : "—"}</strong>
          <small>{indices[mode].coverage}/{universe.length} {english ? "companies" : "firem"}</small>
        </button>)}
      </div>
      <div className="theme-timeframes" role="group" aria-label="Období historie tématu">
        {themeTimeframes.map((value) => <button key={value} aria-pressed={timeframe === value} onClick={() => setTimeframe(value)}>{value}</button>)}
      </div>
      {(loading || !reliability.usable) && <div className="industry-history-progress" role="status">
        <strong>{loading ? (english ? "Loading industry performance…" : "Načítám vývoj odvětví…") : missingCapitalization ? (english ? "Insufficient capitalization coverage for the weighted index" : "Nedostatečné pokrytí kapitalizací pro vážený index") : (english ? "Insufficient historical coverage" : "Nedostatečné pokrytí historických dat")}</strong>
        <p>{english ? `History ready for ${overview.measured} of ${universe.length} companies` : `Historie připravena pro ${overview.measured} z ${universe.length} firem`} · {timeframe}</p>
        {loading && <progress value={overview.measured} max={universe.length || 1} aria-label={english ? "Price history coverage" : "Pokrytí cenové historie"} />}
        {!reliability.usable && <p>{missingCapitalization ? (english ? "The weighted index needs more known market capitalizations. The equal-weight view is available." : "Pro vážený index chybí kapitalizace dostatečného počtu firem. Dostupný je pohled Equal-weight.") : (english ? "Lens does not yet have sufficient common history to show a reliable industry return." : "Lens zatím nemá dostatečné pokrytí společné historie. Výnos odvětví proto nezobrazuje.")}</p>}
        {!!current?.failed && <small>{english ? `${current.failed} histories could not be refreshed.` : `${current.failed} historií se nepodařilo obnovit.`}</small>}
      </div>}
      {!reliability.usable || performance.status !== "complete" ? null
          : <>
            {(stale || !!current?.failed) && <p className="market-pulse-notice" role="status">{loading && stale ? "Zobrazuji uloženou historii; probíhá obnova." : "Část historie se nepodařilo obnovit. Zobrazuji dostupná data včetně uložené historie."}</p>}
            {performance.partial && <p className="industry-coverage-warning" role="status">{english ? "Partial index" : "Neúplný index"}: {performance.coverage}/{universe.length} {english ? "companies included. This is not the return of the full Lens universe." : "firem zahrnuto. Nejde o výnos celého univerza Lens."}</p>}
            <ThemeHistoryChart points={comparable && indices.equal.status === "complete" ? indices.equal.points : performance.points} comparison={comparable && indices.capitalization.status === "complete" ? indices.capitalization.points : undefined} locale={locale} />
            {comparable && <p className="industry-chart-legend">— Equal-weight · ┄ Market-cap weighted</p>}
            <p className="theme-history-summary">{dateLabel(performance.points[0].date, locale)} – {dateLabel(performance.points.at(-1)!.date, locale)} · Index 100 → {performance.points.at(-1)!.value.toLocaleString(locale, { maximumFractionDigits: 2 })} · výnos {percent(performance.returnPct, locale)} · {performance.coverage}/{performance.total} {english ? "companies included" : "firem zahrnuto"}{performance.partial ? (english ? " · partial coverage" : " · částečné pokrytí") : ""}.</p>

          </>}
      {reliability.usable && <p className="industry-pulse-reading" role="status">{industryPulseCopy[pulse.kind][english ? 1 : 0]}</p>}
      <section className="industry-participation" aria-label={english ? "Participation and concentration" : "Účast a koncentrace"}>
        <div><span>{english ? "Companies rising" : "Podíl rostoucích firem"}</span><strong>{!participationReady || overview.risingPercent === undefined ? "—" : `${overview.risingPercent.toLocaleString(locale, { maximumFractionDigits: 1 })} %`}</strong><small>{overview.measured}/{overview.total} {english ? "companies measured" : "firem změřeno"}{participationReady ? ` · ${overview.positive} ${english ? "rising" : "roste"}` : ""}</small></div>
        <div><span>{english ? "Median period return" : "Medián výnosu období"}</span><strong>{!participationReady || overview.medianReturn === undefined ? "—" : percent(overview.medianReturn, locale)}</strong><small>{overview.measured}/{overview.total} · {timeframe}</small></div>
        <div><span>{english ? "Top 10 concentration" : "Koncentrace Top 10"}</span><strong>{industry?.economics.top10Concentration === undefined ? "—" : `${industry.economics.top10Concentration.toLocaleString(locale, { maximumFractionDigits: 1 })} %`}</strong><small>{english ? "Share of universe capitalization" : "Podíl kapitalizace univerza"}</small></div>
      </section>
      <IndustryMarketMap overview={overview} timeframe={timeframe} locale={locale} navigation={navigation} />
      {reliability.usable && performance.status === "complete" && <ThemeDrivers performance={performance} timeframe={timeframe} locale={locale} navigation={navigation} />}
      <details className="industry-disclosure"><summary>{english ? "Explore participation and return distribution" : "Prozkoumat šíři růstu a rozdělení výnosů"}</summary><IndustryVisualizations overview={overview} timeframe={timeframe} locale={locale} capDate={capDate} />{participationReady && <IndustryBreadth overview={overview} timeframe={timeframe} locale={locale} navigation={navigation} />}</details>
      <details className="industry-disclosure"><summary>{english ? "Explore all companies" : "Prozkoumat všechny firmy"} · {universe.length}</summary>
      <IndustryCompanies navigation={navigation} key={theme.id} overview={overview} timeframe={timeframe} locale={locale} capDate={capDate} capSource={industry?.members[0]?.marketCapSource} />
      </details>
      <details className="industry-disclosure"><summary>{english ? "Index methodology and coverage" : "Metodika indexu a pokrytí"}</summary>
      {industry && <p className="industry-data-note">{universe.length}/100 {english ? "eligible companies; US listings only" : "způsobilých firem; pouze US listingy"} · {english ? "Updated" : "Aktualizace"} {dateLabel(industry.updatedAt.slice(0, 10), locale)} · {english ? "Rebalance" : "Rebalance"} {dateLabel(industry.rebalancedAt.slice(0, 10), locale)} · v{industry.version.slice(0, 8)}</p>}
      <p className="industry-data-note">{english ? "Each view uses companies with sufficient history; the weighted view also requires a known market cap. Different coverage can affect the comparison." : "Každý pohled zahrnuje firmy s dostatečnou historií; vážený pohled navíc vyžaduje známou kapitalizaci. Rozdílné pokrytí může ovlivnit srovnání."} {english ? "Capitalization weights use a fixed snapshot, not historical caps" : "Kapitalizační váhy vycházejí z pevného snapshotu, nikoli historických kapitalizací"} · {capDate}.</p>
      <p className="theme-methodology">{english ? "Fixed starting weights: equal, or proportional to the market-cap snapshot" : "Pevné počáteční váhy: stejné, nebo úměrné snapshotu kapitalizací"} · {capDate}. {english ? "These are not historical market caps. Price returns without dividends, FX or rebalancing; only observed common dates. Coverage can differ by period. Excluded companies remain in the table." : "Nejde o historické kapitalizace. Cenové výnosy bez dividend, FX a rebalancování; jen společná pozorovaná data. Pokrytí se může lišit podle období. Nezahrnuté firmy zůstávají v tabulce."}</p>
      </details>
      {industry && <details className="industry-data-note"><summary>{english ? "Membership sources & exclusions" : "Zdroje členství a vyřazení kandidáti"} · {industry.candidateCount} → {universe.length}</summary><ul>{industry.sources.map((source) => <li key={source}><a href={source} target="_blank" rel="noreferrer">{source}</a></li>)}</ul><ul>{industry.excluded.map((item) => <li key={item.symbol}>{item.symbol}: {item.reason}</li>)}</ul></details>}
    </section>
  );
}
