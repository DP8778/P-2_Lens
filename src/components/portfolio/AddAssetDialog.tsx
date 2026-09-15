"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { getPortfolioValue, type HoldingDraft } from "@/lib/finance/portfolio-engine";
import { loadFxQuote, loadQuotes } from "@/lib/market-data/service";
import type { MarketAsset, MarketQuote } from "@/lib/market-data/types";
import { allocation, money } from "@/components/charts/chart-formatters";
import { AssetSearch } from "./AssetSearch";
import { quotePriceLabel } from "./AssetSearchResult";
import { usePortfolio } from "./PortfolioProvider";

const currentDate = () => new Date().toISOString().slice(0, 10);
const number = (value: string) => Number(value.replace(",", "."));

export function AddAssetDialog({
  onClose,
  initialAssetId,
  onSaved,
}: {
  onClose: () => void;
  initialAssetId?: string;
  onSaved?: (symbol: string) => void;
}) {
  const { holdings, assets, market, savePersonal } = usePortfolio();
  const [asset, setAsset] = useState<MarketAsset | undefined>(
    assets.find((candidate) => candidate.id === initialAssetId),
  );
  const [quantity, setQuantity] = useState("");
  const [cost, setCost] = useState("");
  const [date, setDate] = useState(currentDate());
  const [fees, setFees] = useState("0");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quote, setQuote] = useState<MarketQuote>();
  const [quoteError, setQuoteError] = useState("");
  const [fxLoading, setFxLoading] = useState(false);
  const [fxError, setFxError] = useState("");
  const [currentFx, setCurrentFx] = useState<number>();
  const existingHolding = holdings.find((position) => position.assetId === asset?.id);

  useEffect(() => {
    if (!asset) return;
    let cancelled = false;
    void Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        setQuote(undefined);
        setQuoteLoading(true);
        setQuoteError("");
        return loadQuotes([asset]).then((quotes) => quotes[0]);
      })
      .then((nextQuote) => {
        if (cancelled) return;
        if (!nextQuote) throw new Error("Aktuální cena není dostupná.");
        setQuote(nextQuote);
      })
      .catch(() => {
        if (!cancelled) setQuoteError("Aktuální cena teď není dostupná.");
      })
      .finally(() => { if (!cancelled) setQuoteLoading(false); });
    return () => { cancelled = true; };
  }, [asset]);

  useEffect(() => {
    if (!asset) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setCurrentFx(asset.currency === "CZK" ? 1 : undefined);
      setFxLoading(asset.currency !== "CZK");
      setFxError("");
      if (asset.currency !== "CZK")
        return loadFxQuote(asset.currency, "CZK")
          .then((fx) => { if (!cancelled) setCurrentFx(fx.rate); })
          .catch(() => { if (!cancelled) setFxError("Přepočet do CZK není dostupný."); })
          .finally(() => { if (!cancelled) setFxLoading(false); });
    });
    return () => { cancelled = true; };
  }, [asset]);

  const parsedDraft = useMemo<HoldingDraft | undefined>(() => {
    if (!asset) return undefined;
    const draft = {
      assetId: asset.id,
      quantity: number(quantity),
      averageCost: number(cost),
      fees: number(fees),
      date,
    };
    return Number.isFinite(draft.quantity) && draft.quantity > 0 &&
      Number.isFinite(draft.averageCost) && draft.averageCost > 0 &&
      Number.isFinite(draft.fees) && draft.fees >= 0 &&
      date >= "1900-01-01" && date <= currentDate()
      ? draft
      : undefined;
  }, [asset, cost, date, fees, quantity]);

  const preview = useMemo(() => {
    if (!asset || !parsedDraft) return undefined;
    const resultingQuantity = (existingHolding?.quantity ?? 0) + parsedDraft.quantity;
    if (!quote) return { resultingQuantity };
    const nativeValue = resultingQuantity * quote.price;
    if (currentFx === undefined) return { resultingQuantity, nativeValue };
    const resultingValue = nativeValue * currentFx;
    const currentValue = getPortfolioValue(holdings, currentDate(), market.prices, market.fxRates);
    const portfolioAfter = currentValue + parsedDraft.quantity * quote.price * currentFx;
    return {
      resultingQuantity,
      nativeValue,
      value: resultingValue,
      allocation: portfolioAfter ? (resultingValue / portfolioAfter) * 100 : 100,
    };
  }, [asset, currentFx, existingHolding, holdings, market.fxRates, market.prices, parsedDraft, quote]);

  const submit = async () => {
    if (!asset || pending) return;
    if (!parsedDraft) {
      setError("Zkontrolujte množství, nákupní cenu, datum a poplatek.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await savePersonal(asset, parsedDraft);
      onSaved?.(asset.symbol);
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Investici se nepodařilo přidat. Historická data nejsou dostupná.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open
      wide
      className={!asset ? "asset-search-dialog" : ""}
      title="Přidat investici"
      onClose={pending ? () => {} : onClose}
    >
      <div className="add-asset-flow">
        {!asset ? (
          <>
            <h3 className="asset-search-title">Najděte instrument</h3>
            <AssetSearch
              mode="personal"
              existingIds={holdings.map((holding) => holding.assetId)}
              onSelect={(selected) => {
                if (!("provider" in selected)) return;
                setQuote(undefined);
                setQuoteError("");
                setAsset(selected);
                setError("");
              }}
            />
          </>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); void submit(); }} noValidate>
            <button
              type="button"
              className="dialog-back"
              onClick={() => { setAsset(undefined); setQuote(undefined); setError(""); }}
            >
              <ArrowLeft size={15} /> Změnit instrument
            </button>
            <div className="selected-asset selected-investment-identity">
              <span className="asset-monogram">{asset.symbol.slice(0, 2)}</span>
              <div>
                <strong>{asset.symbol} · {asset.name}</strong>
                <p className="tertiary">{asset.exchange} · {asset.currency}{asset.country ? ` · ${asset.country}` : ""}</p>
              </div>
            </div>
            <div className="instrument-quote" aria-live="polite">
              <span>{quote ? quotePriceLabel(quote) : "Cena instrumentu"}</span>
              <strong>{quoteLoading ? "Načítám…" : quote ? `${quote.price.toLocaleString("cs-CZ")} ${quote.currency}` : "Cena nedostupná"}</strong>
              <small>{quote ? `Aktualizováno ${new Date(quote.timestamp).toLocaleString("cs-CZ")}` : quoteError}</small>
              {quote && asset.currency !== "CZK" && (
                <small className="instrument-quote-fx">
                  {fxLoading
                    ? "Přepočítávám do CZK…"
                    : currentFx !== undefined
                      ? `≈ ${money(quote.price * currentFx)} / akcie`
                      : fxError}
                </small>
              )}
            </div>
            {existingHolding && (
              <p className="inline-notice">
                <strong>{asset.symbol} už máte v portfoliu.</strong>{" "}
                Aktuální množství: {existingHolding.quantity.toLocaleString("cs-CZ", { maximumFractionDigits: 8 })}. Přidáváte další nákup.
              </p>
            )}
            <div className="position-fields">
              <label>Množství<input inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="0,00" autoFocus aria-invalid={!!error} aria-describedby={error ? "position-error" : undefined} /></label>
              <label>Nákupní cena · {asset.currency}<input inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} placeholder="Cena za jednotku" aria-invalid={!!error} aria-describedby={error ? "position-error" : undefined} /></label>
              <label>Datum<input type="date" min="1900-01-01" max={currentDate()} value={date} onChange={(event) => setDate(event.target.value)} aria-invalid={!!error} aria-describedby={error ? "position-error" : undefined} /></label>
              <label>Poplatek · {asset.currency}<input inputMode="decimal" value={fees} onChange={(event) => setFees(event.target.value)} aria-invalid={!!error} aria-describedby={error ? "position-error" : undefined} /></label>
            </div>
            {quote && date === currentDate() && <button type="button" className="use-current-price" onClick={() => setCost(String(quote.price))}>Použít aktuální cenu</button>}
            <section className="inline-investment-preview" aria-label="Náhled investice">
              <h3>Po přidání</h3>
              <dl>
                <div><dt>Hodnota pozice</dt><dd>{preview?.nativeValue !== undefined ? `${preview.nativeValue.toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} ${asset.currency}` : "—"}{preview?.value !== undefined && asset.currency !== "CZK" ? <small>≈ {money(preview.value)}</small> : null}</dd></div>
                <div><dt>Množství</dt><dd>{preview ? preview.resultingQuantity.toLocaleString("cs-CZ", { maximumFractionDigits: 8 }) : "—"}</dd></div>
                <div><dt>Alokace</dt><dd>{preview?.allocation !== undefined ? allocation(preview.allocation) : "—"}</dd></div>
              </dl>
            </section>
            {error && <p id="position-error" role="alert" className="form-error">{error}</p>}
            <div className="dialog-actions single-action">
              <button type="submit" className="primary-button" disabled={pending}>
                {pending
                  ? `Přidávám ${asset.symbol} · načítám historická data…`
                  : existingHolding
                    ? "Přidat další nákup"
                    : "Přidat do portfolia"}
              </button>
            </div>
          </form>
        )}
        {asset && <p className="dialog-footnote">Osobní transakce zůstávají pouze v tomto prohlížeči.</p>}
      </div>
    </Dialog>
  );
}
