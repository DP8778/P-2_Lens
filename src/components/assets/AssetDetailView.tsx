"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import type { Locale } from "@/i18n/getDictionary";
import { AssetPriceChart } from "@/components/charts/AssetPriceChart";
import { AddAssetDialog } from "@/components/portfolio/AddAssetDialog";
import { usePortfolio } from "@/components/portfolio/PortfolioProvider";
import { getPortfolioValue } from "@/lib/finance/portfolio-engine";
import { addLocalDays, localDateISO } from "@/lib/date/local-date";
import { searchMarketAssets } from "@/lib/market-data/client";
import { loadFxQuote, loadHistory, loadQuotePreview } from "@/lib/market-data/service";
import type { MarketAsset, MarketPricePoint, MarketQuote } from "@/lib/market-data/types";
import { allocation, money, percent } from "@/components/charts/chart-formatters";

type AssetRange = "1W" | "1M" | "3M" | "1Y" | "ALL";
const rangeDays: Record<Exclude<AssetRange, "ALL">, number> = { "1W": 7, "1M": 30, "3M": 90, "1Y": 365 };
const typeLabels = { stock: "Akcie", etf: "ETF", crypto: "Kryptoměna", cash: "Hotovost" } as const;
const nativeMoney = (value: number, currency: string, locale: string) =>
  `${value.toLocaleString(locale, { maximumFractionDigits: 2 })} ${currency}`;

export function AssetDetailView({ assetId, locale }: { assetId: string; locale: Locale }) {
  const { assets, holdings, market } = usePortfolio();
  const ownedAsset = assets.find((candidate) => candidate.id === assetId);
  const [resolvedAsset, setResolvedAsset] = useState<MarketAsset>();
  const asset = ownedAsset ?? resolvedAsset;
  const [assetLoading, setAssetLoading] = useState(!ownedAsset);
  const [assetError, setAssetError] = useState(false);
  const [quote, setQuote] = useState<MarketQuote | undefined>(market.quotes.find((candidate) => candidate.assetId === assetId));
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [quoteError, setQuoteError] = useState(false);
  const [fxRate, setFxRate] = useState<number>();
  const [timeframe, setTimeframe] = useState<AssetRange>("1M");
  const [history, setHistory] = useState<MarketPricePoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);
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
      setQuoteLoading(true);
      setQuoteError(false);
      return loadQuotePreview(asset);
    })
      .then((next) => { if (next && !cancelled) setQuote(next); })
      .catch(() => { if (!cancelled) setQuoteError(true); })
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
    const from = timeframe === "ALL" ? "2000-01-01" : addLocalDays(to, -rangeDays[timeframe]);
    void Promise.resolve().then(() => {
      if (cancelled) return undefined;
      setHistoryLoading(true);
      setHistoryError(false);
      return loadHistory(asset, { from, to, interval: "1day" });
    })
      .then((result) => {
        if (!result || cancelled) return;
        setHistory(result.points);
        setHistoryError(result.points.length === 0);
      })
      .catch(() => { if (!cancelled) { setHistory([]); setHistoryError(true); } })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
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
          ) : <strong className="quote-unavailable">Cena momentálně není dostupná.</strong>}
          {quoteError && quote && <small>Aktualizace ceny se nezdařila; zobrazuji poslední dostupnou hodnotu.</small>}
        </div>
      </header>

      <section className="asset-history-section" aria-labelledby="asset-history-title">
        <div className="asset-section-heading">
          <h2 id="asset-history-title">Vývoj ceny</h2>
          <div className="asset-timeframes" aria-label="Období grafu">
            {(["1W", "1M", "3M", "1Y", "ALL"] as const).map((value) => <button key={value} aria-pressed={timeframe === value} onClick={() => setTimeframe(value)}>{value}</button>)}
          </div>
        </div>
        {historyLoading ? <div className="asset-chart-state">Načítám historická data…</div> : historyError ? <div className="asset-chart-state">Historická data momentálně nejsou dostupná.</div> : <AssetPriceChart data={history} currency={asset.currency} locale={locale} />}
      </section>

      <div className="asset-detail-columns">
        {holding && (
          <section className="asset-position-section" aria-labelledby="my-position-title">
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

        <section className="asset-information-section" aria-labelledby="asset-information-title">
          <h2 id="asset-information-title">Informace</h2>
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
        </section>
      </div>

      {notice && <div className="portfolio-toast" role="status">{notice}</div>}
      {addOpen && <AddAssetDialog initialAsset={asset} initialAssetId={asset.id} onClose={() => setAddOpen(false)} onSaved={(symbol) => { setNotice(`${symbol} bylo přidáno do portfolia.`); window.setTimeout(() => setNotice(""), 3200); }} />}
    </main>
  );
}
