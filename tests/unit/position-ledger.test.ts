import {
  buildHoldings,
  getPortfolioSeries,
  type Transaction,
} from "@/lib/finance/portfolio-engine";
import {
  createPositionLedgerEntries,
  reconcilePositionLedgerCashFlows,
} from "@/lib/finance/position-ledger";
import type { FxRate } from "@/lib/finance/domain";

const trade = (
  type: "buy" | "sell",
  assetId: string,
  quantity: number,
  unitPrice: number,
  token: string,
  options: { date?: string; currency?: string; fee?: number } = {},
) =>
  createPositionLedgerEntries(
    {
      assetId,
      type,
      quantity,
      unitPrice,
      occurredAt: options.date ?? "2026-01-01",
      currency: options.currency ?? "CZK",
      fee: options.fee ?? 0,
    },
    token,
  );

const syntheticCash = (transactions: Transaction[], rates: FxRate[] = []) =>
  buildHoldings(transactions, "2026-01-31", rates).find(
    (holding) => holding.assetId === "cash",
  )?.quantity ?? 0;

describe("personal position-ledger semantics", () => {
  test("characterizes the old buy → sell → buy synthetic-cash leak", () => {
    const oldProviderStyle: Transaction[] = [
      { id: "funding-a", type: "deposit", occurredAt: "2026-01-01", amount: 100, currency: "CZK", fee: 0 },
      { id: "buy-a", type: "buy", occurredAt: "2026-01-01", assetId: "asset-a", quantity: 1, unitPrice: 100, currency: "CZK", fee: 0 },
      { id: "sell-a", type: "sell", occurredAt: "2026-01-02", assetId: "asset-a", quantity: 1, unitPrice: 120, currency: "CZK", fee: 0 },
      { id: "funding-b", type: "deposit", occurredAt: "2026-01-03", amount: 80, currency: "CZK", fee: 0 },
      { id: "buy-b", type: "buy", occurredAt: "2026-01-03", assetId: "asset-b", quantity: 1, unitPrice: 80, currency: "CZK", fee: 0 },
    ];

    const cash = buildHoldings(oldProviderStyle, "2026-01-03", []).find(
      (holding) => holding.assetId === "cash",
    );

    expect(cash?.quantity).toBe(120);
  });

  test("buy leaves no synthetic cash", () => {
    expect(syntheticCash(trade("buy", "asset-a", 1, 100, "buy"))).toBeCloseTo(0);
  });

  test("buy → sell leaves no synthetic cash", () => {
    const rows = [
      ...trade("buy", "asset-a", 1, 100, "buy", { date: "2026-01-01" }),
      ...trade("sell", "asset-a", 1, 120, "sell", { date: "2026-01-02" }),
    ];
    expect(syntheticCash(rows)).toBeCloseTo(0);
  });

  test("buy → sell → second buy leaves no synthetic cash", () => {
    const rows = [
      ...trade("buy", "asset-a", 1, 100, "buy-a", { date: "2026-01-01" }),
      ...trade("sell", "asset-a", 1, 120, "sell-a", { date: "2026-01-02" }),
      ...trade("buy", "asset-b", 1, 80, "buy-b", { date: "2026-01-03" }),
    ];
    expect(syntheticCash(rows)).toBeCloseTo(0);
  });

  test("migrates legacy personal trades without changing explicit cash flows", () => {
    const legacy: Transaction[] = [
      { id: "personal-buy-asset-a-buy", type: "buy", occurredAt: "2026-01-01", assetId: "asset-a", quantity: 1, unitPrice: 100, currency: "CZK", fee: 2 },
      { id: "personal-funding-asset-a-buy", type: "deposit", occurredAt: "2026-01-01", amount: 102, currency: "CZK", fee: 0 },
      { id: "personal-sell-asset-a-sell", type: "sell", occurredAt: "2026-01-02", assetId: "asset-a", quantity: 0.5, unitPrice: 120, currency: "CZK", fee: 1 },
      { id: "explicit-deposit", type: "deposit", occurredAt: "2026-01-01", amount: 50, currency: "CZK", fee: 0 },
    ];

    const migrated = reconcilePositionLedgerCashFlows(legacy);
    expect(migrated).toContainEqual(expect.objectContaining({
      id: "personal-withdrawal-asset-a-sell",
      type: "withdrawal",
      amount: 59,
    }));
    expect(syntheticCash(migrated)).toBeCloseTo(50);
    expect(reconcilePositionLedgerCashFlows(migrated)).toBe(migrated);
  });

  test("multiple buys, partial sell and fees stay cash-neutral", () => {
    const rows = [
      ...trade("buy", "asset-a", 1, 100, "buy-a", { fee: 2 }),
      ...trade("buy", "asset-a", 1, 110, "buy-b", { date: "2026-01-02", fee: 1 }),
      ...trade("sell", "asset-a", 0.5, 120, "sell-a", { date: "2026-01-03", fee: 1 }),
    ];
    expect(syntheticCash(rows)).toBeCloseTo(0);
    expect(buildHoldings(rows, "2026-01-31", []).find((row) => row.assetId === "asset-a")?.quantity).toBe(1.5);
  });

  test("foreign-currency trades stay neutral while explicit cash remains explicit", () => {
    const rates = [{ date: "2026-01-01", currency: "USD", czkPerUnit: 22 }];
    const rows: Transaction[] = [
      { id: "explicit-deposit", type: "deposit", occurredAt: "2026-01-01", amount: 50, currency: "USD", fee: 0 },
      ...trade("buy", "asset-a", 1, 100, "buy", { currency: "USD", fee: 2 }),
      ...trade("sell", "asset-a", 0.5, 120, "sell", { currency: "USD", fee: 1 }),
    ];
    expect(syntheticCash(rows, rates)).toBeCloseTo(1_100);
  });

  test("same-day ordering is semantic and portfolio return ignores neutral funding flows", () => {
    const rows = [
      ...trade("buy", "asset-a", 1, 100, "z-buy", { date: "2026-01-01" }),
      ...trade("sell", "asset-a", 1, 110, "a-sell", { date: "2026-01-02" }),
    ];
    const series = getPortfolioSeries(
      rows,
      "2026-01-01",
      "2026-01-02",
      [
        { assetId: "asset-a", date: "2026-01-01", close: 100, currency: "CZK" },
        { assetId: "asset-a", date: "2026-01-02", close: 110, currency: "CZK" },
      ],
      [],
      ["2026-01-01", "2026-01-02"],
    );
    expect(series.at(-1)?.returnPct).toBeCloseTo(10);
    expect(syntheticCash([...rows].reverse())).toBeCloseTo(0);
  });
});
