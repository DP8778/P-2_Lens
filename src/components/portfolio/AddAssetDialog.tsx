"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { assetCatalog, MOCK_AS_OF } from "@/data/mock/catalog";
import {
  getPortfolioValue,
  positionPreview,
  positionSchema,
  toUsd,
  type Holding,
  type HoldingDraft,
  type PositionCurrency,
} from "@/lib/finance/portfolio-engine";
import { fetchMarketQuotes } from "@/lib/market-data/client";
import { loadFxQuote } from "@/lib/market-data/service";
import type { MarketAsset, MarketQuote } from "@/lib/market-data/types";
import { money, allocation } from "@/components/charts/chart-formatters";
import { AssetSearch, type SearchAsset } from "./AssetSearch";
import { usePortfolio } from "./PortfolioProvider";

const isMarketAsset = (asset: SearchAsset): asset is MarketAsset => "provider" in asset;
const currentDate = () => new Date().toISOString().slice(0, 10);

export function AddAssetDialog({
  onClose,
  initialAssetId,
  edit,
  onSaved,
}: {
  onClose: () => void;
  initialAssetId?: string;
  edit?: Holding;
  onSaved?: (symbol: string) => void;
}) {
  const { mode, holdings, assets, market, save, savePersonal } = usePortfolio();
  const initial =
    mode === "personal"
      ? assets.find((asset) => asset.id === (edit?.assetId ?? initialAssetId))
      : assetCatalog.find((asset) => asset.id === (edit?.assetId ?? initialAssetId));
  const [asset, setAsset] = useState<SearchAsset | undefined>(initial);
  const [step, setStep] = useState(edit || initialAssetId ? 2 : 1);
  const [quantity, setQuantity] = useState(edit ? String(edit.quantity) : "");
  const [cost, setCost] = useState(edit ? String(edit.averageCost) : "");
  const [currency, setCurrency] = useState<PositionCurrency>(
    (initial?.currency as PositionCurrency | undefined) ?? "USD",
  );
  const [date, setDate] = useState(edit?.date ?? (mode === "personal" ? currentDate() : MOCK_AS_OF));
  const [fees, setFees] = useState(edit ? String(edit.fees) : "0");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quote, setQuote] = useState<MarketQuote>();
  const [currentFx, setCurrentFx] = useState(1);
  const [draft, setDraft] = useState<HoldingDraft>();
  const existingHolding = holdings.find((position) => position.assetId === asset?.id);
  const existing = Boolean(existingHolding);
  const number = (value: string) => Number(value.replace(",", "."));

  useEffect(() => {
    if (mode !== "personal" || !asset || !isMarketAsset(asset)) return;
    const controller = new AbortController();
    void Promise.resolve()
      .then(() => {
        setQuoteLoading(true);
        setError("");
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
        setError(reason instanceof Error ? reason.message : "Aktuální cena není dostupná.");
      })
      .finally(() => setQuoteLoading(false));
    return () => controller.abort();
  }, [asset, mode]);

  const preview = useMemo(() => {
    if (!draft) return undefined;
    if (mode === "demo") return positionPreview(draft, holdings, !!edit);
    if (!quote) return undefined;
    const value = draft.quantity * quote.price * currentFx;
    const currentValue = getPortfolioValue(holdings, currentDate(), market.prices, market.fxRates);
    const previousValue = edit
      ? 0
      : holdings
          .filter((holding) => holding.assetId === draft.assetId)
          .reduce(
            (sum, holding) =>
              sum + getPortfolioValue([holding], currentDate(), market.prices, market.fxRates),
            0,
          );
    return {
      value,
      allocation: currentValue + value ? ((value + previousValue) / (currentValue + value)) * 100 : 100,
    };
  }, [currentFx, draft, edit, holdings, market.fxRates, market.prices, mode, quote]);

  const validate = () => {
    if (!asset) return;
    if (!Number.isFinite(number(quantity)) || number(quantity) <= 0) {
      setError("Množství musí být číslo větší než nula.");
      return;
    }
    if (!Number.isFinite(number(cost)) || number(cost) <= 0) {
      setError("Nákupní cena musí být číslo větší než nula.");
      return;
    }
    if (!Number.isFinite(number(fees)) || number(fees) < 0) {
      setError("Poplatky musí být nezáporné číslo.");
      return;
    }
    if (mode === "personal") {
      if (!quote) {
        setError("Aktuální cena není dostupná. Zkuste načtení znovu.");
        return;
      }
      if (date > currentDate() || date < "1900-01-01") {
        setError("Zkontrolujte datum pozice.");
        return;
      }
      setDraft({ assetId: asset.id, quantity: number(quantity), averageCost: number(cost), fees: number(fees), date });
      setError("");
      setStep(3);
      return;
    }
    const parsed = positionSchema.safeParse({
      assetId: asset.id,
      quantity: number(quantity),
      averageCost: toUsd(number(cost), currency),
      fees: toUsd(number(fees), currency),
      date,
    });
    if (!parsed.success) {
      setError("Zkontrolujte datum a velikost pozice. Datum nesmí být po 7. 9. 2026.");
      return;
    }
    setError("");
    setDraft(parsed.data);
    setStep(3);
  };

  const submit = async () => {
    if (!draft || !asset || pending) return;
    setPending(true);
    setError("");
    try {
      if (mode === "personal") {
        if (!isMarketAsset(asset)) throw new Error("Neplatné live aktivum.");
        await savePersonal(asset, draft, !!edit);
      } else {
        save(draft, !!edit);
      }
      onSaved?.(asset.symbol);
      onClose();
    } catch (reason) {
      setError(
        mode === "demo"
          ? "Pozici se nepodařilo uložit. Zkontrolujte, zda prohlížeč povoluje místní úložiště, a zkuste to znovu."
          : reason instanceof Error
          ? reason.message
          : "Pozici se nepodařilo uložit. Historická data se nepodařilo načíst.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open wide title={edit ? "Upravit investici" : "Přidat investici"} onClose={pending ? () => {} : onClose}>
      <div className="add-asset-flow">
        {step < 4 && (
          <ol className="flow-steps" aria-label="Postup přidání">
            {["Instrument", "Transakce", "Kontrola"].map((label, index) => (
              <li key={label} aria-current={step === index + 1 ? "step" : undefined}><span>{index + 1}</span>{label}</li>
            ))}
          </ol>
        )}
        {step === 1 && (
          <AssetSearch
            mode={mode}
            existingIds={holdings.map((holding) => holding.assetId)}
            onSelect={(selected) => {
              setAsset(selected);
              setCurrency(selected.currency as PositionCurrency);
              setStep(2);
              setError("");
            }}
          />
        )}
        {step === 2 && asset && (
          <form onSubmit={(event) => { event.preventDefault(); validate(); }} noValidate>
            <div className="selected-asset">
              <span className="asset-monogram">{asset.symbol.slice(0, 2)}</span>
              <div>
                <strong>{asset.name}</strong>
                <p className="tertiary">{asset.symbol} · {asset.exchange ?? "Market"} · {asset.currency}</p>
              </div>
            </div>
            {mode === "personal" && (
              <dl className="live-quote-preview" aria-live="polite">
                <div><dt>Aktuální cena</dt><dd>{quoteLoading ? "Načítám…" : quote ? `${quote.price.toLocaleString("cs-CZ")} ${quote.currency}` : "Nedostupná"}</dd></div>
                <div><dt>Aktualizováno</dt><dd>{quote ? new Date(quote.timestamp).toLocaleString("cs-CZ") : "—"}</dd></div>
                <div><dt>Stav trhu</dt><dd>{quote?.marketState === "open" ? "Trh otevřen" : quote?.marketState === "closed" ? "Trh zavřen" : "Neznámý"}</dd></div>
              </dl>
            )}
            {existing && !edit && <p className="inline-notice"><strong>{asset.symbol} už je ve vašem portfoliu.</strong> Současná pozice: {existingHolding?.quantity.toLocaleString("cs-CZ", { maximumFractionDigits: 8 })} ks. Přidáte další nákup ke stejné pozici.</p>}
            <div className="position-fields">
              <label>Množství<input inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="0,00" autoFocus aria-invalid={!!error} aria-describedby={error ? "position-error" : undefined} /></label>
              <label>{mode === "demo" ? "Průměrná nákupní cena" : "Nákupní cena"}<input inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} placeholder="Cena za jednotku" aria-invalid={!!error} aria-describedby={error ? "position-error" : undefined} /></label>
              <label>Měna nákupu<select value={currency} disabled={mode === "personal"} onChange={(event) => setCurrency(event.target.value as PositionCurrency)}><option>USD</option><option>CZK</option><option>EUR</option>{mode === "personal" && !["USD", "CZK", "EUR"].includes(currency) && <option>{currency}</option>}</select></label>
              <label>Datum nákupu<input type="date" min="1900-01-01" max={mode === "personal" ? currentDate() : MOCK_AS_OF} value={date} onChange={(event) => setDate(event.target.value)} aria-invalid={!!error} aria-describedby={error ? "position-error" : undefined} /></label>
              <label className="full-field">Poplatky · {currency}<input inputMode="decimal" value={fees} onChange={(event) => setFees(event.target.value)} aria-invalid={!!error} aria-describedby={error ? "position-error" : undefined} /></label>
            </div>
            {mode === "personal" && quote && date === currentDate() && <button type="button" className="use-current-price" onClick={() => setCost(String(quote.price))}>Použít aktuální cenu</button>}
            {error && <p id="position-error" role="alert" className="form-error">{error}</p>}
            <div className="dialog-actions">
              <button type="button" className="quiet-button" onClick={() => { setStep(1); setError(""); }} disabled={!!edit}><ArrowLeft size={16} />Zpět</button>
              <button type="submit" className="primary-button" disabled={quoteLoading}>Zkontrolovat investici<ArrowRight size={16} /></button>
            </div>
          </form>
        )}
        {step === 3 && asset && draft && preview && (
          <div>
            <div className="preview-heading"><span className="asset-monogram">{asset.symbol.slice(0, 2)}</span><h3>{asset.name}</h3><p>{draft.quantity.toLocaleString("cs-CZ", { maximumFractionDigits: 8 })} {asset.symbol}</p></div>
            <dl className="detail-metrics">
              <div><dt>{mode === "demo" ? `Odhadovaná hodnota ${edit ? "pozice" : "přidání"}` : "Odhadovaná současná hodnota"}</dt><dd>{money(preview.value)}</dd></div>
              <div><dt>{mode === "demo" ? "Alokace aktiva po uložení" : "Projektovaná alokace"}</dt><dd>{allocation(preview.allocation)}</dd></div>
              <div><dt>Nákupní cena</dt><dd>{number(cost).toLocaleString("cs-CZ")} {currency}</dd></div>
              <div><dt>Datum nákupu</dt><dd>{date}</dd></div>
              <div><dt>Poplatek</dt><dd>{number(fees).toLocaleString("cs-CZ")} {currency}</dd></div>
            </dl>
            <p className="tertiary">{mode === "personal" ? "Před uložením načteme denní historii aktiva a odpovídající historický kurz do CZK." : "Ocenění používá deterministické demo ceny a kurzy."}</p>
            {error && <p role="alert" className="form-error">{error}</p>}
            <div className="dialog-actions">
              <button className="quiet-button" disabled={pending} onClick={() => setStep(2)}><ArrowLeft size={16} />Upravit</button>
              <button className="primary-button" disabled={pending} onClick={submit}>{pending ? `Přidávám ${asset.symbol} · načítám historická data…` : edit ? "Uložit změny" : existing ? "Přidat další nákup" : "Přidat do portfolia"}</button>
            </div>
          </div>
        )}
        {step < 3 && <p className="dialog-footnote">{mode === "personal" ? "Twelve Data · osobní transakce zůstávají pouze v tomto prohlížeči." : "Demo katalog · pozice se ukládají pouze v tomto prohlížeči."}</p>}
      </div>
    </Dialog>
  );
}
