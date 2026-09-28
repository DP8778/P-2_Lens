import type { FinancialStatement } from "./financial-anatomy";
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
  const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(a), Math.abs(b)) * 0.005;
  return /^\d{4}-\d{2}-\d{2}$/.test(s.period) && [s.revenue, s.costOfRevenue, s.grossProfit, s.operatingExpenses, s.operatingIncome, s.netIncome].every(validMoney)
    && s.revenue > 0 && s.costOfRevenue >= 0 && s.operatingExpenses >= 0
    && near(s.revenue - s.costOfRevenue, s.grossProfit) && near(s.grossProfit - s.operatingExpenses, s.operatingIncome);
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
/** Read inline XBRL contexts/units/scales; dimensional facts never become consolidated totals. */
export function parseSecAnnual(html: string, asset: MarketAsset, source: string): FinancialStatement[] {
  const contexts = new Map([...html.matchAll(/<xbrli:context\b([^>]*)>([\s\S]*?)<\/xbrli:context>/gi)].flatMap(([, attrs, body]) => {
    const start = body.match(/<xbrli:startDate>(.*?)<\/xbrli:startDate>/)?.[1];
    const end = body.match(/<xbrli:endDate>(.*?)<\/xbrli:endDate>/)?.[1];
    if (!start || !end || (Date.parse(end) - Date.parse(start)) / 86400000 < 350 || (Date.parse(end) - Date.parse(start)) / 86400000 > 380) return [];
    const dimensions = [...body.matchAll(/<xbrldi:explicitMember\b[^>]*>(.*?)<\/xbrldi:explicitMember>/g)].map((match) => match[1]);
    return [[attributes(attrs).id, { end, dimensions }] as const];
  }));
  const usdUnits = new Set([...html.matchAll(/<xbrli:unit\b([^>]*)>([\s\S]*?)<\/xbrli:unit>/gi)].filter(([, , body]) => /<xbrli:measure>iso4217:USD<\/xbrli:measure>/.test(body) && !body.includes("divide")).map(([, attrs]) => attributes(attrs).id));
  const facts = [...html.matchAll(/<ix:nonFraction\b([^>]*)>([\s\S]*?)<\/ix:nonFraction>/gi)].flatMap(([, attrs, body]) => {
    const a = attributes(attrs), context = contexts.get(a.contextref);
    if (!context || !usdUnits.has(a.unitref) || a["xsi:nil"] === "true") return [];
    const text = decodeText(body).replace(/,/g, "");
    const value = Number(text) * 10 ** Number(a.scale ?? 0) * (a.sign === "-" ? -1 : 1);
    if (!/^-?\d+(\.\d+)?$/.test(text) || !Number.isFinite(value)) return [];
    return [{ ...context, name: a.name, value }];
  });
  return [...new Set(facts.map((fact) => fact.end))].flatMap((period) => {
    const get = (...names: string[]) => names.map((name) => facts.find((f) => f.end === period && !f.dimensions.length && f.name === `us-gaap:${name}`)?.value).find(validMoney);
    const statement: FinancialStatement = { assetId: asset.id, period, currency: "USD", durationMonths: 12, source,
      revenue: get("RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues")!, costOfRevenue: get("CostOfRevenue", "CostOfGoodsAndServicesSold")!,
      grossProfit: get("GrossProfit")!, operatingExpenses: get("OperatingExpenses")!, operatingIncome: get("OperatingIncomeLoss")!, netIncome: get("NetIncomeLoss")!,
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

/** Keep verified history and primary-source detail when a secondary refresh has unchanged totals. */
export function mergeFinancialHistory(previous: FinancialStatement[], incoming: FinancialStatement[]): FinancialStatement[] {
  const periods = new Map(previous.map((statement) => [statement.period, statement]));
  for (const statement of incoming) {
    const old = periods.get(statement.period);
    const keys = ["revenue", "costOfRevenue", "grossProfit", "operatingExpenses", "operatingIncome", "netIncome"] as const;
    const sameTotals = old && old.currency === statement.currency && keys.every((key) => old[key] === statement[key]);
    periods.set(statement.period, sameTotals && old.source.startsWith("https://www.sec.gov/") ? old : statement);
  }
  return [...periods.values()].sort((a, b) => b.period.localeCompare(a.period));
}
