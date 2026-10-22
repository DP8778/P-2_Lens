import OpenAI from "openai";
import { createHash } from "node:crypto";
import { companyResearchRequestSchema, type ResearchErrorCode } from "@/lib/company-research/schema";
import { normalizeCompanyResearch } from "@/lib/company-research/normalize";
import { COMPANY_RESEARCH_INSTRUCTION } from "@/lib/company-research/instructions";
import { checkCompanyResearchLimit } from "@/lib/company-research/rate-limit";
import { buildCompanyResearchContext } from "@/lib/finance/company-research-context";
import { fundamentalsSource } from "@/lib/fundamentals/snapshot-source";
import { getMarketDataProvider } from "@/lib/market-data/server";
import { assetCatalog } from "@/data/mock/catalog";

export const runtime = "nodejs";
export const maxDuration = 120;
const failure = (code: ResearchErrorCode, status = 503, retryAfter?: number) => Response.json({ error: { code } }, {
  status, headers: { "Cache-Control": "no-store", ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}) },
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 3000) return failure("invalid_identity", 413);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 3000) return failure("invalid_identity", 413);
    body = JSON.parse(raw);
  } catch { return failure("invalid_identity", 400); }
  const parsed = companyResearchRequestSchema.safeParse(body);
  if (!parsed.success) return failure("invalid_identity", 400);
  if (!process.env.OPENAI_API_KEY?.trim()) return failure("no_key");
  const key = createHash("sha256").update(request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local").digest("hex");
  const limit = checkCompanyResearchLimit(key);
  if (!limit.allowed) return failure("rate_limited", 429, limit.retryAfter);
  const input = parsed.data;
  try {
    const industries = fundamentalsSource.getIndustries();
    const members = Object.values(industries).flatMap(industry => industry.members.map(member => member.asset));
    let asset = members.find(candidate => candidate.id === input.assetId);
    const demo = assetCatalog.find(candidate => candidate.id === input.assetId);
    if (!asset && demo) {
      if (demo.type !== "stock" || demo.symbol !== input.symbol) return failure("invalid_identity", 400);
      asset = members.find(candidate => candidate.symbol === demo.symbol);
    }
    if (!asset && !demo) asset = (await getMarketDataProvider().searchAssets(input.symbol)).find(candidate => candidate.id === input.assetId);
    if (!asset || asset.type !== "stock" || asset.symbol !== input.symbol || (input.micCode && asset.micCode !== input.micCode)) return failure("invalid_identity", 400);
    const verified = buildCompanyResearchContext(asset, fundamentalsSource.getCompany(asset.id), input.theme ? industries[input.theme] : undefined);
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 90_000, maxRetries: 0 });
    const response = await client.responses.create({
      model: process.env.OPENAI_COMPANY_RESEARCH_MODEL || "gpt-5.5",
      instructions: COMPANY_RESEARCH_INSTRUCTION,
      input: JSON.stringify({ VERIFIED_LENS_DATA: verified, WEB_RESEARCH_TASK: { locale: input.locale, today: new Date().toISOString().slice(0, 10), horizonDays: 90, widenedHorizonDays: 180 } }),
      tools: [{ type: "web_search", external_web_access: true }], tool_choice: "required",
      include: ["web_search_call.action.sources"], max_output_tokens: 6500,
      reasoning: { effort: "low" }, store: false,
    }, { signal: request.signal });
    const research = normalizeCompanyResearch(response, { assetId: input.assetId, locale: input.locale }, new Date().toISOString());
    return Response.json({ research }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof OpenAI.RateLimitError) return failure("rate_limited", 429, 60);
    return failure("unavailable");
  }
}
