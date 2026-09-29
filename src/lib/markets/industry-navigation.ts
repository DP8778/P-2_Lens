import { marketThemes } from "@/data/market-themes";
import { themeTimeframes, type ThemeTimeframe } from "@/lib/finance/theme-performance";
import type { IndustryWeighting } from "@/lib/finance/industry-index";

export type IndustryNavigation = { industry: string; period: ThemeTimeframe; weighting: IndustryWeighting; asOf?: string; version?: string };
export type IndustrySearchParams = Record<string, string | string[] | undefined>;
/** Only identifiers and view state cross the URL boundary. Financial values are ignored. */
export function readIndustryNavigation(query: IndustrySearchParams): IndustryNavigation | undefined {
  if (typeof query.industry !== "string" || !marketThemes.some((theme) => theme.id === query.industry)) return undefined;
  const period = query.period ?? "1M";
  const weighting = query.weighting ?? "equal";
  if (typeof period !== "string" || !themeTimeframes.includes(period as ThemeTimeframe)) return undefined;
  if (weighting !== "equal" && weighting !== "market-cap" && weighting !== "capitalization") return undefined;
  const asOf = query.asOf;
  if (asOf !== undefined && (typeof asOf !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !Number.isFinite(Date.parse(asOf)) || new Date(asOf).toISOString().slice(0, 10) !== asOf || asOf > new Date().toISOString().slice(0, 10))) return undefined;
  if (query.version !== undefined && (typeof query.version !== "string" || !/^[a-f0-9]{8,64}$/.test(query.version))) return undefined;
  return { industry: query.industry, period: period as ThemeTimeframe, weighting: weighting === "equal" ? "equal" : "capitalization", asOf, version: query.version };
}
function contextParams(context: IndustryNavigation, key: "industry" | "theme") {
  const query = new URLSearchParams({ [key]: context.industry, period: context.period, weighting: context.weighting === "equal" ? "equal" : "market-cap" });
  if (context.asOf) query.set("asOf", context.asOf);
  if (context.version) query.set("version", context.version);
  return query.toString();
}
export function industryAssetHref(locale: string, assetId: string, context?: IndustryNavigation) {
  return `/${locale}/assets/${encodeURIComponent(assetId)}${context ? `?${contextParams(context, "industry")}` : ""}`;
}
export function industryBackHref(locale: string, context: IndustryNavigation) {
  return `/${locale}/markets?${contextParams(context, "theme")}`;
}
