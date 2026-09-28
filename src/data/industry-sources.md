# Legacy curated industry directory

Production Markets now uses the dynamically refreshed, versioned Lens Top 100
snapshot supplied by `src/lib/fundamentals/snapshot-source.ts`. See
[`../lib/fundamentals/README.md`](../lib/fundamentals/README.md) for current sources,
ranking, exclusions, update cadence and financial provenance.

The directory and capitalization file below remain only as compatibility data
for existing compact/legacy consumers and tests. They do not define production
Top 100 membership or its capitalization weights.

This is a Lens editorial selection of US-listed companies across different parts
of each technology theme, not an exhaustive global industry or official index.
The existing four-constituent Lens calculation baskets are unchanged.

Selection references reviewed 2026-09-27:
- AI: https://www.globalxetfs.com/funds/aiq
- Cloud: https://www.globalxetfs.com/funds/clou
- Cybersecurity: https://www.ftportfolios.com/Retail/Etf/EtfHoldings.aspx?Ticker=CIBR
- Nasdaq listing tiers (file timestamp 2026-09-25 21:31): https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt
- Technology listings: https://stockanalysis.com/stocks/sector/technology/

`src/lib/finance/industry-capitalization.json` is a static source snapshot, not
live data or simulated values. Values were parsed from the Technology table's
Market Cap column on 2026-09-27, converting its rounded T/B/M units to USD.
`observedOn` is the retrieval date, not a guaranteed closing-price timestamp.
Missing entries (such as Alphabet in another sector) remain unknown. Never infer
market capitalization from a share price, fund holding value or company name.
Size bands are Lens display thresholds: Large >= USD 10bn; Mid >= USD 2bn and
< USD 10bn; Small < USD 2bn including micro-cap. Filters describe this dated
snapshot, not a live classification. The UI links the source and displays its date.


Nasdaq Q/G/S listing categories map to MIC XNGS/XNGM/XNCM. Company
exchange labels were also checked on their individual Stock Analysis pages.
Listing IDs therefore use the existing Asset Detail and cache identity format.
