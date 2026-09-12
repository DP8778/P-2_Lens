import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import type { HoldingMetric } from "@/lib/finance/portfolio-engine";
import {
  money,
  percent,
  points,
  allocation,
  dateLabel,
} from "@/components/charts/chart-formatters";
import { usePortfolio } from "./PortfolioProvider";
export function HoldingDetail({
  holding: p,
  locale,
  onClose,
  onCompare,
  onEdit,
  onAdd,
}: {
  holding: HoldingMetric;
  locale: string;
  onClose: () => void;
  onCompare: () => void;
  onEdit: () => void;
  onAdd: () => void;
}) {
  const { remove } = usePortfolio();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  return (
    <Dialog open title={p.asset.name} onClose={onClose}>
      <div className="holding-detail">
        <div className="selected-asset">
          <span className="asset-monogram">{p.asset.symbol.slice(0, 2)}</span>
          <span>
            {p.asset.symbol}
            <small className="tertiary block">Pozice od {dateLabel(p.date, locale)}</small>
          </span>
        </div>
        <div className="detail-value">
          <small>Hodnota ve vybraném období</small>
          <strong>{money(p.marketValue, locale)}</strong>
        </div>
        <dl className="detail-metrics">
          <div>
            <dt>Množství</dt>
            <dd>{p.quantity.toLocaleString(locale, { maximumFractionDigits: 8 })}</dd>
          </div>
          <div>
            <dt>Průměrná cena</dt>
            <dd>{money(p.averageCostCzk, locale)}</dd>
          </div>
          <div>
            <dt>P/L včetně poplatků</dt>
            <dd className={p.pnl >= 0 ? "positive" : "negative"}>
              {money(p.pnl, locale)} · {percent(p.pnlPct, locale)}
            </dd>
          </div>
          <div>
            <dt>Alokace</dt>
            <dd>{allocation(p.allocationPct, locale)}</dd>
          </div>
          <div>
            <dt>Příspěvek za období</dt>
            <dd>{points(p.contributionPctPoints, locale)}</dd>
          </div>
        </dl>
        <div className="detail-actions">
          <button className="primary-button" onClick={onCompare}>
            Porovnat v grafu
          </button>
          <button className="quiet-button" onClick={onEdit}>
            Upravit pozici
          </button>
          <button className="quiet-button" onClick={onAdd}>
            Přidat k pozici
          </button>
        </div>
        {confirm ? (
          <div className="remove-confirm">
            <p>Odebrat celou pozici {p.asset.symbol} z tohoto demo portfolia?</p>
            <button
              className="danger-button"
              onClick={() => {
                try {
                  remove(p.assetId);
                  onClose();
                } catch {
                  setError("Pozici nelze odebrat. Místní úložiště není dostupné.");
                }
              }}
            >
              Odebrat pozici
            </button>
            <button className="quiet-button" onClick={() => setConfirm(false)}>
              Zrušit
            </button>
          </div>
        ) : (
          <button className="remove-link" onClick={() => setConfirm(true)}>
            Odebrat z portfolia
          </button>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </Dialog>
  );
}
