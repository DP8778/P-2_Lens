"use client";
import type { PortfolioAnalysis } from "@/lib/finance/portfolio-engine";
import type { AnalysisState } from "./AnalysisProvider";

export function AnalysisInspector({
  state,
  analysis,
}: {
  state: AnalysisState;
  analysis: PortfolioAnalysis;
}) {
  if (process.env.NODE_ENV !== "development") return null;
  return (
    <details className="surface" style={{ marginTop: 24, padding: 16 }}>
      <summary>Dev · AnalysisContext</summary>
      <pre style={{ overflow: "auto", marginTop: 12, fontSize: 12 }}>
        {JSON.stringify(
          {
            state,
            selectedPeriod: analysis.selectedPeriod,
            selectedPoint: analysis.selectedPoint?.timestamp ?? null,
            summary: analysis.summary,
            missingPriceAssetIds: analysis.missingPriceAssetIds,
          },
          null,
          2,
        )}
      </pre>
    </details>
  );
}
