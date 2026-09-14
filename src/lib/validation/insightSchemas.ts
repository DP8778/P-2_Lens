import { z } from "zod";

const contributionSchema = z.object({
  assetId: z.string().max(180).optional(),
  symbol: z.string().min(1).max(12),
  contributionPctPoints: z.number().finite(),
}).strict();

const lensSelectionSchema = z
  .object({
    asset: z
      .object({
        assetId: z.string().min(1).max(180),
        symbol: z.string().min(1).max(12),
        returnPct: z.number().finite(),
        contributionPctPoints: z.number().finite(),
        averageAllocationPct: z.number().finite(),
        currentAllocationPct: z.number().finite(),
      })
      .strict()
      .optional(),
    point: z
      .object({
        timestamp: z.iso.datetime(),
        value: z.number().nonnegative(),
        returnPct: z.number().finite(),
        drawdownPct: z.number().nonpositive(),
        benchmarkDeltaPct: z.number().finite().optional(),
        isTrough: z.boolean(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const insightInputSchema = z
  .object({
    period: z.object({
      from: z.iso.datetime(),
      to: z.iso.datetime(),
      label: z.enum(["1W", "1M", "3M", "YTD", "1Y", "ALL"]),
    }),
    portfolio: z.object({
      startValue: z.number().nonnegative(),
      endValue: z.number().nonnegative(),
      absolutePnl: z.number(),
      returnPct: z.number(),
    }),
    benchmark: z.object({ name: z.string().max(80), returnPct: z.number(), deltaPct: z.number() }),
    risk: z.object({
      maxDrawdownPct: z.number().nonpositive(),
      currentDrawdownPct: z.number().nonpositive(),
      peakDate: z.iso.datetime().optional(),
      troughDate: z.iso.datetime().optional(),
      recoveryDate: z.iso.datetime().optional(),
      recoveryStatus: z.enum(["no-drawdown", "recovered", "unrecovered"]),
    }),
    exposure: z.object({
      btcPct: z.number().min(0).max(100),
      largestPositionPct: z.number().min(0).max(100),
      largestPositionSymbol: z.string().min(1).max(12).optional(),
      top3Pct: z.number().min(0).max(100),
      assetCount: z.number().int().nonnegative(),
      cashPct: z.number().min(0).max(100),
    }),
    contribution: z.object({
      residualPctPoints: z.number().finite(),
      topContributor: contributionSchema.optional(),
      topDetractor: contributionSchema.optional(),
    }),
    contributors: z.array(contributionSchema).max(5),
    detractors: z.array(contributionSchema).max(5),
    dataQuality: z.object({
      source: z.enum(["mock", "live"]),
      estimated: z.boolean(),
      missingPriceAssetIds: z.array(z.string().min(1).max(80)).max(20).default([]),
    }),
    selection: lensSelectionSchema,
    context: z
      .object({
        mode: z.enum(["performance", "contribution", "drawdown"]),
        benchmarkVisible: z.boolean(),
        currency: z.literal("CZK"),
        rangeLabel: z.string().max(40),
        selectedRange: z.tuple([z.iso.datetime(), z.iso.datetime()]).optional(),
        selectedAsset: z.string().max(12).optional(),
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

export type InsightInput = z.infer<typeof insightInputSchema>;

export const insightEvidenceActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("selectAsset"), assetId: z.string().min(1).max(180) }).strict(),
  z.object({ type: z.literal("selectDrawdown"), timestamp: z.iso.datetime() }).strict(),
  z.object({ type: z.literal("showBenchmark") }).strict(),
]);

export const insightEvidenceSchema = z
  .object({
    id: z.string().min(1).max(80),
    label: z.string().min(1).max(100),
    metric: z.enum([
      "portfolioReturn",
      "portfolioValue",
      "benchmarkReturn",
      "benchmarkDelta",
      "assetReturn",
      "assetContribution",
      "assetAllocation",
      "residual",
      "maxDrawdown",
      "currentDrawdown",
      "largestPosition",
      "top3Share",
      "cashShare",
    ]),
    value: z.number().finite(),
    unit: z.enum(["CZK", "percent", "percentage-point"]),
    source: z.literal("PortfolioAnalysis"),
    detail: z.string().max(140).optional(),
    action: insightEvidenceActionSchema.optional(),
  })
  .strict();

const insightClaimSchema = z
  .object({
    text: z.string().min(1).max(360),
    evidenceIds: z.array(z.string().min(1).max(80)).min(1).max(3),
  })
  .strict();

export const insightContextSchema = z
  .object({
    datasetVersion: z.enum(["lens-demo-2026.09-v2", "live-market-data-v1"]),
    scope: z
      .object({
        type: z.enum(["range", "timeframe", "overview"]),
        label: z.string().min(1).max(100),
        from: z.iso.datetime(),
        to: z.iso.datetime(),
      })
      .strict(),
    focus: z
      .object({
        type: z.enum(["point", "asset", "mode", "overview"]),
        label: z.string().min(1).max(100),
      })
      .strict(),
    mode: z.enum(["performance", "contribution", "drawdown"]),
    performance: z
      .object({
        portfolioReturnPct: z.number().finite(),
        portfolioValueCzk: z.number().nonnegative(),
        benchmark: z
          .object({
            symbol: z.string().min(1).max(12),
            returnPct: z.number().finite(),
            deltaPctPoints: z.number().finite(),
          })
          .strict()
          .optional(),
      })
      .strict(),
    drivers: z
      .object({
        topContributor: contributionSchema.optional(),
        topDetractor: contributionSchema.optional(),
        residualPctPoints: z.number().finite(),
      })
      .strict(),
    risk: z
      .object({
        maxDrawdownPct: z.number().nonpositive(),
        currentDrawdownPct: z.number().nonpositive(),
        peakDate: z.iso.datetime().optional(),
        troughDate: z.iso.datetime().optional(),
        recoveryDate: z.iso.datetime().optional(),
        recoveryStatus: z.enum(["no-drawdown", "recovered", "unrecovered"]),
        largestPosition: z
          .object({ symbol: z.string().min(1).max(12), allocationPct: z.number().finite() })
          .strict()
          .optional(),
        top3Pct: z.number().finite(),
        cashPct: z.number().finite(),
      })
      .strict(),
    selection: lensSelectionSchema,
    evidence: z.array(insightEvidenceSchema).max(12),
    limitations: z.array(z.string().min(1).max(240)).max(4),
  })
  .strict();

export const insightResponseSchema = z
  .object({
    scopeLabel: z.string().min(1).max(100),
    headline: z.string().min(1).max(160),
    summary: z.string().min(1).max(700),
    drivers: z.array(insightClaimSchema).max(3),
    riskNotes: z.array(insightClaimSchema).max(2),
    evidence: z.array(insightEvidenceSchema).max(8),
    limitations: z.array(z.string().min(1).max(240)).max(3),
    mode: z.enum(["deterministic", "ai"]),
  })
  .strict();

export const aiInsightWordingSchema = z
  .object({
    headline: z.string().min(1).max(160),
    summary: z.string().min(1).max(700),
    drivers: z.array(insightClaimSchema).max(3),
    riskNotes: z.array(insightClaimSchema).max(2),
    limitations: z.array(z.string().min(1).max(240)).max(3),
  })
  .strict();

export type InsightContext = z.infer<typeof insightContextSchema>;
export type InsightResponse = z.infer<typeof insightResponseSchema>;
export type InsightEvidence = z.infer<typeof insightEvidenceSchema>;
export type AiInsightWording = z.infer<typeof aiInsightWordingSchema>;
