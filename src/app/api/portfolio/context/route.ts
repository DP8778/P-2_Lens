import { buildAnalysis, timeframeRange, timeline } from "@/lib/finance/portfolio-engine";
import { toLensFacts } from "@/lib/finance/lens-facts";
import { portfolioContextSchema, contextInsightSchema } from "@/lib/validation/portfolioContext";
import { buildDeterministicInsight, buildInsightContext } from "@/lib/insights/insight-context";
import { POST as generateInsight } from "@/app/api/ai/portfolio-insight/route";

export const runtime = "nodejs";
const indexOfDate = (date: string, fallback: number) => {
  const index = timeline.findIndex((candidate) => candidate === date);
  return index < 0 ? fallback : index;
};

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > 30_000)
    return Response.json({ error: "Požadavek je příliš velký." }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "Neplatný požadavek." }, { status: 400 });
  }
  const parsed = portfolioContextSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: "Neplatný kontext portfolia." }, { status: 400 });
  const input = parsed.data;
  const range: [number, number] = input.selectedRange
    ? [indexOfDate(input.selectedRange[0], 0), indexOfDate(input.selectedRange[1], 730)]
    : timeframeRange(input.timeframe === "CUSTOM" ? "1M" : input.timeframe);
  const analysis = buildAnalysis(
    input.transactions,
    range,
    input.benchmarkId,
    input.compareAssetId,
    input.selectedPoint,
  );
  const facts = toLensFacts(analysis, input.timeframe === "CUSTOM" ? "ALL" : input.timeframe, {
    mode: input.mode,
    benchmarkVisible: input.showBenchmark,
  });
  const verifiedContext = buildInsightContext(analysis, input, facts);
  let insight = buildDeterministicInsight(verifiedContext);
  if (input.explain) {
    const response = await generateInsight(
      new Request(new URL("/api/ai/portfolio-insight", request.url), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": request.headers.get("x-forwarded-for") ?? "local",
        },
        body: JSON.stringify(verifiedContext),
      }),
    );
    const output = await response.json();
    if (output.mode === "ai") insight = output.insight;
  }
  return Response.json(contextInsightSchema.parse(insight));
}
