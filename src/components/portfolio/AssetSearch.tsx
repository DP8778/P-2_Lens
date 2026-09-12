import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { assetCatalog, assetTypeLabels, type CatalogAsset } from "@/data/mock/catalog";
import { AssetSearchResult } from "./AssetSearchResult";
export function AssetSearch({
  existingIds,
  onSelect,
}: {
  existingIds: string[];
  onSelect: (asset: CatalogAsset) => void;
}) {
  const [query, setQuery] = useState("");
  const [settled, setSettled] = useState("");
  const [type, setType] = useState("all");
  useEffect(() => {
    const timer = setTimeout(() => setSettled(query), 180);
    return () => clearTimeout(timer);
  }, [query]);
  const loading = query !== settled;
  const results = assetCatalog.filter(
    (a) =>
      (type === "all" || a.type === type) &&
      `${a.symbol} ${a.name}`.toLowerCase().includes(settled.toLowerCase().trim()),
  );
  return (
    <div>
      <label className="search-field">
        <Search size={18} />
        <input
          autoFocus
          aria-label="Hledat ticker nebo aktivum"
          placeholder="Hledat ticker nebo aktivum"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="asset-type-filters">
        <button aria-pressed={type === "all"} onClick={() => setType("all")}>
          Vše
        </button>
        {Object.entries(assetTypeLabels).map(([key, label]) => (
          <button key={key} aria-pressed={type === key} onClick={() => setType(key)}>
            {label}
          </button>
        ))}
      </div>
      <div className="search-results" aria-busy={loading}>
        {loading ? (
          <p role="status" className="search-message">
            Hledám v katalogu…
          </p>
        ) : results.length ? (
          <>
            {!settled && <p className="tertiary">Vyberte aktivum z demo katalogu.</p>}
            {results.map((asset) => (
              <AssetSearchResult
                key={asset.id}
                asset={asset}
                existing={existingIds.includes(asset.id)}
                onSelect={() => onSelect(asset)}
              />
            ))}
          </>
        ) : (
          <p role="status" className="search-message">
            Žádné výsledky. Zkuste jiný ticker nebo typ aktiva.
          </p>
        )}
      </div>
    </div>
  );
}
