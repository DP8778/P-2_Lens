import { buildCompanyHistory } from "@/lib/finance/company-history";
import type { FinancialStatement } from "@/lib/finance/financial-anatomy";
import { advertisingContext } from "@/lib/finance/advertising-context";

export function PlatformEconomics({ locale, statements }: { locale: string; statements?: FinancialStatement[] }) {
  const history = buildCompanyHistory("twelvedata:XNGM:TTD", statements);
  if (!history) return null;
  const en = locale === "en-US";
  const money = (value: number) => new Intl.NumberFormat(locale, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(value);
  const pct = (value: number) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 }).format(value);
  const max = Math.max(...history.periods.map((period) => period.grossSpend?.value ?? period.revenue));
  return <section className="platform-economics" aria-labelledby="platform-economics-title">
    <header><span>{en ? "Platform economics" : "Ekonomika platformy"}</span><h2 id="platform-economics-title" tabIndex={-1}>{en ? "Ad spend is not company revenue" : "Objem reklamy není tržba firmy"}</h2></header>
    <p>{en ? "Gross spend includes client purchases of inventory, services and data plus the platform fee. Revenue is recognized on a different, largely net basis. These overlapping measures are compared, never stacked or shown as slices of a whole." : "Gross spend zahrnuje klientské nákupy reklamního prostoru, služeb a dat i poplatek platformě. Tržby mají jiný, převážně netto účetní základ. Překrývající se veličiny se porovnávají, nesčítají se do celku."}</p>
    <div className="platform-comparison">{history.periods.map((period) => <figure key={period.period}>
      <figcaption>FY{period.period.slice(0, 4)} · USD</figcaption>
      <div><span>Gross spend</span><strong>{period.grossSpend ? money(period.grossSpend.value) : "—"}</strong><i style={{ width: `${(period.grossSpend?.value ?? 0) / max * 100}%` }} aria-hidden="true" /></div>
      <div><span>{en ? "Revenue" : "Tržby"}</span><strong>{money(period.revenue)}</strong><i className="revenue-bar" style={{ width: `${period.revenue / max * 100}%` }} aria-hidden="true" /></div>
      <p>{en ? "Revenue / gross spend" : "Tržby / gross spend"}: <strong>{period.grossSpend ? `${period.grossSpend.sourceScale === 1_000_000 ? "≈ " : ""}${pct(period.revenue / period.grossSpend.value)}` : "—"}</strong></p>
    </figure>)}</div>
    <p className="industry-data-note">{en ? "The ratio is derived by Lens, not a contractual fee or market share. FY2023 spend is reported in rounded millions; FY2024–25 in thousands. CTV, Kokai and UID2 are not revenue segments." : "Poměr odvozuje Lens; není smluvní sazbou ani tržním podílem. Gross spend FY2023 je vykázaný v zaokrouhlených milionech, FY2024–25 v tisících. CTV, Kokai ani UID2 nejsou výnosové segmenty."}</p>
    <div className="industry-table-scroll"><table><caption>{en ? "Reported annual values in USD; sources and precision" : "Vykázané roční hodnoty v USD; zdroje a přesnost"}</caption><thead><tr><th>FY</th><th>Gross spend</th><th>{en ? "Revenue" : "Tržby"}</th><th>{en ? "Source scale · spend / revenue" : "Měřítko zdroje · spend / tržby"}</th></tr></thead><tbody>{history.periods.map((p) => <tr key={p.period}><th>{p.period.slice(0, 4)}</th><td>{p.grossSpend ? <a href={p.grossSpend.source} target="_blank" rel="noreferrer">{p.grossSpend.value.toLocaleString(locale)}</a> : "—"}</td><td><a href={p.source} target="_blank" rel="noreferrer">{p.revenue.toLocaleString(locale)}</a></td><td>{p.grossSpend?.sourceScale.toLocaleString(locale) ?? "—"} / {p.sourceScale?.toLocaleString(locale)} USD</td></tr>)}</tbody></table></div>
  </section>;
}

export function AdvertisingMarketContext({ locale }: { locale: "cs-CZ" | "en-US" }) {
  const en = locale === "en-US", data = advertisingContext;
  return <section className="company-market-position advertising-context" aria-labelledby="advertising-market-title">
    <header><span>{en ? "Market and competitors" : "Trh a konkurence"} · {data.reviewedAt}</span><h2 id="advertising-market-title" tabIndex={-1}>{en ? "Buying ads in an open ecosystem" : "Nákup reklamy v otevřeném ekosystému"}</h2></header>
    <div className="market-industry-size"><div><span>{data.market.scope[locale]} · CY{data.market.year}</span><strong>{new Intl.NumberFormat(locale, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(data.market.value)}</strong></div><p>{data.market.limitation[locale]} <a href={data.market.source} target="_blank" rel="noreferrer">IAB / PwC ↗</a></p></div>
    <div className="advertising-models">{data.competitors.map((item) => <article key={item.name}><h3>{item.name}</h3><p>{item.description[locale]}</p><a href={item.source} target="_blank" rel="noreferrer">{en ? "Company source" : "Firemní zdroj"} ↗</a></article>)}</div>
    <p className="industry-data-note">{en ? "Qualitative comparison. Comparable DSP revenue and spend are not published for all peers, so Lens shows no competitor share pie. AMD and TTD are examples of different businesses, not competitors." : "Kvalitativní srovnání. Srovnatelné DSP tržby a objemy nejsou u všech firem zveřejněné; Lens proto neukazuje koláč podílů konkurentů. AMD a TTD jsou příklady různých podnikání, nikoli konkurenti."}</p>
    <div className="advertising-models">{data.watchouts.map((item) => <article key={item.label[locale]}><span>{item.kind[locale]}</span><h3>{item.label[locale]}</h3><p>{item.text[locale]}</p><a href={item.source} target="_blank" rel="noreferrer">{en ? "Evidence" : "Podklad"} ↗</a></article>)}</div>
  </section>;
}
