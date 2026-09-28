/** Statement amounts use one currency and unit (native currency units), never price data. */
export interface FinancialStatement {
  assetId: string;
  period: string;
  currency: string;
  durationMonths: number;
  source: string;
  segmentSource?: string;
  revenue: number;
  costOfRevenue: number;
  grossProfit: number;
  operatingExpenses: number;
  operatingIncome: number;
  netIncome: number;
  segments?: { name: string; revenue: number }[];
  expenses?: { salesMarketing?: number; researchDevelopment?: number; generalAdministrative?: number };
}
export type FinancialFlowLink = { from: string; to: string; value: number };
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(a), Math.abs(b)) * 0.005;

/** Reject inconsistent units/identities instead of constructing a misleading money flow. */
export function buildFinancialAnatomy(assetId: string, statements: FinancialStatement[] = []) {
  const periods = statements.filter((s) => s.assetId === assetId && /^https:\/\//.test(s.source)
    && /^\d{4}-\d{2}-\d{2}$/.test(s.period) && Number.isFinite(Date.parse(s.period))
    && /^[A-Z]{3}$/.test(s.currency) && [3, 6, 9, 12].includes(s.durationMonths)
    && [s.revenue, s.costOfRevenue, s.grossProfit, s.operatingExpenses, s.operatingIncome, s.netIncome].every(finite)
    && s.revenue > 0 && s.costOfRevenue >= 0 && s.operatingExpenses >= 0
    && close(s.revenue - s.costOfRevenue, s.grossProfit)
    && close(s.grossProfit - s.operatingExpenses, s.operatingIncome))
    .sort((a, b) => a.period.localeCompare(b.period));
  const latest = periods.at(-1);
  if (!latest) return { status: "unavailable" as const };
  const history = periods.filter((s) => s.currency === latest.currency && s.durationMonths === latest.durationMonths);
  // Growth uses a comparable fiscal period one year earlier, never a mixed quarterly/annual comparison.
  const prior = history.findLast((s) => {
    const days = (Date.parse(latest.period) - Date.parse(s.period)) / 86_400_000;
    return days >= 350 && days <= 380;
  });
  const segmentSum = latest.segments?.reduce((sum, item) => sum + item.revenue, 0) ?? 0;
  const segments = latest.segments?.length && latest.segments.every((item) => item.name.trim() && finite(item.revenue) && item.revenue >= 0)
    && segmentSum <= latest.revenue ? [...latest.segments] : [];
  if (segments.length && segmentSum < latest.revenue) segments.push({ name: "Unallocated revenue", revenue: latest.revenue - segmentSum });
  const expenseEntries = Object.entries(latest.expenses ?? {});
  const expenseSum = expenseEntries.reduce((sum, [, value]) => sum + value!, 0);
  const expenses = expenseEntries.length && expenseEntries.every(([, value]) => finite(value) && value >= 0) && expenseSum <= latest.operatingExpenses
    ? expenseEntries.map(([name, value]) => ({ name, value: value! })) : [];
  if (expenses.length && expenseSum < latest.operatingExpenses) expenses.push({ name: "otherExpenses", value: latest.operatingExpenses - expenseSum });
  const links: FinancialFlowLink[] = [];
  // Negative earnings are displayed as signed statement values, not negative-width Sankey links.
  const flowAvailable = latest.grossProfit >= 0 && latest.operatingIncome >= 0 && latest.netIncome >= 0;
  if (flowAvailable) {
    segments.forEach((segment, index) => links.push({ from: `segment-${index}`, to: "revenue", value: segment.revenue }));
    links.push({ from: "revenue", to: "costOfRevenue", value: latest.costOfRevenue },
      { from: "revenue", to: "grossProfit", value: latest.grossProfit },
      { from: "grossProfit", to: "operatingExpenses", value: latest.operatingExpenses },
      { from: "grossProfit", to: "operatingIncome", value: latest.operatingIncome });
    expenses.forEach((expense) => links.push({ from: "operatingExpenses", to: expense.name, value: expense.value }));
    const bridge = latest.operatingIncome - latest.netIncome;
    if (bridge >= 0) {
      links.push({ from: "operatingIncome", to: "netIncome", value: latest.netIncome });
      if (bridge > 0) links.push({ from: "operatingIncome", to: "netDeductions", value: bridge });
    } else {
      links.push({ from: "operatingIncome", to: "netIncome", value: latest.operatingIncome },
        { from: "netAdditions", to: "netIncome", value: -bridge });
    }
  }
  const nodeValues = Object.fromEntries([...new Set(links.flatMap((link) => [link.from, link.to]))].map((id) => {
    const incoming = links.filter((link) => link.to === id).reduce((sum, link) => sum + link.value, 0);
    const outgoing = links.filter((link) => link.from === id).reduce((sum, link) => sum + link.value, 0);
    return [id, Math.max(incoming, outgoing)];
  }));
  return { nodeValues, status: "available" as const, latest, history, segments, expenses, flowAvailable,
    links: links.filter((link) => link.value > 0),
    revenueGrowth: prior ? (latest.revenue / prior.revenue - 1) * 100 : undefined,
    grossMargin: latest.grossProfit / latest.revenue * 100,
    operatingMargin: latest.operatingIncome / latest.revenue * 100 };
}
