import { MarketDataError } from "../errors";

export interface TwelveDataErrorBody {
  status?: string;
  code?: number;
  message?: string;
}

/** Converts provider-specific failures into the stable Lens market-data error contract. */
export function normalizeTwelveDataError(httpStatus: number, body: TwelveDataErrorBody) {
  const status = body.code ?? httpStatus;
  const message = body.message || "Twelve Data request selhal.";
  if (status === 429) return new MarketDataError("RATE_LIMIT", message, true, 429);
  if (status === 401 || status === 403)
    return new MarketDataError("AUTH", message, false, 503);
  if (status === 404) return new MarketDataError("NOT_FOUND", message, false, 404);
  if (status === 400 || /invalid|not found|symbol/i.test(message))
    return new MarketDataError("INVALID_SYMBOL", message, false, 400);
  return new MarketDataError("UNAVAILABLE", message, httpStatus >= 500, 502);
}
