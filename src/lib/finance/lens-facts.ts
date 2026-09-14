import type { InsightInput } from "@/lib/validation/insightSchemas";
import type { PortfolioAnalysis, TimeRange } from "./portfolio-engine";

export type LensFacts = InsightInput;

/** Jediná hranice mezi deterministickou finanční analýzou a textovou vrstvou Lens. */
export function toLensFacts(
  analysis: PortfolioAnalysis,
  timeframe: TimeRange,
  options?: {
    mode?: "performance" | "contribution" | "drawdown";
    benchmarkVisible?: boolean;
    dataSource?: "mock" | "live";
  },
): LensFacts {
  const metrics = analysis.metrics;
  const selectedHolding = analysis.holdings.find(
    (holding) => holding.asset.symbol === analysis.compare,
  );
  const selectedContribution = analysis.contribution.items.find(
    (item) => item.symbol === analysis.compare,
  );
  return {
    period: { from: metrics.startDate, to: metrics.endDate, label: timeframe },
    portfolio: {
      startValue: metrics.startValue,
      endValue: metrics.endValue,
      absolutePnl: metrics.absolutePnl,
      returnPct: metrics.returnPct,
    },
    benchmark: {
      name: analysis.benchmark,
      returnPct: metrics.benchmarkReturnPct,
      deltaPct: metrics.benchmarkDeltaPct,
    },
    risk: {
      maxDrawdownPct: analysis.drawdown.maxDrawdown,
      currentDrawdownPct: analysis.drawdown.currentDrawdown,
      peakDate: analysis.drawdown.peak?.date,
      troughDate: analysis.drawdown.trough?.date,
      recoveryDate: analysis.drawdown.recovery?.date,
      recoveryStatus: analysis.drawdown.status,
    },
    exposure: {
      btcPct: metrics.btcExposurePct,
      largestPositionPct: analysis.concentration.largestPosition?.allocationPct ?? 0,
      largestPositionSymbol: analysis.concentration.largestPosition?.symbol,
      top3Pct: analysis.concentration.top3Share,
      assetCount: analysis.concentration.assetCount,
      cashPct: analysis.concentration.cashShare,
    },
    contribution: {
      residualPctPoints: analysis.contribution.residual,
      topContributor: analysis.contribution.topContributor
        ? {
            assetId: analysis.contribution.topContributor.assetId,
            symbol: analysis.contribution.topContributor.symbol,
            contributionPctPoints: analysis.contribution.topContributor.contributionPctPoints,
          }
        : undefined,
      topDetractor: analysis.contribution.topDetractor
        ? {
            assetId: analysis.contribution.topDetractor.assetId,
            symbol: analysis.contribution.topDetractor.symbol,
            contributionPctPoints: analysis.contribution.topDetractor.contributionPctPoints,
          }
        : undefined,
    },
    contributors: analysis.contribution.items
      .filter((item) => item.contributionPctPoints > 0)
      .slice(0, 5)
      .map(({ assetId, symbol, contributionPctPoints }) => ({
        assetId,
        symbol,
        contributionPctPoints,
      })),
    detractors: [...analysis.contribution.items]
      .filter((item) => item.contributionPctPoints < 0)
      .sort((a, b) => a.contributionPctPoints - b.contributionPctPoints)
      .slice(0, 5)
      .map(({ assetId, symbol, contributionPctPoints }) => ({
        assetId,
        symbol,
        contributionPctPoints,
      })),
    dataQuality: {
      source: options?.dataSource ?? "mock",
      estimated: (options?.dataSource ?? "mock") === "mock",
      missingPriceAssetIds: analysis.missingPriceAssetIds,
    },
    selection: {
      asset:
        analysis.compare && (selectedHolding || selectedContribution)
          ? {
              assetId: selectedHolding?.assetId ?? selectedContribution!.assetId,
              symbol: analysis.compare,
              returnPct: analysis.points.at(-1)?.assetReturnPct ?? 0,
              contributionPctPoints: selectedContribution?.contributionPctPoints ?? 0,
              averageAllocationPct: selectedContribution?.averageAllocationPct ?? 0,
              currentAllocationPct: selectedHolding?.allocationPct ?? 0,
            }
          : undefined,
      point: analysis.selectedPoint
        ? {
            timestamp: analysis.selectedPoint.timestamp,
            value: analysis.selectedPoint.portfolioValue,
            returnPct: analysis.selectedPoint.portfolioReturnPct,
            drawdownPct: analysis.selectedPoint.drawdown,
            benchmarkDeltaPct: options?.benchmarkVisible
              ? analysis.selectedPoint.benchmarkDeltaPct
              : undefined,
            isTrough: analysis.selectedPoint.timestamp === analysis.drawdown.trough?.date,
          }
        : undefined,
    },
    context: {
      mode: options?.mode ?? "performance",
      benchmarkVisible: options?.benchmarkVisible ?? true,
      currency: "CZK",
      rangeLabel: timeframe,
      selectedRange: analysis.timeframe === "CUSTOM" ? [metrics.startDate, metrics.endDate] : undefined,
      selectedAsset: analysis.compare,
      selectedPoint: analysis.selectedPoint
        ? {
            timestamp: analysis.selectedPoint.timestamp,
            returnPct: analysis.selectedPoint.portfolioReturnPct,
            drawdownPct: analysis.selectedPoint.drawdown,
          }
        : undefined,
      compare: analysis.compare
        ? {
            symbol: analysis.compare,
            returnPct:
              analysis.selectedPoint?.assetReturnPct ?? analysis.points.at(-1)?.assetReturnPct ?? 0,
          }
        : undefined,
    },
  };
}
