import { ChevronRight } from "lucide-react";
import { assetTypeLabels, type CatalogAsset } from "@/data/mock/catalog";
export function AssetSearchResult({
  asset,
  existing,
  onSelect,
}: {
  asset: CatalogAsset;
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
          {assetTypeLabels[asset.type]}
          {asset.type === "stock" ? " · USA" : ""}
          {existing ? " · Již v portfoliu" : ""}
        </small>
      </span>
      <ChevronRight size={16} />
    </button>
  );
}
