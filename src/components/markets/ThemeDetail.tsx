"use client";

import { useEffect, useMemo, useState } from "react";
import type { MarketTheme } from "@/data/market-themes";
import { themeHistoryRange, themeTimeframes, type ThemeTimeframe } from "@/lib/finance/theme-performance";
import type { MarketPricePoint } from "@/lib/market-data/types";
import { loadHistory } from "@/lib/market-data/service";
import { getBrowserMarketDataCache } from "@/lib/market-data/cache/market-cache";
import { percent, dateLabel } from "@/components/charts/chart-formatters";
import { industryCompanies, industryDescriptions } from "@/data/market-industries";
import { buildIndustryIndex, type IndustryWeighting } from "@/lib/finance/industry-index";
import { capitalizationSource, buildIndustryOverview } from "@/lib/finance/industry-overview";
import { IndustryOverviewStrip, IndustryBreadth, IndustryCompanies } from "./IndustryCompanies";
import { ThemeDrivers, IndustryVisualizations } from "./IndustryVisualizations";
import { ThemeHistoryChart } from "./ThemeHistoryChart";

type Result = { key: string; histories: Map<string, MarketPricePoint[]>; failed: boolean; stale: boolean };

export function ThemeDetail({ theme, locale }: { theme: MarketTheme; locale: string }) {
  const english = locale === "en-US";
  const [timeframe, setTimeframe] = useState<ThemeTimeframe>("1M");
  const [weighting, setWeighting] = useState<IndustryWeighting>("equal");
  const universe = useMemo(() => industryCompanies(theme), [theme]);
  const [referenceDate] = useState(() => new Date());
  const historyRange = useMemo(() => themeHistoryRange("1Y", referenceDate), [referenceDate]);
  const range = useMemo(() => themeHistoryRange(timeframe, referenceDate), [timeframe, referenceDate]);
  const key = `${theme.id}:${historyRange.from}:${historyRange.to}`;
  const [result, setResult] = useState<Result>();
  const current = result?.key === key ? result : undefined;
  const indices = useMemo(() => ({
    equal: buildIndustryIndex(universe, current?.histories ?? new Map(), range, "equal"),
    capitalization: buildIndustryIndex(universe, current?.histories ?? new Map(), range, "capitalization", capitalizationSource.marketCaps),
  }), [universe, current, range]);
  const performance = indices[weighting];
  const overview = useMemo(() => {
    const data = buildIndustryOverview(universe, universe, current?.histories ?? new Map(), range);
    const contributions = new Map(performance.status === "complete" ? performance.contributors.map((item) => [item.asset.id, item.contributionPctPoints]) : []);
    return { ...data, rows: data.rows.map((row) => ({ ...row, inBasket: contributions.has(row.asset.id), contributionPctPoints: contributions.get(row.asset.id) })) };
  }, [universe, current, range, performance]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      const cache = getBrowserMarketDataCache();
      const results = await Promise.allSettled(universe.map(async (asset) => {
        try {
          const history = await loadHistory(asset, historyRange, cache);
          return { asset, points: history.points, stale: false };
        } catch (error) {
          const cached = await cache.getHistory(asset.id);
          if (!cached || cached.from > historyRange.from || cached.to < historyRange.to) throw error;
          return { asset, points: cached.points, stale: true };
        }
      }));
      if (cancelled) return;
      const available = results.flatMap((item) => item.status === "fulfilled" ? [item.value] : []);
      setResult({ key, histories: new Map(available.map((item) => [item.asset.id, item.points])), failed: results.some((item) => item.status === "rejected"), stale: available.some((item) => item.stale) });
    });
    return () => { cancelled = true; };
  }, [key, historyRange, universe]);

  return (
    <section className="theme-detail" aria-label={`Historie tématu ${theme.name}`} aria-busy={!current}>
      <header className="theme-detail-header">
        <div><span className="theme-detail-eyebrow">{english ? "Industry · Technology" : "Odvětví · Technology"}</span><h3>{theme.name}</h3><p>{industryDescriptions[theme.id]}</p></div>
        <div className="theme-period-return"><span>Výnos za {timeframe}</span><strong className={performance?.status === "complete" ? performance.returnPct >= 0 ? "positive" : "negative" : ""}>{!current ? "…" : performance?.status === "complete" ? percent(performance.returnPct, locale) : "—"}</strong><small>{weighting === "equal" ? "Equal-weight" : "Market-cap weighted"} · {performance.coverage} / {universe.length} {english ? "companies included" : "firem zahrnuto"}{performance.partial ? (english ? " · partial coverage" : " · částečné pokrytí") : ""}</small></div>
      </header>
      <IndustryOverviewStrip overview={overview} locale={locale} />
      <div className="industry-trend-label"><h4>Lens Industry Index</h4><span>Index 100 · {english ? "Tracked universe · not an official index" : "Sledované univerzum · nejde o oficiální index"}</span></div>
      <div className="industry-index-comparison" role="group" aria-label={english ? "Index weighting" : "Vážení indexu"}>
        {(["equal", "capitalization"] as const).map((mode) => <button key={mode} aria-pressed={weighting === mode} onClick={() => setWeighting(mode)}>
          <span>{mode === "equal" ? "Equal-weight" : english ? "Market-cap weighted" : "Váženo kapitalizací"}</span>
          <strong>{!current ? "…" : indices[mode].status === "complete" ? percent(indices[mode].returnPct, locale) : "—"}</strong>
          <small>{indices[mode].coverage}/{universe.length} {english ? "companies" : "firem"}</small>
        </button>)}
      </div>
      <p className="industry-data-note">{english ? "Each view uses companies with sufficient history; the weighted view also requires a known market cap. Different coverage can affect the comparison." : "Každý pohled zahrnuje firmy s dostatečnou historií; vážený pohled navíc vyžaduje známou kapitalizaci. Rozdílné pokrytí může ovlivnit srovnání."} {english ? "Capitalization weights use a fixed snapshot, not historical caps" : "Kapitalizační váhy vycházejí z pevného snapshotu, nikoli historických kapitalizací"} · {capitalizationSource.observedOn}.</p>
      <div className="theme-timeframes" role="group" aria-label="Období historie tématu">
        {themeTimeframes.map((value) => <button key={value} aria-pressed={timeframe === value} onClick={() => setTimeframe(value)}>{value}</button>)}
      </div>
      {!current ? <div className="theme-history-placeholder" role="status">Načítám historii tématu…</div>
        : performance?.status !== "complete" ? <div className="theme-history-placeholder" role="status"><p className="market-pulse-notice">{english ? "Index unavailable: insufficient common history or market-cap data for this period." : "Index není dostupný: chybí dostatečná společná historie nebo kapitalizace pro zvolené období."}</p></div>
          : <>
            {(current.stale || current.failed) && <p className="market-pulse-notice" role="status">Část historie se nepodařilo obnovit. Zobrazuji dostupná data včetně uložené historie.</p>}
            <ThemeHistoryChart points={performance.points} locale={locale} />
            <p className="theme-history-summary">{dateLabel(performance.points[0].date, locale)} – {dateLabel(performance.points.at(-1)!.date, locale)} · Index 100 → {performance.points.at(-1)!.value.toLocaleString(locale, { maximumFractionDigits: 2 })} · výnos {percent(performance.returnPct, locale)} · {performance.coverage}/{performance.total} {english ? "companies included" : "firem zahrnuto"}{performance.partial ? (english ? " · partial coverage" : " · částečné pokrytí") : ""}.</p>
            <ThemeDrivers performance={performance} timeframe={timeframe} locale={locale} />
          </>}
      <IndustryVisualizations overview={overview} timeframe={timeframe} locale={locale} />
      <IndustryBreadth overview={overview} timeframe={timeframe} locale={locale} />
      <p className="theme-methodology">{english ? "Fixed starting weights: equal, or proportional to the market-cap snapshot" : "Pevné počáteční váhy: stejné, nebo úměrné snapshotu kapitalizací"} · {capitalizationSource.observedOn}. {english ? "These are not historical market caps. Price returns without dividends, FX or rebalancing; only observed common dates. Coverage can differ by period. Excluded companies remain in the table." : "Nejde o historické kapitalizace. Cenové výnosy bez dividend, FX a rebalancování; jen společná pozorovaná data. Pokrytí se může lišit podle období. Nezahrnuté firmy zůstávají v tabulce."}</p>
      <IndustryCompanies key={theme.id} overview={overview} timeframe={timeframe} locale={locale} />
    </section>
  );
}
