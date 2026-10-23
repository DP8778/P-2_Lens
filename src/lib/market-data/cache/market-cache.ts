import type { FxQuote, FxRatePoint, MarketPricePoint, MarketQuote } from "../types";

export interface HistoryCacheRecord {
  key: string;
  assetId: string;
  interval: "1day";
  from: string;
  to: string;
  points: MarketPricePoint[];
  updatedAt: string;
  provider: string;
  version: 1;
}

export interface FxHistoryCacheRecord {
  key: string;
  base: string;
  quote: string;
  from: string;
  to: string;
  points: FxRatePoint[];
  updatedAt: string;
  provider: string;
  version: 1;
}

export interface QuoteCacheRecord {
  key: string;
  quote: MarketQuote;
  updatedAt: string;
}

export interface FxQuoteCacheRecord {
  key: string;
  quote: FxQuote;
  updatedAt: string;
}

export interface MarketDataCache {
  getHistory(assetId: string): Promise<HistoryCacheRecord | undefined>;
  putHistory(record: HistoryCacheRecord): Promise<void>;
  getFxHistory(base: string, quote: string): Promise<FxHistoryCacheRecord | undefined>;
  putFxHistory(record: FxHistoryCacheRecord): Promise<void>;
  getQuote(assetId: string): Promise<QuoteCacheRecord | undefined>;
  putQuote(record: QuoteCacheRecord): Promise<void>;
  getFxQuote(base: string, quote: string): Promise<FxQuoteCacheRecord | undefined>;
  putFxQuote(record: FxQuoteCacheRecord): Promise<void>;
  clearMarketData(): Promise<void>;
}

export const mergePricePoints = (current: MarketPricePoint[], incoming: MarketPricePoint[]) =>
  [...new Map([...current, ...incoming].map((point) => [point.date, point])).values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

export const mergeFxPoints = (current: FxRatePoint[], incoming: FxRatePoint[]) =>
  [...new Map([...current, ...incoming].map((point) => [point.date, point])).values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );

export function missingHistoryRanges(
  record: Pick<HistoryCacheRecord, "from" | "to"> | undefined,
  from: string,
  to: string,
) {
  if (!record) return [{ from, to }];
  const ranges: { from: string; to: string }[] = [];
  if (from < record.from) ranges.push({ from, to: record.from });
  if (to > record.to) ranges.push({ from: record.to, to });
  return ranges.filter((range) => range.from < range.to);
}

export class MemoryMarketDataCache implements MarketDataCache {
  histories = new Map<string, HistoryCacheRecord>();
  fxHistories = new Map<string, FxHistoryCacheRecord>();
  quotes = new Map<string, QuoteCacheRecord>();
  fxQuotes = new Map<string, FxQuoteCacheRecord>();
  getHistory(assetId: string) {
    return Promise.resolve(this.histories.get(assetId));
  }
  putHistory(record: HistoryCacheRecord) {
    this.histories.set(record.assetId, record);
    return Promise.resolve();
  }
  getFxHistory(base: string, quote: string) {
    return Promise.resolve(this.fxHistories.get(`${base}:${quote}`));
  }
  putFxHistory(record: FxHistoryCacheRecord) {
    this.fxHistories.set(`${record.base}:${record.quote}`, record);
    return Promise.resolve();
  }
  getQuote(assetId: string) {
    return Promise.resolve(this.quotes.get(assetId));
  }
  putQuote(record: QuoteCacheRecord) {
    this.quotes.set(record.key, record);
    return Promise.resolve();
  }
  getFxQuote(base: string, quote: string) {
    return Promise.resolve(this.fxQuotes.get(`${base}:${quote}`));
  }
  putFxQuote(record: FxQuoteCacheRecord) {
    this.fxQuotes.set(record.key, record);
    return Promise.resolve();
  }
  clearMarketData() {
    this.histories.clear();
    this.fxHistories.clear();
    this.quotes.clear();
    this.fxQuotes.clear();
    return Promise.resolve();
  }
}

const databaseName = "lens-market-data-v1";
const stores = ["history", "fxHistory", "quotes", "fxQuotes"] as const;

export class IndexedDbMarketDataCache implements MarketDataCache {
  private open() {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 2);
      request.onupgradeneeded = () => {
        stores.forEach((store) => {
          if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, { keyPath: "key" });
        });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  private async read<T>(store: (typeof stores)[number], key: string) {
    const db = await this.open();
    return new Promise<T | undefined>((resolve, reject) => {
      const request = db.transaction(store).objectStore(store).get(key);
      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error);
    }).finally(() => db.close());
  }
  private async write<T>(store: (typeof stores)[number], value: T) {
    const db = await this.open();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(store, "readwrite");
      transaction.objectStore(store).put(value);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    }).finally(() => db.close());
  }
  getHistory(assetId: string) {
    return this.read<HistoryCacheRecord>("history", assetId);
  }
  putHistory(record: HistoryCacheRecord) {
    return this.write("history", record);
  }
  getFxHistory(base: string, quote: string) {
    return this.read<FxHistoryCacheRecord>("fxHistory", `${base}:${quote}`);
  }
  putFxHistory(record: FxHistoryCacheRecord) {
    return this.write("fxHistory", record);
  }
  getQuote(assetId: string) {
    return this.read<QuoteCacheRecord>("quotes", assetId);
  }
  putQuote(record: QuoteCacheRecord) {
    return this.write("quotes", record);
  }
  getFxQuote(base: string, quote: string) {
    return this.read<FxQuoteCacheRecord>("fxQuotes", `${base}:${quote}`);
  }
  putFxQuote(record: FxQuoteCacheRecord) {
    return this.write("fxQuotes", record);
  }
  async clearMarketData() {
    const db = await this.open();
    await Promise.all(
      stores.map(
        (store) =>
          new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(store, "readwrite");
            transaction.objectStore(store).clear();
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
          }),
      ),
    );
    db.close();
  }
}

let browserCache: MarketDataCache | undefined;
export function getBrowserMarketDataCache() {
  browserCache ??=
    typeof indexedDB === "undefined" ? new MemoryMarketDataCache() : new IndexedDbMarketDataCache();
  return browserCache;
}
