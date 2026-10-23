export const marketDataConfig = {
  searchDebounceMs: 300,
  quoteFreshMs: 90_000,
  quotePollMs: 90_000,
  closedQuoteRefreshMs: 10 * 60_000,
  fxFreshMs: 10 * 60_000,
  historyFreshMs: 6 * 60 * 60_000,
  metadataFreshMs: 24 * 60 * 60_000,
  maxSearchResults: 30,
  maxQuoteAssets: 24,
  requestTimeoutMs: 12_000,
} as const;
