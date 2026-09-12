import { buildInsightInput } from "@/lib/ai/buildInsightInput";
import { buildFallbackInsight } from "@/lib/ai/fallbackSummarizer";
import { buildPortfolioMetrics } from "@/lib/finance/buildPortfolioMetrics";
import { insightInputSchema, insightOutputSchema } from "@/lib/validation/insightSchemas";
describe("AI trust boundary", () => {
  const input = buildInsightInput(buildPortfolioMetrics("1M"), "1M");
  test("accepts only structured metric input", () => {
    expect(insightInputSchema.safeParse(input).success).toBe(true);
    expect(insightInputSchema.safeParse({ ...input, email: "private@example.com" }).success).toBe(
      false,
    );
  });
  test("creates a schema-valid deterministic fallback", () => {
    const insight = buildFallbackInsight(input);
    expect(insightOutputSchema.safeParse(insight).success).toBe(true);
    expect(insight.summary).toContain("benchmark");
  });
});
