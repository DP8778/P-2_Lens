"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@/i18n/getDictionary";
import { marketThemeAssets, marketThemes, type MarketTheme } from "@/data/market-themes";
import { getBrowserMarketDataCache } from "@/lib/market-data/cache/market-cache";
import { loadQuotes } from "@/lib/market-data/service";
import type { MarketQuote } from "@/lib/market-data/types";
import { percent } from "@/components/charts/chart-formatters";

const defaultTheme = marketThemes[0];

const price = (quote: MarketQuote, locale: string) =>
  `${quote.price.toLocaleString(locale, { maximumFractionDigits: 2 })} ${quote.currency}`;

function summarize(theme: MarketTheme, quotes: Map<string, MarketQuote>) {
  const available = theme.constituents.flatMap((asset) => {
    const quote = quotes.get(asset.id);
    return quote?.changePercent === undefined ? [] : [{ asset, quote }];
  });
  const average = available.length
    ? available.reduce((sum, item) => sum + item.quote.changePercent!, 0) / available.length
    : undefined;
  const sorted = [...available].sort((left, right) => right.quote.changePercent! - left.quote.changePercent!);
  return {
    average,
    rising: available.filter((item) => item.quote.changePercent! > 0).length,
    falling: available.filter((item) => item.quote.changePercent! < 0).length,
    measured: available.length,
    topGainer: sorted[0],
    topLoser: sorted.at(-1),
  };
}

export function MarketPulse({ locale, variant = "compact", initialThemeId }: { locale: Locale; variant?: "compact" | "full"; initialThemeId?: string }) {
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedThemeId, setSelectedThemeId] = useState(
    marketThemes.some((theme) => theme.id === initialThemeId) ? initialThemeId! : defaultTheme.id,
  );

  const selectedTheme = marketThemes.find((theme) => theme.id === selectedThemeId) ?? defaultTheme;

  useEffect(() => {
    let cancelled = false;
    const cache = getBrowserMarketDataCache();
    void (async () => {
      const cached = await Promise.all(marketThemeAssets.map((asset) => cache.getQuote(asset.id)));
      if (cancelled) return;
      setQuotes(cached.flatMap((record) => record ? [record.quote] : []));
      setLoading(false);
      setError(false);
      const result = await loadQuotes(selectedTheme.constituents, cache);
      if (!cancelled) setQuotes((current) =>
        [...new Map([...current, ...result].map((quote) => [quote.assetId, quote])).values()],
      );
    })()
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedTheme]);

  const byAsset = useMemo(() => new Map(quotes.map((quote) => [quote.assetId, quote])), [quotes]);

  return (
    <section className={`market-pulse ${variant}`} aria-labelledby={`market-pulse-title-${variant}`}>
      <header>
        <div><span>Lens Theme</span><h2 id={`market-pulse-title-${variant}`}>Technology</h2></div>
        {variant === "compact" && <Link href={`/${locale}/markets`}>Zobrazit Markets →</Link>}
      </header>
      {error && <p className="market-pulse-notice" role="status">Část aktuálních market dat není dostupná.</p>}
      <div className="market-theme-grid" aria-busy={loading}>
        {marketThemes.map((theme) => {
          const summary = summarize(theme, byAsset);
          const content = (
            <>
              <span>{theme.name}</span>
              <strong className={summary.average === undefined ? "" : summary.average >= 0 ? "positive" : "negative"}>{loading ? "…" : summary.average === undefined ? "—" : percent(summary.average, locale)}</strong>
              <small>{loading ? "Načítám…" : summary.measured ? `${summary.rising} / ${summary.measured} roste · ${summary.falling} klesá` : "Data nejsou dostupná"}</small>
              {variant === "full" && summary.topGainer && summary.topLoser && (
                <em><b>{summary.topGainer.asset.symbol} {percent(summary.topGainer.quote.changePercent!, locale)}</b><b>{summary.topLoser.asset.symbol} {percent(summary.topLoser.quote.changePercent!, locale)}</b></em>
              )}
            </>
          );
          return variant === "compact"
            ? <Link className="market-theme-card" href={`/${locale}/markets?theme=${theme.id}`} key={theme.id}>{content}</Link>
            : <button className="market-theme-card" aria-pressed={selectedTheme.id === theme.id} onClick={() => setSelectedThemeId(theme.id)} key={theme.id}>{content}</button>;
        })}
      </div>

      {variant === "full" && (
        <div className="market-constituents">
          <div><span>Lens Theme</span><h3>{selectedTheme.name}</h3><small>Equal-weight denní změna dostupných titulů · nejde o tržní index</small></div>
          <div className="market-constituent-list">
            {selectedTheme.constituents.map((asset) => {
              const quote = byAsset.get(asset.id);
              return (
                <Link className="market-constituent-row" href={`/${locale}/assets/${encodeURIComponent(asset.id)}`} key={asset.id} aria-label={`Detail ${asset.symbol}`}>
                  <span><strong>{asset.symbol}</strong><small>{asset.name}</small></span>
                  <b>{quote ? price(quote, locale) : "Cena nedostupná"}</b>
                  <em className={quote?.changePercent === undefined ? "" : quote.changePercent >= 0 ? "positive" : "negative"}>{quote?.changePercent === undefined ? "—" : percent(quote.changePercent, locale)}</em>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
