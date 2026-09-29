"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@/i18n/getDictionary";
import { marketThemeAssets, marketThemes, type MarketTheme } from "@/data/market-themes";
import { getBrowserMarketDataCache } from "@/lib/market-data/cache/market-cache";
import { loadQuotes } from "@/lib/market-data/service";
import type { MarketQuote } from "@/lib/market-data/types";
import { percent } from "@/components/charts/chart-formatters";

import type { IndustryView } from "@/lib/finance/industry-data";
import { industryCompanies } from "@/data/market-industries";
import { industryAssetHref, type IndustryNavigation } from "@/lib/markets/industry-navigation";
import { ThemeDetail } from "./ThemeDetail";

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
    coverage: theme.constituents.filter((asset) => quotes.has(asset.id)).length,
    rising: available.filter((item) => item.quote.changePercent! > 0).length,
    falling: available.filter((item) => item.quote.changePercent! < 0).length,
    measured: available.length,
    topGainer: sorted[0],
    topLoser: sorted.at(-1),
  };
}

export function MarketPulse({ locale, variant = "compact", initialThemeId, industries, initialNavigation }: { locale: Locale; variant?: "compact" | "full"; initialThemeId?: string; industries?: Record<string, IndustryView>; initialNavigation?: IndustryNavigation }) {
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [navigation, setNavigation] = useState<IndustryNavigation | undefined>(initialNavigation);
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
        <div><span>{variant === "full" ? "Lens Industries" : "Lens Theme"}</span><h2 id={`market-pulse-title-${variant}`}>Technology</h2></div>
        {variant === "compact" && <Link href={`/${locale}/markets`}>Zobrazit Markets →</Link>}
      </header>
      {error && <p className="market-pulse-notice" role="status">Část aktuálních market dat není dostupná.</p>}
      <div className="market-theme-grid" aria-busy={loading}>
        {marketThemes.map((theme) => {
          const summary = summarize(theme, byAsset);
          const pending = loading && selectedTheme.id === theme.id && !summary.coverage;
          const partial = summary.measured < theme.constituents.length;
          const content = variant === "full" ? <>
            <span>{theme.name}<small className="industry-selector-count">{industries?.[theme.id]?.members.length ?? industryCompanies(theme).length} {locale === "en-US" ? "tracked companies" : "sledovaných firem"}</small></span>
            <small>{industries ? "Lens Top 100 →" : "Industry Index →"}</small>
          </> : (
            <>
              <span>{theme.name}</span>
              <strong className={partial || summary.average === undefined ? "" : summary.average >= 0 ? "positive" : "negative"}>{pending ? "…" : partial || summary.average === undefined ? "—" : percent(summary.average, locale)}</strong>
              <small>{pending ? "Načítám…" : summary.coverage
                ? partial
                  ? `Částečná data · ${summary.coverage}/${theme.constituents.length} titulů`
                  : `${summary.coverage} / ${theme.constituents.length} titulů k dispozici · ${summary.rising} roste · ${summary.falling} klesá`
                : "Data nejsou dostupná"}</small>

            </>
          );
          return variant === "compact"
            ? <Link className="market-theme-card" href={`/${locale}/markets?theme=${theme.id}`} key={theme.id}>{content}</Link>
            : <button className="market-theme-card" aria-pressed={selectedTheme.id === theme.id} onClick={() => {
              if (theme.id !== selectedThemeId) {
                setLoading(true);
                setError(false);
                setSelectedThemeId(theme.id);
              }
            }} key={theme.id}>{content}</button>;
        })}
      </div>

      {variant === "full" && <ThemeDetail onNavigationChange={setNavigation} initialNavigation={initialNavigation} theme={selectedTheme} locale={locale} industry={industries?.[selectedTheme.id]} />}

      {variant === "full" && (
        <details className="industry-basket-members"><summary>{locale === "en-US" ? "Lens calculation basket" : "Složení výpočtového koše Lens"} · {selectedTheme.constituents.length}</summary>
        <div className="market-constituents">
          <div><span>Lens Theme</span><h3>{selectedTheme.name}</h3><small>Equal-weight denní změna dostupných titulů · nejde o tržní index</small></div>
          <div className="market-constituent-list">
            {selectedTheme.constituents.map((asset) => {
              const quote = byAsset.get(asset.id);
              return (
                <Link className="market-constituent-row" href={industryAssetHref(locale, asset.id, navigation)} key={asset.id} aria-label={`Detail ${asset.symbol}`}>
                  <span><strong>{asset.symbol}</strong><small>{asset.name}</small></span>
                  <b>{quote ? price(quote, locale) : loading ? "Načítám…" : "Cena nedostupná"}</b>
                  <em className={quote?.changePercent === undefined ? "" : quote.changePercent >= 0 ? "positive" : "negative"}>{quote?.changePercent === undefined ? "—" : percent(quote.changePercent, locale)}</em>
                </Link>
              );
            })}
          </div>
        </div>
        </details>
      )}
    </section>
  );
}
