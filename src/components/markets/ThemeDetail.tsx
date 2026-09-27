"use client";

import { useEffect, useMemo, useState } from "react";
import type { MarketTheme } from "@/data/market-themes";
import { buildThemePerformance, themeHistoryRange, themeTimeframes, type ThemeTimeframe } from "@/lib/finance/theme-performance";
import type { MarketPricePoint } from "@/lib/market-data/types";
import { loadHistory } from "@/lib/market-data/service";
import { getBrowserMarketDataCache } from "@/lib/market-data/cache/market-cache";
import { percent, dateLabel } from "@/components/charts/chart-formatters";
import { industryCompanies, industryDescriptions } from "@/data/market-industries";
import { buildIndustryOverview } from "@/lib/finance/industry-overview";
import { IndustryOverviewStrip, IndustryBreadth, IndustryCompanies } from "./IndustryCompanies";
import { ThemeDrivers, IndustryVisualizations } from "./IndustryVisualizations";
import { ThemeHistoryChart } from "./ThemeHistoryChart";

type Result = { key: string; histories: Map<string, MarketPricePoint[]>; failed: boolean; stale: boolean };

export function ThemeDetail({ theme, locale }: { theme: MarketTheme; locale: string }) {
  const english = locale === "en-US";
  const [timeframe, setTimeframe] = useState<ThemeTimeframe>("1M");
  const [referenceDate] = useState(() => new Date());
  const historyRange = useMemo(() => themeHistoryRange("1Y", referenceDate), [referenceDate]);
  const range = useMemo(() => themeHistoryRange(timeframe, referenceDate), [timeframe, referenceDate]);
  const key = `${theme.id}:${historyRange.from}:${historyRange.to}`;
  const [result, setResult] = useState<Result>();
  const current = result?.key === key ? result : undefined;
  const performance = useMemo(() => current
    ? buildThemePerformance(theme.constituents, current.histories, range)
    : undefined, [current, theme, range]);

  const universe = useMemo(() => industryCompanies(theme), [theme]);
  const [saved, setSaved] = useState<{ themeId: string; histories: Map<string, MarketPricePoint[]> }>();
  useEffect(() => {
    let cancelled = false;
    const cache = getBrowserMarketDataCache();
    void Promise.allSettled(universe.map((asset) => cache.getHistory(asset.id))).then((records) => {
      if (!cancelled) setSaved({ themeId: theme.id, histories: new Map(records.flatMap((record, index) =>
        record.status === "fulfilled" && record.value ? [[universe[index].id, record.value.points] as const] : [],
      )) });
    });
    return () => { cancelled = true; };
  }, [universe, theme.id, current]);
  const overview = useMemo(() => buildIndustryOverview(universe, theme.constituents,
    new Map([...(saved?.themeId === theme.id ? saved.histories : []), ...(current?.histories ?? [])]), range),
  [universe, theme, saved, current, range]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      const cache = getBrowserMarketDataCache();
      const results = await Promise.allSettled(theme.constituents.map(async (asset) => {
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
  }, [key, historyRange, theme]);

  return (
    <section className="theme-detail" aria-label={`Historie tématu ${theme.name}`} aria-busy={!current}>
      <header className="theme-detail-header">
        <div><span className="theme-detail-eyebrow">{english ? "Industry · Technology" : "Odvětví · Technology"}</span><h3>{theme.name}</h3><p>{industryDescriptions[theme.id]}</p></div>
        <div className="theme-period-return"><span>Výnos za {timeframe}</span><strong className={performance?.status === "complete" ? performance.returnPct >= 0 ? "positive" : "negative" : ""}>{!current ? "…" : performance?.status === "complete" ? percent(performance.returnPct, locale) : "—"}</strong><small>{english ? "Lens basket" : "Koš Lens"} · {theme.constituents.length}/{universe.length}</small></div>
      </header>
      <IndustryOverviewStrip overview={overview} basketCount={theme.constituents.length} locale={locale} />
      <div className="industry-trend-label"><h4>Lens Theme · equal-weight</h4><span>Index 100 · {theme.constituents.length} {english ? "companies, not the whole universe or an official index" : "firmy, nikoli celé univerzum ani oficiální index"}</span></div>
      <div className="theme-timeframes" role="group" aria-label="Období historie tématu">
        {themeTimeframes.map((value) => <button key={value} aria-pressed={timeframe === value} onClick={() => setTimeframe(value)}>{value}</button>)}
      </div>
      {!current ? <div className="theme-history-placeholder" role="status">Načítám historii tématu…</div>
        : performance?.status !== "complete" ? <div className="theme-history-placeholder" role="status"><p className="market-pulse-notice">{current.failed ? "Historie části titulů není dostupná." : "Částečná historie tématu."} Výkonnost vyžaduje úplnou historii všech {theme.constituents.length} titulů ve stejných dnech zvoleného období.</p></div>
          : <>
            {current.stale && <p className="market-pulse-notice" role="status">Obnovení historie selhalo. Zobrazuji uložená data.</p>}
            <ThemeHistoryChart points={performance.points} locale={locale} />
            <p className="theme-history-summary">{dateLabel(performance.points[0].date, locale)} – {dateLabel(performance.points.at(-1)!.date, locale)} · Index 100 → {performance.points.at(-1)!.value.toLocaleString(locale, { maximumFractionDigits: 2 })} · výnos {percent(performance.returnPct, locale)} · {performance.total}/{performance.total} titulů.</p>
            <ThemeDrivers performance={performance} timeframe={timeframe} locale={locale} />
          </>}
      <IndustryVisualizations overview={overview} timeframe={timeframe} locale={locale} />
      <IndustryBreadth overview={overview} timeframe={timeframe} locale={locale} />
      <p className="theme-methodology">Stejná počáteční váha každého titulu; průměr cen normalizovaných na 100. Bez dividend a průběžného rebalancování. Denní závěrečné ceny, bez dnešního neuzavřeného dne.</p>
      <IndustryCompanies key={theme.id} overview={overview} timeframe={timeframe} locale={locale} />
    </section>
  );
}
