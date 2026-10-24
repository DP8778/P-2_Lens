import { buildFinancialAnatomy, type FinancialStatement } from "./financial-anatomy";

export const companyHistoryMetrics = ["revenue", "operatingIncome", "netIncome"] as const;
export type CompanyHistoryMetric = typeof companyHistoryMetrics[number];

/** Reuse the validated, comparable income statements; no quote or demo series enters this view. */
export function buildCompanyHistory(assetId: string, statements?: FinancialStatement[]) {
  const anatomy = buildFinancialAnatomy(assetId, statements);
  if (anatomy.status !== "available") return undefined;
  return {
    currency: anatomy.latest.currency,
    latest: anatomy.latest,
    periods: anatomy.history,
    excludedCount: anatomy.excludedHistoryCount,
  };
}

/** A zero/negative baseline cannot support a meaningful Index 100 profit comparison. */
export function companyHistoryIndex(periods: FinancialStatement[], metrics: readonly CompanyHistoryMetric[]) {
  if (!periods.length || metrics.some((metric) => periods[0][metric] <= 0)) return undefined;
  return periods.map((period) => ({ date: period.period,
    values: metrics.map((metric) => period[metric] / periods[0][metric] * 100),
  }));
}
