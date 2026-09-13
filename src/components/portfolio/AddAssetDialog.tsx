"use client";
import { useState } from "react";
import { Check, ArrowLeft, ArrowRight } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { assetCatalog, MOCK_AS_OF, type CatalogAsset } from "@/data/mock/catalog";
import {
  positionPreview,
  positionSchema,
  toUsd,
  type Holding,
  type HoldingDraft,
  type PositionCurrency,
} from "@/lib/finance/portfolio-engine";
import { money, allocation } from "@/components/charts/chart-formatters";
import { AssetSearch } from "./AssetSearch";
import { usePortfolio } from "./PortfolioProvider";
export function AddAssetDialog({
  onClose,
  initialAssetId,
  edit,
}: {
  onClose: () => void;
  initialAssetId?: string;
  edit?: Holding;
}) {
  const { holdings, save } = usePortfolio();
  const [asset, setAsset] = useState<CatalogAsset | undefined>(
    assetCatalog.find((a) => a.id === (edit?.assetId ?? initialAssetId)),
  );
  const [step, setStep] = useState(edit || initialAssetId ? 2 : 1);
  const [quantity, setQuantity] = useState(edit ? String(edit.quantity) : "");
  const [cost, setCost] = useState(edit ? String(edit.averageCost) : "");
  const [currency, setCurrency] = useState<PositionCurrency>("USD");
  const [date, setDate] = useState(edit?.date ?? MOCK_AS_OF);
  const [fees, setFees] = useState(edit ? String(edit.fees) : "0");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState<HoldingDraft>();
  const existing = holdings.some((p) => p.assetId === asset?.id);
  const number = (value: string) => Number(value.replace(",", "."));
  const preview = draft ? positionPreview(draft, holdings, !!edit) : undefined;
  const validate = () => {
    if (!Number.isFinite(number(quantity)) || number(quantity) <= 0) {
      setError("Množství musí být číslo větší než nula.");
      return;
    }
    if (!Number.isFinite(number(cost)) || number(cost) <= 0) {
      setError("Průměrná cena musí být číslo větší než nula.");
      return;
    }
    if (!Number.isFinite(number(fees)) || number(fees) < 0) {
      setError("Poplatky musí být nezáporné číslo.");
      return;
    }
    const parsed = positionSchema.safeParse({
      assetId: asset?.id,
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
    if (!draft || pending) return;
    setPending(true);
    setError("");
    try {
      await new Promise((resolve) => setTimeout(resolve, 180));
      save(draft, !!edit);
      setStep(4);
    } catch {
      setError(
        "Pozici se nepodařilo uložit. Zkontrolujte, zda prohlížeč povoluje místní úložiště, a zkuste to znovu.",
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <Dialog
      open
      title={step === 4 ? "Pozice uložena" : edit ? "Upravit pozici" : "Přidat aktivum"}
      onClose={pending ? () => {} : onClose}
    >
      <div className="add-asset-flow">
        {step < 4 && (
          <ol className="flow-steps" aria-label="Postup přidání">
            {["Aktivum", "Pozice", "Kontrola"].map((label, i) => (
              <li key={label} aria-current={step === i + 1 ? "step" : undefined}>
                <span>{i + 1}</span>
                {label}
              </li>
            ))}
          </ol>
        )}
        {step === 1 && (
          <AssetSearch
            existingIds={holdings.map((p) => p.assetId)}
            onSelect={(selected) => {
              setAsset(selected);
              setStep(2);
              setError("");
            }}
          />
        )}
        {step === 2 && asset && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              validate();
            }}
            noValidate
          >
            <div className="selected-asset">
              <span className="asset-monogram">{asset.symbol.slice(0, 2)}</span>
              <div>
                <strong>{asset.name}</strong>
                <p className="tertiary">
                  {asset.symbol} · {asset.quoteCurrency}
                </p>
              </div>
            </div>
            {existing && !edit && (
              <p className="inline-notice">
                Aktivum již držíte. Množství přičteme ke stávající pozici a přepočítáme průměrnou
                nákupní cenu.
              </p>
            )}
            <div className="position-fields">
              <label>
                Množství
                <input
                  inputMode="decimal"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0,00"
                  autoFocus
                  aria-invalid={!!error}
                  aria-describedby={error ? "position-error" : undefined}
                />
              </label>
              <label>
                Průměrná nákupní cena
                <input
                  inputMode="decimal"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="Cena za jednotku"
                />
              </label>
              <label>
                Měna nákupu
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as PositionCurrency)}
                >
                  <option>USD</option>
                  <option>CZK</option>
                  <option>EUR</option>
                </select>
              </label>
              <label>
                Datum pozice
                <input
                  type="date"
                  min="1900-01-01"
                  max={MOCK_AS_OF}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label className="full-field">
                Poplatky · {currency}
                <input inputMode="decimal" value={fees} onChange={(e) => setFees(e.target.value)} />
              </label>
            </div>
            {error && (
              <p id="position-error" role="alert" className="form-error">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button
                type="button"
                className="quiet-button"
                onClick={() => {
                  setStep(1);
                  setError("");
                }}
                disabled={!!edit}
              >
                <ArrowLeft size={16} />
                Zpět
              </button>
              <button type="submit" className="primary-button">
                Zkontrolovat pozici
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        )}
        {step === 3 && asset && draft && preview && (
          <div>
            <div className="preview-heading">
              <span className="asset-monogram">{asset.symbol.slice(0, 2)}</span>
              <h3>{asset.name}</h3>
              <p>
                {draft.quantity.toLocaleString("cs-CZ", { maximumFractionDigits: 8 })}{" "}
                {asset.symbol}
              </p>
            </div>
            <dl className="detail-metrics">
              <div>
                <dt>Odhadovaná hodnota {edit ? "pozice" : "přidání"}</dt>
                <dd>{money(preview.value)}</dd>
              </div>
              <div>
                <dt>Alokace aktiva po uložení</dt>
                <dd>{allocation(preview.allocation)}</dd>
              </div>
              <div>
                <dt>Datum pozice</dt>
                <dd>{date}</dd>
              </div>
            </dl>
            <p className="tertiary">
              Ocenění v CZK používá pevné demo kurzy a ceny k 7. 9. 2026. Graf simuluje dnešní
              složení i před datem nákupu.
            </p>
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <div className="dialog-actions">
              <button className="quiet-button" disabled={pending} onClick={() => setStep(2)}>
                <ArrowLeft size={16} />
                Upravit
              </button>
              <button className="primary-button" disabled={pending} onClick={submit}>
                {pending
                  ? "Ukládám…"
                  : edit
                    ? "Uložit změny"
                    : existing
                      ? "Přidat ke stávající pozici"
                      : "Přidat do portfolia"}
              </button>
            </div>
          </div>
        )}
        {step === 4 && (
          <div className="save-success" role="status">
            <span>
              <Check size={28} />
            </span>
            <h3>{asset?.symbol} je v portfoliu</h3>
            <p>Hodnota portfolia, graf i Lens Insight jsou aktualizované.</p>
            <button className="primary-button" onClick={onClose}>
              Zpět do portfolia
            </button>
          </div>
        )}
        {step < 3 && (
          <p className="dialog-footnote">
            Demo katalog · pozice se ukládají pouze v tomto prohlížeči.
          </p>
        )}
      </div>
    </Dialog>
  );
}
