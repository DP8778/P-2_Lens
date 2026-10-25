import type { FinancialStatement } from "./financial-anatomy";
import { reconcilesStatement } from "./financial-anatomy.ts";
import type { MarketAsset } from "../market-data/types";

export const decodeText = (value: string) => value.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#160;|&nbsp;/g, " ").trim();
export function tableRows(html: string): string[][] {
  return [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((row) => [...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => decodeText(cell[1])));
}
export function compactNumber(value: string): number | undefined {
  const match = value.replace(/,/g, "").match(/^([\d.]+)([TBMK])?$/);
  if (!match) return undefined;
  const result = Number(match[1]) * ({ T: 1e12, B: 1e9, M: 1e6, K: 1e3 }[match[2]] ?? 1);
  return Number.isFinite(result) && result > 0 ? result : undefined;
}
/** Strict extraction of JSON-compatible primitive arrays; never evaluate upstream JavaScript. */
function arrayField(text: string, key: string): unknown[] {
  const match = text.match(new RegExp(`(?:^|[,\\{])${key}:\\[([^\\]]*)\\]`));
  if (!match) return [];
  try { const values: unknown = JSON.parse(`[${match[1]}]`); return Array.isArray(values) ? values : []; } catch { return []; }
}
const validMoney = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
export function validStatement(s: FinancialStatement) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s.period) && reconcilesStatement(s);
}
export function parseIncomeStatement(html: string, asset: MarketAsset, source: string): FinancialStatement[] {
  // Only parse an explicitly USD annual statement. Other currencies remain unavailable.
  if (!/Financials in millions USD/.test(decodeText(html))) return [];
  const data = html.match(/financialData:\{([\s\S]*?)\},map:/)?.[1];
  if (!data) return [];
  const fields = Object.fromEntries(["datekey", "revenue", "cor", "gp", "opex", "opinc", "netinc", "rnd"].map((key) => [key, arrayField(data, key)]));
  return fields.datekey.flatMap((period, index) => {
    if (typeof period !== "string" || period === "TTM") return [];
    const statement: FinancialStatement = { assetId: asset.id, period, currency: "USD", durationMonths: 12, source,
      revenue: fields.revenue[index] as number, costOfRevenue: fields.cor[index] as number,
      grossProfit: fields.gp[index] as number, operatingExpenses: fields.opex[index] as number,
      operatingIncome: fields.opinc[index] as number, netIncome: fields.netinc[index] as number,
      ...(validMoney(fields.rnd[index]) && fields.rnd[index] >= 0 ? { expenses: { researchDevelopment: fields.rnd[index] } } : {}),
    };
    return validStatement(statement) ? [statement] : [];
  });
}
export function parseRevenueSegments(html: string): Map<string, { name: string; revenue: number }[]> {
  const section = html.match(/id:"revenue-segments"([\s\S]*?)\},ttm:/)?.[1];
  if (!section) return new Map();
  const data = section.slice(section.indexOf("data:{") + 5);
  const dates = arrayField(data, "datekey");
  const rows = [...section.matchAll(/\{id:"([a-z0-9_]+)",title:"([^"]+)"/g)]
    .filter(([, id]) => !/total|growth/.test(id));
  return new Map(dates.flatMap((date, i) => typeof date === "string" ? [[date, rows.flatMap(([, id, name]) => {
    const value = arrayField(data, id)[i];
    return validMoney(value) && value >= 0 ? [{ name, revenue: value }] : [];
  })] as const] : []));
}
const attributes = (text: string) => Object.fromEntries([...text.matchAll(/([\w:]+)="([^"]*)"/g)].map(([, key, value]) => [key.toLowerCase(), value]));
type SecFact = { end: string; dimensions: string[]; name: string; value: number };

function secAnnualFacts(html: string): SecFact[] {
  const contexts = new Map([...html.matchAll(/<xbrli:context\b([^>]*)>([\s\S]*?)<\/xbrli:context>/gi)].flatMap(([, attrs, body]) => {
    const start = body.match(/<xbrli:startDate>(.*?)<\/xbrli:startDate>/i)?.[1];
    const end = body.match(/<xbrli:endDate>(.*?)<\/xbrli:endDate>/i)?.[1];
    if (!start || !end || (Date.parse(end) - Date.parse(start)) / 86400000 < 350 || (Date.parse(end) - Date.parse(start)) / 86400000 > 380) return [];
    const dimensions = [...body.matchAll(/<xbrldi:explicitMember\b[^>]*>(.*?)<\/xbrldi:explicitMember>/gi)].map((match) => match[1]);
    return [[attributes(attrs).id, { end, dimensions }] as const];
  }));
  const usdUnits = new Set([...html.matchAll(/<xbrli:unit\b([^>]*)>([\s\S]*?)<\/xbrli:unit>/gi)].filter(([, , body]) => /<xbrli:measure>iso4217:USD<\/xbrli:measure>/i.test(body) && !body.includes("divide")).map(([, attrs]) => attributes(attrs).id));
  return [...html.matchAll(/<ix:nonFraction\b([^>]*)>([\s\S]*?)<\/ix:nonFraction>/gi)].flatMap(([, attrs, body]) => {
    const a = attributes(attrs), context = contexts.get(a.contextref);
    if (!context || !usdUnits.has(a.unitref) || a["xsi:nil"] === "true") return [];
    const text = decodeText(body).replace(/,/g, "");
    const value = Number(text) * 10 ** Number(a.scale ?? 0) * (a.sign === "-" ? -1 : 1);
    if (!/^-?\d+(\.\d+)?$/.test(text) || !Number.isFinite(value)) return [];
    return [{ ...context, name: a.name, value }];
  });
}

/** Read inline XBRL contexts/units/scales; dimensional facts never become consolidated totals. */
export function parseSecAnnual(html: string, asset: MarketAsset, source: string): Extract<FinancialStatement, { grossProfit: number }>[] {
  const facts = secAnnualFacts(html);
  return [...new Set(facts.map((fact) => fact.end))].flatMap((period) => {
    const get = (...names: string[]) => names.map((name) => facts.find((f) => f.end === period && !f.dimensions.length && f.name === `us-gaap:${name}`)?.value).find(validMoney);
    const revenue = get("RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues")!;
    const grossProfit = get("GrossProfit")!;
    const costCandidates = [get("CostOfRevenue"), get("CostOfGoodsAndServicesSold")].filter(validMoney);
    const costOfRevenue = costCandidates.find((value) => Math.abs(revenue - value - grossProfit) <= Math.max(1, revenue) * 0.005) ?? costCandidates[0];
    const operatingIncome = get("OperatingIncomeLoss")!;
    // Some primary filings show every operating-expense line but do not tag the displayed total.
    // The reconciled total is the exact statement bridge, never a secondary-provider substitute.
    const operatingExpenses = get("OperatingExpenses") ?? grossProfit - operatingIncome;
    const statement: FinancialStatement = { assetId: asset.id, period, currency: "USD", durationMonths: 12, source,
      accountingBasis: "gaap-consolidated",
      revenue, costOfRevenue: costOfRevenue!, grossProfit, operatingExpenses, operatingIncome, netIncome: get("NetIncomeLoss")!,
      expenses: { salesMarketing: get("SellingAndMarketingExpense"), researchDevelopment: get("ResearchAndDevelopmentExpense"), generalAdministrative: get("GeneralAndAdministrativeExpense") },
    };
    statement.expenses = Object.fromEntries(Object.entries(statement.expenses!).filter(([, value]) => validMoney(value) && value >= 0));
    const segments = ["Government", "Commercial"].flatMap((name) => {
      const member = name === "Government" ? "pltr:GovernmentOperatingSegmentMember" : "pltr:CommercialMember";
      const fact = facts.find((f) => f.end === period && f.dimensions.includes(member) && f.dimensions.every((dimension) => [member, "us-gaap:OperatingSegmentsMember"].includes(dimension)) && f.name === "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax");
      return fact ? [{ name, revenue: fact.value }] : [];
    });
    if (segments.length === 2 && Math.abs(segments.reduce((sum, s) => sum + s.revenue, 0) - statement.revenue) < 1) statement.segments = segments;
    return validStatement(statement) ? [statement] : [];
  });
}

/** AMD's 2025 filing supplies GAAP statements plus its new three-segment presentation and recast comparatives. */
export function parseAmdAnnual(html: string, asset: MarketAsset, source: string): Extract<FinancialStatement, { grossProfit: number }>[] {
  const facts = secAnnualFacts(html);
  return parseSecAnnual(html, asset, source).flatMap((statement) => {
    const segments = [
      ["Data Center", "amd:DatacenterMember"],
      ["Client and Gaming", "amd:ClientAndGamingMember"],
      ["Embedded", "amd:EmbeddedMember"],
    ].flatMap(([name, member]) => {
      const fact = facts.find((candidate) => candidate.end === statement.period
        && candidate.name === "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax"
        && candidate.dimensions.length === 2
        && candidate.dimensions.includes("us-gaap:OperatingSegmentsMember")
        && candidate.dimensions.includes(member));
      return fact ? [{ name, revenue: fact.value }] : [];
    });
    const segmentSum = segments.reduce((sum, segment) => sum + segment.revenue, 0);
    if (segments.length !== 3 || Math.abs(segmentSum - statement.revenue) > Math.max(1, statement.revenue) * 0.00001) return [];
    return [{ ...statement, segments, segmentSource: source, sourceScale: 1_000_000,
      segmentBasis: statement.period === "2025-12-27" ? "reported" as const : "retrospectively-adjusted" as const }];
  });
}

/** TTD FY2025 10-K p.63: a direct operating-expense presentation, in thousands USD. */
export function parseTtdAnnual(html: string, asset: MarketAsset, source: string, retrievedAt: string): FinancialStatement[] {
  if (asset.symbol !== "TTD" || !source.endsWith("/ttd-20251231.htm")) return [];
  const numbers = (row: string[]) => row.slice(1).filter((cell) => /^[\d,]+$/.test(cell)).map((cell) => Number(cell.replaceAll(",", "")));
  const tables = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map(([table]) => tableRows(table));
  const table = tables.find((rows) => rows.some((row) => row[0] === "Platform operations")
    && rows.some((row) => row[0] === "Revenue" && numbers(row).length === 3));
  if (!table || !decodeText(html).includes("In thousands, except per share amounts")) return [];
  const row = (label: string) => numbers(table.find((cells) => cells[0] === label) ?? []);
  const fields = ["Revenue", "Total operating expenses", "Income from operations", "Net income", "Platform operations", "Sales and marketing", "Technology and development", "General and administrative"].map(row);
  if (fields.some((values) => values.length !== 3)) return [];
  const years = table.flat().filter((cell) => /^(2025|2024|2023)$/.test(cell));
  if (years.join(",") !== "2025,2024,2023") return [];
  const spend = tables.flat().find((cells) => /^Gross spend/.test(cells[0] ?? ""));
  const spends = spend ? numbers(spend).slice(0, 2) : [];
  return years.flatMap((year, index) => {
    const [revenue, operatingExpenses, operatingIncome, netIncome, platformOperations, salesMarketing, technologyDevelopment, generalAdministrative] = fields.map((values) => values[index] * 1000);
    const statement: FinancialStatement = { assetId: asset.id, period: `${year}-12-31`, currency: "USD", durationMonths: 12,
      source, sourceScale: 1000, accountingBasis: "gaap-consolidated", presentation: "operating-expenses",
      publishedAt: "2026-02-27", retrievedAt, valueStatus: "reported", revenue, operatingExpenses, operatingIncome, netIncome,
      expenses: { platformOperations, salesMarketing, technologyDevelopment, generalAdministrative },
      ...(spends[index] ? { grossSpend: { value: spends[index] * 1000, source, sourceScale: 1000, publishedAt: "2026-02-27", retrievedAt, status: "reported" as const } } : {}),
    };
    return validStatement(statement) ? [statement] : [];
  });
}

/** Keep primary-source periods when a routine secondary refresh presents a different accounting basis. */
export function mergeFinancialHistory(previous: FinancialStatement[], incoming: FinancialStatement[]): FinancialStatement[] {
  const key = (s: FinancialStatement) => `${s.period}:${s.durationMonths}:${s.currency}`;
  const periods = new Map(previous.map((statement) => [key(statement), statement]));
  for (const statement of incoming) {
    const old = periods.get(key(statement));
    const primary = (url: string) => url.startsWith("https://www.sec.gov/") || url.includes("/sec-filings/content/");
    if (!validStatement(statement)) continue;
    const keepPrimary = old && primary(old.source) && !primary(statement.source);
    // A primary refresh may omit a separately sourced, previously verified spend observation.
    // Preserve it only for exactly the same period/currency/duration and revenue basis.
    const spend = old?.revenue === statement.revenue && old?.presentation === statement.presentation ? old?.grossSpend : undefined;
    periods.set(key(statement), keepPrimary ? old : { ...statement, ...(statement.grossSpend ? {} : spend ? { grossSpend: spend } : {}) });
  }
  return [...periods.values()].sort((a, b) => b.period.localeCompare(a.period));
}
