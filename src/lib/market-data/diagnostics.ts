import { MarketDataError } from "./errors";
import type { MarketAsset } from "./types";

export function quoteFailureDiagnostic(asset: MarketAsset, error: unknown) {
  const normalized = error instanceof MarketDataError
    ? error
    : new MarketDataError("UNAVAILABLE", "Quote není dostupný.", true, 503);
  const diagnostic = {
    assetId: asset.id,
    symbol: asset.symbol,
    exchange: asset.exchange,
    micCode: asset.micCode ?? "—",
    currency: asset.currency,
    code: normalized.code,
    httpStatus: normalized.status,
  };
  if (process.env.NODE_ENV === "development") console.error("Market quote failure", diagnostic);
  return diagnostic;
}
