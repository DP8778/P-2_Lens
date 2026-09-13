/** @jest-environment node */
import { POST } from "@/app/api/ai/portfolio-insight/route";
import { buildAnalysis, initialTransactions, timeframeRange } from "@/lib/finance/portfolio-engine";
import { toLensFacts } from "@/lib/finance/lens-facts";
import { buildInsightContext } from "@/lib/insights/insight-context";
import type { PortfolioContext } from "@/lib/validation/portfolioContext";

const portfolioContext: PortfolioContext = {
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
const verifiedContext = buildInsightContext(
  analysis,
  portfolioContext,
  toLensFacts(analysis, "1M"),
);

describe("POST /api/ai/portfolio-insight", () => {
  test("returns the complete deterministic response without an API key", async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const response = await POST(
      new Request("http://localhost/api/ai/portfolio-insight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(verifiedContext),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.mode).toBe("demo");
    expect(body.insight.mode).toBe("deterministic");
    expect(body.insight.evidence.length).toBeGreaterThan(0);
    process.env.OPENAI_API_KEY = previous;
  });

  test("rejects unverified prompt-shaped input", async () => {
    const response = await POST(
      new Request("http://localhost/api/ai/portfolio-insight", {
        method: "POST",
        body: JSON.stringify({ prompt: "guess my return" }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Ověřený analytický kontext není platný." });
  });
});
