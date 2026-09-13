import { z } from "zod";
import { transactionsSchema } from "@/lib/finance/portfolio-engine";
import { assetCatalog } from "@/data/mock/catalog";
import { insightResponseSchema, type InsightResponse } from "./insightSchemas";
export const portfolioContextSchema = z
  .object({
    transactions: transactionsSchema,
    selectedRange: z
      .tuple([z.iso.datetime(), z.iso.datetime()])
      .refine(([a, b]) => a < b)
      .nullable(),
    benchmarkId: z.enum(["spy", "qqq"]),
    compareAssetId: z.string().refine((id) => id === "" || assetCatalog.some((a) => a.id === id)),
    mode: z.enum(["performance", "contribution", "drawdown"]),
    showBenchmark: z.boolean(),
    selectedPoint: z.iso.datetime().nullable(),
    timeframe: z.enum(["1W", "1M", "3M", "YTD", "1Y", "ALL", "CUSTOM"]),
    explain: z.boolean().optional(),
  })
  .strict()
  .refine(
    (input) =>
      input.selectedPoint === null ||
      input.selectedRange === null ||
      (input.selectedPoint >= input.selectedRange[0] && input.selectedPoint <= input.selectedRange[1]),
  );
export type PortfolioContext = z.infer<typeof portfolioContextSchema>;
export const contextInsightSchema = insightResponseSchema;
export type ContextInsight = InsightResponse;
