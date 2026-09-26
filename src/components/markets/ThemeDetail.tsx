"use client";

import { useEffect, useMemo, useState } from "react";
import type { MarketTheme } from "@/data/market-themes";
import { buildThemePerformance, themeHistoryRange, themeTimeframes, type ThemeTimeframe } from "@/lib/finance/theme-performance";
import type { MarketPricePoint } from "@/lib/market-data/types";
import { loadHistory } from "@/lib/market-data/service";
import { getBrowserMarketDataCache } from "@/lib/market-data/cache/market-cache";
import { percent, dateLabel } from "@/components/charts/chart-formatters";
import { ThemeHistoryChart } from "./ThemeHistoryChart";

type Result = { key: string; histories: Map<string, MarketPricePoint[]>; failed: boolean; stale: boolean };

export function ThemeDetail({ theme, locale }: { theme: MarketTheme; locale: string }) {
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
        <div><span className="theme-detail-eyebrow">Lens Theme · equal-weight</span><h3>{theme.name}</h3><p>Index 100 · cenový výnos · nejde o oficiální index</p></div>
        <div className="theme-period-return"><span>Výnos za {timeframe}</span><strong className={performance?.status === "complete" ? performance.returnPct >= 0 ? "positive" : "negative" : ""}>{!current ? "…" : performance?.status === "complete" ? percent(performance.returnPct, locale) : "—"}</strong></div>
      </header>
      <div className="theme-timeframes" role="group" aria-label="Období historie tématu">
        {themeTimeframes.map((value) => <button key={value} aria-pressed={timeframe === value} onClick={() => setTimeframe(value)}>{value}</button>)}
      </div>
      {!current ? <div className="theme-history-placeholder" role="status">Načítám historii tématu…</div>
        : performance?.status !== "complete" ? <div className="theme-history-placeholder" role="status"><p className="market-pulse-notice">{current.failed ? "Historie části titulů není dostupná." : "Částečná historie tématu."} Výkonnost vyžaduje úplnou historii všech {theme.constituents.length} titulů ve stejných dnech zvoleného období.</p></div>
          : <>
            {current.stale && <p className="market-pulse-notice" role="status">Obnovení historie selhalo. Zobrazuji uložená data.</p>}
            <ThemeHistoryChart points={performance.points} locale={locale} />
            <p className="theme-history-summary">{dateLabel(performance.points[0].date, locale)} – {dateLabel(performance.points.at(-1)!.date, locale)} · Index 100 → {performance.points.at(-1)!.value.toLocaleString(locale, { maximumFractionDigits: 2 })} · výnos {percent(performance.returnPct, locale)} · {performance.total}/{performance.total} titulů.</p>
            <div className="theme-period-stats">
              <div><h4>Šíře růstu za {timeframe}</h4><strong>{performance.positive} / {performance.total} titulů v plusu</strong></div>
              <div><h4>2 nejsilnější tituly</h4>{performance.leaders.map(({ asset, returnPct }) => <p key={asset.id}><span>{asset.symbol}</span><b>{percent(returnPct, locale)}</b></p>)}</div>
              <div><h4>2 nejslabší tituly</h4>{performance.laggards.map(({ asset, returnPct }) => <p key={asset.id}><span>{asset.symbol}</span><b>{percent(returnPct, locale)}</b></p>)}</div>
            </div>
          </>}
      <p className="theme-methodology">Stejná počáteční váha každého titulu; průměr cen normalizovaných na 100. Bez dividend a průběžného rebalancování. Denní závěrečné ceny, bez dnešního neuzavřeného dne.</p>
    </section>
  );
}
