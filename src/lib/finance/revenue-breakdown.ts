import type { FinancialStatement } from "./financial-anatomy";

export type RevenueBreakdownPeriod = {
  fiscalYear: number;
  period: string;
  currency: string;
  durationMonths: number;
  revenue: number;
  source: string;
  sourceScale?: number;
  segmentBasis?: FinancialStatement["segmentBasis"];
  segments: { name: string; revenue: number; sharePct: number; changePct?: number; absoluteChange?: number }[];
};

export type RevenueGrowthSummary = {
  fiscalYear: number;
  priorFiscalYear: number;
  largestSegment: { name: string; revenue: number };
  largestGrowthContributor: { name: string; absoluteChange: number };
  changes: { name: string; absoluteChange: number }[];
};

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(a), Math.abs(b)) * 0.00001;

function validSegments(statement: FinancialStatement) {
  return statement.segments?.length
    && statement.segments.every((segment) => segment.name.trim() && finite(segment.revenue) && segment.revenue >= 0)
    && close(statement.segments.reduce((sum, segment) => sum + segment.revenue, 0), statement.revenue);
}

/** Build a comparable two-period segment view without inferring missing revenue or mixing units. */
export function buildRevenueBreakdown(assetId: string, statements: FinancialStatement[] = []) {
  const candidates = statements
    .filter((statement) => statement.assetId === assetId && statement.durationMonths === 12
      && /^\d{4}-\d{2}-\d{2}$/.test(statement.period) && finite(statement.revenue) && statement.revenue > 0
      && /^[A-Z]{3}$/.test(statement.currency) && /^https:\/\//.test(statement.segmentSource ?? statement.source))
    .sort((a, b) => b.period.localeCompare(a.period));
  const latest = candidates.find(validSegments);
  if (!latest?.segments) return { status: "unavailable" as const, reason: "missing-segments" as const };
  const prior = candidates.find((statement) => {
    const days = (Date.parse(latest.period) - Date.parse(statement.period)) / 86_400_000;
    return statement !== latest && statement.currency === latest.currency && statement.durationMonths === latest.durationMonths
      && (!latest.accountingBasis || statement.accountingBasis === latest.accountingBasis)
      && days >= 350 && days <= 380 && validSegments(statement);
  });
  if (!prior?.segments) return { status: "unavailable" as const, reason: "missing-comparison" as const };
  const priorByName = new Map(prior.segments.map((segment) => [segment.name, segment]));
  if (latest.segments.length !== prior.segments.length || latest.segments.some((segment) => !priorByName.has(segment.name))) {
    return { status: "unavailable" as const, reason: "incomparable-segments" as const };
  }
  const periods: RevenueBreakdownPeriod[] = [latest, prior].map((statement) => ({
    fiscalYear: Number(statement.period.slice(0, 4)), period: statement.period, currency: statement.currency,
    durationMonths: statement.durationMonths, revenue: statement.revenue,
    source: statement.segmentSource ?? statement.source, sourceScale: statement.sourceScale,
    segmentBasis: statement.segmentBasis,
    segments: latest.segments!.map((latestSegment) => {
      const segment = statement.segments!.find((candidate) => candidate.name === latestSegment.name)!;
      const comparison = statement === latest ? priorByName.get(segment.name) : undefined;
      return { ...segment, sharePct: segment.revenue / statement.revenue * 100,
        ...(comparison ? { absoluteChange: segment.revenue - comparison.revenue } : {}),
        ...(comparison && comparison.revenue > 0 ? { changePct: (segment.revenue / comparison.revenue - 1) * 100 } : {}) };
    }),
  }));
  const changes = periods[0].segments.map(({ name, absoluteChange }) => ({ name, absoluteChange: absoluteChange! }));
  const growth: RevenueGrowthSummary = {
    fiscalYear: periods[0].fiscalYear,
    priorFiscalYear: periods[1].fiscalYear,
    largestSegment: periods[0].segments.reduce((largest, segment) => segment.revenue > largest.revenue ? segment : largest),
    largestGrowthContributor: changes.reduce((largest, segment) => segment.absoluteChange > largest.absoluteChange ? segment : largest),
    changes,
  };
  return { status: "available" as const, periods, latest: periods[0], prior: periods[1], growth };
}
