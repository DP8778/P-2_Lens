import type { Transaction } from "./domain";

export interface PositionTradeInput {
  assetId: string;
  type: "buy" | "sell";
  quantity: number;
  unitPrice: number;
  occurredAt: string;
  currency: string;
  fee: number;
}

/**
 * Personal portfolio is a position ledger, not a brokerage cash account.
 * Every trade therefore gets a performance-neutral external cash-flow companion.
 */
export function createPositionLedgerEntries(
  input: PositionTradeInput,
  token: string,
): Transaction[] {
  const gross = input.quantity * input.unitPrice;
  if (input.type === "sell" && input.fee >= gross)
    throw new Error("Poplatek za prodej musí být nižší než hodnota prodeje.");

  const trade: Transaction = {
    id: `personal-${input.type}-${input.assetId}-${token}`,
    type: input.type,
    occurredAt: input.occurredAt,
    assetId: input.assetId,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    currency: input.currency,
    fee: input.fee,
  };

  if (input.type === "buy") {
    const funding: Transaction = {
      id: `personal-funding-${input.assetId}-${token}`,
      type: "deposit",
      occurredAt: input.occurredAt,
      amount: gross + input.fee,
      currency: input.currency,
      fee: 0,
    };
    return [funding, trade];
  }

  const proceeds: Transaction = {
    id: `personal-withdrawal-${input.assetId}-${token}`,
    type: "withdrawal",
    occurredAt: input.occurredAt,
    amount: gross - input.fee,
    currency: input.currency,
    fee: 0,
  };
  return [trade, proceeds];
}

export function implicitCashFlowIdForTrade(transaction: Transaction) {
  if (transaction.type !== "buy" && transaction.type !== "sell") return undefined;
  const prefix = `personal-${transaction.type}-${transaction.assetId}-`;
  if (!transaction.id.startsWith(prefix)) return undefined;
  const token = transaction.id.slice(prefix.length);
  const flow = transaction.type === "buy" ? "funding" : "withdrawal";
  return `personal-${flow}-${transaction.assetId}-${token}`;
}

/**
 * Upgrades position-ledger trades saved before sell proceeds were paired with
 * an external withdrawal. Explicit deposits and withdrawals are left intact.
 */
export function reconcilePositionLedgerCashFlows(
  transactions: Transaction[],
): Transaction[] {
  const existingIds = new Set(transactions.map((transaction) => transaction.id));
  const companions: Transaction[] = [];

  for (const transaction of transactions) {
    if (transaction.type !== "buy" && transaction.type !== "sell") continue;
    const companionId = implicitCashFlowIdForTrade(transaction);
    if (!companionId || existingIds.has(companionId)) continue;

    const gross = transaction.quantity * transaction.unitPrice;
    const amount = transaction.type === "buy" ? gross + transaction.fee : gross - transaction.fee;
    if (amount <= 0) continue;

    companions.push({
      id: companionId,
      type: transaction.type === "buy" ? "deposit" : "withdrawal",
      occurredAt: transaction.occurredAt,
      amount,
      currency: transaction.currency,
      fee: 0,
    });
    existingIds.add(companionId);
  }

  return companions.length ? [...transactions, ...companions] : transactions;
}
