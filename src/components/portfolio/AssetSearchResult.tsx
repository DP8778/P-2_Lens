import { ChevronRight } from "lucide-react";
import { assetTypeLabels } from "@/data/mock/catalog";
import type { AssetType } from "@/lib/finance/domain";
export function AssetSearchResult({
  asset,
  existing,
  id,
  active,
  onSelect,
}: {
  asset: {
    id: string;
    symbol: string;
    name: string;
    type: AssetType;
    currency: string;
    exchange?: string;
  };
  existing: boolean;
  id?: string;
  active?: boolean;
  onSelect: () => void;
}) {
  return (
    <button id={id} role="option" aria-selected={active} className={`asset-search-result ${active ? "active" : ""}`} onClick={onSelect}>
      <span className={`asset-monogram ${asset.type}`}>{asset.symbol.slice(0, 2)}</span>
      <span>
        <strong>
          {asset.symbol} <span>{asset.name}</span>
        </strong>
        <small>
          {asset.exchange ? `${asset.exchange} · ` : ""}
          {assetTypeLabels[asset.type]} · {asset.currency}
          {"country" in asset && asset.country ? ` · ${asset.country}` : ""}
          {existing ? " · Již v portfoliu" : ""}
        </small>
      </span>
      <ChevronRight size={16} />
    </button>
  );
}
