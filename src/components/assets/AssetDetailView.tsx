"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import type { Locale } from "@/i18n/getDictionary";
import { marketThemes } from "@/data/market-themes";
import type { FundamentalsRecord } from "@/lib/finance/industry-data";
import { AssetIndustryContext } from "./AssetIndustryContext";
import type { IndustryView } from "@/lib/finance/industry-data";
import { industryBackHref, type IndustryNavigation } from "@/lib/markets/industry-navigation";
import type { AssetEntryContext } from "@/lib/markets/industry-navigation";
import { CompanyResearchSections, useCompanyResearch } from "./CompanyResearch";
import { CompanyPrimer } from "./CompanyPrimer";
import { CompanyRevenueMix } from "./CompanyRevenueMix";
import { FinancialAnatomy } from "./FinancialAnatomy";
import { CompanyHistoryChart } from "./CompanyHistoryChart";
import { AddAssetDialog } from "@/components/portfolio/AddAssetDialog";
import { usePortfolio } from "@/components/portfolio/PortfolioProvider";
import { buildHoldings, getPortfolioValue, initialTransactions } from "@/lib/finance/portfolio-engine";
import { addLocalDays, localDateISO } from "@/lib/date/local-date";
import { searchMarketAssets } from "@/lib/market-data/client";
import { loadFxQuote, loadHistory, loadQuoteAlternative, loadQuotePreview } from "@/lib/market-data/service";
import type { MarketAsset, MarketPricePoint, MarketQuote } from "@/lib/market-data/types";
import { quoteFailureDiagnostic } from "@/lib/market-data/diagnostics";
import { calculateAssetPerformance } from "@/lib/market-data/asset-performance";
import { allocation, money, percent } from "@/components/charts/chart-formatters";
import { MOCK_AS_OF, portfolioDataset } from "@/data/mock/portfolioDataset";
import { companyProfileFor } from "@/data/company-profiles";
import { buildRevenueBreakdown } from "@/lib/finance/revenue-breakdown";

type AssetRange = "1W" | "1M" | "3M" | "1Y" | "ALL";
const rangeDays: Record<Exclude<AssetRange, "ALL">, number> = { "1W": 7, "1M": 30, "3M": 90, "1Y": 365 };
const typeLabels = { stock: "Akcie", etf: "ETF", crypto: "Kryptoměna", cash: "Hotovost" } as const;
const nativeMoney = (value: number, currency: string, locale: string) =>
  `${value.toLocaleString(locale, { maximumFractionDigits: 2 })} ${currency}`;

export function AssetDetailView({ assetId, locale, fundamentals, industry, industryNavigation, initialAsset, entry = { source: "market" }, marketConfigured = true }: {
  assetId: string;
  locale: Locale;
  fundamentals?: FundamentalsRecord;
  industry?: IndustryView;
  industryNavigation?: IndustryNavigation;
  initialAsset?: MarketAsset;
  entry?: AssetEntryContext;
  marketConfigured?: boolean;
}) {
  const router = useRouter();
  const en = locale === "en-US";
  const context = industry && industryNavigation && industry.id === industryNavigation.industry
    && industry.members.some((member) => member.asset.id === assetId) ? industryNavigation : undefined;
  const themeName = marketThemes.find((theme) => theme.id === context?.industry)?.name;
  const { assets, holdings, market } = usePortfolio();
  const ownedAsset = assets.find((candidate) => candidate.id === assetId);
  const [resolvedAsset, setResolvedAsset] = useState<MarketAsset>();
  const asset = initialAsset ?? ownedAsset ?? resolvedAsset;
  const demoEntry = entry.source === "demo";
  const demoPositionAssetId = entry.source === "demo" ? entry.positionAssetId : undefined;
  const demoHistory = useMemo<MarketPricePoint[]>(() => demoPositionAssetId ? portfolioDataset.prices
    .filter((point) => point.assetId === demoPositionAssetId)
    .map((point) => ({ assetId, date: point.date.slice(0, 10), close: point.close, currency: point.currency, adjustedForSplits: true })) : [], [assetId, demoPositionAssetId]);
  const demoQuote = useMemo<MarketQuote | undefined>(() => {
    const latest = demoHistory.at(-1), previous = demoHistory.at(-2);
    if (!latest) return undefined;
    const change = previous ? latest.close - previous.close : undefined;
    return { assetId, price: latest.close, currency: latest.currency, change,
      changePercent: change !== undefined && previous ? change / previous.close * 100 : undefined,
      timestamp: `${MOCK_AS_OF}T20:00:00.000Z`, marketState: "closed", freshness: "lastClose", source: "cache" };
  }, [assetId, demoHistory]);
  const research = useCompanyResearch(asset, locale);
  const [assetLoading, setAssetLoading] = useState(!asset);
  const [assetError, setAssetError] = useState(false);
  const [quote, setQuote] = useState<MarketQuote | undefined>(demoQuote ?? market.quotes.find((candidate) => candidate.assetId === assetId));
  const [quoteLoading, setQuoteLoading] = useState(!demoEntry);
  const [quoteError, setQuoteError] = useState(false);
  const [quoteDiagnostic, setQuoteDiagnostic] = useState<ReturnType<typeof quoteFailureDiagnostic>>();
  const [quoteAlternative, setQuoteAlternative] = useState<{ asset: MarketAsset; quote: MarketQuote }>();
  const [alternativeLoading, setAlternativeLoading] = useState(false);
  const [fxRate, setFxRate] = useState<number>();
  const [timeframe, setTimeframe] = useState<AssetRange>(context?.period ?? "1Y");
  const [annualHistory, setAnnualHistory] = useState<MarketPricePoint[]>(demoEntry ? demoHistory.filter((point) => point.date >= addLocalDays(MOCK_AS_OF, -365)) : []);
  const [annualHistoryLoading, setAnnualHistoryLoading] = useState(false);
  const [annualHistoryError, setAnnualHistoryError] = useState(false);
  const [allHistory, setAllHistory] = useState<MarketPricePoint[]>(demoEntry ? demoHistory : []);
  const [allHistoryLoading, setAllHistoryLoading] = useState(false);
  const [allHistoryError, setAllHistoryError] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [historyProvenance, setHistoryProvenance] = useState<{ source: "demo" | "network" | "cache"; asOf: string } | undefined>(demoEntry ? { source: "demo", asOf: MOCK_AS_OF } : undefined);

  useEffect(() => {
    if (asset) return;
    let cancelled = false;
    const parts = assetId.split(":");
    const symbol = parts.at(-1) ?? assetId;
    void Promise.resolve().then(() => {
      if (cancelled) return [];
      setAssetLoading(true);
      setAssetError(false);
      return searchMarketAssets(symbol);
    })
      .then((results) => {
        if (cancelled) return;
        const match = results.find((candidate) => candidate.id === assetId)
          ?? results.find((candidate) => candidate.provider === parts[0] && candidate.micCode === parts[1] && candidate.symbol === symbol)
          ?? (parts.length === 1 ? results.find((candidate) => candidate.symbol === symbol.toUpperCase()) : undefined);
        if (!match) throw new Error("not-found");
        setResolvedAsset(match);
      })
      .catch(() => { if (!cancelled) setAssetError(true); })
      .finally(() => { if (!cancelled) setAssetLoading(false); });
    return () => { cancelled = true; };
  }, [asset, assetId]);

  useEffect(() => {
    if (!asset) return;
    if (demoEntry) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return undefined;
      setQuote(undefined);
      setQuoteLoading(true);
      setQuoteError(false);
      setQuoteDiagnostic(undefined);
      setQuoteAlternative(undefined);
      setAlternativeLoading(false);
      return loadQuotePreview(asset, undefined, undefined, marketConfigured);
    })
      .then((next) => { if (next && !cancelled) setQuote(next); })
      .catch(async (reason) => {
        if (cancelled) return;
        setQuoteError(true);
        setQuoteDiagnostic(quoteFailureDiagnostic(asset, reason));
        if (!marketConfigured) return;
        setAlternativeLoading(true);
        try {
          const alternative = await loadQuoteAlternative(asset);
          if (!cancelled) setQuoteAlternative(alternative);
        } catch {
          // The selected listing error remains the primary user-facing state.
        } finally {
          if (!cancelled) setAlternativeLoading(false);
        }
      })
      .finally(() => { if (!cancelled) setQuoteLoading(false); });
    return () => { cancelled = true; };
  }, [asset, demoEntry, demoQuote, marketConfigured]);

  useEffect(() => {
    if (!asset) return;
    if (demoEntry) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return undefined;
      setFxRate(asset.currency === "CZK" ? 1 : undefined);
      return asset.currency === "CZK" ? undefined : loadFxQuote(asset.currency, "CZK", undefined, marketConfigured);
    })
      .then((fx) => { if (fx && !cancelled) setFxRate(fx.rate); })
      .catch(() => { if (!cancelled) setFxRate(undefined); });
    return () => { cancelled = true; };
  }, [asset, demoEntry, marketConfigured]);

  useEffect(() => {
    if (!asset) return;
    if (demoEntry) return;
    let cancelled = false;
    const to = localDateISO();
    const from = addLocalDays(to, -365);
    void Promise.resolve().then(() => {
      if (cancelled) return undefined;
      setAnnualHistory([]);
      setAnnualHistoryLoading(true);
      setAnnualHistoryError(false);
      return loadHistory(asset, { from, to, interval: "1day" }, undefined, undefined, marketConfigured);
    })
      .then((result) => {
        if (!result || cancelled) return;
        setAnnualHistory(result.points);
        setAnnualHistoryError(result.points.length === 0);
        const asOf = result.points.at(-1)?.date;
        if (asOf) setHistoryProvenance({ source: result.source, asOf });
      })
      .catch(() => { if (!cancelled) { setAnnualHistory([]); setAnnualHistoryError(true); } })
      .finally(() => { if (!cancelled) setAnnualHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [asset, demoEntry, demoHistory, marketConfigured]);

  useEffect(() => {
    if (!asset || timeframe !== "ALL") return;
    if (demoEntry) return;
    let cancelled = false;
    const to = localDateISO();
    void Promise.resolve().then(() => {
      if (cancelled) return undefined;
      setAllHistory([]);
      setAllHistoryLoading(true);
      setAllHistoryError(false);
      return loadHistory(asset, { from: "2000-01-01", to, interval: "1day" }, undefined, undefined, marketConfigured);
    })
      .then((result) => {
        if (!result || cancelled) return;
        setAllHistory(result.points);
        setAllHistoryError(result.points.length === 0);
        const asOf = result.points.at(-1)?.date;
        if (asOf) setHistoryProvenance({ source: result.source, asOf });
      })
      .catch(() => { if (!cancelled) { setAllHistory([]); setAllHistoryError(true); } })
      .finally(() => { if (!cancelled) setAllHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [asset, demoEntry, demoHistory, marketConfigured, timeframe]);

  const displayedQuote = demoEntry ? demoQuote : quote;
  const displayedFxRate = demoEntry
    ? asset?.currency === "CZK" ? 1 : portfolioDataset.fxRates.findLast((point) => point.date.slice(0, 10) <= MOCK_AS_OF && point.currency === asset?.currency)?.czkPerUnit
    : fxRate;
  const displayedAnnualHistory = demoEntry ? demoHistory.filter((point) => point.date >= addLocalDays(MOCK_AS_OF, -365)) : annualHistory;
  const displayedAllHistory = demoEntry ? demoHistory : allHistory;
  const displayedHistoryProvenance = demoEntry ? { source: "demo" as const, asOf: MOCK_AS_OF } : historyProvenance;
  const demoHoldings = useMemo(() => buildHoldings(initialTransactions), []);
  const activeHoldings = demoEntry ? demoHoldings : holdings;
  const holding = activeHoldings.find((candidate) => candidate.assetId === (demoPositionAssetId ?? asset?.id));
  const positionValue = holding && displayedQuote && displayedFxRate !== undefined ? holding.quantity * displayedQuote.price * displayedFxRate : undefined;
  const pnl = holding && positionValue !== undefined ? positionValue - holding.totalCostCzk : undefined;
  const portfolioValue = useMemo(
    () => demoEntry
      ? getPortfolioValue(demoHoldings, MOCK_AS_OF, portfolioDataset.prices, portfolioDataset.fxRates)
      : getPortfolioValue(holdings, localDateISO(), market.prices, market.fxRates),
    [demoEntry, demoHoldings, holdings, market.fxRates, market.prices],
  );
  const positionAllocation = positionValue !== undefined && portfolioValue > 0 ? (positionValue / portfolioValue) * 100 : undefined;
  const chartHistory = useMemo(() => {
    if (timeframe === "ALL") return displayedAllHistory;
    const cutoff = addLocalDays(demoEntry ? MOCK_AS_OF : localDateISO(), -rangeDays[timeframe]);
    return displayedAnnualHistory.filter((point) => point.date >= cutoff);
  }, [displayedAllHistory, displayedAnnualHistory, demoEntry, timeframe]);
  const historyLoading = timeframe === "ALL" ? allHistoryLoading : annualHistoryLoading;
  const historyError = (timeframe === "ALL" ? allHistoryError : annualHistoryError)
    || (!historyLoading && chartHistory.length === 0);
  const performance = useMemo(
    () => calculateAssetPerformance(displayedAnnualHistory, displayedQuote?.price, demoEntry ? MOCK_AS_OF : localDateISO()),
    [displayedAnnualHistory, demoEntry, displayedQuote?.price],
  );
  const profile = companyProfileFor(assetId);
  const revenueBreakdown = buildRevenueBreakdown(assetId, fundamentals?.statements);
  const showRevenueMix = profile?.featuredRevenueMix && revenueBreakdown.status === "available";

  const backNavigation = <nav className="asset-detail-navigation" aria-label={en ? "Asset navigation" : "Navigace aktiva"}>
    {context && <Link className="asset-back-link asset-context-navigation" href={industryBackHref(locale, context)}><ArrowLeft size={15} />{en ? "Back to theme" : "Zpět na téma"}: {themeName}</Link>}
    <Link className="asset-back-link" href={`/${locale}/dashboard`}>{!context && <ArrowLeft size={15} />}Portfolio</Link>
    {(asset?.type === "stock" || context) && <Link className="asset-back-link" href={`/${locale}/markets`}>Markets</Link>}
  </nav>;

  if (!asset && assetLoading) return <main className="asset-detail-page">{backNavigation}<p className="asset-detail-state">Načítám instrument…</p></main>;
  if (!asset && assetError) return <main className="asset-detail-page">{backNavigation}<p className="asset-detail-state">Instrument se nepodařilo načíst.</p></main>;
  if (!asset) return null;

  const quoteState = demoEntry
    ? (en ? "Demo price · not market data" : "Demo cena · nejde o tržní data")
    : displayedQuote?.marketState === "open" && displayedQuote.freshness === "fresh" ? (en ? "Market open" : "Trh otevřen") : (en ? "Last closing price" : "Poslední zavírací cena");
  const change = displayedQuote?.change;
  const changePercent = displayedQuote?.changePercent;
  const changePositive = (change ?? changePercent ?? 0) >= 0;

  return (
    <main className="asset-detail-page page-enter">
      {backNavigation}

      <header className="asset-detail-header">
        <div className="asset-detail-identity">
          <h1>{asset.name}</h1>
          <p>{asset.symbol} · {asset.exchange} · {asset.currency}</p>
          {holding && <span>{demoEntry ? (en ? "Demo position" : "Demo pozice") : (en ? "In portfolio" : "V portfoliu")} · {holding.quantity.toLocaleString(locale, { maximumFractionDigits: 8 })} ks</span>}
        </div>
        <div className="asset-detail-quote" aria-live="polite">
          {quoteLoading && !displayedQuote ? <strong>Načítám cenu…</strong> : displayedQuote ? (
            <>
              <strong>{nativeMoney(displayedQuote.price, displayedQuote.currency, locale)}</strong>
              {(change !== undefined || changePercent !== undefined) && (
                <span className={changePositive ? "positive" : "negative"}>
                  {change !== undefined ? `${change > 0 ? "+" : ""}${nativeMoney(change, displayedQuote.currency, locale)}` : ""}
                  {change !== undefined && changePercent !== undefined ? " · " : ""}
                  {changePercent !== undefined ? percent(changePercent, locale) : ""}
                </span>
              )}
              <small>{quoteState} · {demoEntry ? (en ? "data as of" : "data k") : (en ? "updated" : "aktualizováno")} {new Date(displayedQuote.timestamp).toLocaleString(locale)}</small>
            </>
          ) : <strong className="quote-unavailable">Cena pro {asset.exchange} není dostupná.</strong>}
          {quoteError && displayedQuote && <small>Aktualizace ceny se nezdařila; zobrazuji poslední dostupnou hodnotu.</small>}
        </div>
      </header>
      <CompanyHistoryChart key={assetId} assetId={assetId} symbol={asset.symbol} currency={asset.currency} locale={locale}
        statements={fundamentals?.statements} priceData={chartHistory} priceLoading={historyLoading} priceError={historyError}
        priceControls={<div className="asset-timeframes" aria-label={en ? "Chart period" : "Období grafu"}>
          {(["1W", "1M", "3M", "1Y", "ALL"] as const).map(value => <button key={value} aria-pressed={timeframe === value} onClick={() => setTimeframe(value)}>{value}</button>)}
        </div>}
        priceProvenance={displayedHistoryProvenance && <p className="asset-history-provenance">{displayedHistoryProvenance.source === "demo" ? (en ? "Demo history · not market data" : "Demo historie · nejde o tržní data") : displayedHistoryProvenance.source === "cache" ? (en ? "Saved Twelve Data history" : "Uložená historie Twelve Data") : (en ? "Twelve Data history" : "Historie Twelve Data")} · {en ? "data through" : "data do"} {new Date(`${displayedHistoryProvenance.asOf.slice(0, 10)}T12:00:00Z`).toLocaleDateString(locale)}</p>}
      />
      {asset.type === "stock" && (showRevenueMix && revenueBreakdown.status === "available"
        ? <CompanyRevenueMix periods={revenueBreakdown.periods} growth={revenueBreakdown.growth} locale={locale} profile={profile} companyLabel={asset.symbol} />
        : <CompanyPrimer assetId={asset.id} locale={locale} fundamentals={fundamentals} profile={profile} />)}
      {industry && context && <AssetIndustryContext key={`${assetId}:${context.industry}:${context.period}:${context.weighting}:${context.asOf}:${context.version}:${industry.version}`} assetId={assetId} locale={locale} industry={industry} navigation={context} />}

      {displayedAnnualHistory.length > 0 && <section className="asset-performance-strip" aria-label="Výkonnost aktiva">
        <dl>
          <div><dt>1W</dt><dd className={performance.week === undefined ? "" : performance.week >= 0 ? "positive" : "negative"}>{performance.week === undefined ? "—" : percent(performance.week, locale)}</dd></div>
          <div><dt>1M</dt><dd className={performance.month === undefined ? "" : performance.month >= 0 ? "positive" : "negative"}>{performance.month === undefined ? "—" : percent(performance.month, locale)}</dd></div>
          <div><dt>1Y</dt><dd className={performance.year === undefined ? "" : performance.year >= 0 ? "positive" : "negative"}>{performance.year === undefined ? "—" : percent(performance.year, locale)}</dd></div>
          <div><dt>52W high</dt><dd>{performance.high52Week === undefined ? "—" : nativeMoney(performance.high52Week, asset.currency, locale)}</dd></div>
          <div><dt>52W low</dt><dd>{performance.low52Week === undefined ? "—" : nativeMoney(performance.low52Week, asset.currency, locale)}</dd></div>
          <div><dt>Od 52W high</dt><dd className={performance.fromHigh === undefined ? "" : performance.fromHigh >= 0 ? "positive" : "negative"}>{performance.fromHigh === undefined ? "—" : percent(performance.fromHigh, locale)}</dd></div>
        </dl>
      </section>}
      {demoEntry && <p className="asset-data-provenance" role="note">{en ? "Price, history and position valuation use the deterministic lens-demo-2026.09-v2 dataset. Financial statements below are separate sourced company data with their own reporting period." : "Cena, historie a ocenění pozice používají deterministický dataset lens-demo-2026.09-v2. Výkazy níže jsou samostatná zdrojovaná firemní data s vlastním účetním obdobím."}</p>}

      {!displayedQuote && quoteError && (alternativeLoading || quoteAlternative) && (
        <section className="asset-quote-fallback" aria-live="polite">
          {alternativeLoading ? <p>Hledám jiný dostupný listing…</p> : quoteAlternative ? (
            <>
              <div><span>Jiný dostupný listing</span><strong>{quoteAlternative.asset.symbol} · {quoteAlternative.asset.exchange} · {quoteAlternative.asset.currency}</strong><b>{nativeMoney(quoteAlternative.quote.price, quoteAlternative.quote.currency, locale)}</b></div>
              <button className="primary-button" onClick={() => router.push(`/${locale}/assets/${encodeURIComponent(quoteAlternative.asset.id)}`)}>Použít {quoteAlternative.asset.exchange} listing</button>
            </>
          ) : <p>Pro stejnou společnost jsme nenašli dostupný alternativní listing.</p>}
        </section>
      )}

      {process.env.NODE_ENV === "development" && quoteDiagnostic && (
        <details className="asset-quote-diagnostics">
          <summary>Dev · quote diagnostics</summary>
          <dl>{Object.entries(quoteDiagnostic).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
        </details>
      )}

      {asset.type === "stock" && <FinancialAnatomy assetId={asset.id} locale={locale} statements={fundamentals?.statements} fetchedAt={fundamentals?.fetchedAt} stale={!!fundamentals?.errors?.length} showRevenueStructure={!showRevenueMix} />}

      {asset.type === "stock" && <CompanyResearchSections research={research} locale={locale} />}

      {holding && (
          <section className="asset-position-section asset-position-detail" aria-labelledby="my-position-title">
            <div className="asset-section-heading"><h2 id="my-position-title">{demoEntry ? (en ? "Demo position" : "Demo pozice") : (en ? "My position" : "Moje pozice")}</h2>{!demoEntry && <button className="primary-button" onClick={() => setAddOpen(true)}><Plus size={16} />Dokoupit</button>}</div>
            <dl className="asset-position-metrics">
              <div><dt>Množství</dt><dd>{holding.quantity.toLocaleString(locale, { maximumFractionDigits: 8 })}</dd></div>
              <div><dt>Současná hodnota</dt><dd>{positionValue === undefined ? "—" : money(positionValue, locale)}</dd></div>
              <div><dt>Průměrná nákupní cena</dt><dd>{nativeMoney(holding.averageCost, asset.currency, locale)}</dd></div>
              <div><dt>P/L</dt><dd className={pnl === undefined ? "" : pnl >= 0 ? "positive" : "negative"}>{pnl === undefined ? "—" : `${money(pnl, locale)} · ${percent((pnl / holding.totalCostCzk) * 100, locale)}`}</dd></div>
              <div><dt>Podíl v portfoliu</dt><dd>{positionAllocation === undefined ? "—" : allocation(positionAllocation, locale)}</dd></div>
            </dl>
          </section>
      )}

      <details className="asset-information-section">
        <summary>Detaily instrumentu</summary>
          <dl>
            <div><dt>Ticker</dt><dd>{asset.symbol}</dd></div>
            {asset.exchange && <div><dt>Burza</dt><dd>{asset.exchange}</dd></div>}
            {asset.micCode && <div><dt>MIC</dt><dd>{asset.micCode}</dd></div>}
            <div><dt>Měna</dt><dd>{asset.currency}</dd></div>
            <div><dt>Typ instrumentu</dt><dd>{typeLabels[asset.type]}</dd></div>
            {asset.country && <div><dt>Země</dt><dd>{asset.country}</dd></div>}
            {displayedQuote && <div><dt>Market state</dt><dd>{displayedQuote.marketState === "open" ? "Otevřen" : displayedQuote.marketState === "closed" ? "Zavřen" : "Neznámý"}</dd></div>}
            {displayedQuote && <div><dt>Poslední aktualizace</dt><dd>{new Date(displayedQuote.timestamp).toLocaleString(locale)}</dd></div>}
          </dl>
      </details>

      {notice && <div className="portfolio-toast" role="status">{notice}</div>}
      {addOpen && !demoEntry && <AddAssetDialog initialAsset={asset} initialAssetId={asset.id} onClose={() => setAddOpen(false)} onSaved={(symbol) => { setNotice(`${symbol} bylo přidáno do portfolia.`); window.setTimeout(() => setNotice(""), 3200); }} />}
    </main>
  );
}
