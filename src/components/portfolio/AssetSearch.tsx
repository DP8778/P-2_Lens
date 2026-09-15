import { useEffect, useId, useMemo, useState } from "react";
import { AlertCircle, Search, X } from "lucide-react";
import { assetCatalog, assetTypeLabels, type CatalogAsset } from "@/data/mock/catalog";
import { marketDataConfig } from "@/lib/market-data/config";
import { fetchMarketStatus, searchMarketAssets } from "@/lib/market-data/client";
import { MarketDataError, type MarketDataErrorCode } from "@/lib/market-data/errors";
import type { MarketAsset } from "@/lib/market-data/types";
import type { PortfolioMode } from "./PortfolioProvider";
import { AssetSearchResult } from "./AssetSearchResult";

export type SearchAsset = CatalogAsset | MarketAsset;
type SearchState = "idle" | "loading" | "ready" | "error";
type ProviderState = "checking" | "configured" | "not-configured" | "unavailable";

const recentKey = "lens-recent-market-assets-v1";
const readRecent = (): MarketAsset[] => {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(recentKey) ?? "[]") as MarketAsset[];
  } catch {
    return [];
  }
};

export function rememberMarketAsset(asset: MarketAsset) {
  try {
    localStorage.setItem(
      recentKey,
      JSON.stringify([asset, ...readRecent().filter((item) => item.id !== asset.id)].slice(0, 8)),
    );
  } catch {
    // UX-only cache must never block selection.
  }
}

export function marketSearchErrorMessage(code: MarketDataErrorCode) {
  if (code === "AUTH") return "Přístup k live market datům nebyl autorizován.";
  if (code === "RATE_LIMIT") return "Limit poskytovatele je dočasně vyčerpaný. Zkuste to později.";
  if (code === "INVALID_RESPONSE") return "Poskytovatel vrátil neplatnou odpověď.";
  if (code === "NOT_FOUND" || code === "INVALID_SYMBOL")
    return "Žádné výsledky. Zkuste jiný ticker nebo název.";
  return "Live market data jsou dočasně nedostupná. Zkontrolujte připojení a zkuste to znovu.";
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
  const [state, setState] = useState<SearchState>("idle");
  const [providerState, setProviderState] = useState<ProviderState>(
    mode === "personal" ? "checking" : "configured",
  );
  const [providerName, setProviderName] = useState(mode === "personal" ? "Twelve Data" : "Demo");
  const [errorCode, setErrorCode] = useState<MarketDataErrorCode>();
  const [lastHttpError, setLastHttpError] = useState<number>();
  const [statusAttempt, setStatusAttempt] = useState(0);

  useEffect(() => {
    if (mode !== "personal") return;
    const controller = new AbortController();
    void fetchMarketStatus(controller.signal)
      .then((status) => {
        setProviderName(status.provider === "twelvedata" ? "Twelve Data" : status.provider);
        setProviderState(status.configured ? "configured" : "not-configured");
        setErrorCode(status.configured ? undefined : "AUTH");
        setLastHttpError(undefined);
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        const normalized = reason instanceof MarketDataError
          ? reason
          : new MarketDataError("UNAVAILABLE", "Market data nejsou dostupná.", true, 503);
        setProviderState("unavailable");
        setErrorCode(normalized.code);
        setLastHttpError(normalized.status);
      });
    return () => controller.abort();
  }, [mode, statusAttempt]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setSettled(query.trim()),
      mode === "personal" ? marketDataConfig.searchDebounceMs : 180,
    );
    return () => window.clearTimeout(timer);
  }, [mode, query]);

  useEffect(() => {
    if (mode !== "personal" || providerState !== "configured") return;
    if (settled.length < 2) return;
    const controller = new AbortController();
    void Promise.resolve()
      .then(() => {
        setState("loading");
        setErrorCode(undefined);
        setLastHttpError(undefined);
        return searchMarketAssets(settled, controller.signal);
      })
      .then((assets) => {
        setRemote(assets);
        setActive(0);
        setState("ready");
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        const normalized = reason instanceof MarketDataError
          ? reason
          : new MarketDataError("UNAVAILABLE", "Market data nejsou dostupná.", true, 503);
        setRemote([]);
        setErrorCode(normalized.code);
        setLastHttpError(normalized.status);
        setState("error");
      });
    return () => controller.abort();
  }, [mode, providerState, settled]);

  const availableResults = useMemo<SearchAsset[]>(() =>
    mode === "personal"
      ? query.trim().length < 2
        ? recent
        : remote
      : assetCatalog.filter((asset) =>
          `${asset.symbol} ${asset.name}`.toLowerCase().includes(settled.toLowerCase()),
        ),
  [mode, query, recent, remote, settled]);
  const results = useMemo(
    () => availableResults.filter((asset) => type === "all" || asset.type === type),
    [availableResults, type],
  );
  const loading = providerState === "configured" && (query.trim() !== settled || state === "loading");
  const disabled = mode === "personal" && providerState !== "configured";
  const hasResultsContext = results.length > 0 || loading || (settled.length >= 2 && state === "ready");
  const showFilters = availableResults.length > 0;
  const choose = (asset: SearchAsset) => {
    if (mode === "personal" && "provider" in asset) rememberMarketAsset(asset);
    onSelect(asset);
  };

  const inlineError = providerState === "not-configured"
    ? "Live market data nejsou nakonfigurována."
    : providerState === "unavailable"
      ? marketSearchErrorMessage(errorCode ?? "UNAVAILABLE")
      : state === "error" && errorCode
        ? marketSearchErrorMessage(errorCode)
        : undefined;

  return (
    <div className={`asset-search ${hasResultsContext ? "has-results" : "is-compact"}`}>
      <label className="search-field asset-search-input">
        <Search size={18} />
        <input
          autoFocus={!disabled}
          disabled={disabled}
          role="combobox"
          aria-label="Hledat akcii nebo ETF"
          placeholder={providerState === "checking" ? "Ověřuji live market data…" : "Ticker nebo název instrumentu…"}
          aria-controls={hasResultsContext ? listId : undefined}
          aria-expanded={results.length > 0}
          aria-autocomplete="list"
          aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            if (event.target.value.trim().length < 2) {
              setState("idle");
              setRemote([]);
              setErrorCode(undefined);
              setLastHttpError(undefined);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((value) => Math.min(results.length - 1, value + 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((value) => Math.max(0, value - 1));
            }
            if (event.key === "Enter" && results[active]) {
              event.preventDefault();
              choose(results[active]);
            }
            if (event.key === "Escape" && query) {
              event.stopPropagation();
              setQuery("");
              setSettled("");
              setState("idle");
              setRemote([]);
              setErrorCode(undefined);
              setLastHttpError(undefined);
            }
          }}
        />
        {query && (
          <button
            type="button"
            aria-label="Vymazat hledání"
            onClick={() => {
              setQuery("");
              setSettled("");
            }}
          >
            <X size={15} />
          </button>
        )}
      </label>

      {inlineError && (
        <div className="market-search-error" role="alert">
          <AlertCircle size={16} />
          <div>
            <strong>{inlineError}</strong>
            {providerState === "not-configured" && process.env.NODE_ENV === "development" && (
              <small>TWELVE_DATA_API_KEY chybí v serverovém prostředí. Po doplnění restartujte Next.js.</small>
            )}
          </div>
          {providerState === "unavailable" && (
            <button type="button" onClick={() => {
              setProviderState("checking");
              setStatusAttempt((value) => value + 1);
            }}>Zkusit znovu</button>
          )}
        </div>
      )}

      {!disabled && !query && !recent.length && (
        <p className="asset-search-hint">Začněte tickerem, například AAPL nebo PLTR.</p>
      )}

      {showFilters && (
        <div className="asset-type-filters" aria-label="Typ instrumentu">
          {(["all", "stock", "etf"] as const).map((value) => (
            <button
              key={value}
              aria-pressed={type === value}
              onClick={() => {
                setType(value);
                setActive(0);
              }}
            >
              {value === "all" ? "Vše" : assetTypeLabels[value]}
            </button>
          ))}
        </div>
      )}

      {hasResultsContext && (
        <div className="search-results" id={listId} role="listbox" aria-label="Výsledky hledání" aria-busy={loading}>
          {!query && recent.length > 0 && (
            <div className="search-results-heading">
              <span>Nedávno hledané</span>
              <button onClick={() => { localStorage.removeItem(recentKey); setRecent([]); }}>Vymazat</button>
            </div>
          )}
          {loading && <p role="status" className="search-message search-loading">Hledám instrumenty…</p>}
          {results.map((asset, index) => (
            <AssetSearchResult
              key={asset.id}
              id={`${listId}-${index}`}
              asset={asset}
              active={index === active}
              existing={existingIds.includes(asset.id)}
              onSelect={() => choose(asset)}
            />
          ))}
          {!loading && settled.length >= 2 && state === "ready" && !results.length && (
            <p role="status" className="search-message search-empty">Žádné výsledky. Zkuste jiný ticker nebo název.</p>
          )}
          <span className="sr-only" role="status" aria-live="polite">
            {state === "ready" ? `${results.length} výsledků` : ""}
          </span>
        </div>
      )}

      {process.env.NODE_ENV === "development" && mode === "personal" && (
        <details className="market-search-diagnostics">
          <summary>Dev diagnostics</summary>
          <dl>
            <div><dt>Provider</dt><dd>{providerName}</dd></div>
            <div><dt>Configured</dt><dd>{providerState === "checking" ? "checking" : String(providerState === "configured")}</dd></div>
            <div><dt>Last search status</dt><dd>{state}</dd></div>
            <div><dt>Last HTTP error code</dt><dd>{lastHttpError ?? "—"}</dd></div>
            <div><dt>Normalized error code</dt><dd>{errorCode ?? "—"}</dd></div>
          </dl>
        </details>
      )}
    </div>
  );
}
