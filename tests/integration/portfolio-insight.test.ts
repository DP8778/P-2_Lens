/** @jest-environment node */
import { POST } from "@/app/api/ai/portfolio-insight/route";
import { buildInsightInput } from "@/lib/ai/buildInsightInput";
import { buildPortfolioMetrics } from "@/lib/finance/buildPortfolioMetrics";
describe("POST /api/ai/portfolio-insight", () => {
  test("returns a controlled demo insight without a key", async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const response = await POST(
      new Request("http://localhost/api/ai/portfolio-insight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildInsightInput(buildPortfolioMetrics("1M"), "1M")),
      }),
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.mode).toBe("demo");
    expect(body.insight.headline).toBeTruthy();
    process.env.OPENAI_API_KEY = previous;
  });
  test("rejects malformed input safely", async () => {
    const response = await POST(
      new Request("http://localhost/api/ai/portfolio-insight", {
        method: "POST",
        body: JSON.stringify({ prompt: "guess my return" }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Zadané metriky nejsou platné." });
  });
});
