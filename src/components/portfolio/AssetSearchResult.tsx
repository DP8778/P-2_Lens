import { assetTypeLabels } from "@/data/mock/catalog";
import type { AssetType } from "@/lib/finance/domain";
import type { MarketQuote } from "@/lib/market-data/types";

export function quotePriceLabel(quote: MarketQuote) {
  if (quote.freshness === "stale" || quote.source === "cache") return "Uložená cena";
  if (quote.marketState === "open" && quote.freshness === "fresh") return "Aktuální cena";
  return "Poslední cena";
}

export function AssetSearchResult({
  asset,
  existing,
  id,
  active,
  quote,
  quoteLoading = false,
  quoteUnavailable = false,
  onActivate,
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
  quote?: MarketQuote;
  quoteLoading?: boolean;
  quoteUnavailable?: boolean;
  onActivate?: () => void;
  onSelect: () => void;
}) {
  return (
    <button
      id={id}
      role="option"
      aria-selected={active}
      className={`asset-search-result ${active ? "active" : ""}`}
      onMouseEnter={onActivate}
      onFocus={onActivate}
      onClick={onSelect}
    >
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
      {active && (quote || quoteLoading || quoteUnavailable) ? (
        <span className={`asset-search-price ${quote?.freshness === "stale" ? "stale" : ""}`}>
          {quoteLoading ? (
            <><strong>Načítám cenu…</strong><small>Jeden aktivní instrument</small></>
          ) : quote ? (
            <><strong>{quote.price.toLocaleString("cs-CZ")} {quote.currency}</strong><small>{quotePriceLabel(quote)}</small></>
          ) : (
            <><strong>Cena nedostupná</strong><small>Instrument lze stále vybrat</small></>
          )}
        </span>
      ) : null}
    </button>
  );
}
