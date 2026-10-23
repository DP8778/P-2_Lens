export type MarketDataErrorCode =
  | "RATE_LIMIT"
  | "NOT_FOUND"
  | "UNAVAILABLE"
  | "INVALID_SYMBOL"
  | "AUTH"
  | "NO_HISTORY"
  | "INVALID_RESPONSE";

export class MarketDataError extends Error {
  constructor(
    readonly code: MarketDataErrorCode,
    message: string,
    readonly retryable: boolean,
    readonly status = 502,
  ) {
    super(message);
    this.name = "MarketDataError";
  }
}

export function marketDataErrorResponse(error: unknown) {
  const normalized =
    error instanceof MarketDataError
      ? error
      : new MarketDataError("UNAVAILABLE", "Market data nejsou dočasně dostupná.", true);
  return Response.json(
    { error: { code: normalized.code, message: normalized.message, retryable: normalized.retryable } },
    { status: normalized.status },
  );
}

