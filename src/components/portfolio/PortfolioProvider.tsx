"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { z } from "zod";
import {
  buildHoldings,
  draftToTransaction,
  initialTransactions,
  transactionsSchema,
  type AnalysisDataset,
  type Holding,
  type HoldingDraft,
  type Transaction,
} from "@/lib/finance/portfolio-engine";
import type { Asset, Benchmark, FxRate, PricePoint } from "@/lib/finance/domain";
import { marketDataConfig } from "@/lib/market-data/config";
import { fetchMarketStatus, searchMarketAssets } from "@/lib/market-data/client";
import { loadFxHistory, loadHistory, loadQuotes } from "@/lib/market-data/service";
import { marketAssetSchema } from "@/lib/market-data/validation";
import type { MarketAsset, MarketQuote } from "@/lib/market-data/types";

export type PortfolioMode = "demo" | "personal";
export type MarketLoadState = "idle" | "loading" | "ready" | "stale" | "unavailable";
const demoKey = "lens-portfolio-transactions-v3";
const personalKey = "lens-personal-portfolio-v1";
const modeKey = "lens-portfolio-mode-v1";

const baseTransaction = {
  id: z.string().min(1).max(240),
  occurredAt: z.iso.date(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  fee: z.number().finite().nonnegative(),
};
const personalTransactionSchema = z.discriminatedUnion("type", [
  z.object({ ...baseTransaction, type: z.literal("buy"), assetId: z.string().min(3).max(180), quantity: z.number().finite().positive(), unitPrice: z.number().finite().positive() }),
  z.object({ ...baseTransaction, type: z.literal("sell"), assetId: z.string().min(3).max(180), quantity: z.number().finite().positive(), unitPrice: z.number().finite().positive() }),
  z.object({ ...baseTransaction, type: z.literal("deposit"), amount: z.number().finite().positive() }),
  z.object({ ...baseTransaction, type: z.literal("withdrawal"), amount: z.number().finite().positive() }),
]);
const personalSchema = z.object({
  version: z.literal(1),
  assets: z.array(marketAssetSchema).max(250),
  transactions: z.array(personalTransactionSchema).max(2000),
});
type PersonalPortfolio = z.infer<typeof personalSchema>;
const emptyPersonal: PersonalPortfolio = { version: 1, assets: [], transactions: [] };

let demoSnapshot = initialTransactions;
let personalSnapshot: PersonalPortfolio = emptyPersonal;
let modeSnapshot: PortfolioMode = "demo";
let loaded = false;
let storageWarning = "";
let sequence = 0;
const listeners = new Set<() => void>();
function hydrateStorage() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const rawDemo = localStorage.getItem(demoKey);
    if (rawDemo) demoSnapshot = transactionsSchema.parse(JSON.parse(rawDemo));
    const rawPersonal = localStorage.getItem(personalKey);
    if (rawPersonal) personalSnapshot = personalSchema.parse(JSON.parse(rawPersonal));
    const rawMode = localStorage.getItem(modeKey);
    if (rawMode === "personal" || rawMode === "demo") modeSnapshot = rawMode;
  } catch {
    storageWarning = "Uložená data nelze načíst. Demo zůstává dostupné a osobní data nebyla přepsána.";
  }
}
const notify = () => listeners.forEach((listener) => listener());
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const readDemo = () => (hydrateStorage(), demoSnapshot);
const readPersonal = () => (hydrateStorage(), personalSnapshot);
const readMode = () => (hydrateStorage(), modeSnapshot);
function persistDemo(rows: Transaction[]) {
  const parsed = transactionsSchema.parse(rows);
  localStorage.setItem(demoKey, JSON.stringify(parsed));
  demoSnapshot = parsed;
  storageWarning = "";
  notify();
}
function persistPersonal(value: PersonalPortfolio) {
  const parsed = personalSchema.parse(value);
  localStorage.setItem(personalKey, JSON.stringify(parsed));
  personalSnapshot = parsed;
  storageWarning = "";
  notify();
}
function persistMode(mode: PortfolioMode) {
  localStorage.setItem(modeKey, mode);
  modeSnapshot = mode;
  notify();
}

const dateOnly = (value: string) => value.slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);
const domainAsset = (asset: MarketAsset): Asset => ({
  id: asset.id,
  symbol: asset.symbol,
  name: asset.name,
  type: asset.type,
  currency: asset.currency,
  quoteCurrency: asset.currency,
  sector: "Market",
  exchange: asset.exchange,
});
const calendar = (from: string, to: string) => {
  const result: string[] = [];
  for (let time = Date.parse(`${from}T12:00:00Z`); time <= Date.parse(`${to}T12:00:00Z`); time += 86_400_000)
    result.push(new Date(time).toISOString().slice(0, 10));
  return result;
};
const freshnessState = (quotes: MarketQuote[]): MarketLoadState =>
  quotes.some((quote) => quote.freshness === "stale") ? "stale" : "ready";

export interface MarketRuntime {
  configured: boolean | null;
  state: MarketLoadState;
  prices: PricePoint[];
  fxRates: FxRate[];
  quotes: MarketQuote[];
  benchmark?: MarketAsset;
  lastRefresh?: string;
  error?: string;
  source?: "network" | "cache";
}
const emptyRuntime: MarketRuntime = { configured: null, state: "idle", prices: [], fxRates: [], quotes: [] };
type SavePersonalDraft = Omit<HoldingDraft, "assetId"> & { assetId: string };

const Context = createContext<{
  mode: PortfolioMode;
  setMode: (mode: PortfolioMode) => void;
  transactions: Transaction[];
  holdings: Holding[];
  assets: MarketAsset[];
  warning: string;
  market: MarketRuntime;
  analysisDataset?: AnalysisDataset;
  save: (row: HoldingDraft, edit?: boolean) => void;
  savePersonal: (asset: MarketAsset, row: SavePersonalDraft, edit?: boolean) => Promise<void>;
  remove: (id: string) => void;
  refreshQuotes: () => Promise<void>;
} | null>(null);

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const mode = useSyncExternalStore(subscribe, readMode, () => "demo" as PortfolioMode);
  const demoTransactions = useSyncExternalStore(subscribe, readDemo, () => initialTransactions);
  const personal = useSyncExternalStore(subscribe, readPersonal, () => emptyPersonal);
  const [market, setMarket] = useState<MarketRuntime>(emptyRuntime);
  const personalTransactions = personal.transactions as Transaction[];

  const refreshQuotesOnly = useCallback(async () => {
    if (mode !== "personal" || !personal.assets.length) return;
    try {
      const allAssets = market.benchmark ? [...personal.assets, market.benchmark] : personal.assets;
      const quotes = await loadQuotes(allAssets);
      const quotePoints: PricePoint[] = quotes.map((quote) => ({ assetId: quote.assetId, date: dateOnly(quote.timestamp), close: quote.price, currency: quote.currency }));
      setMarket((current) => ({
        ...current,
        state: freshnessState(quotes),
        quotes,
        prices: [...current.prices.filter((point) => !quotePoints.some((quote) => quote.assetId === point.assetId && quote.date === point.date)), ...quotePoints],
        lastRefresh: new Date().toISOString(),
        source: quotes.some((quote) => quote.source === "cache") ? "cache" : "network",
        error: quotes.some((quote) => quote.freshness === "stale") ? "Data nejsou aktuální; používám poslední uložené ceny." : undefined,
      }));
    } catch (error) {
      setMarket((current) => ({ ...current, state: current.prices.length ? "stale" : "unavailable", error: error instanceof Error ? error.message : "Market data nejsou dostupná." }));
    }
  }, [market.benchmark, mode, personal.assets]);

  const hydratePersonalMarket = useCallback(async () => {
    if (mode !== "personal") return;
    setMarket((current) => ({ ...current, state: "loading", error: undefined }));
    try {
      const status = await fetchMarketStatus();
      if (!status.configured) {
        setMarket({ ...emptyRuntime, configured: false, state: "unavailable", error: "Live market data nejsou nakonfigurována." });
        return;
      }
      if (!personal.assets.length) {
        setMarket({ ...emptyRuntime, configured: true, state: "ready" });
        return;
      }
      const benchmark = market.benchmark ?? (await searchMarketAssets("SPY")).find((asset) => asset.symbol === "SPY" && asset.type === "etf");
      const requestedAssets = benchmark ? [...personal.assets, benchmark] : personal.assets;
      const from = personalTransactions.filter((row) => "assetId" in row).map((row) => row.occurredAt).sort()[0] ?? today();
      const range = { from, to: today(), interval: "1day" as const };
      const currencies = [...new Set(requestedAssets.map((asset) => asset.currency))].filter((currency) => currency !== "CZK");
      const [histories, fxHistories, quotes] = await Promise.all([
        Promise.all(requestedAssets.map((asset) => loadHistory(asset, range))),
        Promise.all(currencies.map((currency) => loadFxHistory(currency, "CZK", range))),
        loadQuotes(requestedAssets),
      ]);
      const historicalPrices: PricePoint[] = histories.flatMap((history) => history.points.map((point) => ({ assetId: point.assetId, date: point.date, close: point.close, currency: point.currency })));
      const quotePoints: PricePoint[] = quotes.map((quote) => ({ assetId: quote.assetId, date: dateOnly(quote.timestamp), close: quote.price, currency: quote.currency }));
      const priceMap = new Map([...historicalPrices, ...quotePoints].map((point) => [`${point.assetId}:${point.date}`, point]));
      const fxRates: FxRate[] = [
        { date: from, currency: "CZK", czkPerUnit: 1 },
        ...fxHistories.flatMap((history) => history.points.map((point) => ({ date: point.date, currency: point.base, czkPerUnit: point.rate }))),
      ];
      setMarket({
        configured: true,
        state: freshnessState(quotes),
        prices: [...priceMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
        fxRates,
        quotes,
        benchmark,
        lastRefresh: new Date().toISOString(),
        source: histories.some((history) => history.source === "network") || fxHistories.some((history) => history.source === "network") || quotes.some((quote) => quote.source === "network") ? "network" : "cache",
      });
    } catch (error) {
      setMarket((current) => ({ ...current, configured: current.configured ?? true, state: current.prices.length ? "stale" : "unavailable", error: error instanceof Error ? error.message : "Market data nejsou dostupná." }));
    }
  }, [market.benchmark, mode, personal.assets, personalTransactions]);

  useEffect(() => { void hydratePersonalMarket(); }, [hydratePersonalMarket]);
  useEffect(() => {
    if (mode !== "personal" || !personal.assets.length) return;
    const refreshIfVisible = () => {
      if (document.visibilityState !== "visible") return;
      const age = market.lastRefresh ? Date.now() - Date.parse(market.lastRefresh) : Infinity;
      const marketOpen = market.quotes.some((quote) => quote.marketState === "open");
      if (marketOpen || age >= marketDataConfig.closedQuoteRefreshMs) void refreshQuotesOnly();
    };
    const interval = window.setInterval(refreshIfVisible, marketDataConfig.quotePollMs);
    const onFocus = () => {
      if (document.visibilityState === "visible" && (!market.lastRefresh || Date.now() - Date.parse(market.lastRefresh) > marketDataConfig.quoteFreshMs)) void refreshQuotesOnly();
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", onFocus); window.removeEventListener("focus", onFocus); };
  }, [market.lastRefresh, market.quotes, mode, personal.assets.length, refreshQuotesOnly]);

  const transactions = mode === "demo" ? demoTransactions : personalTransactions;
  const holdings = useMemo(() => mode === "demo" ? buildHoldings(transactions) : buildHoldings(transactions, today(), market.fxRates), [market.fxRates, mode, transactions]);
  const analysisDataset = useMemo<AnalysisDataset | undefined>(() => {
    if (mode !== "personal" || !personal.assets.length || market.prices.length === 0) return undefined;
    const firstTransaction = personalTransactions.filter((row) => "assetId" in row).map((row) => row.occurredAt).sort()[0];
    if (!firstTransaction) return undefined;
    const benchmarkAsset = market.benchmark;
    const assets: Asset[] = [...personal.assets.map(domainAsset), ...(benchmarkAsset && !personal.assets.some((asset) => asset.id === benchmarkAsset.id) ? [domainAsset(benchmarkAsset)] : [])];
    const benchmarks: Benchmark[] = benchmarkAsset ? [{ id: "spy", name: "S&P 500", symbol: "SPY", assetId: benchmarkAsset.id, currency: benchmarkAsset.currency }] : [];
    return { asOf: today(), timeline: calendar(firstTransaction, today()), assets, prices: market.prices, fxRates: market.fxRates, benchmarks };
  }, [market.benchmark, market.fxRates, market.prices, mode, personal.assets, personalTransactions]);

  const savePersonal = useCallback(async (asset: MarketAsset, row: SavePersonalDraft, edit = false) => {
    const range = { from: row.date, to: today(), interval: "1day" as const };
    setMarket((current) => ({ ...current, state: "loading", error: undefined }));
    try {
      await Promise.all([loadHistory(asset, range), asset.currency === "CZK" ? Promise.resolve() : loadFxHistory(asset.currency, "CZK", range)]);
      const current = readPersonal();
      const timestamp = `${Date.now()}-${sequence++}`;
      const remaining = edit ? current.transactions.filter((transaction) => !("assetId" in transaction && transaction.assetId === asset.id) && !transaction.id.startsWith(`personal-funding-${asset.id}-`)) : current.transactions;
      const funding: Transaction = { id: `personal-funding-${asset.id}-${timestamp}`, type: "deposit", occurredAt: row.date, amount: row.quantity * row.averageCost + row.fees, currency: asset.currency, fee: 0 };
      const purchase: Transaction = { id: `personal-buy-${asset.id}-${timestamp}`, type: "buy", occurredAt: row.date, assetId: asset.id, quantity: row.quantity, unitPrice: row.averageCost, currency: asset.currency, fee: row.fees };
      persistPersonal({ version: 1, assets: [...current.assets.filter((candidate) => candidate.id !== asset.id), asset], transactions: [...remaining, funding, purchase] });
    } catch (error) {
      setMarket((current) => ({ ...current, state: current.prices.length ? "stale" : "unavailable", error: error instanceof Error ? error.message : "Historická data se nepodařilo načíst." }));
      throw error;
    }
  }, []);

  return (
    <Context value={{
      mode,
      setMode: persistMode,
      transactions,
      holdings,
      assets: personal.assets,
      warning: storageWarning,
      market,
      analysisDataset,
      save: (row, edit) => {
        const remaining = edit ? readDemo().filter((transaction) => !("assetId" in transaction) || transaction.assetId !== row.assetId) : readDemo();
        persistDemo([...remaining, draftToTransaction(row, `local-${Date.now()}-${sequence++}`)]);
      },
      savePersonal,
      remove: (id) => {
        if (mode === "demo") { persistDemo(readDemo().filter((transaction) => !("assetId" in transaction) || transaction.assetId !== id)); return; }
        const current = readPersonal();
        persistPersonal({ ...current, assets: current.assets.filter((asset) => asset.id !== id), transactions: current.transactions.filter((transaction) => !("assetId" in transaction && transaction.assetId === id) && !transaction.id.startsWith(`personal-funding-${id}-`)) });
      },
      refreshQuotes: refreshQuotesOnly,
    }}>
      {children}
    </Context>
  );
}

export function usePortfolio() {
  const context = useContext(Context);
  if (!context) throw new Error("PortfolioProvider missing");
  return context;
}
