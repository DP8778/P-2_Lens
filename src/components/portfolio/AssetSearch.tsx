import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { assetCatalog, assetTypeLabels, type CatalogAsset } from "@/data/mock/catalog";
import { marketDataConfig } from "@/lib/market-data/config";
import { searchMarketAssets } from "@/lib/market-data/client";
import type { MarketAsset } from "@/lib/market-data/types";
import type { PortfolioMode } from "./PortfolioProvider";
import { AssetSearchResult } from "./AssetSearchResult";

export type SearchAsset = CatalogAsset | MarketAsset;

export function AssetSearch({
  mode,
  existingIds,
  onSelect,
}: {
  mode: PortfolioMode;
  existingIds: string[];
  onSelect: (asset: SearchAsset) => void;
}) {
  const [query, setQuery] = useState("");
  const [settled, setSettled] = useState("");
  const [type, setType] = useState("all");
  const [remote, setRemote] = useState<MarketAsset[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(query.trim()), mode === "personal" ? marketDataConfig.searchDebounceMs : 180);
    return () => window.clearTimeout(timer);
  }, [mode, query]);

  useEffect(() => {
    if (mode !== "personal") return;
    if (settled.length < 2) {
      return;
    }
    const controller = new AbortController();
    void Promise.resolve()
      .then(() => {
        setState("loading");
        setError("");
        return searchMarketAssets(settled, controller.signal);
      })
      .then((assets) => {
        setRemote(assets);
        setState("ready");
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setRemote([]);
        setError(reason instanceof Error ? reason.message : "Vyhledávání není dostupné.");
        setState("error");
      });
    return () => controller.abort();
  }, [mode, settled]);

  const demoResults = assetCatalog.filter(
    (asset) =>
      (type === "all" || asset.type === type) &&
      `${asset.symbol} ${asset.name}`.toLowerCase().includes(settled.toLowerCase()),
  );
  const results: SearchAsset[] = (mode === "personal" ? remote : demoResults).filter(
    (asset) => type === "all" || asset.type === type,
  );
  const loading = query.trim() !== settled || state === "loading";

  return (
    <div>
      <label className="search-field">
        <Search size={18} />
        <input
          autoFocus
          aria-label={mode === "personal" ? "Hledat akcii nebo ETF" : "Hledat ticker nebo aktivum"}
          placeholder={mode === "personal" ? "Hledat akcii nebo ETF" : "Hledat ticker nebo aktivum"}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="asset-type-filters">
        <button aria-pressed={type === "all"} onClick={() => setType("all")}>Vše</button>
        {Object.entries(assetTypeLabels)
          .filter(([key]) => mode === "demo" || key === "stock" || key === "etf")
          .map(([key, label]) => (
            <button key={key} aria-pressed={type === key} onClick={() => setType(key)}>{label}</button>
          ))}
      </div>
      <div className="search-results" aria-busy={loading}>
        {mode === "personal" && settled.length < 2 && !loading ? (
          <p role="status" className="search-message">Zadejte alespoň 2 znaky. Hledáme přímo v universe Twelve Data.</p>
        ) : loading ? (
          <p role="status" className="search-message">Hledám aktiva…</p>
        ) : state === "error" ? (
          <p role="alert" className="search-message">{error}</p>
        ) : results.length ? (
          <>
            {mode === "demo" && !settled && <p className="tertiary">Vyberte aktivum z demo katalogu.</p>}
            {results.map((asset) => (
              <AssetSearchResult key={asset.id} asset={asset} existing={existingIds.includes(asset.id)} onSelect={() => onSelect(asset)} />
            ))}
          </>
        ) : (
          <p role="status" className="search-message">Žádné výsledky. Zkuste jiný ticker nebo název.</p>
        )}
      </div>
    </div>
  );
}
