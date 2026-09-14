import { ChevronRight } from "lucide-react";
import { assetTypeLabels } from "@/data/mock/catalog";
import type { AssetType } from "@/lib/finance/domain";
export function AssetSearchResult({
  asset,
  existing,
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
  onSelect: () => void;
}) {
  return (
    <button className="asset-search-result" onClick={onSelect}>
      <span className={`asset-monogram ${asset.type}`}>{asset.symbol.slice(0, 2)}</span>
      <span>
        <strong>
          {asset.symbol} <span>{asset.name}</span>
        </strong>
        <small>
          {asset.exchange ? `${asset.exchange} · ` : ""}
          {assetTypeLabels[asset.type]} · {asset.currency}
          {existing ? " · Již v portfoliu" : ""}
        </small>
      </span>
      <ChevronRight size={16} />
    </button>
  );
}
