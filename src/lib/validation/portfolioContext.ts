import { z } from "zod";
import { holdingsSchema } from "@/lib/finance/portfolio-engine";
import { assetCatalog } from "@/data/mock/catalog";
export const portfolioContextSchema = z
  .object({
    holdings: holdingsSchema,
    range: z
      .tuple([z.number().int().min(0).max(729), z.number().int().min(1).max(730)])
      .refine(([a, b]) => a < b),
    benchmark: z.enum(["spy", "qqq"]),
    compare: z.string().refine((id) => id === "" || assetCatalog.some((a) => a.id === id)),
    mode: z.enum(["performance", "contribution", "drawdown"]),
    showBenchmark: z.boolean(),
    selected: z.number().int().min(0).max(730).nullable(),
    timeframe: z.enum(["1D", "1W", "1M", "3M", "YTD", "1Y", "ALL", "CUSTOM"]),
    explain: z.boolean().optional(),
  })
  .strict()
  .refine((input) => input.selected === null || input.selected <= input.range[1] - input.range[0]);
export type PortfolioContext = z.infer<typeof portfolioContextSchema>;
export const contextInsightSchema = z.object({
  headline: z.string().max(200),
  summary: z.string().max(1600),
  context: z.string().max(200),
  explanation: z.string().max(1600).optional(),
  mode: z.enum(["deterministic", "ai"]),
});
export type ContextInsight = z.infer<typeof contextInsightSchema>;
