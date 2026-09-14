import { useEffect, useId, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { assetCatalog, assetTypeLabels, type CatalogAsset } from "@/data/mock/catalog";
import { marketDataConfig } from "@/lib/market-data/config";
import { searchMarketAssets } from "@/lib/market-data/client";
import type { MarketAsset } from "@/lib/market-data/types";
import type { PortfolioMode } from "./PortfolioProvider";
import { AssetSearchResult } from "./AssetSearchResult";

export type SearchAsset = CatalogAsset | MarketAsset;
const recentKey = "lens-recent-market-assets-v1";
const readRecent = (): MarketAsset[] => {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(recentKey) ?? "[]") as MarketAsset[]; } catch { return []; }
};
export function rememberMarketAsset(asset: MarketAsset) {
  try { localStorage.setItem(recentKey, JSON.stringify([asset, ...readRecent().filter((item) => item.id !== asset.id)].slice(0, 8))); } catch { /* UX-only cache must never block selection. */ }
}

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
  const listId = useId();
  const [type, setType] = useState<"all" | "stock" | "etf">("all");
  const [remote, setRemote] = useState<MarketAsset[]>([]);
  const [recent, setRecent] = useState<MarketAsset[]>(readRecent);
  const [active, setActive] = useState(0);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(query.trim()), mode === "personal" ? marketDataConfig.searchDebounceMs : 180);
    return () => window.clearTimeout(timer);
  }, [mode, query]);

  useEffect(() => {
    if (mode !== "personal" || settled.length < 2) return;
    const controller = new AbortController();
    void Promise.resolve()
      .then(() => {
        setState("loading");
        setError("");
        return searchMarketAssets(settled, controller.signal);
      })
      .then((assets) => {
        setRemote(assets); setActive(0);
        setState("ready");
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError("Vyhledávání je momentálně nedostupné.");
        setState("error");
      });
    return () => controller.abort();
  }, [mode, settled]);

  const results = useMemo<SearchAsset[]>(() => {
    const source = mode === "personal"
      ? query.trim().length < 2 ? recent : remote
      : assetCatalog.filter((asset) => `${asset.symbol} ${asset.name}`.toLowerCase().includes(settled.toLowerCase()));
    return source.filter((asset) => type === "all" || asset.type === type);
  }, [mode, query, recent, remote, settled, type]);
  const loading = query.trim() !== settled || state === "loading";
  const choose = (asset: SearchAsset) => {
    if (mode === "personal" && "provider" in asset) rememberMarketAsset(asset);
    onSelect(asset);
  };

  return (
    <div className="asset-search">
      <label className="search-field asset-search-input">
        <Search size={18} />
        <input
          autoFocus
          role="combobox"
          aria-label="Hledat akcii nebo ETF"
          placeholder="Hledat akcii nebo ETF…"
          aria-controls={listId}
          aria-expanded={results.length > 0}
          aria-autocomplete="list"
          aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setActive(0); }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") { event.preventDefault(); setActive((value) => Math.min(results.length - 1, value + 1)); }
            if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(0, value - 1)); }
            if (event.key === "Enter" && results[active]) { event.preventDefault(); choose(results[active]); }
            if (event.key === "Escape" && query) { event.stopPropagation(); setQuery(""); setSettled(""); }
          }}
        />
        {query && <button type="button" aria-label="Vymazat hledání" onClick={() => { setQuery(""); setSettled(""); }}><X size={15} /></button>}
      </label>
      <div className="asset-type-filters" aria-label="Typ instrumentu">
        {(["all", "stock", "etf"] as const).map((value) => <button key={value} aria-pressed={type === value} onClick={() => { setType(value); setActive(0); }}>{value === "all" ? "Vše" : assetTypeLabels[value]}</button>)}
      </div>
      <div className="search-results" id={listId} role="listbox" aria-label="Výsledky hledání" aria-busy={loading}>
        {!query && recent.length > 0 && <div className="search-results-heading"><span>Nedávno hledané</span><button onClick={() => { localStorage.removeItem(recentKey); setRecent([]); }}>Vymazat</button></div>}
        {!query && !recent.length && mode === "personal" && <p role="status" className="search-message">Hledejte podle tickeru, názvu společnosti nebo ETF.</p>}
        {loading && <p role="status" className="search-message search-loading">Hledám instrumenty…</p>}
        {state === "error" && settled.length >= 2 && <p role="alert" className="search-message">{error}{remote.length ? " Zobrazuji poslední výsledky." : ""}</p>}
        {!loading && query.trim().length === 1 && <p role="status" className="search-message">Zadejte alespoň 2 znaky.</p>}
        {results.map((asset, index) => <AssetSearchResult key={asset.id} id={`${listId}-${index}`} asset={asset} active={index === active} existing={existingIds.includes(asset.id)} onSelect={() => choose(asset)} />)}
        {!loading && settled.length >= 2 && state === "ready" && !results.length && <p role="status" className="search-message">Žádné výsledky. Zkuste jiný ticker nebo název.</p>}
        <span className="sr-only" role="status" aria-live="polite">{state === "ready" ? `${results.length} výsledků` : ""}</span>
      </div>
    </div>
  );
}
