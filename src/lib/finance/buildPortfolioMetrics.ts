import type { PortfolioMetrics, Timeframe } from "@/types/finance";
import { buildAnalysis, initialTransactions, timeframeRange } from "./portfolio-engine";

/** @deprecated Použijte PortfolioAnalysis; zachováno pro starší karty a stories. */
export function buildPortfolioMetrics(timeframe: Timeframe): PortfolioMetrics {
  return buildAnalysis(initialTransactions, timeframeRange(timeframe)).metrics;
}
