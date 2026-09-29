"use client";

import { buildFinancialAnatomy, type FinancialStatement } from "@/lib/finance/financial-anatomy";
import { percent } from "@/components/charts/chart-formatters";

type Anatomy = Extract<ReturnType<typeof buildFinancialAnatomy>, { status: "available" }>;
const labels: Record<string, [string, string]> = {
  revenue: ["Tržby", "Revenue"], costOfRevenue: ["Náklady na tržby", "Cost of revenue"],
  grossProfit: ["Hrubý zisk", "Gross profit"], operatingExpenses: ["Provozní náklady", "Operating expenses"],
  operatingIncome: ["Provozní zisk", "Operating income"], netIncome: ["Čistý zisk", "Net income"],
  salesMarketing: ["Prodej a marketing", "Sales & marketing"], researchDevelopment: ["Výzkum a vývoj", "R&D"],
  generalAdministrative: ["Správa a administrativa", "G&A"], otherExpenses: ["Ostatní provozní náklady", "Other operating expenses"],
  netDeductions: ["Daně a ostatní vlivy · netto", "Taxes & other effects · net"],
  netAdditions: ["Ostatní čistý přínos", "Other net additions"],
};
const metrics = ["revenue", "grossProfit", "operatingIncome", "netIncome"] as const;

function FinancialFlow({ data, locale }: { data: Anatomy; locale: string }) {
  const en = locale === "en-US";
  const amount = (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency: data.latest.currency, notation: "compact", maximumFractionDigits: 2 }).format(value);
  const name = (id: string) => id.startsWith("segment-") ? data.segments[Number(id.split("-")[1])].name : labels[id]?.[en ? 1 : 0] ?? id;
  const stages = [data.segments.map((_, i) => `segment-${i}`), ["revenue"], ["costOfRevenue", "grossProfit"], ["operatingExpenses", "operatingIncome", "netAdditions"], [...data.expenses.map((item) => item.name), "netDeductions", "netIncome"]];
  const nodes = stages.flatMap((stage, column) => stage.filter((id) => data.links.some((link) => link.from === id || link.to === id)).map((id, row, columnNodes) => ({ id, x: 14 + column * 230, y: 40 + (row + 0.5) * 260 / columnNodes.length })));
  const position = new Map(nodes.map((node) => [node.id, node]));
  return <figure className="financial-flow">
    <div className="financial-flow-scroll" tabIndex={0} aria-label={en ? "Revenue to profit flow, scroll horizontally" : "Tok od tržeb k zisku, lze posouvat vodorovně"}>
      <svg viewBox="0 0 1150 360" role="img" aria-label={en ? "Revenue to profit. Exact amounts follow in the text summary." : "Od tržeb k zisku. Přesné částky jsou v textovém přehledu pod grafem."}>
        {data.links.map((link) => {
          const from = position.get(link.from)!, to = position.get(link.to)!;
          return <path key={`${link.from}-${link.to}`} d={`M ${from.x + 6} ${from.y} C ${from.x + 110} ${from.y}, ${to.x - 110} ${to.y}, ${to.x} ${to.y}`} stroke="currentColor" strokeOpacity="0.12" strokeWidth={Math.max(1, link.value / data.latest.revenue * 28)} fill="none"><title>{name(link.from)} → {name(link.to)}: {amount(link.value)}</title></path>;
        })}
        {nodes.map((node) => <g key={node.id}><rect x={node.x} y={node.y - 15} width="4" height="30" rx="2" fill="currentColor" opacity="0.6" /><text x={node.x + 10} y={node.y - 20} fill="currentColor" fontSize="11">{name(node.id)}</text><text x={node.x + 10} y={node.y + 4} fill="currentColor" fontSize="12">{amount(data.nodeValues[node.id])}</text></g>)}
      </svg>
    </div>
    <div className="financial-flow-mobile" aria-label={en ? "Revenue to profit flow" : "Tok od tržeb k zisku"}>{stages.filter((stage) => stage.some((id) => position.has(id))).map((stage, i) => <div className="financial-mobile-stage" key={i}>{i > 0 && <span className="financial-stage-arrow" aria-hidden="true">↓</span>}{stage.filter((id) => position.has(id)).map((id) => <div key={id}><span>{name(id)}</span><strong>{amount(data.nodeValues[id])}</strong><i aria-hidden="true" style={{ width: `${Math.min(100, data.nodeValues[id] / data.latest.revenue * 100)}%` }} /></div>)}</div>)}</div>
    <figcaption>{en ? "Revenue is split into costs and retained earnings at each stage. Flow widths are proportional to amounts; taxes and other effects are a net reconciliation, not an expense breakdown." : "Tržby se v jednotlivých krocích dělí na náklady a zbývající zisk. Šířka toku odpovídá částce; daně a ostatní vlivy jsou čistý rozdíl, nikoli rozpis nákladů."}</figcaption>
    <details><summary>{en ? "Flow amounts" : "Částky jednotlivých toků"}</summary><ul>{data.links.map((link) => <li key={`${link.from}-${link.to}`}>{name(link.from)} → {name(link.to)}: {amount(link.value)}</li>)}</ul></details>
  </figure>;
}

/** Only verified statements supplied by the provider-neutral data layer enter this view. */
export function FinancialAnatomy({ assetId, locale, statements, fetchedAt, stale }: { assetId: string; locale: string; statements?: FinancialStatement[]; fetchedAt?: string; stale?: boolean }) {
  const en = locale === "en-US";
  const data = buildFinancialAnatomy(assetId, statements);
  const name = (id: string) => labels[id][en ? 1 : 0];
  return <section className="financial-anatomy" aria-labelledby="financial-anatomy-title">
    <header><span>Financial Anatomy</span><h2 id="financial-anatomy-title">{en ? "How does this company make money?" : "Jak firma vydělává a kam peníze směřují?"}</h2></header>
    {data.status === "unavailable" ? <div className="financial-unavailable" role="status">
      <h3>{en ? "Financial statements are unavailable" : "Finanční výkazy nejsou dostupné"}</h3>
      <p>{en ? "Lens has no verified revenue segments, income statement or financial history for this company. Price history cannot substitute for these figures." : "Lens pro tuto firmu nemá ověřené segmenty tržeb, výsledovku ani historii hospodaření. Cenová historie tyto údaje nenahrazuje."}</p>
      <p className="financial-flow-outline">{en ? "Revenue → Gross profit → Operating income → Net income" : "Tržby → Hrubý zisk → Provozní zisk → Čistý zisk"}</p>
      <p>{en ? "Revenue structure, growth, margins and the financial flow will appear only with verified statements." : "Struktura tržeb, růst, marže a finanční tok se zobrazí pouze s ověřenými výkazy."}</p>
    </div> : <>
      <details className="financial-sources"><summary>{data.latest.period} · {en ? "Verified statements · sources and freshness" : "Ověřené výkazy · zdroje a aktuálnost"}{stale ? (en ? " · stale" : " · starší data") : ""}</summary>
      {fetchedAt && <p className="industry-data-note">{en ? "Statements retrieved" : "Výkazy načteny"} · {new Date(fetchedAt).toLocaleDateString(locale)}{stale ? (en ? " · Refresh failed; last verified data" : " · Obnovení selhalo; poslední ověřená data") : ""}</p>}
      <p className="industry-data-note">{data.latest.period} · {data.latest.durationMonths} {en ? "months" : "měsíců"} · {data.latest.currency} · <a href={data.latest.source} target="_blank" rel="noreferrer">{en ? "Statement source" : "Zdroj výkazu"}</a></p>
      </details>
      <dl className="financial-margins">{[{ title: en ? "Revenue growth · YoY" : "Růst tržeb · meziročně", value: data.revenueGrowth }, { title: en ? "Gross margin" : "Hrubá marže", value: data.grossMargin }, { title: en ? "Operating margin" : "Provozní marže", value: data.operatingMargin }].map((item) => <div key={item.title}><dt>{item.title}</dt><dd>{item.value === undefined ? "—" : percent(item.value, locale)}</dd></div>)}</dl>
      {data.flowAvailable ? <FinancialFlow data={data} locale={locale} /> : <p role="status">{en ? "Loss-making periods are shown as signed values below; the flow is unavailable." : "Ztrátové období je uvedeno se zápornými hodnotami níže; tok není dostupný."}</p>}
      <div className="financial-revenue-structure"><h3>{en ? "Revenue structure" : "Struktura tržeb"}</h3>{data.latest.segmentSource && <a className="industry-data-note" href={data.latest.segmentSource} target="_blank" rel="noreferrer">{en ? "Reported segment source" : "Zdroj vykázaných segmentů"}</a>}{data.segments.length ? <ul>{data.segments.map((segment, i) => <li key={i}><span>{segment.name === "Unallocated revenue" ? (en ? "Unallocated revenue" : "Nerozlišené tržby") : segment.name}</span><strong>{new Intl.NumberFormat(locale, { style: "currency", currency: data.latest.currency, notation: "compact" }).format(segment.revenue)}</strong></li>)}</ul> : <p>{en ? "Revenue segments unavailable." : "Segmenty tržeb nejsou dostupné."}</p>}</div>
      <h3>{en ? "Financial history" : "Historie hospodaření"}</h3>
      {data.history.length >= 2 && <div className="financial-trends">{metrics.map((key) => {
        const values = data.history.map((period) => period[key]);
        const low = Math.min(...values), high = Math.max(...values);
        const y = (value: number) => high === low ? 40 : 68 - (value - low) / (high - low) * 56;
        const summary = `${name(key)}: ${data.history.map((period) => `${period.period}: ${period[key].toLocaleString(locale)} ${period.currency}`).join("; ")}`;
        return <figure key={key}><figcaption>{name(key)}</figcaption><svg viewBox="0 0 240 80" role="img" aria-label={summary}><polyline points={values.map((value, i) => `${8 + i / (values.length - 1) * 224},${y(value)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="1.5" /><circle cx="232" cy={y(values.at(-1)!)} r="3" fill="currentColor" /></svg><small>{data.history[0].period} → {data.latest.period}</small></figure>;
      })}</div>}
      <details className="industry-disclosure" open={!data.flowAvailable}><summary>{en ? "Detailed financial history" : "Podrobná historie hospodaření"}</summary><div className="industry-table-scroll"><table className="financial-history"><caption>{en ? "Comparable periods; amounts in" : "Srovnatelná období; částky v"} {data.latest.currency}</caption><thead><tr><th>{en ? "Period" : "Období"}</th>{metrics.map((key) => <th key={key}>{name(key)}</th>)}</tr></thead><tbody>{data.history.map((statement) => <tr key={statement.period}><th><a href={statement.source} target="_blank" rel="noreferrer">{statement.period}</a></th>{metrics.map((key) => <td key={key}>{statement[key].toLocaleString(locale)}</td>)}</tr>)}</tbody></table></div></details>
    </>}
  </section>;
}
