"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/getDictionary";
import { marketDataConfig } from "@/lib/market-data/config";
import { searchMarketAssets } from "@/lib/market-data/client";
import { quoteFailureDiagnostic } from "@/lib/market-data/diagnostics";
import { loadQuotePreview } from "@/lib/market-data/service";
import type { MarketAsset, MarketQuote } from "@/lib/market-data/types";

const quoteLabel = (quote: MarketQuote) =>
  quote.marketState === "open" && quote.freshness === "fresh" ? "Aktuální cena" : "Poslední cena";

export function GlobalAssetSearch({ locale }: { locale: Locale }) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [settled, setSettled] = useState("");
  const [results, setResults] = useState<MarketAsset[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [quote, setQuote] = useState<MarketQuote>();
  const [quoteLoading, setQuoteLoading] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(query.trim()), marketDataConfig.searchDebounceMs);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (settled.length < 2) {
      Promise.resolve().then(() => { setResults([]); setLoading(false); setError(""); });
      return;
    }
    const controller = new AbortController();
    void Promise.resolve().then(() => { setLoading(true); setError(""); return searchMarketAssets(settled, controller.signal); })
      .then((assets) => { setResults(assets); setActive(0); setOpen(true); })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setResults([]);
        setError("Hledání je dočasně nedostupné.");
        setOpen(true);
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [settled]);

  const activeAsset = results[active];
  useEffect(() => {
    if (!open || !activeAsset) {
      Promise.resolve().then(() => { setQuote(undefined); setQuoteLoading(false); });
      return;
    }
    const controller = new AbortController();
    void Promise.resolve().then(() => { setQuote(undefined); setQuoteLoading(true); return loadQuotePreview(activeAsset, controller.signal); })
      .then(setQuote)
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        quoteFailureDiagnostic(activeAsset, reason);
        setQuote(undefined);
      })
      .finally(() => { if (!controller.signal.aborted) setQuoteLoading(false); });
    return () => controller.abort();
  }, [activeAsset, open]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  const navigate = (asset: MarketAsset) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(`/${locale}/assets/${encodeURIComponent(asset.id)}`);
  };

  return (
    <div className="global-asset-search" ref={root}>
      <label className="global-search-field">
        <Search size={15} />
        <input
          aria-label="Globální hledání aktiv"
          role="combobox"
          aria-expanded={open && query.trim().length >= 2}
          aria-controls={listId}
          aria-activedescendant={activeAsset ? `${listId}-${active}` : undefined}
          autoComplete="off"
          placeholder="Hledat akcii, ETF…"
          value={query}
          onFocus={() => { if (query.trim().length >= 2) setOpen(true); }}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); if (results.length) setActive((value) => Math.min(results.length - 1, value + 1)); }
            if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(0, value - 1)); }
            if (event.key === "Enter" && activeAsset) { event.preventDefault(); navigate(activeAsset); }
            if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
          }}
        />
        {query && <button type="button" aria-label="Vymazat globální hledání" onClick={() => { setQuery(""); setOpen(false); }}><X size={14} /></button>}
      </label>
      {open && query.trim().length >= 2 && (
        <div className="global-search-results glass" id={listId} role="listbox" aria-label="Globální výsledky hledání">
          {loading && <p role="status">Hledám instrumenty…</p>}
          {error && <p role="alert">{error}</p>}
          {!loading && !error && !results.length && <p role="status">Žádné výsledky.</p>}
          {results.map((asset, index) => {
            const activeResult = index === active;
            const activeQuote = activeResult ? quote : undefined;
            return (
              <button
                type="button"
                role="option"
                aria-selected={activeResult}
                id={`${listId}-${index}`}
                key={asset.id}
                className={activeResult ? "active" : ""}
                onPointerEnter={() => setActive(index)}
                onClick={() => navigate(asset)}
              >
                <span><strong>{asset.symbol}</strong><small>{asset.name}</small></span>
                <span><small>{asset.exchange} · {asset.currency}</small>{activeResult && <b>{quoteLoading ? "Načítám cenu…" : activeQuote ? `${activeQuote.price.toLocaleString(locale, { maximumFractionDigits: 2 })} ${activeQuote.currency}` : "Cena nedostupná"}{activeQuote && <em>{quoteLabel(activeQuote)}</em>}</b>}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
