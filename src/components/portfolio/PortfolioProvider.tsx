"use client";
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import {
  holdingsSchema,
  initialHoldings,
  saveHolding,
  type Holding,
} from "@/lib/finance/portfolio-engine";

const key = "lens-portfolio-v2";
let snapshot = initialHoldings;
let loaded = false;
let storageWarning = "";
const listeners = new Set<() => void>();
function read() {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try {
      const raw = localStorage.getItem(key);
      if (raw) snapshot = holdingsSchema.parse(JSON.parse(raw));
    } catch {
      storageWarning = "Uložené portfolio nelze načíst. Zobrazuji výchozí demo.";
    }
  }
  return snapshot;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function persist(rows: Holding[]) {
  localStorage.setItem(key, JSON.stringify(holdingsSchema.parse(rows)));
  snapshot = rows;
  storageWarning = "";
  listeners.forEach((listener) => listener());
}
const Context = createContext<{
  holdings: Holding[];
  warning: string;
  save: (row: Holding, edit?: boolean) => void;
  remove: (id: string) => void;
} | null>(null);
export function PortfolioProvider({ children }: { children: ReactNode }) {
  const holdings = useSyncExternalStore(subscribe, read, () => initialHoldings);
  return (
    <Context
      value={{
        holdings,
        warning: storageWarning,
        save: (row, edit) => persist(saveHolding(read(), row, edit)),
        remove: (id) => persist(read().filter((p) => p.assetId !== id)),
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
