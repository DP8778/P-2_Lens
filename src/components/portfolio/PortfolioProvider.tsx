"use client";
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import {
  buildHoldings,
  draftToTransaction,
  initialTransactions,
  transactionsSchema,
  type Holding,
  type HoldingDraft,
  type Transaction,
} from "@/lib/finance/portfolio-engine";

const key = "lens-portfolio-transactions-v3";
let snapshot = initialTransactions;
let loaded = false;
let storageWarning = "";
let sequence = 0;
const listeners = new Set<() => void>();
function read() {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try {
      const raw = localStorage.getItem(key);
      if (raw) snapshot = transactionsSchema.parse(JSON.parse(raw));
    } catch {
      storageWarning = "Uložené portfolio nelze načíst. Zobrazuji výchozí demo.";
    }
  }
  return snapshot;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
function persist(rows: Transaction[]) {
  const parsed = transactionsSchema.parse(rows);
  localStorage.setItem(key, JSON.stringify(parsed));
  snapshot = parsed;
  storageWarning = "";
  listeners.forEach((listener) => listener());
}
const Context = createContext<{
  transactions: Transaction[];
  holdings: Holding[];
  warning: string;
  save: (row: HoldingDraft, edit?: boolean) => void;
  remove: (id: string) => void;
} | null>(null);
export function PortfolioProvider({ children }: { children: ReactNode }) {
  const transactions = useSyncExternalStore(subscribe, read, () => initialTransactions);
  const holdings = buildHoldings(transactions);
  return (
    <Context
      value={{
        transactions,
        holdings,
        warning: storageWarning,
        save: (row, edit) => {
          const remaining = edit
            ? read().filter(
                (transaction) => !("assetId" in transaction) || transaction.assetId !== row.assetId,
              )
            : read();
          persist([...remaining, draftToTransaction(row, `local-${Date.now()}-${sequence++}`)]);
        },
        remove: (id) =>
          persist(
            read().filter(
              (transaction) => !("assetId" in transaction) || transaction.assetId !== id,
            ),
          ),
      }}
    >
      {children}
    </Context>
  );
}
export function usePortfolio() {
  const context = useContext(Context);
  if (!context) throw new Error("PortfolioProvider missing");
  return context;
}
