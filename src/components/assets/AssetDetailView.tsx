"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import type { Locale } from "@/i18n/getDictionary";
import { AssetPriceChart } from "@/components/charts/AssetPriceChart";
import { AddAssetDialog } from "@/components/portfolio/AddAssetDialog";
import { usePortfolio } from "@/components/portfolio/PortfolioProvider";
import { getPortfolioValue } from "@/lib/finance/portfolio-engine";
import { addLocalDays, localDateISO } from "@/lib/date/local-date";
import { searchMarketAssets } from "@/lib/market-data/client";
import { loadFxQuote, loadHistory, loadQuoteAlternative, loadQuotePreview } from "@/lib/market-data/service";
import type { MarketAsset, MarketPricePoint, MarketQuote } from "@/lib/market-data/types";
import { quoteFailureDiagnostic } from "@/lib/market-data/diagnostics";
import { calculateAssetPerformance } from "@/lib/market-data/asset-performance";
import { allocation, money, percent } from "@/components/charts/chart-formatters";

type AssetRange = "1W" | "1M" | "3M" | "1Y" | "ALL";
const rangeDays: Record<Exclude<AssetRange, "ALL">, number> = { "1W": 7, "1M": 30, "3M": 90, "1Y": 365 };
const typeLabels = { stock: "Akcie", etf: "ETF", crypto: "Kryptoměna", cash: "Hotovost" } as const;
const nativeMoney = (value: number, currency: string, locale: string) =>
  `${value.toLocaleString(locale, { maximumFractionDigits: 2 })} ${currency}`;

export function AssetDetailView({ assetId, locale }: { assetId: string; locale: Locale }) {
  const router = useRouter();
  const { assets, holdings, market } = usePortfolio();
  const ownedAsset = assets.find((candidate) => candidate.id === assetId);
  const [resolvedAsset, setResolvedAsset] = useState<MarketAsset>();
  const asset = ownedAsset ?? resolvedAsset;
  const [assetLoading, setAssetLoading] = useState(!ownedAsset);
  const [assetError, setAssetError] = useState(false);
  const [quote, setQuote] = useState<MarketQuote | undefined>(market.quotes.find((candidate) => candidate.assetId === assetId));
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [quoteError, setQuoteError] = useState(false);
  const [quoteDiagnostic, setQuoteDiagnostic] = useState<ReturnType<typeof quoteFailureDiagnostic>>();
  const [quoteAlternative, setQuoteAlternative] = useState<{ asset: MarketAsset; quote: MarketQuote }>();
  const [alternativeLoading, setAlternativeLoading] = useState(false);
  const [fxRate, setFxRate] = useState<number>();
  const [timeframe, setTimeframe] = useState<AssetRange>("1M");
  const [annualHistory, setAnnualHistory] = useState<MarketPricePoint[]>([]);
  const [annualHistoryLoading, setAnnualHistoryLoading] = useState(false);
  const [annualHistoryError, setAnnualHistoryError] = useState(false);
  const [allHistory, setAllHistory] = useState<MarketPricePoint[]>([]);
  const [allHistoryLoading, setAllHistoryLoading] = useState(false);
  const [allHistoryError, setAllHistoryError] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (ownedAsset) return;
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
  }, [assetId, ownedAsset]);

  useEffect(() => {
    if (!asset) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return undefined;
      setQuote(undefined);
      setQuoteLoading(true);
      setQuoteError(false);
      setQuoteDiagnostic(undefined);
      setQuoteAlternative(undefined);
      setAlternativeLoading(false);
      return loadQuotePreview(asset);
    })
      .then((next) => { if (next && !cancelled) setQuote(next); })
      .catch(async (reason) => {
        if (cancelled) return;
        setQuoteError(true);
        setQuoteDiagnostic(quoteFailureDiagnostic(asset, reason));
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
  }, [asset]);

  useEffect(() => {
    if (!asset) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return undefined;
      setFxRate(asset.currency === "CZK" ? 1 : undefined);
      return asset.currency === "CZK" ? undefined : loadFxQuote(asset.currency, "CZK");
    })
      .then((fx) => { if (fx && !cancelled) setFxRate(fx.rate); })
      .catch(() => { if (!cancelled) setFxRate(undefined); });
    return () => { cancelled = true; };
  }, [asset]);

  useEffect(() => {
    if (!asset) return;
    let cancelled = false;
    const to = localDateISO();
    const from = addLocalDays(to, -365);
    void Promise.resolve().then(() => {
      if (cancelled) return undefined;
      setAnnualHistory([]);
      setAnnualHistoryLoading(true);
      setAnnualHistoryError(false);
      return loadHistory(asset, { from, to, interval: "1day" });
    })
      .then((result) => {
        if (!result || cancelled) return;
        setAnnualHistory(result.points);
        setAnnualHistoryError(result.points.length === 0);
      })
      .catch(() => { if (!cancelled) { setAnnualHistory([]); setAnnualHistoryError(true); } })
      .finally(() => { if (!cancelled) setAnnualHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [asset]);

  useEffect(() => {
    if (!asset || timeframe !== "ALL") return;
    let cancelled = false;
    const to = localDateISO();
    void Promise.resolve().then(() => {
      if (cancelled) return undefined;
      setAllHistory([]);
      setAllHistoryLoading(true);
      setAllHistoryError(false);
      return loadHistory(asset, { from: "2000-01-01", to, interval: "1day" });
    })
      .then((result) => {
        if (!result || cancelled) return;
        setAllHistory(result.points);
        setAllHistoryError(result.points.length === 0);
      })
      .catch(() => { if (!cancelled) { setAllHistory([]); setAllHistoryError(true); } })
      .finally(() => { if (!cancelled) setAllHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [asset, timeframe]);

  const holding = holdings.find((candidate) => candidate.assetId === asset?.id);
  const positionValue = holding && quote && fxRate !== undefined ? holding.quantity * quote.price * fxRate : undefined;
  const pnl = holding && positionValue !== undefined ? positionValue - holding.totalCostCzk : undefined;
  const portfolioValue = useMemo(
    () => getPortfolioValue(holdings, localDateISO(), market.prices, market.fxRates),
    [holdings, market.fxRates, market.prices],
  );
  const positionAllocation = positionValue !== undefined && portfolioValue > 0 ? (positionValue / portfolioValue) * 100 : undefined;
  const chartHistory = useMemo(() => {
    if (timeframe === "ALL") return allHistory;
    const cutoff = addLocalDays(localDateISO(), -rangeDays[timeframe]);
    return annualHistory.filter((point) => point.date >= cutoff);
  }, [allHistory, annualHistory, timeframe]);
  const historyLoading = timeframe === "ALL" ? allHistoryLoading : annualHistoryLoading;
  const historyError = (timeframe === "ALL" ? allHistoryError : annualHistoryError)
    || (!historyLoading && chartHistory.length === 0);
  const performance = useMemo(
    () => calculateAssetPerformance(annualHistory, quote?.price, localDateISO()),
    [annualHistory, quote?.price],
  );

  if (!asset && assetLoading) return <main className="asset-detail-page"><p className="asset-detail-state">Načítám instrument…</p></main>;
  if (!asset && assetError) return <main className="asset-detail-page"><Link className="asset-back-link" href={`/${locale}/dashboard`}><ArrowLeft size={15} />Portfolio</Link><p className="asset-detail-state">Instrument se nepodařilo načíst.</p></main>;
  if (!asset) return null;

  const quoteState = quote?.marketState === "open" && quote.freshness === "fresh" ? "Trh otevřen" : "Poslední zavírací cena";
  const change = quote?.change;
  const changePercent = quote?.changePercent;
  const changePositive = (change ?? changePercent ?? 0) >= 0;

  return (
    <main className="asset-detail-page page-enter">
      <Link className="asset-back-link" href={`/${locale}/dashboard`}><ArrowLeft size={15} />Portfolio</Link>

      <header className="asset-detail-header">
        <div className="asset-detail-identity">
          <h1>{asset.name}</h1>
          <p>{asset.symbol} · {asset.exchange} · {asset.currency}</p>
          {holding && <span>V portfoliu · {holding.quantity.toLocaleString(locale, { maximumFractionDigits: 8 })} ks</span>}
        </div>
        <div className="asset-detail-quote" aria-live="polite">
          {quoteLoading && !quote ? <strong>Načítám cenu…</strong> : quote ? (
            <>
              <strong>{nativeMoney(quote.price, quote.currency, locale)}</strong>
              {(change !== undefined || changePercent !== undefined) && (
                <span className={changePositive ? "positive" : "negative"}>
                  {change !== undefined ? `${change > 0 ? "+" : ""}${nativeMoney(change, quote.currency, locale)}` : ""}
                  {change !== undefined && changePercent !== undefined ? " · " : ""}
                  {changePercent !== undefined ? percent(changePercent, locale) : ""}
                </span>
              )}
              <small>{quoteState} · aktualizováno {new Date(quote.timestamp).toLocaleString(locale)}</small>
            </>
          ) : <strong className="quote-unavailable">Cena pro {asset.exchange} není dostupná.</strong>}
          {quoteError && quote && <small>Aktualizace ceny se nezdařila; zobrazuji poslední dostupnou hodnotu.</small>}
        </div>
      </header>

      <section className="asset-performance-strip" aria-label="Výkonnost aktiva">
        <dl>
          <div><dt>1W</dt><dd className={performance.week === undefined ? "" : performance.week >= 0 ? "positive" : "negative"}>{performance.week === undefined ? "—" : percent(performance.week, locale)}</dd></div>
          <div><dt>1M</dt><dd className={performance.month === undefined ? "" : performance.month >= 0 ? "positive" : "negative"}>{performance.month === undefined ? "—" : percent(performance.month, locale)}</dd></div>
          <div><dt>1Y</dt><dd className={performance.year === undefined ? "" : performance.year >= 0 ? "positive" : "negative"}>{performance.year === undefined ? "—" : percent(performance.year, locale)}</dd></div>
          <div><dt>52W high</dt><dd>{performance.high52Week === undefined ? "—" : nativeMoney(performance.high52Week, asset.currency, locale)}</dd></div>
          <div><dt>52W low</dt><dd>{performance.low52Week === undefined ? "—" : nativeMoney(performance.low52Week, asset.currency, locale)}</dd></div>
          <div><dt>Od 52W high</dt><dd className={performance.fromHigh === undefined ? "" : performance.fromHigh >= 0 ? "positive" : "negative"}>{performance.fromHigh === undefined ? "—" : percent(performance.fromHigh, locale)}</dd></div>
        </dl>
      </section>

      {!quote && quoteError && (
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

      <section className="asset-history-section" aria-labelledby="asset-history-title">
        <div className="asset-section-heading">
          <h2 id="asset-history-title">Vývoj ceny</h2>
          <div className="asset-timeframes" aria-label="Období grafu">
            {(["1W", "1M", "3M", "1Y", "ALL"] as const).map((value) => <button key={value} aria-pressed={timeframe === value} onClick={() => setTimeframe(value)}>{value}</button>)}
          </div>
        </div>
        {historyLoading ? <div className="asset-chart-state">Načítám historická data…</div> : historyError ? <div className="asset-chart-state">Historická data momentálně nejsou dostupná.</div> : <AssetPriceChart data={chartHistory} currency={asset.currency} locale={locale} />}
      </section>

      {holding && (
          <section className="asset-position-section asset-position-detail" aria-labelledby="my-position-title">
            <div className="asset-section-heading"><h2 id="my-position-title">Moje pozice</h2><button className="primary-button" onClick={() => setAddOpen(true)}><Plus size={16} />Dokoupit</button></div>
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
            {quote && <div><dt>Market state</dt><dd>{quote.marketState === "open" ? "Otevřen" : quote.marketState === "closed" ? "Zavřen" : "Neznámý"}</dd></div>}
            {quote && <div><dt>Poslední aktualizace</dt><dd>{new Date(quote.timestamp).toLocaleString(locale)}</dd></div>}
          </dl>
      </details>

      {notice && <div className="portfolio-toast" role="status">{notice}</div>}
      {addOpen && <AddAssetDialog initialAsset={asset} initialAssetId={asset.id} onClose={() => setAddOpen(false)} onSaved={(symbol) => { setNotice(`${symbol} bylo přidáno do portfolia.`); window.setTimeout(() => setNotice(""), 3200); }} />}
    </main>
  );
}
