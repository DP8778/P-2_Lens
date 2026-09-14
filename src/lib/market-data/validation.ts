import { z } from "zod";
import { marketAssetIdentity } from "./types";

const isoCurrency = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/);
const symbol = z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9./:_-]+$/);
export const marketAssetSchema = z
  .object({
    id: z.string().min(3).max(180),
    provider: z.enum(["twelvedata", "mock", "demo"]),
    providerSymbol: symbol,
    symbol: symbol,
    name: z.string().trim().min(1).max(180),
    type: z.enum(["stock", "etf", "crypto", "cash"]),
    exchange: z.string().trim().min(1).max(80),
    micCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4}$/).optional(),
    currency: isoCurrency,
    country: z.string().trim().max(80).optional(),
    timezone: z.string().trim().max(80).optional(),
  })
  .strict();
export const twelveDataAssetSchema = marketAssetSchema.refine(
  (asset) =>
    asset.provider === "twelvedata" &&
    asset.id === marketAssetIdentity("twelvedata", asset.symbol, asset.micCode, asset.exchange),
  { message: "Neplatná identita aktiva." },
);
export const searchQuerySchema = z.string().trim().min(2).max(80);
export const quotesRequestSchema = z
  .object({ assets: z.array(twelveDataAssetSchema).min(1).max(24) })
  .strict();
export const historyQuerySchema = z
  .object({
    asset: z.string().min(2).max(10000),
    from: z.iso.date(),
    to: z.iso.date(),
    interval: z.literal("1day").default("1day"),
  })
  .refine((value) => value.from <= value.to, { message: "Neplatný rozsah dat." });
export const fxQuerySchema = z
  .object({
    from: isoCurrency,
    to: isoCurrency,
    start: z.iso.date().optional(),
    end: z.iso.date().optional(),
  })
  .refine((value) => (!value.start && !value.end) || (!!value.start && !!value.end), {
    message: "Historický FX rozsah vyžaduje start i end.",
  })
  .refine((value) => !value.start || !value.end || value.start <= value.end, {
    message: "Neplatný FX rozsah.",
  });
