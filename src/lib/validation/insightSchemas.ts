import { z } from "zod";

const contributionSchema = z.object({
  symbol: z.string().min(1).max(12),
  contributionPctPoints: z.number().finite(),
});

export const insightInputSchema = z
  .object({
    period: z.object({
      from: z.iso.datetime(),
      to: z.iso.datetime(),
      label: z.enum(["1D", "1W", "1M", "3M", "YTD", "1Y", "ALL"]),
    }),
    portfolio: z.object({
      startValue: z.number().nonnegative(),
      endValue: z.number().nonnegative(),
      absolutePnl: z.number(),
      returnPct: z.number(),
    }),
    benchmark: z.object({ name: z.string().max(80), returnPct: z.number(), deltaPct: z.number() }),
    risk: z.object({ maxDrawdownPct: z.number().nonpositive() }),
    exposure: z.object({
      btcPct: z.number().min(0).max(100),
      largestPositionPct: z.number().min(0).max(100),
    }),
    contributors: z.array(contributionSchema).max(5),
    detractors: z.array(contributionSchema).max(5),
    dataQuality: z.object({ source: z.enum(["mock", "live"]), estimated: z.boolean() }),
    context: z
      .object({
        mode: z.enum(["performance", "contribution", "drawdown"]),
        benchmarkVisible: z.boolean(),
        currency: z.literal("CZK"),
        rangeLabel: z.string().max(40),
        selectedPoint: z
          .object({
            timestamp: z.iso.datetime(),
            returnPct: z.number().finite(),
            drawdownPct: z.number().finite(),
          })
          .optional(),
        compare: z
          .object({ symbol: z.string().max(12), returnPct: z.number().finite() })
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const evidenceItemSchema = z.object({
  title: z.string().min(1).max(120),
  explanation: z.string().min(1).max(500),
  metricReference: z.string().min(1).max(120),
});

export const insightOutputSchema = z.object({
  headline: z.string().min(1).max(160),
  summary: z.string().min(1).max(800),
  drivers: z.array(evidenceItemSchema).max(4),
  watchouts: z.array(evidenceItemSchema).max(4),
  dataQualityNote: z.string().min(1).max(400),
  disclaimer: z.string().min(1).max(300),
});

export type InsightInput = z.infer<typeof insightInputSchema>;
export type InsightOutput = z.infer<typeof insightOutputSchema>;
