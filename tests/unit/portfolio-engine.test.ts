import {
  buildAnalysis,
  buildHoldings,
  buildSnapshot,
  getAllocation,
  getBenchmarkDelta,
  getBenchmarkReturn,
  getConcentrationAnalysis,
  getContributionAnalysis,
  getDrawdownAnalysis,
  getLargestPosition,
  getMaxDrawdown,
  getPortfolioSeries,
  getPortfolioValue,
  initialTransactions,
  mockFx,
  normalizeSeriesToBase100,
  timeline,
  timeframeRange,
  transactionsSchema,
  type Transaction,
} from "@/lib/finance/portfolio-engine";
import { demoPriceFor, portfolioDataset } from "@/data/mock/portfolioDataset";
import { toLensFacts } from "@/lib/finance/lens-facts";
import type { Timeframe } from "@/types/finance";

const transactions: Transaction[] = [
  {
    id: "deposit",
    type: "deposit",
    occurredAt: "2026-01-01",
    amount: 100_000,
    currency: "CZK",
    fee: 0,
  },
  {
    id: "buy-1",
    type: "buy",
    occurredAt: "2026-01-02",
    assetId: "aapl",
    quantity: 10,
    unitPrice: 200,
    currency: "USD",
    fee: 5,
  },
  {
    id: "buy-2",
    type: "buy",
    occurredAt: "2026-02-02",
    assetId: "aapl",
    quantity: 5,
    unitPrice: 260,
    currency: "USD",
    fee: 2,
  },
  {
    id: "sell",
    type: "sell",
    occurredAt: "2026-03-02",
    assetId: "aapl",
    quantity: 3,
    unitPrice: 250,
    currency: "USD",
    fee: 1,
  },
];

describe("jednotná finanční doména", () => {
  test("odvozuje množství a průměrnou cenu z nákupů a prodejů", () => {
    const holding = buildHoldings(transactions).find((row) => row.assetId === "aapl")!;
    expect(holding.quantity).toBe(12);
    expect(holding.averageCost).toBeCloseTo(220);
    expect(holding.totalCostCzk).toBeGreaterThan(0);
  });

  test("oceňuje pozici poslední známou cenou a pevným FX kurzem", () => {
    const holding = buildHoldings(transactions).find((row) => row.assetId === "aapl")!;
    const prices = [{ assetId: "aapl", date: "2026-09-01", close: 300, currency: "USD" as const }];
    const rates = [{ date: "2026-09-01", currency: "USD" as const, czkPerUnit: 20 }];
    expect(getPortfolioValue([holding], "2026-09-07", prices, rates)).toBe(72_000);
  });

  test.each<Timeframe>(["1W", "1M", "3M", "YTD", "1Y", "ALL"])(
    "sjednocuje hodnotu, výnos, alokaci a benchmark pro %s",
    (timeframe) => {
      const analysis = buildAnalysis(initialTransactions, timeframeRange(timeframe), "spy", "btc");
      expect(analysis.holdings.reduce((sum, row) => sum + row.marketValue, 0)).toBeCloseTo(
        analysis.metrics.endValue,
        6,
      );
      expect(analysis.allocation.reduce((sum, row) => sum + row.percentage, 0)).toBeCloseTo(100, 8);
      expect(
        analysis.contribution.items.reduce((sum, row) => sum + row.contributionPctPoints, 0) +
          analysis.contribution.residual,
      ).toBeCloseTo(analysis.metrics.returnPct, 8);
      expect(analysis.metrics.benchmarkDeltaPct).toBeCloseTo(
        analysis.metrics.returnPct - analysis.metrics.benchmarkReturnPct,
      );
      expect(analysis.metrics.maxDrawdownPct).toBeCloseTo(
        Math.min(...analysis.points.map((point) => point.drawdown)),
      );
      expect(analysis.points[0].portfolioIndex).toBe(100);
      expect(analysis.points[0].benchmarkIndex).toBe(100);
    },
  );

  test("normalizuje řady na společný základ 100", () => {
    expect(
      normalizeSeriesToBase100([{ value: 50 }, { value: 75 }]).map((point) => point.normalized),
    ).toEqual([100, 150]);
    expect(normalizeSeriesToBase100([])).toEqual([]);
  });

  test("počítá benchmark return a delta ze stejné normalizované řady", () => {
    const benchmark = normalizeSeriesToBase100([{ value: 200 }, { value: 212 }]);
    expect(getBenchmarkReturn(benchmark)).toBeCloseTo(6);
    expect(getBenchmarkDelta(9.5, getBenchmarkReturn(benchmark))).toBeCloseTo(3.5);
  });

  test("počítá maximální peak-to-trough drawdown", () => {
    expect(getMaxDrawdown([100, 120, 90, 110])).toBe(-25);
  });

  test("vrací drawdown řadu, maximum a dokončenou obnovu", () => {
    const result = getDrawdownAnalysis([
      { date: "2026-01-01T12:00:00.000Z", value: 100, returnPct: 0 },
      { date: "2026-01-02T12:00:00.000Z", value: 120, returnPct: 20 },
      { date: "2026-01-03T12:00:00.000Z", value: 90, returnPct: -10 },
      { date: "2026-01-04T12:00:00.000Z", value: 121, returnPct: 21 },
    ]);
    expect(result.series.map((point) => point.drawdownPct)).toEqual([0, 0, -25, 0]);
    expect(result.maxDrawdown).toBe(-25);
    expect(result.peak?.date).toContain("01-02");
    expect(result.trough?.date).toContain("01-03");
    expect(result.recovery?.date).toContain("01-04");
    expect(result.status).toBe("recovered");
  });

  test("rozlišuje období bez poklesu a neobnovený pokles", () => {
    expect(
      getDrawdownAnalysis([
        { date: "2026-01-01", value: 100, returnPct: 0 },
        { date: "2026-01-02", value: 105, returnPct: 5 },
      ]).status,
    ).toBe("no-drawdown");
    const open = getDrawdownAnalysis([
      { date: "2026-01-01", value: 100, returnPct: 0 },
      { date: "2026-01-02", value: 80, returnPct: -20 },
    ]);
    expect(open.status).toBe("unrecovered");
    expect(open.recovery).toBeUndefined();
  });

  test("atribuuje kladné i záporné příspěvky a ponechá explicitní residual", () => {
    const analysis = buildAnalysis(initialTransactions, timeframeRange("3M"));
    expect(analysis.contribution.items.some((item) => item.contributionPctPoints > 0)).toBe(true);
    expect(analysis.contribution.items.some((item) => item.contributionPctPoints < 0)).toBe(true);
    const sum = analysis.contribution.items.reduce(
      (total, item) => total + item.contributionPctPoints,
      analysis.contribution.residual,
    );
    expect(sum).toBeCloseTo(analysis.metrics.returnPct, 8);
    expect(Number.isFinite(analysis.contribution.residual)).toBe(true);
  });

  test("zachová příspěvek aktiva nakoupeného a plně prodaného uvnitř období", () => {
    const roundTrip: Transaction[] = [
      { id: "d", type: "deposit", occurredAt: "2026-08-08", amount: 200_000, currency: "CZK", fee: 0 },
      { id: "b", type: "buy", occurredAt: "2026-08-10", assetId: "msft", quantity: 5, unitPrice: 500, currency: "USD", fee: 0 },
      { id: "s", type: "sell", occurredAt: "2026-08-20", assetId: "msft", quantity: 5, unitPrice: 510, currency: "USD", fee: 0 },
    ];
    const contribution = getContributionAnalysis(
      roundTrip,
      "2026-08-08T12:00:00.000Z",
      "2026-08-30T12:00:00.000Z",
    );
    expect(contribution.items.find((item) => item.assetId === "msft")).toBeDefined();
    expect(contribution.items.find((item) => item.assetId === "cash")?.contributionPctPoints).toBe(0);
  });

  test("počítá koncentraci, top 3 a hotovost odděleně", () => {
    const result = getConcentrationAnalysis([
      { assetId: "cash", value: 10, percentage: 10 },
      { assetId: "btc", value: 40, percentage: 40 },
      { assetId: "aapl", value: 30, percentage: 30 },
      { assetId: "msft", value: 20, percentage: 20 },
    ]);
    expect(result.largestPosition).toMatchObject({ assetId: "btc", allocationPct: 40 });
    expect(result.top3Share).toBe(90);
    expect(result.assetCount).toBe(3);
    expect(result.cashShare).toBe(10);
  });

  test("vlastní rozsah řídí všechny analytické vrstvy", () => {
    const analysis = buildAnalysis(initialTransactions, [705, 712]);
    expect(analysis.timeframe).toBe("CUSTOM");
    expect(analysis.selectedPeriod).toEqual({ from: timeline[705], to: timeline[712] });
    expect(analysis.drawdown.series).toHaveLength(8);
    expect(analysis.contribution.items.length).toBeGreaterThan(0);
  });

  test("vrací největší pozici z odvozené alokace", () => {
    const holdings = buildHoldings(initialTransactions);
    const allocation = getAllocation(holdings);
    expect(getLargestPosition(allocation)).toEqual(allocation[0]);
  });

  test("zvládá prázdné a čistě hotovostní portfolio bez NaN", () => {
    const empty = buildAnalysis([], [700, 730]);
    expect(empty.metrics.endValue).toBe(0);
    expect(empty.metrics.returnPct).toBe(0);
    expect(JSON.stringify(empty)).not.toMatch(/NaN|Infinity/);
    const cash: Transaction[] = [
      {
        id: "cash",
        type: "deposit",
        occurredAt: "2025-01-01",
        amount: 100_000,
        currency: "CZK",
        fee: 0,
      },
    ];
    const analysis = buildAnalysis(cash, [700, 730]);
    expect(analysis.metrics.endValue).toBe(100_000);
    expect(analysis.metrics.returnPct).toBe(0);
  });

  test("označí chybějící cenu a nevymýšlí její hodnotu", () => {
    const snapshot = buildSnapshot(transactions, "2026-09-07", [], []);
    expect(snapshot.missingPriceAssetIds).toContain("aapl");
    expect(snapshot.totalValue).toBe(0);
  });

  test("zachová záporný výnos v historické řadě", () => {
    const rows: Transaction[] = [
      {
        id: "d",
        type: "deposit",
        occurredAt: "2024-09-07",
        amount: 44_800,
        currency: "CZK",
        fee: 0,
      },
      {
        id: "b",
        type: "buy",
        occurredAt: "2024-09-07",
        assetId: "aapl",
        quantity: 10,
        unitPrice: 200,
        currency: "USD",
        fee: 0,
      },
    ];
    expect(getPortfolioSeries(rows, "2024-09-07", "2026-09-07").at(-1)!.returnPct).toBeLessThan(0);
  });

  test("validuje strukturu, známá aktiva a unikátní id transakcí", () => {
    expect(transactionsSchema.safeParse(initialTransactions).success).toBe(true);
    expect(
      transactionsSchema.safeParse([
        ...transactions,
        { ...transactions[1], id: "unknown", assetId: "missing" },
      ]).success,
    ).toBe(false);
    expect(transactionsSchema.safeParse([...transactions, { ...transactions[1] }]).success).toBe(
      false,
    );
  });

  test("recovery dataset drží finanční invarianty a známý charakter", () => {
    const current = buildAnalysis(initialTransactions, timeframeRange("1M"));
    const year = buildAnalysis(initialTransactions, timeframeRange("1Y"));
    const cash = current.holdings.find((holding) => holding.assetId === "cash");
    const allocationSum = current.allocation.reduce((sum, item) => sum + item.percentage, 0);
    expect(cash?.marketValue ?? -1).toBeGreaterThanOrEqual(0);
    expect(current.metrics.endValue).toBeGreaterThan(0);
    expect(allocationSum).toBeCloseTo(100, 8);
    expect(current.concentration.largestPosition?.allocationPct ?? 101).toBeLessThanOrEqual(100);
    expect(current.concentration.top3Share).toBeLessThanOrEqual(100);
    for (const holding of current.holdings) {
      const expectedValue =
        holding.quantity * demoPriceFor(holding.assetId, 730) * mockFx[holding.asset.currency];
      expect(holding.marketValue).toBeCloseTo(expectedValue, 6);
      expect(Number.isFinite(holding.pnl)).toBe(true);
      expect(Number.isFinite(holding.returnPct)).toBe(true);
    }
    initialTransactions.forEach((transaction, index) => {
      const cashAtTransaction = buildHoldings(
        initialTransactions.slice(0, index + 1),
        transaction.occurredAt,
      ).find((holding) => holding.assetId === "cash");
      expect(cashAtTransaction?.quantity ?? 0).toBeGreaterThanOrEqual(0);
    });
    const facts = toLensFacts(current, "1M", {
      mode: "performance",
      benchmarkVisible: true,
    });
    expect(JSON.stringify({ current, year, facts })).not.toMatch(/NaN|Infinity/);
    const last = current.points.at(-1)!;
    const previous = current.points.at(-2)!;
    expect(last.portfolioValue).toBeGreaterThan(0);
    expect(Math.abs(last.portfolioReturnPct - previous.portfolioReturnPct)).toBeLessThan(5);
    expect(portfolioDataset.version).toBe("lens-demo-2026.09-v2");
    expect(current.metrics.endValue).toBeCloseTo(3_663_261, -4);
    expect(current.concentration.cashShare).toBeGreaterThan(13);
    expect(current.concentration.cashShare).toBeLessThan(14);
    expect(current.concentration.largestPosition?.allocationPct).toBeGreaterThan(24);
    expect(current.concentration.largestPosition?.allocationPct).toBeLessThan(26);
    expect(current.metrics.returnPct).toBeGreaterThan(4.2);
    expect(current.metrics.returnPct).toBeLessThan(4.5);
    expect(current.metrics.benchmarkReturnPct).toBeCloseTo(3.7, 1);
    expect(current.metrics.benchmarkDeltaPct).toBeGreaterThan(0.5);
    expect(current.metrics.benchmarkDeltaPct).toBeLessThan(0.8);
    expect(current.metrics.maxDrawdownPct).toBeCloseTo(0, 1);
    expect(current.contribution.topContributor?.assetId).toBe("nvda");
    expect(current.contribution.topContributor?.contributionPctPoints).toBeGreaterThan(1);
    expect(current.contribution.topContributor?.contributionPctPoints).toBeLessThan(1.3);
    expect(year.metrics.returnPct).toBeGreaterThan(11.3);
    expect(year.metrics.returnPct).toBeLessThan(11.8);
    expect(year.metrics.benchmarkReturnPct).toBeCloseTo(10.7, 1);
    expect(year.metrics.benchmarkDeltaPct).toBeGreaterThan(0.7);
    expect(year.metrics.benchmarkDeltaPct).toBeLessThan(1.1);
    expect(year.metrics.maxDrawdownPct).toBeGreaterThan(-7.3);
    expect(year.metrics.maxDrawdownPct).toBeLessThan(-6.4);
    expect(year.contribution.topContributor?.assetId).toBe("btc");
    expect(year.contribution.topContributor?.contributionPctPoints).toBeGreaterThan(3.9);
    expect(year.contribution.topContributor?.contributionPctPoints).toBeLessThan(4.7);
    const apple = year.contribution.items.find((item) => item.assetId === "aapl")!;
    expect(apple.contributionPctPoints).toBeGreaterThan(-0.4);
    expect(apple.contributionPctPoints).toBeLessThan(0);
    expect(year.contribution.residual).toBeGreaterThan(0.2);
    expect(year.contribution.residual).toBeLessThan(1);
  });
});
