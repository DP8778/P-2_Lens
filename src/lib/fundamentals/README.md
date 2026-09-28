# Verified fundamentals and Lens Top 100

This data layer supplies the existing Industry Index and Financial Anatomy. It
never calls or changes price providers, price routes, price caching or portfolios.
Production routes load the verified snapshot on the server and pass only the
requested statements / industry summaries to their existing client components.
`FundamentalsSource` is the provider-neutral application contract.

## Refresh and persistence

Run `npm run data:refresh` (Node 24, public internet; no API key). The publisher
fetches current sources, parses primitive data without evaluating upstream JS,
checks statement identities, ranks memberships and atomically replaces
`snapshots/current.json`. Immutable membership records live under
`snapshots/memberships/<industry>-<content-hash>.json`. Source timestamps, URLs,
exclusions, current version and the last membership/order rebalance are retained.
Caps/weights update with each snapshot; historical charts backcast the **current**
membership and fixed snapshot weights, not a point-in-time rebalanced index.

Critical listing/membership/cap-source failures abort publication and keep the
previous snapshot. Individual financial failures preserve the prior report and
its original fetchedAt with an error/stale flag. Annual history is merged by
period; unchanged totals retain prior SEC expense/segment details. No financial
value is inferred from stock prices. Missing data never become zero.

`--reuse-downloads` is a local development option using downloads under 24 hours
old in ignored `.cache/lens-source-data`. Production refresh does not use it.
`LENS_DATA_USER_AGENT` optionally configures the source request identification.

`.github/workflows/refresh-industry-data.yml` provides manual and weekday
scheduled refresh, quality checks, and snapshot commits. GitHub schedules run
only after this workflow exists on the default branch. Published changes become
visible after deploying the new snapshot; this is not a live per-page scraper.

## Membership methodology (US-listed scope)

Candidates are rediscovered every refresh:

- AI: current Global X AIQ holdings.
- AI Infrastructure: union of current Global X DTCR and CHPX holdings (data
  infrastructure, compute hardware and quantum ecosystem; themes can overlap).
- Semiconductors: Stock Analysis semiconductor industry classification.
- SaaS/Cloud: current Global X CLOU holdings.
- Cybersecurity: current Global X BUG holdings.

Only supported common-equity US listings verified against Nasdaq Trader's
`nasdaqlisted.txt` / `otherlisted.txt` qualify. Cash, funds, preferred shares,
rights, warrants, unsupported foreign tickers and missing caps are excluded.
Nasdaq tiers determine XNGS/XNGM/XNCM; exchange codes determine XNYS/XASE/ARCX.
Current USD market caps and company names come from Stock Analysis sector tables
(Technology, Communication Services, Consumer Discretionary, Real Estate,
Industrials, Financials). Never use an ETF's holding value as a company cap.
Candidates without a value in these source tables are explicitly excluded.

Sort by descending company cap with symbol tie-break; deduplicate identical
normalized issuer names (share classes); retain at most 100. This is **Lens's
source-defined thematic selection**, not every global company and not an official
index. ETF managers define candidate relevance, Lens defines the cap ranking.
Names are the current cross-feed issuer identifier; unusual differently named
share classes may require a stronger identifier before expanding exchanges.
Do not pad a short universe to 100 with unrelated companies.

Both index weighting modes, breadth, distribution, rankings, market map and
table receive this same membership. Price-history eligibility stays in the
existing index calculator; partial coverage gets an explicit prominent notice.
Membership does not imply that Twelve Data history is available for every member.
No provider credits are spent by this fundamentals/universe publisher.

## Financial sources

- Stock Analysis annual income statements: exact published data arrays (native
  USD units), not rounded display text. TTM is excluded. Revenue, cost of revenue,
  gross profit, opex, operating income, net income and R&D are mapped explicitly.
  Combined SG&A is **not** fabricated into Sales/Marketing and G&A.
- Stock Analysis reported revenue-segment tables, only when the same-period
  segment sum reconciles with consolidated revenue.
- SEC inline XBRL, currently a registered Palantir 2025 10-K enhancement:
  https://www.sec.gov/Archives/edgar/data/1321655/000132165526000011/pltr-20251231.htm
  The parser respects USD units, scales, annual periods and dimensional contexts.
  Its 2023–2025 consolidated figures, Sales & Marketing, R&D, G&A, Government and
  Commercial segments take precedence. Earlier annual years come from Stock
  Analysis. Future years can still flow through the general annual adapter;
  additional primary-source filings can be registered without changing the UI.

Every statement retains its source; segments retain their own source. Non-USD
reports and incomplete/non-reconciling statements remain unavailable. This is
reported accounting revenue/profit, not a cash-flow statement.

Industry revenue sums only available USD annual reports whose fiscal year ends
in the displayed year. Fiscal year-ends differ. YoY compares matched companies
with comparable prior-year annual periods. Both coverage denominators are shown;
no extrapolation to missing companies. Median return and rising percentage use
available price observations; Top 10 concentration uses all membership caps.
