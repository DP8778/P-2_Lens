import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { checkRateLimit } from "@/lib/ai/rateLimiter";
import {
  aiInsightWordingSchema,
  insightContextSchema,
} from "@/lib/validation/insightSchemas";
import { buildDeterministicInsight, mergeAiWording } from "@/lib/insights/insight-context";

export const runtime = "nodejs";

const SYSTEM_INSTRUCTION = `You are the concise Czech interpretation layer for a portfolio analytics product.
Use only the verified InsightContext supplied by the application. Never calculate, alter, round into a different
claim, or invent a financial value. Do not write numeric values in generated prose; the application renders all
numbers from computed evidence. Every driver and risk note must cite one or more existing evidence IDs.
Do not add external financial claims. Do not recommend a trade, asset, allocation change, or strategy. Do not
predict prices or future performance. If evidence is insufficient, state that briefly in limitations. Return only
the requested structured Czech wording. Keep the summary to one or two sentences.`;

function fallback(context: unknown, mode: "demo" | "rate_limited" | "error") {
  const parsed = insightContextSchema.safeParse(context);
  if (!parsed.success)
    return Response.json({ error: "Ověřený analytický kontext není platný." }, { status: 400 });
  return Response.json({ insight: buildDeterministicInsight(parsed.data), mode });
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
  const parsed = insightContextSchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: "Ověřený analytický kontext není platný." }, { status: 400 });

  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const limit = checkRateLimit(clientKey);
  if (!limit.allowed)
    return new Response(
      JSON.stringify({ insight: buildDeterministicInsight(parsed.data), mode: "rate_limited" }),
      {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": String(limit.retryAfter) },
      },
    );
  if (!process.env.OPENAI_API_KEY) return fallback(parsed.data, "demo");

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
      text: { format: zodTextFormat(aiInsightWordingSchema, "contextual_lens_wording") },
    });
    if (!response.output_parsed) return fallback(parsed.data, "error");
    return Response.json({
      insight: mergeAiWording(parsed.data, response.output_parsed),
      mode: "ai",
    });
  } catch (error) {
    if (error instanceof OpenAI.RateLimitError)
      return new Response(
        JSON.stringify({ insight: buildDeterministicInsight(parsed.data), mode: "rate_limited" }),
        { status: 429, headers: { "content-type": "application/json", "retry-after": "8" } },
      );
    return fallback(parsed.data, "error");
  }
}
