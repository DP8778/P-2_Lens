import { buildAnalysis } from "@/lib/finance/portfolio-engine";
import { portfolioContextSchema, contextInsightSchema } from "@/lib/validation/portfolioContext";
import { contextualInsight } from "@/lib/ai/contextualInsight";
import { buildInsightInput } from "@/lib/ai/buildInsightInput";
import { POST as generateInsight } from "@/app/api/ai/portfolio-insight/route";
export const runtime = "nodejs";
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
  const analysis = buildAnalysis(input.holdings, input.range, input.benchmark, input.compare);
  const insight = contextualInsight(analysis, input);
  if (input.explain && process.env.OPENAI_API_KEY) {
    const selectedAnalysis =
      input.selected !== null && input.selected > 0
        ? buildAnalysis(
            input.holdings,
            [input.range[0], input.range[0] + input.selected],
            input.benchmark,
            input.compare,
          )
        : analysis;
    const facts = buildInsightInput(
      selectedAnalysis.metrics,
      input.timeframe === "CUSTOM" ? "ALL" : input.timeframe,
    );
    facts.benchmark.name = analysis.benchmark;
    const point = input.selected === null ? undefined : analysis.points[input.selected];
    if (point && input.selected === 0) {
      facts.portfolio = {
        startValue: point.portfolioValue,
        endValue: point.portfolioValue,
        absolutePnl: 0,
        returnPct: point.portfolioReturnPct,
      };
      facts.benchmark.returnPct = point.benchmarkReturnPct;
      facts.benchmark.deltaPct = point.benchmarkDeltaPct;
      facts.risk.maxDrawdownPct = point.drawdown;
      facts.contributors = [];
      facts.detractors = [];
      facts.period.to = point.timestamp;
    }
    facts.context = {
      mode: input.mode,
      benchmarkVisible: input.showBenchmark,
      currency: "CZK",
      rangeLabel: input.timeframe === "CUSTOM" ? "Vlastní období" : input.timeframe,
      selectedPoint: point
        ? {
            timestamp: point.timestamp,
            returnPct: point.portfolioReturnPct,
            drawdownPct: point.drawdown,
          }
        : undefined,
      compare: analysis.compare
        ? { symbol: analysis.compare, returnPct: (point ?? analysis.points.at(-1)!).assetReturnPct }
        : undefined,
    };
    const response = await generateInsight(
      new Request(new URL("/api/ai/portfolio-insight", request.url), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": request.headers.get("x-forwarded-for") ?? "local",
        },
        body: JSON.stringify(facts),
      }),
    );
    const output = await response.json();
    if (output.mode === "ai") {
      insight.explanation = output.insight.summary;
      insight.mode = "ai";
    }
  }
  return Response.json(contextInsightSchema.parse(insight));
}
