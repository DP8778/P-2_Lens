import type { IndustryIndex } from "./industry-index";

export const industryCoveragePolicy = { minimumRatio: 0.8, minimumCompanies: 10 } as const;
export function hasReliableIndustryCoverage(coverage: number, total: number) {
  return total > 0 && coverage >= Math.ceil(total * industryCoveragePolicy.minimumRatio)
    && coverage >= Math.min(industryCoveragePolicy.minimumCompanies, total);
}
export function industryPerformanceState(index: IndustryIndex, loading: boolean, stale: boolean) {
  const usable = index.status === "complete" && hasReliableIndustryCoverage(index.coverage, index.total);
  return { usable, state: !usable ? loading ? "loading" : "insufficient"
    : stale ? "stale" : index.partial ? "partial" : "reliable" } as const;
}
