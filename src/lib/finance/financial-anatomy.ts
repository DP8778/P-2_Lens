/** Statement amounts use one currency and unit (native currency units), never price data. */
interface StatementBase {
  assetId: string;
  period: string;
  currency: string;
  durationMonths: number;
  source: string;
  segmentSource?: string;
  /** Source amounts are normalized to native currency units; this records the source table scale. */
  sourceScale?: number;
  /** Comparable statement presentation; currency and duration alone do not establish comparability. */
  accountingBasis?: "gaap-consolidated";
  publishedAt?: string;
  retrievedAt?: string;
  valueStatus?: "reported";
  grossSpend?: { value: number; source: string; sourceScale: number; publishedAt: string; retrievedAt: string; status: "reported" };
  /** Whether the segment presentation is current-period reported or retrospectively adjusted. */
  segmentBasis?: "reported" | "retrospectively-adjusted";
  revenue: number;
  operatingExpenses: number;
  operatingIncome: number;
  netIncome: number;
  segments?: { name: string; revenue: number }[];
  expenses?: { salesMarketing?: number; researchDevelopment?: number; generalAdministrative?: number; platformOperations?: number; technologyDevelopment?: number };
}
/** Some issuers report all operating costs directly below revenue, without gross profit. */
export type FinancialStatement = StatementBase & (
  | { presentation?: "gross-profit"; costOfRevenue: number; grossProfit: number }
  | { presentation: "operating-expenses"; costOfRevenue?: never; grossProfit?: never }
);
export type FinancialFlowLink = { from: string; to: string; value: number };
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(a), Math.abs(b)) * 0.005;

export function reconcilesStatement(s: FinancialStatement) {
  if (![s.revenue, s.operatingExpenses, s.operatingIncome, s.netIncome].every(finite)
    || s.revenue <= 0 || s.operatingExpenses < 0) return false;
  if (s.presentation === "operating-expenses") {
    const expenses = Object.values(s.expenses ?? {});
    return s.costOfRevenue === undefined && s.grossProfit === undefined
      && Math.abs(s.revenue - s.operatingExpenses - s.operatingIncome) <= 1
      && expenses.every((value) => finite(value) && value >= 0)
      && expenses.reduce((sum, value) => sum + (value ?? 0), 0) <= s.operatingExpenses;
  }
  return finite(s.costOfRevenue) && finite(s.grossProfit) && s.costOfRevenue >= 0
    && close(s.revenue - s.costOfRevenue, s.grossProfit)
    && close(s.grossProfit - s.operatingExpenses, s.operatingIncome);
}

/** Reject inconsistent units/identities instead of constructing a misleading money flow. */
export function buildFinancialAnatomy(assetId: string, statements: FinancialStatement[] = [], options: { includeRevenueSegments?: boolean } = {}) {
  const periods = statements.filter((s) => s.assetId === assetId && /^https:\/\//.test(s.source)
    && /^\d{4}-\d{2}-\d{2}$/.test(s.period) && Number.isFinite(Date.parse(s.period))
    && /^[A-Z]{3}$/.test(s.currency) && [3, 6, 9, 12].includes(s.durationMonths)
    && reconcilesStatement(s))
    .sort((a, b) => a.period.localeCompare(b.period));
  const latest = periods.at(-1);
  if (!latest) return { status: "unavailable" as const };
  const history = periods.filter((s) => s.currency === latest.currency && s.durationMonths === latest.durationMonths
    && (!latest.accountingBasis || s.accountingBasis === latest.accountingBasis)
    && (s.presentation ?? "gross-profit") === (latest.presentation ?? "gross-profit"));
  const excludedHistoryCount = periods.filter((s) => s.currency === latest.currency && s.durationMonths === latest.durationMonths).length - history.length;
  // Growth uses a comparable fiscal period one year earlier, never a mixed quarterly/annual comparison.
  const prior = history.findLast((s) => {
    const days = (Date.parse(latest.period) - Date.parse(s.period)) / 86_400_000;
    return days >= 350 && days <= 380;
  });
  const reportedSegments = options.includeRevenueSegments === false ? undefined : latest.segments;
  const segmentSum = reportedSegments?.reduce((sum, item) => sum + item.revenue, 0) ?? 0;
  const segments = reportedSegments?.length && reportedSegments.every((item) => item.name.trim() && finite(item.revenue) && item.revenue >= 0)
    && segmentSum <= latest.revenue ? [...reportedSegments] : [];
  if (segments.length && segmentSum < latest.revenue) segments.push({ name: "Unallocated revenue", revenue: latest.revenue - segmentSum });
  const primaryRevenueSegment = segments
    .filter((segment) => segment.name !== "Unallocated revenue")
    .sort((a, b) => b.revenue - a.revenue)[0];
  const expenseEntries = Object.entries(latest.expenses ?? {});
  const expenseSum = expenseEntries.reduce((sum, [, value]) => sum + value!, 0);
  const expenses = expenseEntries.length && expenseEntries.every(([, value]) => finite(value) && value >= 0) && expenseSum <= latest.operatingExpenses
    ? expenseEntries.map(([name, value]) => ({ name, value: value! })) : [];
  if (expenses.length && expenseSum < latest.operatingExpenses) expenses.push({ name: "otherExpenses", value: latest.operatingExpenses - expenseSum });
  const links: FinancialFlowLink[] = [];
  // Negative earnings are displayed as signed statement values, not negative-width Sankey links.
  const flowAvailable = (latest.presentation === "operating-expenses" || latest.grossProfit >= 0) && latest.operatingIncome >= 0 && latest.netIncome >= 0;
  if (flowAvailable) {
    segments.forEach((segment, index) => links.push({ from: `segment-${index}`, to: "revenue", value: segment.revenue }));
    if (latest.presentation === "operating-expenses") {
      links.push({ from: "revenue", to: "operatingExpenses", value: latest.operatingExpenses },
        { from: "revenue", to: "operatingIncome", value: latest.operatingIncome });
    } else links.push({ from: "revenue", to: "costOfRevenue", value: latest.costOfRevenue },
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
  return { nodeValues, status: "available" as const, latest, history, excludedHistoryCount, segments, expenses, flowAvailable,
    links: links.filter((link) => link.value > 0),
    primaryRevenueSource: primaryRevenueSegment ? { ...primaryRevenueSegment, sharePct: primaryRevenueSegment.revenue / latest.revenue * 100 } : undefined,
    revenueGrowth: prior ? (latest.revenue / prior.revenue - 1) * 100 : undefined,
    grossMargin: latest.presentation === "operating-expenses" ? undefined : latest.grossProfit / latest.revenue * 100,
    operatingMargin: latest.operatingIncome / latest.revenue * 100 };
}
