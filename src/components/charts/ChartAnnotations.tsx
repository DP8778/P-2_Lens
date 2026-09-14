import { useState } from "react";
import { assetCatalog } from "@/data/mock/catalog";
import type { TransactionAnnotation } from "@/lib/chart/chart-series";
import type { Asset } from "@/lib/finance/domain";
import { dateLabel } from "./chart-formatters";

export function ChartAnnotations({
  events,
  onSelect,
  assets = assetCatalog,
}: {
  events: TransactionAnnotation[];
  onSelect: (index: number) => void;
  assets?: Asset[];
}) {
  const [openId, setOpenId] = useState<string>();
  const visible = events.slice(-6);
  if (!visible.length) return null;
  const open = visible.find((event) => event.id === openId);
  const asset = open ? assets.find((candidate) => candidate.id === open.assetId) : undefined;
  return (
    <div className="chart-annotations" aria-label="Transakce ve vybraném období">
      <div className="annotation-buttons">
        {visible.map((event) => {
          const symbol =
            assets.find((candidate) => candidate.id === event.assetId)?.symbol ??
            event.assetId;
          return (
            <button
              key={event.id}
              aria-expanded={openId === event.id}
              onClick={() => {
                setOpenId(openId === event.id ? undefined : event.id);
                onSelect(event.index);
              }}
            >
              <span className={`event-marker ${event.type}`}>
                {event.type === "buy" ? "+" : "−"}
              </span>
              {event.type.toUpperCase()} {symbol}
            </button>
          );
        })}
      </div>
      {open && (
        <div className="annotation-popover glass" role="status">
          <strong>
            {open.type.toUpperCase()} {asset?.symbol ?? open.assetId}
          </strong>
          <span>{dateLabel(`${open.date}T12:00:00.000Z`)}</span>
          <p>
            {open.quantity.toLocaleString("cs-CZ", { maximumFractionDigits: 8 })} {asset?.symbol}
          </p>
          <small>
            {open.unitPrice.toLocaleString("cs-CZ")} {open.currency} za jednotku
          </small>
        </div>
      )}
    </div>
  );
}
