"use client";

import Link from "next/link";
import { useState } from "react";
import { capitalizationSource, filterIndustryCompanies, type IndustryOverview } from "@/lib/finance/industry-overview";
import { percent, points } from "@/components/charts/chart-formatters";

const cap = (value: number, locale: string) => new Intl.NumberFormat(locale, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(value);

export function IndustryOverviewStrip({ overview, basketCount, locale }: { overview: IndustryOverview; basketCount: number; locale: string }) {
  const en = locale === "en-US";
  return <div className="industry-overview-strip">
    <div><span>{en ? "Tracked companies" : "Sledované firmy"}</span><strong>{overview.total}</strong><small>{en ? "Curated universe, not the entire global industry" : "Kurátorovaný výběr, ne celé globální odvětví"}</small></div>
    <div><span>{en ? "Lens calculation basket" : "Výpočtový koš Lens"}</span><strong>{basketCount} / {overview.total}</strong><small>{en ? "Equal starting weights · Index 100" : "Stejné počáteční váhy · Index 100"}</small></div>
    <div><span>{en ? "Whole tracked universe return" : "Výnos celého sledovaného univerza"}</span><strong>{overview.universeReturn === undefined ? "—" : percent(overview.universeReturn, locale)}</strong><small>{overview.universeReturn === undefined ? (en ? `History available for ${overview.measured}/${overview.total} companies; no partial-universe average.` : `Historie dostupná pro ${overview.measured}/${overview.total} firem; průměr neúplného univerza nepočítáme.`) : (en ? "Equal-weight · all tracked companies" : "Equal-weight · všechny sledované firmy")}</small></div>
    <div><span>{en ? "Known market caps · snapshot" : "Známé kapitalizace · snapshot"}</span><strong>{overview.capitalizationCoverage ? cap(overview.capitalizationTotal, locale) : "—"}</strong><small>{overview.capitalizationCoverage}/{overview.total} · {capitalizationSource.observedOn} · {en ? "not live" : "není živý údaj"}</small></div>
  </div>;
}

export function IndustryBreadth({ overview, timeframe, locale }: { overview: IndustryOverview; timeframe: string; locale: string }) {
  const en = locale === "en-US";
  return <section className="industry-breadth" aria-label={en ? "Industry breadth" : "Šíře odvětví"}>
    <header><h4>{en ? "Market breadth" : "Šíře trhu"} <small>· {timeframe}</small></h4><span>{en ? `Measured ${overview.measured}/${overview.total} tracked companies` : `Změřeno ${overview.measured}/${overview.total} sledovaných firem`}</span></header>
    <p className="industry-breadth-counts"><b>{overview.positive}</b> {en ? "rising" : "roste"} <b>{overview.negative}</b> {en ? "falling" : "klesá"} <b>{overview.unchanged}</b> {en ? "unchanged" : "beze změny"} <span>· {en ? "available history only" : "jen dostupná historie"}</span></p>
    <div className="industry-rankings">
      {[{ name: en ? "Leaders" : "Nejsilnější výnosy", rows: overview.leaders }, { name: en ? "Laggards" : "Nejslabší výnosy", rows: overview.laggards }].map((group) => <div key={group.name}><h5>{group.name} · {timeframe}</h5>{group.rows.length ? group.rows.map((row) => <Link key={row.asset.id} href={`/${locale}/assets/${encodeURIComponent(row.asset.id)}`}><strong>{row.asset.symbol}</strong><span>{row.asset.name}</span><b>{percent(row.returnPct!, locale)}</b></Link>) : <p>{en ? "History unavailable" : "Historie není dostupná"}</p>}</div>)}
    </div>
    <p className="industry-data-note">{en ? "Rankings cover only companies with available period history, not the whole industry. Missing values are not zero returns." : "Pořadí zahrnuje pouze firmy s dostupnou historií období, ne celé odvětví. Chybějící hodnoty nejsou nulové výnosy."}</p>
  </section>;
}

export function IndustryCompanies({ overview, timeframe, locale }: { overview: IndustryOverview; timeframe: string; locale: string }) {
  const en = locale === "en-US";
  const [query, setQuery] = useState("");
  const [size, setSize] = useState("all");
  const [sort, setSort] = useState("best");
  const rows = filterIndustryCompanies(overview.rows, query, size, sort);
  return <section className="industry-companies" aria-label={en ? "Industry companies" : "Firmy v odvětví"}>
    <header><h4>{en ? "Industry companies" : "Firmy v odvětví"}</h4><span>{rows.length} / {overview.total}</span></header>
    <div className="industry-table-controls">
      <label>{en ? "Find a company" : "Hledat firmu"}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={en ? "Name or ticker" : "Název nebo ticker"} /></label>
      <label>{en ? "Company size" : "Velikost firmy"}<select value={size} onChange={(event) => setSize(event.target.value)}><option value="all">{en ? "All sizes" : "Všechny velikosti"}</option>{["Large", "Mid", "Small"].map((value) => <option key={value}>{value}</option>)}<option value="Unknown">{en ? "Unknown" : "Neznámá"}</option></select></label>
      <label>{en ? "Sort companies" : "Řadit firmy"}<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="best">{en ? "Return: highest first" : "Výnos: od nejvyššího"}</option><option value="worst">{en ? "Return: lowest first" : "Výnos: od nejnižšího"}</option><option value="name">{en ? "Company name A–Z" : "Název firmy A–Z"}</option></select></label>
    </div>
    <p className="industry-data-note">{en ? "Size uses a dated market-cap snapshot: Large ≥ $10bn, Mid $2–10bn, Small < $2bn (including micro-cap)." : "Velikost vychází ze snapshotu kapitalizací: Large ≥ 10 mld. USD, Mid 2–10 mld., Small < 2 mld. (včetně micro-cap)."} <a href={capitalizationSource.source} target="_blank" rel="noreferrer">Stock Analysis · {capitalizationSource.observedOn}</a></p>
    <div className="industry-table-scroll" tabIndex={0} aria-label={en ? "Company table, scroll horizontally" : "Tabulka firem, lze posouvat vodorovně"}>
      <table><caption className="sr-only">{en ? "Whole tracked industry universe" : "Celé sledované univerzum odvětví"} · {timeframe}</caption><thead><tr><th scope="col">{en ? "Company" : "Firma"}</th><th scope="col">{en ? "Size" : "Velikost"}</th><th scope="col">{en ? "Market cap · snapshot" : "Kapitalizace · snapshot"}</th><th scope="col">{en ? "Return" : "Výnos"} · {timeframe}</th><th scope="col">Lens Theme</th><th scope="col">{en ? "Basket contribution" : "Příspěvek do koše"}</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.asset.id}><td><Link href={`/${locale}/assets/${encodeURIComponent(row.asset.id)}`}><strong>{row.asset.symbol}</strong><span>{row.asset.name}</span></Link></td><td>{row.size === "Unknown" ? "—" : row.size}</td><td>{row.marketCap === undefined ? "—" : cap(row.marketCap, locale)}</td><td title={row.from && row.to ? `${row.from} – ${row.to}` : undefined}>{row.returnPct === undefined ? <span className="industry-missing">{en ? "No history" : "Bez historie"}</span> : percent(row.returnPct, locale)}</td><td>{row.inBasket ? (en ? "In calculation basket" : "Ve výpočtovém koši") : "—"}</td><td>{row.contributionPctPoints === undefined ? "—" : en ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2, signDisplay: "exceptZero" }).format(row.contributionPctPoints)} pp` : points(row.contributionPctPoints, locale)}</td></tr>)}</tbody></table>
    </div>
    {!rows.length && <p role="status">{en ? "No companies match these filters." : "Žádná firma neodpovídá filtrům."}</p>}
    <p className="industry-data-note">{en ? "Period returns use available saved daily history. Only the Lens calculation basket loads automatically. Open a company for its current details. Market caps are a dated snapshot, not live fundamentals." : "Výnosy období používají dostupnou uloženou denní historii. Automaticky se načítá pouze výpočtový koš Lens. Aktuální detail otevřete kliknutím na firmu. Kapitalizace jsou datovaný snapshot, nikoli živá fundamentální data."}</p>
  </section>;
}
