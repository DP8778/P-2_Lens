/** @jest-environment node */
jest.mock("@/app/api/ai/portfolio-insight/route", () => ({ POST: jest.fn() }));

import { POST as generateInsight } from "@/app/api/ai/portfolio-insight/route";
import { POST as generateContext } from "@/app/api/portfolio/context/route";
import { initialTransactions, timeline } from "@/lib/finance/portfolio-engine";

const mockedInsight = jest.mocked(generateInsight);
const context = {
  transactions: initialTransactions,
  selectedRange: [timeline[365], timeline[730]],
  timeframe: "1Y",
  benchmarkId: "spy",
  compareAssetId: "",
  mode: "performance",
  showBenchmark: true,
  selectedPoint: null,
};
const request = (explain = false) => generateContext(new Request("http://localhost/api/portfolio/context", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ ...context, explain }),
}));

beforeEach(() => mockedInsight.mockReset());

test.each([
  { mode: "demo", status: 200, enhancement: "not_configured" },
  { mode: "rate_limited", status: 429, enhancement: "rate_limited" },
  { mode: "error", status: 200, enhancement: "service_error" },
] as const)("$mode keeps deterministic Evidence and reports $enhancement", async ({ mode, status, enhancement }) => {
  const baseline = await (await request()).json();
  mockedInsight.mockResolvedValue(new Response(JSON.stringify({ mode, insight: baseline.insight }), {
    status,
    headers: { "content-type": "application/json" },
  }));

  const delivered = await (await request(true)).json();
  expect(delivered.meta).toEqual({ wording: "application", enhancement });
  expect(delivered.insight.evidence).toEqual(baseline.insight.evidence);
  expect(delivered.insight.evidence.length).toBeGreaterThan(0);
});

test("AI wording is identified while Evidence remains application-computed", async () => {
  const baseline = await (await request()).json();
  mockedInsight.mockResolvedValue(Response.json({
    mode: "ai",
    insight: { ...baseline.insight, mode: "ai", headline: "AI formulace nad ověřenými daty" },
  }));

  const delivered = await (await request(true)).json();
  expect(delivered.meta).toEqual({ wording: "ai", enhancement: "ready" });
  expect(delivered.insight.headline).toBe("AI formulace nad ověřenými daty");
  expect(delivered.insight.evidence).toEqual(baseline.insight.evidence);
});

test("transport failure falls back to application wording with Evidence", async () => {
  const baseline = await (await request()).json();
  mockedInsight.mockRejectedValue(new Error("offline"));
  const delivered = await (await request(true)).json();
  expect(delivered.meta).toEqual({ wording: "application", enhancement: "service_error" });
  expect(delivered.insight.evidence).toEqual(baseline.insight.evidence);
});

