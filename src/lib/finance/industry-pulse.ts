import type { IndustryIndex } from "./industry-index";
import type { IndustryOverview } from "./industry-overview";

/** Same observed cohort AND dates; never silently recalculate either index for display. */
export function comparableIndustryIndices(equal: IndustryIndex, capitalization: IndustryIndex) {
  if (equal.status !== "complete" || capitalization.status !== "complete") return false;
  const ids = new Set(equal.contributors.map((row) => row.asset.id));
  return ids.size === capitalization.contributors.length && capitalization.contributors.every((row) => ids.has(row.asset.id))
    && equal.points.length === capitalization.points.length && equal.points.every((point, i) => point.date === capitalization.points[i].date);
}
export type IndustryPulseKind = "insufficient" | "different-cohorts" | "narrow-positive" | "large-leading" | "broad-positive" | "broad-negative" | "mixed";
/** Descriptive policy, not a forecast: >=80% coverage and >=min(10,total) observations. */
export function interpretIndustryPulse(equal: IndustryIndex, capitalization: IndustryIndex, overview: IndustryOverview, top10?: number, stale = false) {
  const comparable = comparableIndustryIndices(equal, capitalization);
  let kind: IndustryPulseKind = "insufficient";
  if (equal.status !== "complete" || capitalization.status !== "complete") return { kind, comparable };
  if (!comparable) return { kind: "different-cohorts" as const, comparable };
  const gap = capitalization.returnPct - equal.returnPct;
  if (stale || equal.total === 0 || equal.coverage / equal.total < .8 || equal.coverage < Math.min(10, equal.total)
    || overview.measured !== equal.coverage || overview.risingPercent === undefined || overview.medianReturn === undefined) return { kind, comparable, gap };
  const breadth = overview.risingPercent, median = overview.medianReturn;
  if (capitalization.returnPct > 0 && breadth < 50) kind = "narrow-positive";
  else if (capitalization.returnPct > 0 && gap >= 2 && (breadth < 70 || median < capitalization.returnPct - 2 || (top10 !== undefined && top10 >= 50))) kind = "large-leading";
  else if (Math.abs(gap) <= 2 && equal.returnPct > 0 && capitalization.returnPct > 0 && breadth >= 60 && median > 0) kind = "broad-positive";
  else if (Math.abs(gap) <= 2 && equal.returnPct < 0 && capitalization.returnPct < 0 && breadth <= 40 && median < 0) kind = "broad-negative";
  else kind = "mixed";
  return { kind, comparable, gap };
}
export const industryPulseCopy: Record<IndustryPulseKind, [string, string]> = {
  insufficient: ["Pokrytí nebo aktuálnost dat zatím nestačí k jistému posouzení účasti firem.", "Coverage or freshness is insufficient to assess participation confidently."],
  "different-cohorts": ["Řady zahrnují různé firmy nebo data. Jejich rozdíl nelze vykládat jako vliv velikosti firem.", "The series cover different companies or dates. Their gap cannot be attributed to company size."],
  "narrow-positive": ["Vážený index roste, ale méně než polovina změřených firem je v plusu.", "The weighted index is positive, but fewer than half of measured companies are rising."],
  "large-leading": ["Ve změřené části odvětví vedou toto období větší společnosti.", "Larger companies are leading this period in the measured universe."],
  "broad-positive": ["Růst je rozložený napříč většinou změřených firem.", "Gains are broadly distributed across the measured universe."],
  "broad-negative": ["Pokles zasahuje většinu změřených firem při obou způsobech vážení.", "Declines affect most measured companies under both weighting methods."],
  mixed: ["Účast firem je smíšená. Rozdíl vah sám o sobě nepotvrzuje plošný pohyb.", "Participation is mixed. The weighting gap alone does not establish a broad move."],
};
