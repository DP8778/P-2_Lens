import { companyResearchRequestSchema, companyResearchSchema, type CompanyResearch, type CompanyResearchRequest, type ResearchErrorCode } from "./schema";

const prefix = "lens-company-research-v1:";
const freshness = 45 * 60_000;
const pending = new Map<string, Promise<CompanyResearch>>();
const memory = new Map<string, CompanyResearch>();
const keyOf = (identity: Pick<CompanyResearchRequest, "assetId" | "locale">) => `${prefix}${identity.locale}:${identity.assetId}`;
export class CompanyResearchError extends Error {
  constructor(readonly code: ResearchErrorCode) { super(code); }
}
export function savedCompanyResearch(identity: Pick<CompanyResearchRequest, "assetId" | "locale">) {
  const key = keyOf(identity);
  let saved = memory.get(key);
  try {
    const raw = sessionStorage.getItem(key);
    const parsed = raw && companyResearchSchema.safeParse(JSON.parse(raw));
    if (parsed && parsed.success && parsed.data.assetId === identity.assetId && parsed.data.locale === identity.locale) saved = parsed.data;
  } catch { /* Session storage can be unavailable. The mounted session still works. */ }
  return saved;
}
export const researchIsFresh = (research: CompanyResearch) => {
  const age = Date.now() - Date.parse(research.researchedAt);
  return age >= 0 && age < freshness;
};
export function loadCompanyResearch(input: CompanyResearchRequest, refresh = false): Promise<CompanyResearch> {
  const request = companyResearchRequestSchema.parse(input), key = keyOf(request);
  if (pending.has(key)) return pending.get(key)!;
  const saved = savedCompanyResearch(request);
  if (!refresh && saved && researchIsFresh(saved)) return Promise.resolve(saved);
  const task = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 100_000);
    try {
      const response = await fetch("/api/ai/company-research", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request), signal: controller.signal });
      const body = await response.json();
      if (!response.ok) throw new CompanyResearchError(response.status === 429 ? "rate_limited" : body?.error?.code === "no_key" ? "no_key" : "unavailable");
      const research = companyResearchSchema.parse(body.research);
      if (research.assetId !== request.assetId || research.locale !== request.locale) throw new CompanyResearchError("unavailable");
      memory.set(key, research);
      if (memory.size > 12) memory.delete(memory.keys().next().value!);
      try {
        const keys = Object.keys(sessionStorage).filter(item => item.startsWith(prefix) && item !== key);
        while (keys.length >= 12) sessionStorage.removeItem(keys.shift()!);
        sessionStorage.setItem(key, JSON.stringify(research));
      } catch { /* Storage quota does not block research. */ }
      return research;
    } finally { clearTimeout(timeout); }
  })().finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}
