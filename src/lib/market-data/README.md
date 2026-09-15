# Lens market data layer

## Boundaries

User data and market data are separate stores. Personal assets and transactions use the versioned
`lens-personal-portfolio-v1` localStorage record. Quotes, daily history and FX history use the
`lens-market-data-v1` IndexedDB database. Clearing the market cache never deletes transactions.
The deterministic `lens-demo-2026.09-v2` dataset does not consume live prices and remains the
offline test fixture and fallback.

The browser only calls Lens `/api/market/*` routes. `TwelveDataProvider` and its API key are
server-only. Provider responses are normalized to `MarketAsset`, `MarketQuote`,
`MarketPricePoint`, `FxQuote` and `FxRatePoint` before crossing the route boundary. The finance
engine receives only normalized assets, prices and CZK-per-unit FX rates; it has no Twelve Data
dependency.

`GET /api/market/status` is the browser-safe configuration probe. A missing or whitespace-only
`TWELVE_DATA_API_KEY` returns `configured: false`; the key value is never returned or logged.
Search errors retain the normalized `AUTH`, `RATE_LIMIT`, `UNAVAILABLE`, `INVALID_RESPONSE`,
`INVALID_SYMBOL` or `NOT_FOUND` code across the route boundary. `npm run test:market-live` is the
only opt-in real-provider smoke path and skips cleanly when the server-side key is absent.

## Asset identity and discovery

An asset ID is `provider:MIC:symbol`, falling back to exchange when MIC is absent. A ticker is not
a global ID, so identical symbols on different exchanges remain distinct positions. Symbol search
is requested on demand after two characters, debounced by 300 ms and cancelled when a newer query
starts. Only Common Stock, ETF and Digital Currency results are normalized; the primary UI filters
to stocks and ETFs. Exact symbol/name matches are promoted while preserving provider relevance.
The complete provider universe is never bundled into React.

## Quotes and freshness

The dashboard sends one batch quote request for held instruments and the benchmark. Quotes are
fresh for roughly 90 seconds and refresh every 90 seconds while the page is visible. Polling pauses
for hidden tabs. Focus/visibility return triggers refresh only when stale. On 429, timeout or
temporary provider failure, a cached quote is returned as `stale`; without cache it becomes
`unavailable`. `open`, `closed` and `unknown` market states are shown without claiming all prices
are realtime.

## Daily history and cache

Adding a position backfills `1day` history from its purchase date through today. IndexedDB records
store provider, coverage, points, update time and schema version. Requests fetch missing leading or
trailing ranges and merge by date without duplicates; a stale recent tail is refreshed. A current
open-market quote replaces the same calendar date instead of creating a duplicate. A closed-market
quote remains the latest known close.

Different market calendars are aligned to a calendar-day portfolio timeline. Valuation carries the
last known valid close forward across weekends and holidays. Because consecutive carried prices are
equal, contribution creates no artificial market move on a closed day. Missing prices are surfaced
in `PortfolioAnalysis`; a new position is not persisted if its required historical backfill fails.

## FX convention

Every internal FX rate means: how many CZK (`quote`) one unit of the asset currency (`base`) costs.
Thus USD/CZK 22.40 means 1 USD = 22.40 CZK. Direct pairs are preferred; if only the inverse pair is
available it is validated and inverted. Currencies share one cached series, so five USD assets do
not create five FX requests. Historical valuations use the rate for that date, never today's rate.

## Financial scope

Twelve Data daily equity/ETF prices are split-adjusted. The current transaction model does not
adjust pre-split quantities, so portfolios spanning a split require a future split-aware transaction
normalizer. This is a known **P0 correctness limitation**: an unsplit historical quantity combined
with a split-adjusted price understates post-split units and value. It requires explicit corporate
action factors rather than a price heuristic and is therefore documented and regression-tracked,
not silently approximated. Performance is price-based plus user-recorded cash flows,
not dividend total return. Dividends are not inferred. Deposits/withdrawals remain external flows,
so they do not create synthetic investment return.

## Serverless behavior

Correctness does not depend on persistent server memory. Route handlers are uncached request-time
boundaries and the durable per-browser history cache is IndexedDB. Concurrent client quote requests
for the same asset set are deduplicated, but that short-lived promise map is only an optimization.
