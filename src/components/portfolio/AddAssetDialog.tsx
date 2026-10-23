"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { loadFxQuote, loadQuotes } from "@/lib/market-data/service";
import type { MarketAsset, MarketQuote } from "@/lib/market-data/types";
import { localDateISO } from "@/lib/date/local-date";
import { money } from "@/components/charts/chart-formatters";
import { AssetSearch } from "./AssetSearch";
import { quotePriceLabel } from "./AssetSearchResult";
import { usePortfolio } from "./PortfolioProvider";

const parseQuantity = (value: string) => Number(value.replace(",", "."));
const nativeMoney = (value: number, currency: string) =>
  `${value.toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} ${currency}`;

export function AddAssetDialog({
  onClose,
  initialAssetId,
  initialAsset,
  onSaved,
}: {
  onClose: () => void;
  initialAssetId?: string;
  initialAsset?: MarketAsset;
  onSaved?: (symbol: string) => void;
}) {
  const { holdings, assets, savePersonal } = usePortfolio();
  const [asset, setAsset] = useState<MarketAsset | undefined>(
    initialAsset ?? assets.find((candidate) => candidate.id === initialAssetId),
  );
  const [quantity, setQuantity] = useState("");
  const [quote, setQuote] = useState<MarketQuote>();
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState(false);
  const [fxRate, setFxRate] = useState<number>();
  const [fxLoading, setFxLoading] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const existingHolding = holdings.find((position) => position.assetId === asset?.id);

  useEffect(() => {
    if (!asset) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return [];
      setQuote(undefined);
      setQuoteError(false);
      setQuoteLoading(true);
      return loadQuotes([asset]);
    })
      .then((quotes) => {
        if (cancelled) return;
        const next = quotes[0];
        if (!next || !Number.isFinite(next.price) || next.price <= 0) throw new Error("quote");
        setQuote(next);
      })
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
      setFxLoading(asset.currency !== "CZK");
      return asset.currency === "CZK" ? undefined : loadFxQuote(asset.currency, "CZK");
    })
        .then((fx) => { if (fx && !cancelled) setFxRate(fx.rate); })
        .catch(() => { if (!cancelled) setFxRate(undefined); })
        .finally(() => { if (!cancelled) setFxLoading(false); });
    return () => { cancelled = true; };
  }, [asset]);

  const parsedQuantity = parseQuantity(quantity);
  const validQuantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0;
  const nativeValue = quote && validQuantity ? quote.price * parsedQuantity : undefined;
  const czkValue = nativeValue !== undefined && fxRate !== undefined ? nativeValue * fxRate : undefined;
  const changeClass = (quote?.changePercent ?? 0) >= 0 ? "positive" : "negative";
  const changeLabel = quote?.changePercent === undefined
    ? undefined
    : `${quote.changePercent > 0 ? "+" : ""}${quote.changePercent.toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} % dnes`;

  const submit = async () => {
    if (!asset || !quote || !validQuantity || pending) return;
    setPending(true);
    setError("");
    try {
      await savePersonal(
        asset,
        { assetId: asset.id, quantity: parsedQuantity, averageCost: quote.price, fees: 0, date: localDateISO() },
        false,
        { quote, fxRate },
      );
      onSaved?.(asset.symbol);
      onClose();
    } catch {
      setError("Investici se nepodařilo uložit. Zkuste to znovu.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open wide className={!asset ? "asset-search-dialog" : "simple-add-dialog"} title="Přidat aktivum" onClose={pending ? () => {} : onClose}>
      <div className="add-asset-flow">
        {!asset ? (
          <>
            <h3 className="asset-search-title">Najděte instrument</h3>
            <AssetSearch
              mode="personal"
              existingIds={holdings.map((holding) => holding.assetId)}
              onSelect={(selected) => {
                if (!("provider" in selected)) return;
                setAsset(selected);
                setQuantity("");
                setError("");
              }}
            />
          </>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); void submit(); }} noValidate>
            <button type="button" className="dialog-back" onClick={() => { setAsset(undefined); setQuote(undefined); setQuantity(""); setError(""); }}>
              <ArrowLeft size={15} /> Změnit instrument
            </button>

            <header className="simple-add-asset">
              <div>
                <h3>{asset.name}</h3>
                <p>{asset.symbol} · {asset.exchange} · {asset.currency}</p>
                {existingHolding && <span>V portfoliu · {existingHolding.quantity.toLocaleString("cs-CZ", { maximumFractionDigits: 8 })} ks</span>}
              </div>
              <div className="simple-add-quote" aria-live="polite">
                {quoteLoading ? (
                  <strong>Načítám cenu…</strong>
                ) : quote ? (
                  <>
                    <strong>{nativeMoney(quote.price, quote.currency)}</strong>
                    {changeLabel && <span className={changeClass}>{changeLabel}</span>}
                    <small>{quotePriceLabel(quote)} · aktualizováno {new Date(quote.timestamp).toLocaleString("cs-CZ")}</small>
                  </>
                ) : (
                  <strong className="quote-unavailable">Cena momentálně není dostupná.</strong>
                )}
              </div>
            </header>

            <label className="simple-quantity-field">
              Množství
              <input autoFocus inputMode="decimal" value={quantity} onChange={(event) => { setQuantity(event.target.value); setError(""); }} placeholder="0" aria-invalid={Boolean(quantity) && !validQuantity} />
            </label>

            {quote && validQuantity && (
              <div className="current-purchase-preview" aria-live="polite">
                <strong>{parsedQuantity.toLocaleString("cs-CZ", { maximumFractionDigits: 8 })} × {nativeMoney(quote.price, quote.currency)}</strong>
                <span>{nativeValue === undefined ? "—" : nativeMoney(nativeValue, quote.currency)}</span>
                <b>{fxLoading ? "Přepočítávám do CZK…" : czkValue === undefined ? "Přepočet do CZK není dostupný." : `≈ ${money(czkValue)}`}</b>
              </div>
            )}

            {quoteError && <p className="market-search-error compact" role="alert">Cena momentálně není dostupná.</p>}
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="dialog-actions single-action">
              <button type="submit" className="primary-button" disabled={pending || !quote || !validQuantity}>
                {pending ? "Přidávám aktivum…" : "Přidat do portfolia"}
              </button>
            </div>
          </form>
        )}
      </div>
    </Dialog>
  );
}
