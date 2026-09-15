"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { getPortfolioValue, type HoldingDraft } from "@/lib/finance/portfolio-engine";
import { fetchMarketQuotes } from "@/lib/market-data/client";
import { loadFxQuote } from "@/lib/market-data/service";
import type { MarketAsset, MarketQuote } from "@/lib/market-data/types";
import { allocation, money } from "@/components/charts/chart-formatters";
import { AssetSearch } from "./AssetSearch";
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
  const [currentFx, setCurrentFx] = useState(1);
  const existingHolding = holdings.find((position) => position.assetId === asset?.id);

  useEffect(() => {
    if (!asset) return;
    const controller = new AbortController();
    void Promise.resolve()
      .then(() => {
        setQuoteLoading(true);
        setQuoteError("");
        return Promise.all([
          fetchMarketQuotes([asset], controller.signal).then((quotes) => quotes[0]),
          asset.currency === "CZK"
            ? Promise.resolve({ rate: 1 })
            : loadFxQuote(asset.currency, "CZK"),
        ]);
      })
      .then(([nextQuote, fx]) => {
        if (!nextQuote) throw new Error("Aktuální cena není dostupná.");
        setQuote(nextQuote);
        setCurrentFx(fx.rate);
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setQuoteError("Aktuální cena teď není dostupná.");
      })
      .finally(() => setQuoteLoading(false));
    return () => controller.abort();
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
    const resultingValue = resultingQuantity * quote.price * currentFx;
    const currentValue = getPortfolioValue(holdings, currentDate(), market.prices, market.fxRates);
    const portfolioAfter = currentValue + parsedDraft.quantity * quote.price * currentFx;
    return {
      resultingQuantity,
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
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); void submit(); }} noValidate>
            <button
              type="button"
              className="dialog-back"
              onClick={() => { setAsset(undefined); setQuote(undefined); setError(""); }}
            >
              <ArrowLeft size={15} /> Změnit instrument
            </button>
            <div className="selected-asset">
              <span className="asset-monogram">{asset.symbol.slice(0, 2)}</span>
              <div>
                <strong>{asset.symbol} · {asset.name}</strong>
                <p className="tertiary">{asset.exchange} · {asset.currency}{asset.country ? ` · ${asset.country}` : ""}</p>
              </div>
            </div>
            <div className="instrument-quote" aria-live="polite">
              <span>Aktuální cena</span>
              <strong>{quoteLoading ? "Načítám…" : quote ? `${quote.price.toLocaleString("cs-CZ")} ${quote.currency}` : "Nedostupná"}</strong>
              <small>{quote ? `Aktualizováno ${new Date(quote.timestamp).toLocaleString("cs-CZ")}` : quoteError}</small>
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
            <dl className="inline-investment-preview" aria-label="Náhled investice">
              <div><dt>Odhadovaná současná hodnota</dt><dd>{preview?.value !== undefined ? money(preview.value) : "—"}</dd></div>
              <div><dt>Výsledné množství</dt><dd>{preview ? preview.resultingQuantity.toLocaleString("cs-CZ", { maximumFractionDigits: 8 }) : "—"}</dd></div>
              <div><dt>Předpokládaná alokace</dt><dd>{preview?.allocation !== undefined ? allocation(preview.allocation) : "—"}</dd></div>
            </dl>
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
        <p className="dialog-footnote">Osobní transakce zůstávají pouze v tomto prohlížeči.</p>
      </div>
    </Dialog>
  );
}
