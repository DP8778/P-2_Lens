import { z } from "zod";
import { MarketDataError } from "../errors";
import { marketAssetIdentity, type MarketAsset, type MarketQuote } from "../types";

const supportedTypes = {
  "Common Stock": "stock",
  ETF: "etf",
  "Digital Currency": "crypto",
} as const;

const searchResponseSchema = z.object({
  data: z.array(
    z.object({
      symbol: z.string(),
      instrument_name: z.string(),
      exchange: z.string().optional().default("Unknown"),
      mic_code: z.string().nullable().optional(),
      exchange_timezone: z.string().nullable().optional(),
      instrument_type: z.string(),
      country: z.string().nullable().optional(),
      currency: z.string(),
      access: z.object({
        global: z.string().optional(),
        plan: z.string().optional(),
        plan_business: z.string().optional(),
      }).optional(),
    }),
  ),
  status: z.string().optional(),
});

const quoteSchema = z.object({
  symbol: z.string(),
  name: z.string().optional(),
  exchange: z.string().optional(),
  mic_code: z.string().nullable().optional(),
  currency: z.string(),
  close: z.union([z.string(), z.number()]),
  change: z.union([z.string(), z.number()]).nullable().optional(),
  percent_change: z.union([z.string(), z.number()]).nullable().optional(),
  timestamp: z.number().optional(),
  datetime: z.string().optional(),
  is_market_open: z.boolean().optional(),
});

const historySchema = z.object({
  meta: z.object({ currency: z.string().optional() }).passthrough(),
  values: z.array(
    z.object({ datetime: z.string(), close: z.union([z.string(), z.number()]) }),
  ),
  status: z.string().optional(),
});

const finitePositive = (value: string | number, field: string) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0)
    throw new MarketDataError("INVALID_RESPONSE", `Provider vrátil neplatné pole ${field}.`, false);
  return parsed;
};

export function normalizeSearchResponse(input: unknown): MarketAsset[] {
  const parsed = searchResponseSchema.safeParse(input);
  if (!parsed.success)
    throw new MarketDataError("INVALID_RESPONSE", "Neplatná odpověď symbol search.", false);
  return parsed.data.data.flatMap((row) => {
    const type = supportedTypes[row.instrument_type as keyof typeof supportedTypes];
    if (!type) return [];
    const symbol = row.symbol.toUpperCase();
    const micCode = row.mic_code?.toUpperCase() || undefined;
    return [
      {
        id: marketAssetIdentity("twelvedata", symbol, micCode, row.exchange),
        provider: "twelvedata",
        providerSymbol: symbol,
        symbol,
        name: row.instrument_name,
        type,
        exchange: row.exchange,
        micCode,
        currency: row.currency.toUpperCase(),
        country: row.country || undefined,
        timezone: row.exchange_timezone || undefined,
        access: row.access ? {
          global: row.access.global,
          plan: row.access.plan,
          planBusiness: row.access.plan_business,
        } : undefined,
      },
    ];
  });
}

export function normalizeQuote(input: unknown, asset: MarketAsset): MarketQuote {
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success)
    throw new MarketDataError("INVALID_RESPONSE", "Neplatná odpověď quote.", false);
  const row = parsed.data;
  const timestamp = row.timestamp
    ? new Date(row.timestamp * 1000).toISOString()
    : new Date(`${row.datetime ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`).toISOString();
  return {
    assetId: asset.id,
    price: finitePositive(row.close, "close"),
    currency: row.currency.toUpperCase(),
    change: row.change == null ? undefined : Number(row.change),
    changePercent: row.percent_change == null ? undefined : Number(row.percent_change),
    timestamp,
    marketState: row.is_market_open === true ? "open" : row.is_market_open === false ? "closed" : "unknown",
    freshness: row.is_market_open === false ? "lastClose" : "fresh",
    source: "network",
  };
}

export function normalizeHistory(input: unknown, asset: MarketAsset) {
  const parsed = historySchema.safeParse(input);
  if (!parsed.success)
    throw new MarketDataError("INVALID_RESPONSE", "Neplatná odpověď time series.", false);
  if (!parsed.data.values.length)
    throw new MarketDataError("NO_HISTORY", "Historická data nejsou dostupná.", false, 404);
  return parsed.data.values
    .map((row) => ({
      assetId: asset.id,
      date: row.datetime.slice(0, 10),
      close: finitePositive(row.close, "close"),
      currency: (parsed.data.meta.currency || asset.currency).toUpperCase(),
      adjustedForSplits: asset.type === "stock" || asset.type === "etf",
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function normalizeFxRate(value: unknown, from: string, to: string, timestamp?: number) {
  const parsed = z.object({ rate: z.union([z.string(), z.number()]) }).safeParse(value);
  if (!parsed.success)
    throw new MarketDataError("INVALID_RESPONSE", "Neplatná FX odpověď.", false);
  return {
    base: from,
    quote: to,
    rate: finitePositive(parsed.data.rate, "rate"),
    timestamp: new Date((timestamp ?? Date.now() / 1000) * 1000).toISOString(),
    freshness: "fresh" as const,
    source: "network" as const,
  };
}

export function invertFxRate(rate: number) {
  if (!Number.isFinite(rate) || rate <= 0)
    throw new MarketDataError("INVALID_RESPONSE", "Měnový kurz nelze invertovat.", false);
  return 1 / rate;
}
