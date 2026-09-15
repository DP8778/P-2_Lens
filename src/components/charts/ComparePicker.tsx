"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import type { Asset } from "@/lib/finance/domain";
import { marketDataConfig } from "@/lib/market-data/config";
import { searchMarketAssets } from "@/lib/market-data/client";
import type { MarketAsset } from "@/lib/market-data/types";
import { AssetSearchResult } from "@/components/portfolio/AssetSearchResult";
import { rememberMarketAsset } from "@/components/portfolio/AssetSearch";
import { usePortfolio } from "@/components/portfolio/PortfolioProvider";

export function ComparePicker({
  assets,
  selected,
  benchmarkSelected,
  onSelect,
  onSelectBenchmark,
}: {
  assets: Asset[];
  selected: string;
  benchmarkSelected: boolean;
  onSelect: (assetId: string) => void;
  onSelectBenchmark: () => void;
}) {
  const { mode, market, prepareComparison } = usePortfolio();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [settled, setSettled] = useState("");
  const [remote, setRemote] = useState<MarketAsset[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingAsset, setLoadingAsset] = useState("");
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();

  useEffect(() => {
    const timer = window.setTimeout(
      () => setSettled(query.trim()),
      mode === "personal" ? marketDataConfig.searchDebounceMs : 100,
    );
    return () => window.clearTimeout(timer);
  }, [mode, query]);

  useEffect(() => {
    if (!open || mode !== "personal" || settled.length < 2) return;
    const controller = new AbortController();
    void Promise.resolve()
      .then(() => {
        setSearching(true);
        setError("");
        return searchMarketAssets(settled, controller.signal);
      })
      .then((results) => setRemote(results.filter((asset) => !assets.some((held) => held.id === asset.id))))
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError("Vyhledávání na trhu teď není dostupné.");
      })
      .finally(() => setSearching(false));
    return () => controller.abort();
  }, [assets, mode, open, settled]);

  const holdingResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matches = assets.filter(
      (asset) => asset.type !== "cash" &&
        (!normalized || `${asset.symbol} ${asset.name}`.toLowerCase().includes(normalized)),
    );
    return normalized ? matches : matches.slice(0, 5);
  }, [assets, query]);
  const marketResults = mode === "personal" && query.trim().length >= 2 ? remote : [];
  const selectable = [...holdingResults, ...marketResults];
  const selectedAsset = assets.find((asset) => asset.id === selected) ??
    market.comparisonAssets?.find((asset) => asset.id === selected);

  const close = () => {
    setOpen(false);
    setQuery("");
    setSettled("");
    setError("");
  };
  const choose = async (asset: Asset | MarketAsset) => {
    if (assets.some((held) => held.id === asset.id)) {
      onSelect(asset.id);
      close();
      return;
    }
    const external = asset as MarketAsset;
    setLoadingAsset(external.symbol);
    setError("");
    try {
      await prepareComparison(external);
      rememberMarketAsset(external);
      onSelect(external.id);
      close();
    } catch {
      setError("Historii instrumentu se nepodařilo načíst. Zkuste to znovu.");
    } finally {
      setLoadingAsset("");
    }
  };

  return (
    <div className="compare-picker">
      <button className="compare-trigger" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span>Porovnat</span>
        <strong>{selectedAsset?.symbol ?? (benchmarkSelected ? "S&P 500" : "Bez porovnání")}</strong>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="compare-popover glass">
          <div className="compare-popover-heading">
            <strong>Porovnat výkon</strong>
            <button aria-label="Zavřít porovnání" onClick={close}>×</button>
          </div>
          <label className="search-field compare-search-input">
            <Search size={16} />
            <input
              autoFocus
              role="combobox"
              aria-label="Hledat instrument pro porovnání"
              aria-controls={listId}
              aria-expanded={selectable.length > 0}
              aria-autocomplete="list"
              aria-activedescendant={selectable[active] ? `${listId}-${active}` : undefined}
              placeholder="Hledat instrument…"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setActive(0); }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") { event.preventDefault(); setActive((value) => Math.min(selectable.length - 1, value + 1)); }
                if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(0, value - 1)); }
                if (event.key === "Enter" && selectable[active]) { event.preventDefault(); void choose(selectable[active]); }
                if (event.key === "Escape") { event.stopPropagation(); if (query) setQuery(""); else close(); }
              }}
            />
          </label>
          <div id={listId} className="compare-results" role="listbox" aria-label="Instrumenty pro porovnání" aria-busy={searching || !!loadingAsset}>
            {!query && (
              <>
                <p className="compare-group-label">Benchmark</p>
                <button className="compare-benchmark" role="option" aria-selected={benchmarkSelected && !selected} onClick={() => { onSelectBenchmark(); close(); }}>
                  <span>S&P 500</span><small>Výchozí benchmark</small>{benchmarkSelected && !selected && <Check size={14} />}
                </button>
              </>
            )}
            {holdingResults.length > 0 && <p className="compare-group-label">V portfoliu</p>}
            {holdingResults.map((asset, index) => (
              <AssetSearchResult key={asset.id} id={`${listId}-${index}`} asset={asset} active={index === active} existing={false} onSelect={() => void choose(asset)} />
            ))}
            {marketResults.length > 0 && <p className="compare-group-label">Trh</p>}
            {marketResults.map((asset, index) => {
              const activeIndex = holdingResults.length + index;
              return <AssetSearchResult key={asset.id} id={`${listId}-${activeIndex}`} asset={asset} active={activeIndex === active} existing={false} onSelect={() => void choose(asset)} />;
            })}
            {searching && <p role="status" className="compare-loading">Hledám na trhu…</p>}
            {loadingAsset && <p role="status" className="compare-loading">Načítám historii {loadingAsset}… Portfolio zůstává zobrazené.</p>}
            {error && <p role="alert" className="compare-loading">{error}</p>}
            {!searching && query.trim().length >= 2 && !selectable.length && !error && <p role="status" className="compare-loading">Žádný odpovídající instrument.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
