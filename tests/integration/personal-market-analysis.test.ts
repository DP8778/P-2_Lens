import { buildAnalysisFromDataset, type Transaction } from "@/lib/finance/portfolio-engine";
import { toLensFacts } from "@/lib/finance/lens-facts";

describe("personal portfolio market integration", () => {
  test("uses historical asset and USD/CZK series for one consistent analysis", () => {
    const assetId = "twelvedata:XNAS:AAPL";
    const spyId = "twelvedata:ARCX:SPY";
    const timeline = ["2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13", "2026-09-14"];
    const transactions: Transaction[] = [
      { id: "funding", type: "deposit", occurredAt: "2026-09-10", amount: 1005, currency: "USD", fee: 0 },
      { id: "buy", type: "buy", occurredAt: "2026-09-10", assetId, quantity: 5, unitPrice: 200, currency: "USD", fee: 5 },
    ];
    const analysis = buildAnalysisFromDataset(
      transactions,
      [0, 4],
      {
        asOf: "2026-09-14",
        timeline,
        assets: [
          { id: assetId, symbol: "AAPL", name: "Apple", type: "stock", currency: "USD", quoteCurrency: "USD", sector: "Technology", exchange: "NASDAQ" },
          { id: spyId, symbol: "SPY", name: "S&P 500", type: "etf", currency: "USD", quoteCurrency: "USD", sector: "ETF", exchange: "NYSE Arca" },
        ],
        prices: [
          { assetId, date: "2026-09-10", close: 200, currency: "USD" },
          { assetId, date: "2026-09-11", close: 205, currency: "USD" },
          { assetId, date: "2026-09-14", close: 210, currency: "USD" },
          { assetId: spyId, date: "2026-09-10", close: 600, currency: "USD" },
          { assetId: spyId, date: "2026-09-11", close: 603, currency: "USD" },
          { assetId: spyId, date: "2026-09-14", close: 606, currency: "USD" },
        ],
        fxRates: [
          { date: "2026-09-10", currency: "USD", czkPerUnit: 22 },
          { date: "2026-09-11", currency: "USD", czkPerUnit: 22.2 },
          { date: "2026-09-14", currency: "USD", czkPerUnit: 22.5 },
        ],
        benchmarks: [{ id: "spy", name: "S&P 500", symbol: "SPY", assetId: spyId, currency: "USD" }],
      },
      "spy",
      undefined,
      undefined,
      "1W",
    );
    expect(analysis.metrics.endValue).toBeCloseTo(23_625);
    expect(analysis.holdings[0].allocationPct).toBeCloseTo(100);
    expect(analysis.points).toHaveLength(timeline.length);
    expect(analysis.points[2].portfolioValue).toBe(analysis.points[1].portfolioValue);
    expect(analysis.contribution.items[0].symbol).toBe("AAPL");
    expect(Object.values(toLensFacts(analysis, "1W")).flat(Infinity).every((value) => typeof value !== "number" || Number.isFinite(value))).toBe(true);
  });

  test("aligns five listings, purchase dates and USD/EUR FX into one analysis", () => {
    const timeline = ["2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13", "2026-09-14"];
    const listings = [
      ["twelvedata:XNAS:AAPL", "AAPL", "Apple", "USD", "NASDAQ", 200, 210, "2026-09-10"],
      ["twelvedata:XNAS:NVDA", "NVDA", "NVIDIA", "USD", "NASDAQ", 120, 130, "2026-09-11"],
      ["twelvedata:ARCX:SPY", "SPY", "SPDR S&P 500 ETF", "USD", "NYSE Arca", 600, 606, "2026-09-10"],
      ["twelvedata:XETR:VWCE", "VWCE", "Vanguard All-World", "EUR", "Xetra", 135, 140, "2026-09-11"],
      ["twelvedata:XNAS:MSFT", "MSFT", "Microsoft", "USD", "NASDAQ", 500, 510, "2026-09-13"],
    ] as const;
    const assets = listings.map(([id, symbol, name, currency, exchange]) => ({
      id, symbol, name, type: symbol === "SPY" || symbol === "VWCE" ? "etf" as const : "stock" as const,
      currency, quoteCurrency: currency, sector: "Market", exchange,
    }));
    const transactions: Transaction[] = listings.flatMap(([id, , , currency, , purchasePrice, , purchaseDate], index) => [
      { id: `fund-${index}`, type: "deposit" as const, occurredAt: purchaseDate, amount: purchasePrice, currency, fee: 0 },
      { id: `buy-${index}`, type: "buy" as const, occurredAt: purchaseDate, assetId: id, quantity: 1, unitPrice: purchasePrice, currency, fee: 0 },
    ]);
    const prices = listings.flatMap(([assetId, , , currency, , purchasePrice, endPrice, purchaseDate]) => [
      { assetId, date: purchaseDate, close: purchasePrice, currency },
      { assetId, date: "2026-09-14", close: endPrice, currency },
    ]);
    const analysis = buildAnalysisFromDataset(transactions, [0, 4], {
      asOf: "2026-09-14",
      timeline,
      assets,
      prices,
      fxRates: [
        { date: "2026-09-10", currency: "USD", czkPerUnit: 22 },
        { date: "2026-09-11", currency: "USD", czkPerUnit: 22.2 },
        { date: "2026-09-14", currency: "USD", czkPerUnit: 22.5 },
        { date: "2026-09-10", currency: "EUR", czkPerUnit: 24.5 },
        { date: "2026-09-14", currency: "EUR", czkPerUnit: 24.8 },
      ],
      benchmarks: [{ id: "spy", name: "S&P 500", symbol: "SPY", assetId: "twelvedata:ARCX:SPY", currency: "USD" }],
    }, "spy", undefined, undefined, "1W");

    expect(analysis.holdings).toHaveLength(5);
    expect(analysis.metrics.endValue).toBeCloseTo(36_232);
    expect(analysis.holdings.reduce((sum, holding) => sum + holding.allocationPct, 0)).toBeCloseTo(100);
    expect(analysis.points[2].portfolioValue).toBe(analysis.points[1].portfolioValue);
    expect(analysis.contribution.items.map((item) => item.symbol)).toEqual(expect.arrayContaining(["AAPL", "NVDA", "SPY", "VWCE", "MSFT"]));
    expect(JSON.stringify(toLensFacts(analysis, "1W"))).not.toContain("null");
  });
});
