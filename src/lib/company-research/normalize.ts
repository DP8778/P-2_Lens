import { z } from "zod";
import { companyResearchSchema, publicSourceUrl, type CompanyResearch, type CompanyResearchRequest } from "./schema";

const annotationSchema = z.object({ type: z.literal("url_citation"), url: z.string().max(2048), title: z.string().min(1).max(300), start_index: z.number().int().nonnegative(), end_index: z.number().int().nonnegative() });
const envelopeSchema = z.object({ status: z.literal("completed"), output: z.array(z.unknown()).max(100) });
const messageSchema = z.object({ type: z.literal("message"), role: z.literal("assistant"), content: z.array(z.unknown()).max(20) });
const textSchema = z.object({ type: z.literal("output_text"), text: z.string().max(30_000), annotations: z.array(z.unknown()).max(200) });
const headings = { OVERVIEW: "overview", DEVELOPMENTS: "developments", GROWTH: "growth", RISKS: "risks", WATCH: "watch" } as const;
const maximum = { overview: 2, developments: 5, growth: 4, risks: 4, watch: 5 };

/** No model-written URL is trusted. Citation offsets refer to ORIGINAL output text. */
export function normalizeCompanyResearch(input: unknown, identity: Pick<CompanyResearchRequest, "assetId" | "locale">, researchedAt: string): CompanyResearch {
  const response = envelopeSchema.parse(input);
  const sections: CompanyResearch["sections"] = { overview: [], developments: [], growth: [], risks: [], watch: [] };
  const sources: CompanyResearch["sources"] = [];
  let horizonDays: 90 | 180 = 90;
  let limited = false;
  let totalLength = 0;
  for (const output of response.output) {
    const message = messageSchema.safeParse(output);
    if (!message.success) continue;
    for (const content of message.data.content) {
      const part = textSchema.safeParse(content);
      if (!part.success) continue;
      const { text, annotations } = part.data;
      totalLength += text.length;
      if (totalLength > 40_000) throw new Error("Research too long");
      if (/^HORIZON:\s*180\s*$/m.test(text)) horizonDays = 180;
      const citations = annotations.flatMap(candidate => {
        const parsed = annotationSchema.safeParse(candidate);
        if (!parsed.success) return [];
        const a = parsed.data, url = publicSourceUrl(a.url);
        return url && a.start_index < a.end_index && a.end_index <= text.length ? [{ ...a, url }] : [];
      });
      let section: keyof typeof maximum | undefined;
      // Paragraph boundaries keep each item and its evidence together; no whole-answer citations.
      const blocks = [...text.matchAll(/[^\n]+(?:\n(?!\s*\n|## |HORIZON:)[^\n]+)*/g)];
      for (const block of blocks) {
        const raw = block[0], start = block.index!, end = start + raw.length;
        const heading = /^## (OVERVIEW|DEVELOPMENTS|GROWTH|RISKS|WATCH)\s*$/.exec(raw.trim());
        if (heading) { section = headings[heading[1] as keyof typeof headings]; continue; }
        if (!section || /^HORIZON:/.test(raw)) continue;
        const evidence = citations.filter(a => a.start_index < end && a.end_index > start);
        const clean = raw.replace(/cite[^]*/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
          .replace(/https?:\/\/\S+/gi, "").replace(/[*`]/g, "").replace(/^\s*[-•]\s*/, "").trim();
        if (!evidence.length || !clean || clean.length > 1800 || sections[section].length >= maximum[section]) { limited = true; continue; }
        const date = /^(\d{4}-\d{2}-\d{2})\s*\|\s*/.exec(clean);
        const eventDate = date && z.iso.date().safeParse(date[1]).success ? date[1] : undefined;
        if (section === "developments" && eventDate && (eventDate > researchedAt.slice(0, 10)
          || Date.parse(researchedAt) - Date.parse(eventDate) > horizonDays * 86400000)) { limited = true; continue; }
        const sourceIds = [...new Set(evidence.slice(0, 8).map(a => {
          let source = sources.find(s => s.url === a.url);
          if (!source) { source = { id: `s${sources.length + 1}`, title: a.title, url: a.url, domain: new URL(a.url).hostname }; sources.push(source); }
          return source.id;
        }))];
        sections[section].push({ text: eventDate ? clean.slice(date![0].length) : clean, sourceIds, ...(eventDate ? { eventDate } : {}) });
      }
    }
  }
  limited ||= sections.developments.length < 3 || sections.growth.length < 2 || sections.risks.length < 2 || sections.watch.length < 3;
  return companyResearchSchema.parse({ ...identity, researchedAt, horizonDays, limited, sections, sources });
}
