import { z } from "zod";
import snapshot from "./snapshots/current.json";
import { marketAssetSchema } from "@/lib/market-data/validation";
import { validStatement } from "@/lib/finance/fundamentals-normalizers";
import { industryEconomics } from "@/lib/finance/industry-data";
import type { FundamentalsSource } from "./source";
import { canonicalInstrumentId } from "@/lib/instruments/identity";

const statementBase = z.object({
  assetId: z.string(), period: z.iso.date(), currency: z.string().regex(/^[A-Z]{3}$/), durationMonths: z.literal(12), source: z.url(), segmentSource: z.url().optional(),
  sourceScale: z.number().positive().optional(), accountingBasis: z.literal("gaap-consolidated").optional(),
  publishedAt: z.iso.date().optional(), retrievedAt: z.iso.datetime().optional(), valueStatus: z.literal("reported").optional(),
  grossSpend: z.object({ value: z.number().positive(), source: z.url(), sourceScale: z.number().positive(), publishedAt: z.iso.date(), retrievedAt: z.iso.datetime(), status: z.literal("reported") }).optional(),
  segmentBasis: z.enum(["reported", "retrospectively-adjusted"]).optional(),
  revenue: z.number().positive(), operatingExpenses: z.number().nonnegative(), operatingIncome: z.number(), netIncome: z.number(),
  segments: z.array(z.object({ name: z.string(), revenue: z.number().nonnegative() })).optional(),
  expenses: z.object({ salesMarketing: z.number().nonnegative().optional(), researchDevelopment: z.number().nonnegative().optional(), generalAdministrative: z.number().nonnegative().optional(), platformOperations: z.number().nonnegative().optional(), technologyDevelopment: z.number().nonnegative().optional() }).optional(),
});
const statementSchema = z.union([
  statementBase.extend({ presentation: z.literal("gross-profit").optional(), costOfRevenue: z.number().nonnegative(), grossProfit: z.number() }),
  statementBase.extend({ presentation: z.literal("operating-expenses"), costOfRevenue: z.never().optional(), grossProfit: z.never().optional() }),
]).refine(validStatement, "Statement identities do not reconcile");
const recordSchema = z.object({ symbol: z.string(), fetchedAt: z.iso.datetime(), provider: z.string(), statements: z.array(statementSchema), errors: z.array(z.string()).optional() });
const industrySchema = z.object({ id: z.string(), version: z.string(), updatedAt: z.iso.datetime(), rebalancedAt: z.iso.datetime(), sourceDates: z.record(z.string(), z.string()), sources: z.array(z.url()), candidateCount: z.number(), excluded: z.array(z.object({ symbol: z.string(), reason: z.string() })), members: z.array(z.object({ asset: marketAssetSchema, marketCap: z.number().positive(), marketCapSource: z.url() })).max(100) });
const snapshotSchema = z.object({ schemaVersion: z.literal(1), version: z.string(), updatedAt: z.iso.datetime(), industries: z.record(z.string(), industrySchema), fundamentals: z.record(z.string(), recordSchema), instruments: z.array(z.object({ asset: marketAssetSchema, source: z.url(), verifiedAt: z.iso.datetime(), listingCategory: z.string() })).default([]) });

export function createSnapshotSource(input: unknown): FundamentalsSource {
  const data = snapshotSchema.parse(input);
  const members = Object.values(data.industries).flatMap((industry) => industry.members);
  const instruments = [...data.instruments, ...members];
  return {
    getInstrument(assetId) {
      const canonicalId = canonicalInstrumentId(assetId);
      return instruments.find((row) => row.asset.id === canonicalId)?.asset;
    },
    getCompany(assetId) {
      const canonicalId = canonicalInstrumentId(assetId);
      const member = instruments.find((row) => row.asset.id === canonicalId);
      const record = member && data.fundamentals[member.asset.symbol];
      return record ? { ...record, statements: record.statements.filter((statement) => statement.assetId === canonicalId) } : undefined;
    },
    getIndustries() {
      return Object.fromEntries(Object.entries(data.industries).map(([id, industry]) => [id, {
        ...industry, economics: industryEconomics(industry.members, data.fundamentals, Number(data.updatedAt.slice(0, 4)) - 1),
      }]));
    },
  };
}
export const fundamentalsSource = createSnapshotSource(snapshot);
