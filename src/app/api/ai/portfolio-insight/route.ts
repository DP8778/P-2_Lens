import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { buildFallbackInsight } from "@/lib/ai/fallbackSummarizer";
import { checkRateLimit } from "@/lib/ai/rateLimiter";
import { insightInputSchema, insightOutputSchema } from "@/lib/validation/insightSchemas";

export const runtime = "nodejs";
const SYSTEM_INSTRUCTION = `You explain already-calculated portfolio metrics. Never recalculate or invent financial values. Use only supplied metrics. Separate facts from interpretation. When data is missing, state that it is missing. Do not provide personalized buy/sell recommendations. Keep the default explanation concise. Reply in Czech.`;

function safeFallback(input: unknown, status: "demo" | "rate_limited" | "error") {
  const parsed = insightInputSchema.safeParse(input);
  if (!parsed.success)
    return Response.json({ error: "Zadané metriky nejsou platné." }, { status: 400 });
  return Response.json({ insight: buildFallbackInsight(parsed.data), mode: status });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 20_000)
    return Response.json({ error: "Požadavek je příliš velký." }, { status: 413 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Požadavek není platný JSON." }, { status: 400 });
  }
  const parsed = insightInputSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: "Zadané metriky nejsou platné." }, { status: 400 });

  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const limit = checkRateLimit(clientKey);
  if (!limit.allowed)
    return new Response(
      JSON.stringify({ insight: buildFallbackInsight(parsed.data), mode: "rate_limited" }),
      {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": String(limit.retryAfter) },
      },
    );
  if (!process.env.OPENAI_API_KEY) return safeFallback(parsed.data, "demo");

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 12_000,
      maxRetries: 1,
    });
    const response = await client.responses.parse({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      instructions: SYSTEM_INSTRUCTION,
      input: JSON.stringify(parsed.data),
      text: { format: zodTextFormat(insightOutputSchema, "portfolio_insight") },
    });
    if (!response.output_parsed) return safeFallback(parsed.data, "error");
    return Response.json({ insight: response.output_parsed, mode: "ai" });
  } catch (error) {
    if (error instanceof OpenAI.RateLimitError)
      return new Response(
        JSON.stringify({ insight: buildFallbackInsight(parsed.data), mode: "rate_limited" }),
        { status: 429, headers: { "content-type": "application/json", "retry-after": "8" } },
      );
    return safeFallback(parsed.data, "error");
  }
}
