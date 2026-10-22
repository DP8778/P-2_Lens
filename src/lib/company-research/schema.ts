import { z } from "zod";

export const companyResearchRequestSchema = z.object({
  assetId: z.string().min(1).max(180).regex(/^[a-zA-Z0-9:._/-]+$/),
  symbol: z.string().min(1).max(20).regex(/^[A-Z0-9][A-Z0-9.^/-]*$/),
  companyName: z.string().trim().min(1).max(160).regex(/^[^\x00-\x1f<>]+$/),
  assetType: z.literal("stock"),
  exchange: z.string().max(60).regex(/^[\w .()-]*$/).optional(),
  micCode: z.string().regex(/^[A-Z0-9]{4}$/).optional(),
  country: z.string().max(60).regex(/^[\p{L} .()-]+$/u).optional(),
  locale: z.enum(["cs-CZ", "en-US"]),
  theme: z.enum(["ai", "ai-infrastructure", "semiconductors", "saas-cloud", "cybersecurity"]).optional(),
}).strict();
export type CompanyResearchRequest = z.infer<typeof companyResearchRequestSchema>;

export function publicSourceUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port
      || !host.includes('.') || host.endsWith('.local') || host.endsWith('.localhost')
      || host.endsWith('.internal') || /^[\d.]+$/.test(host) || host.includes(':')) return undefined;
    url.hash = "";
    return url.toString();
  } catch { return undefined; }
}
const sourceSchema = z.object({
  id: z.string().regex(/^s\d+$/), title: z.string().min(1).max(300),
  url: z.string().max(2048).refine(value => !!publicSourceUrl(value)),
  domain: z.string().min(1).max(255),
}).strict();
const itemSchema = z.object({
  text: z.string().min(1).max(1800),
  sourceIds: z.array(z.string().regex(/^s\d+$/)).min(1).max(8),
  eventDate: z.iso.date().optional(),
}).strict();
export const researchSections = ["overview", "developments", "growth", "risks", "watch"] as const;
export const companyResearchSchema = z.object({
  assetId: companyResearchRequestSchema.shape.assetId,
  locale: companyResearchRequestSchema.shape.locale,
  researchedAt: z.iso.datetime(), horizonDays: z.union([z.literal(90), z.literal(180)]),
  limited: z.boolean(),
  sections: z.object({ overview: z.array(itemSchema).min(1).max(2), developments: z.array(itemSchema).max(5),
    growth: z.array(itemSchema).max(4), risks: z.array(itemSchema).max(4), watch: z.array(itemSchema).max(5) }).strict(),
  sources: z.array(sourceSchema).min(1).max(40),
}).strict().superRefine((value, ctx) => {
  const ids = new Set(value.sources.map(s => s.id));
  if (ids.size !== value.sources.length || new Set(value.sources.map(s => s.url)).size !== value.sources.length)
    ctx.addIssue({ code: "custom", message: "Duplicate evidence" });
  for (const source of value.sources) if (new URL(source.url).hostname !== source.domain)
    ctx.addIssue({ code: "custom", message: "Source domain mismatch" });
  for (const items of Object.values(value.sections)) for (const item of items)
    if (item.sourceIds.some(id => !ids.has(id))) ctx.addIssue({ code: "custom", message: "Unknown evidence" });
});
export type CompanyResearch = z.infer<typeof companyResearchSchema>;
export type ResearchErrorCode = "unavailable" | "no_key" | "rate_limited" | "invalid_identity";
