import { insightContextSchema, insightResponseSchema } from "@/lib/validation/insightSchemas";
import {
  buildDeterministicInsight,
  buildInsightContext,
} from "@/lib/insights/insight-context";
import { buildAnalysis, initialTransactions, timeframeRange } from "@/lib/finance/portfolio-engine";
import { toLensFacts } from "@/lib/finance/lens-facts";
import type { PortfolioContext } from "@/lib/validation/portfolioContext";

describe("AI trust boundary", () => {
  const input: PortfolioContext = {
    transactions: initialTransactions,
    selectedRange: null,
    timeframe: "1M",
    benchmarkId: "spy",
    compareAssetId: "",
    mode: "performance",
    showBenchmark: true,
    selectedPoint: null,
  };
  const analysis = buildAnalysis(initialTransactions, timeframeRange("1M"));
  const context = buildInsightContext(analysis, input, toLensFacts(analysis, "1M"));

  test("accepts only the strict verified context without application state or PII", () => {
    expect(insightContextSchema.safeParse(context).success).toBe(true);
    expect(insightContextSchema.safeParse({ ...context, email: "private@example.com" }).success).toBe(
      false,
    );
    expect(JSON.stringify(context)).not.toContain("transactions");
  });

  test("creates a schema-valid deterministic response", () => {
    expect(insightResponseSchema.safeParse(buildDeterministicInsight(context)).success).toBe(true);
  });
});
