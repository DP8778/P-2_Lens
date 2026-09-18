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
  initialTransactions,
  type AnalysisDataset,
  type Holding,
  type HoldingDraft,
  type Transaction,
} from "@/lib/finance/portfolio-engine";
import type { Asset, Benchmark, FxRate, PricePoint } from "@/lib/finance/domain";
import {
  createPositionLedgerEntries,
  implicitCashFlowIdForTrade,
  reconcilePositionLedgerCashFlows,
} from "@/lib/finance/position-ledger";
import { marketDataConfig } from "@/lib/market-data/config";
import { fetchMarketStatus, searchMarketAssets } from "@/lib/market-data/client";
import { loadFxHistory, loadHistory, loadQuotes, storeMarketQuote } from "@/lib/market-data/service";
import { marketAssetSchema } from "@/lib/market-data/validation";
import type { MarketAsset, MarketQuote } from "@/lib/market-data/types";
import { addLocalDays, localDateISO } from "@/lib/date/local-date";

export type PortfolioMode = "demo" | "personal";
export type MarketLoadState = "idle" | "loading" | "ready" | "stale" | "unavailable";
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
    const rawPersonal = localStorage.getItem(personalKey);
    if (rawPersonal) {
      const parsed = personalSchema.parse(JSON.parse(rawPersonal));
      const transactions = reconcilePositionLedgerCashFlows(parsed.transactions as Transaction[]);
      personalSnapshot = personalSchema.parse({ ...parsed, transactions });
      if (transactions !== parsed.transactions)
        localStorage.setItem(personalKey, JSON.stringify(personalSnapshot));
    }
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
const readDemo = () => (hydrateStorage(), initialTransactions);
const readPersonal = () => (hydrateStorage(), personalSnapshot);
const readMode = () => (hydrateStorage(), modeSnapshot);
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

const today = () => localDateISO();
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
  comparisonAssets?: MarketAsset[];
  lastRefresh?: string;
  error?: string;
  source?: "network" | "cache";
}
const emptyRuntime: MarketRuntime = { configured: null, state: "idle", prices: [], fxRates: [], quotes: [] };
type SavePersonalDraft = Omit<HoldingDraft, "assetId"> & { assetId: string };
export interface CurrentPurchaseMarket {
  quote: MarketQuote;
  fxRate?: number;
}

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
  savePersonal: (asset: MarketAsset, row: SavePersonalDraft, edit?: boolean, currentMarket?: CurrentPurchaseMarket) => Promise<void>;
  remove: (id: string) => void;
  refreshQuotes: () => Promise<void>;
  prepareComparison: (asset: MarketAsset) => Promise<void>;
  saveTrade: (assetId: string, type: "buy" | "sell", input: { quantity: number; unitPrice: number; date: string; fee: number }, editId?: string) => Promise<void>;
  removeTransaction: (id: string) => void;
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
      const quotePoints: PricePoint[] = quotes.map((quote) => ({ assetId: quote.assetId, date: today(), close: quote.price, currency: quote.currency }));
      setMarket((current) => ({
        ...current,
        state: freshnessState(quotes),
        quotes,
        prices: [...current.prices.filter((point) => !quotePoints.some((quote) => quote.assetId === point.assetId && quote.date === point.date)), ...quotePoints],
        lastRefresh: new Date().toISOString(),
        source: quotes.some((quote) => quote.source === "cache") ? "cache" : "network",
        error: quotes.some((quote) => quote.freshness === "stale") ? "Data nejsou aktuální; používám poslední uložené ceny." : undefined,
      }));
    } catch {
      setMarket((current) => ({ ...current, state: current.prices.length ? "stale" : "unavailable", error: "Market data jsou dočasně nedostupná." }));
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
      const [historyResults, fxHistoryResults, quotes] = await Promise.all([
        Promise.allSettled(requestedAssets.map((asset) => loadHistory(asset, range))),
        Promise.allSettled(currencies.map((currency) => loadFxHistory(currency, "CZK", range))),
        loadQuotes(requestedAssets),
      ]);
      const histories = historyResults.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      const fxHistories = fxHistoryResults.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      const historicalPrices: PricePoint[] = histories.flatMap((history) => history.points.map((point) => ({ assetId: point.assetId, date: point.date, close: point.close, currency: point.currency })));
      const quotePoints: PricePoint[] = quotes.map((quote) => ({ assetId: quote.assetId, date: today(), close: quote.price, currency: quote.currency }));
      const nextFxRates: FxRate[] = [
        { date: from, currency: "CZK", czkPerUnit: 1 },
        ...fxHistories.flatMap((history) => history.points.map((point) => ({ date: point.date, currency: point.base, czkPerUnit: point.rate }))),
      ];
      setMarket((current) => {
        const priceMap = new Map([...current.prices, ...historicalPrices, ...quotePoints].map((point) => [`${point.assetId}:${point.date}`, point]));
        const fxMap = new Map([...current.fxRates, ...nextFxRates].map((point) => [`${point.currency}:${point.date}`, point]));
        return {
          ...current,
          configured: true,
          state: freshnessState(quotes),
          prices: [...priceMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
          fxRates: [...fxMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
          quotes,
          benchmark,
          lastRefresh: new Date().toISOString(),
          source: histories.some((history) => history.source === "network") || fxHistories.some((history) => history.source === "network") || quotes.some((quote) => quote.source === "network") ? "network" : "cache",
          error: undefined,
        };
      });
    } catch {
      setMarket((current) => ({ ...current, configured: current.configured ?? true, state: current.prices.length ? "stale" : "unavailable", error: "Market data jsou dočasně nedostupná." }));
    }
  }, [market.benchmark, mode, personal.assets, personalTransactions]);

  useEffect(() => { void Promise.resolve().then(hydratePersonalMarket); }, [hydratePersonalMarket]);
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
    const assets: Asset[] = [...personal.assets, ...(market.comparisonAssets ?? [])].filter((asset, index, rows) => rows.findIndex((candidate) => candidate.id === asset.id) === index).map(domainAsset);
    if (benchmarkAsset && !assets.some((asset) => asset.id === benchmarkAsset.id)) assets.push(domainAsset(benchmarkAsset));
    const benchmarks: Benchmark[] = benchmarkAsset ? [{ id: "spy", name: "S&P 500", symbol: "SPY", assetId: benchmarkAsset.id, currency: benchmarkAsset.currency }] : [];
    const start = firstTransaction === today() ? addLocalDays(firstTransaction, -1) : firstTransaction;
    return { asOf: today(), timeline: calendar(start, today()), assets, prices: market.prices, fxRates: market.fxRates, benchmarks };
  }, [market.benchmark, market.comparisonAssets, market.fxRates, market.prices, mode, personal.assets, personalTransactions]);

  const savePersonal = useCallback(async (asset: MarketAsset, row: SavePersonalDraft, edit = false, currentMarket?: CurrentPurchaseMarket) => {
    const range = { from: row.date, to: today(), interval: "1day" as const };
    setMarket((current) => ({ ...current, state: "loading", error: undefined }));
    const quote = currentMarket?.quote;
    const validCurrentQuote = row.date === today() && quote?.assetId === asset.id && Number.isFinite(quote.price) && quote.price > 0;
    try {
      if (!validCurrentQuote)
        await Promise.all([loadHistory(asset, range), asset.currency === "CZK" ? Promise.resolve() : loadFxHistory(asset.currency, "CZK", range)]);
      const current = readPersonal();
      const timestamp = `${Date.now()}-${sequence++}`;
      const remaining = edit ? current.transactions.filter((transaction) => !("assetId" in transaction && transaction.assetId === asset.id) && !transaction.id.startsWith(`personal-funding-${asset.id}-`)) : current.transactions;
      const entries = createPositionLedgerEntries({ assetId: asset.id, type: "buy", quantity: row.quantity, unitPrice: row.averageCost, occurredAt: row.date, currency: asset.currency, fee: row.fees }, timestamp);
      persistPersonal({ version: 1, assets: [...current.assets.filter((candidate) => candidate.id !== asset.id), asset], transactions: [...remaining, ...entries] });
      if (validCurrentQuote && quote) {
        await storeMarketQuote(quote);
        const quotePoint: PricePoint = { assetId: asset.id, date: row.date, close: quote.price, currency: quote.currency };
        const fxRate = asset.currency === "CZK" ? 1 : currentMarket?.fxRate;
        setMarket((runtime) => {
          const prices = [...runtime.prices.filter((point) => !(point.assetId === asset.id && point.date === row.date)), quotePoint];
          const fxRates = fxRate === undefined
            ? runtime.fxRates
            : [...runtime.fxRates.filter((point) => !(point.currency === asset.currency && point.date === row.date)), { date: row.date, currency: asset.currency, czkPerUnit: fxRate }];
          return {
            ...runtime,
            configured: true,
            state: freshnessState([quote]),
            prices: prices.sort((a, b) => a.date.localeCompare(b.date)),
            fxRates: fxRates.sort((a, b) => a.date.localeCompare(b.date)),
            quotes: [quote, ...runtime.quotes.filter((candidate) => candidate.assetId !== asset.id)],
            lastRefresh: quote.timestamp,
            source: quote.source,
            error: undefined,
          };
        });
        void Promise.allSettled([
          loadHistory(asset, range),
          asset.currency === "CZK" ? Promise.resolve() : loadFxHistory(asset.currency, "CZK", range),
        ]);
      }
    } catch {
      setMarket((current) => ({ ...current, state: current.prices.length ? "stale" : "unavailable", error: "Investici se nepodařilo uložit." }));
      throw new Error("Investici se nepodařilo uložit. Zkuste to znovu.");
    }
  }, []);

  const prepareComparison = useCallback(async (asset: MarketAsset) => {
    const from = personalTransactions.filter((row) => "assetId" in row).map((row) => row.occurredAt).sort()[0] ?? today();
    const range = { from, to: today(), interval: "1day" as const };
    const [history, fx] = await Promise.all([
      loadHistory(asset, range),
      asset.currency === "CZK" ? Promise.resolve(undefined) : loadFxHistory(asset.currency, "CZK", range),
    ]);
    setMarket((current) => {
      const priceMap = new Map([...current.prices, ...history.points.map((point) => ({ assetId: point.assetId, date: point.date, close: point.close, currency: point.currency }))].map((point) => [`${point.assetId}:${point.date}`, point]));
      const fxMap = new Map([...current.fxRates, ...(fx?.points.map((point) => ({ date: point.date, currency: point.base, czkPerUnit: point.rate })) ?? [])].map((point) => [`${point.currency}:${point.date}`, point]));
      return { ...current, prices: [...priceMap.values()], fxRates: [...fxMap.values()], comparisonAssets: [asset, ...(current.comparisonAssets ?? []).filter((candidate) => candidate.id !== asset.id)] };
    });
  }, [personalTransactions]);

  const saveTrade = useCallback(async (assetId: string, type: "buy" | "sell", input: { quantity: number; unitPrice: number; date: string; fee: number }, editId?: string) => {
    const current = readPersonal();
    const asset = current.assets.find((candidate) => candidate.id === assetId);
    if (!asset) throw new Error("Instrument není v portfoliu.");
    const available = buildHoldings(current.transactions as Transaction[], today(), market.fxRates).find((holding) => holding.assetId === assetId)?.quantity ?? 0;
    const edited = editId ? current.transactions.find((transaction) => transaction.id === editId && "quantity" in transaction) : undefined;
    if (type === "sell" && input.quantity > available + (edited?.type === "sell" ? edited.quantity : 0)) throw new Error("Nelze prodat více, než aktuálně držíte.");
    await Promise.all([loadHistory(asset, { from: input.date, to: today(), interval: "1day" }), asset.currency === "CZK" ? Promise.resolve() : loadFxHistory(asset.currency, "CZK", { from: input.date, to: today(), interval: "1day" })]);
    const companionId = edited ? implicitCashFlowIdForTrade(edited as Transaction) : undefined;
    const withoutEdited = editId ? current.transactions.filter((transaction) => transaction.id !== editId && transaction.id !== companionId) : current.transactions;
    const timestamp = `${Date.now()}-${sequence++}`;
    const entries = createPositionLedgerEntries({ assetId, type, quantity: input.quantity, unitPrice: input.unitPrice, occurredAt: input.date, currency: asset.currency, fee: input.fee }, timestamp);
    persistPersonal({ ...current, transactions: [...withoutEdited, ...entries] });
  }, [market.fxRates]);

  const removeTransaction = useCallback((id: string) => {
    const current = readPersonal();
    const transaction = current.transactions.find((row) => row.id === id);
    if (!transaction) return;
    const companionId = implicitCashFlowIdForTrade(transaction as Transaction);
    persistPersonal({ ...current, transactions: current.transactions.filter((row) => row.id !== id && row.id !== companionId) });
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
        void row; void edit;
        throw new Error("Demo portfolio je read-only.");
      },
      savePersonal,
      remove: (id) => {
        if (mode === "demo") throw new Error("Demo portfolio je read-only.");
        const current = readPersonal();
        persistPersonal({ ...current, assets: current.assets.filter((asset) => asset.id !== id), transactions: current.transactions.filter((transaction) => !("assetId" in transaction && transaction.assetId === id) && !transaction.id.startsWith(`personal-funding-${id}-`) && !transaction.id.startsWith(`personal-withdrawal-${id}-`)) });
      },
      refreshQuotes: refreshQuotesOnly,
      prepareComparison,
      saveTrade,
      removeTransaction,
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
