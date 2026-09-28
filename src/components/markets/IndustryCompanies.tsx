"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { themeTimeframes } from "@/lib/finance/theme-performance";
import { useState } from "react";
import { capitalizationSource, filterIndustryCompanies, type IndustryOverview } from "@/lib/finance/industry-overview";
import type { IndustryView } from "@/lib/finance/industry-data";
import { percent, points } from "@/components/charts/chart-formatters";

const cap = (value: number, locale: string) => new Intl.NumberFormat(locale, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(value);

export function IndustryOverviewStrip({ overview, locale, industry }: { overview: IndustryOverview; locale: string; industry?: IndustryView }) {
  const en = locale === "en-US";
  const economics = industry?.economics;
  const totalCap = economics?.totalMarketCap ?? overview.capitalizationTotal;
  return <div className="industry-overview-strip">
    <div><span>{en ? "Total market capitalization" : "Celková kapitalizace"}</span><strong>{totalCap ? cap(totalCap, locale) : "—"}</strong><small>{en ? "Lens universe · snapshot" : "Univerzum Lens · snapshot"} {industry?.updatedAt.slice(0, 10) ?? capitalizationSource.observedOn}</small></div>
    <div><span>{en ? "Aggregate annual revenue" : "Souhrnné roční tržby"}</span><strong>{economics?.aggregateRevenue === undefined ? "—" : cap(economics.aggregateRevenue, locale)}</strong><small>FY {economics?.fiscalYear ?? "—"} · {economics?.revenueCoverage ?? 0}/{overview.total} {en ? "companies; sum of available reports" : "firem; součet dostupných výkazů"}</small></div>
    <div><span>{en ? "Revenue growth · YoY" : "Růst tržeb · meziročně"}</span><strong>{economics?.revenueGrowth === undefined ? "—" : percent(economics.revenueGrowth, locale)}</strong><small>{economics?.growthCoverage ?? 0}/{overview.total} {en ? "companies with paired annual reports" : "firem se srovnatelnými ročními výkazy"}</small></div>
    <div><span>{en ? "Companies" : "Počet firem"}</span><strong>{overview.total}{industry ? " / 100" : ""}</strong><small>{en ? "Lens selection, not the entire global industry" : "Výběr Lens, nikoli celé globální odvětví"}</small></div>
    <div><span>{en ? "Median period return" : "Medián výnosu období"}</span><strong>{overview.medianReturn === undefined ? "—" : percent(overview.medianReturn, locale)}</strong><small>{overview.measured}/{overview.total} {en ? "companies with history" : "firem s historií"}</small></div>
    <div><span>{en ? "Companies rising" : "Podíl rostoucích firem"}</span><strong>{overview.risingPercent === undefined ? "—" : `${overview.risingPercent.toLocaleString(locale, { maximumFractionDigits: 1 })} %`}</strong><small>{overview.positive}/{overview.measured} · {en ? "of measured companies" : "ze změřených firem"}</small></div>
    <div><span>{en ? "Top 10 concentration" : "Koncentrace Top 10"}</span><strong>{economics?.top10Concentration === undefined ? "—" : `${economics.top10Concentration.toLocaleString(locale, { maximumFractionDigits: 1 })} %`}</strong><small>{en ? "Share of Lens universe market cap" : "Podíl kapitalizace univerza Lens"}</small></div>
    {economics && <p className="industry-economics-note">{en ? "Annual USD revenue, fiscal years ending in" : "Roční tržby v USD, fiskální roky končící v"} {economics.fiscalYear}. {en ? "Fiscal year-ends differ. YoY uses the same companies in both years; missing reports are excluded, not zero." : "Konce fiskálních roků se liší. Meziroční růst porovnává stejné firmy v obou letech; chybějící výkazy nejsou nuly."} {economics.oldestFetchedAt && `${en ? "Oldest financial refresh" : "Nejstarší aktualizace výkazů"}: ${economics.oldestFetchedAt.slice(0, 10)}.`}</p>}
  </div>;
}

export function IndustryBreadth({ overview, timeframe, locale }: { overview: IndustryOverview; timeframe: string; locale: string }) {
  const en = locale === "en-US";
  return <section className="industry-breadth" aria-label={en ? "Industry breadth" : "Šíře odvětví"}>
    <header><h4>{en ? "Leaders and laggards" : "Nejlepší a nejhorší"} <small>· {timeframe}</small></h4><span>{en ? `Measured ${overview.measured}/${overview.total} tracked companies` : `Změřeno ${overview.measured}/${overview.total} sledovaných firem`}</span></header>

    <div className="industry-rankings">
      {[{ name: en ? "Leaders" : "Nejsilnější výnosy", rows: overview.leaders }, { name: en ? "Laggards" : "Nejslabší výnosy", rows: overview.laggards }].map((group) => <div key={group.name}><h5>{group.name} · {timeframe}</h5>{group.rows.length ? group.rows.map((row) => <Link key={row.asset.id} href={`/${locale}/assets/${encodeURIComponent(row.asset.id)}`}><strong>{row.asset.symbol}</strong><span>{row.asset.name}</span><b>{percent(row.returnPct!, locale)}</b></Link>) : <p>{en ? "History unavailable" : "Historie není dostupná"}</p>}</div>)}
    </div>
    <p className="industry-data-note">{en ? "Rankings cover only companies with available period history, not the whole industry. Missing values are not zero returns." : "Pořadí zahrnuje pouze firmy s dostupnou historií období, ne celé odvětví. Chybějící hodnoty nejsou nulové výnosy."}</p>
  </section>;
}

export function IndustryCompanies({ overview, timeframe, locale, capDate = capitalizationSource.observedOn, capSource = capitalizationSource.source }: { overview: IndustryOverview; timeframe: string; locale: string; capDate?: string; capSource?: string }) {
  const en = locale === "en-US";
  const [query, setQuery] = useState("");
  const [size, setSize] = useState("all");
  const [sort, setSort] = useState("best");
  const router = useRouter();
  const rows = filterIndustryCompanies(overview.rows, query, size, sort);
  const normalizedSort = sort === "best" ? `${timeframe}:desc` : sort === "worst" ? `${timeframe}:asc` : sort === "name" ? "name:asc" : sort;
  const [sortColumn, sortDirection] = normalizedSort.split(":");
  const columns = [
    { key: "symbol", label: "Symbol" }, { key: "name", label: en ? "Name" : "Název" },
    { key: "marketCap", label: "MarketCap" }, ...themeTimeframes.map((period) => ({ key: period, label: period })),
    { key: "contribution", label: `${en ? "Contribution" : "Příspěvek"} · ${timeframe}` },
  ];
  const sortBy = (key: string) => setSort(`${key}:${sortColumn === key && sortDirection === "asc" ? "desc" : "asc"}`);
  return <section className="industry-companies" aria-label={en ? "Industry companies" : "Firmy v odvětví"}>
    <header><h4>{en ? "Industry companies" : "Firmy v odvětví"}</h4><span>{rows.length} / {overview.total}</span></header>
    <div className="industry-table-controls">
      <label>{en ? "Find a company" : "Hledat firmu"}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={en ? "Name or ticker" : "Název nebo ticker"} /></label>
      <label>{en ? "Company size" : "Velikost firmy"}<select value={size} onChange={(event) => setSize(event.target.value)}><option value="all">{en ? "All sizes" : "Všechny velikosti"}</option>{["Large", "Mid", "Small"].map((value) => <option key={value}>{value}</option>)}<option value="Unknown">{en ? "Unknown" : "Neznámá"}</option></select></label>
      <label>{en ? "Sort companies" : "Řadit firmy"}<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="best">{en ? "Return: highest first" : "Výnos: od nejvyššího"}</option><option value="worst">{en ? "Return: lowest first" : "Výnos: od nejnižšího"}</option><option value="name">{en ? "Company name A–Z" : "Název firmy A–Z"}</option>{columns.flatMap((column) => ["asc", "desc"].map((direction) => <option key={`${column.key}:${direction}`} value={`${column.key}:${direction}`}>{column.label} {direction === "asc" ? "↑" : "↓"}</option>))}</select></label>
    </div>
    <p className="industry-data-note">{en ? "Size uses a dated market-cap snapshot: Large ≥ $10bn, Mid $2–10bn, Small < $2bn (including micro-cap)." : "Velikost vychází ze snapshotu kapitalizací: Large ≥ 10 mld. USD, Mid 2–10 mld., Small < 2 mld. (včetně micro-cap)."} <a href={capSource} target="_blank" rel="noreferrer">Stock Analysis · {capDate}</a></p>
    <div className="industry-table-scroll" tabIndex={0} aria-label={en ? "Company table, scroll horizontally" : "Tabulka firem, lze posouvat vodorovně"}>
      <table><caption className="sr-only">{en ? "Whole tracked industry universe" : "Celé sledované univerzum odvětví"} · {timeframe}</caption>
        <thead><tr>{columns.map((column) => <th key={column.key} scope="col" aria-sort={sortColumn === column.key ? sortDirection === "asc" ? "ascending" : "descending" : "none"}><button onClick={() => sortBy(column.key)} aria-label={`${column.label} · ${en ? "sort" : "řadit"}`}>{column.label} <span aria-hidden="true">{sortColumn === column.key ? sortDirection === "asc" ? "↑" : "↓" : "↕"}</span></button></th>)}</tr></thead>
        <tbody>{rows.map((row) => {
          const href = `/${locale}/assets/${encodeURIComponent(row.asset.id)}`;
          return <tr key={row.asset.id} tabIndex={0} className="industry-company-row"
            onClick={(event) => { if (!(event.target as HTMLElement).closest("a") && !event.metaKey && !event.ctrlKey) router.push(href); }}
            onKeyDown={(event) => { if (event.key === "Enter" && event.target === event.currentTarget) router.push(href); }}>
            <td><Link href={href}><strong>{row.asset.symbol}</strong><span className="sr-only">{row.asset.name}</span></Link></td>
            <td><span>{row.asset.name}</span><small>{row.size === "Unknown" ? (en ? "Unknown size" : "Velikost neznámá") : row.size}{row.inBasket ? (en ? " · Industry Index" : " · Industry Index") : ""}</small></td>
            <td>{row.marketCap === undefined ? "—" : cap(row.marketCap, locale)}</td>
            {themeTimeframes.map((period) => <td key={period}>{row.returns[period] === undefined ? <span className="industry-missing" aria-label={en ? "No history" : "Bez historie"}>—</span> : percent(row.returns[period]!, locale)}</td>)}
            <td>{row.contributionPctPoints === undefined ? "—" : en ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2, signDisplay: "exceptZero" }).format(row.contributionPctPoints)} pp` : points(row.contributionPctPoints, locale)}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    {!rows.length && <p role="status">{en ? "No companies match these filters." : "Žádná firma neodpovídá filtrům."}</p>}
    <p className="industry-data-note">{en ? "Period returns use available saved daily history. Annual history loads for the selected industry only; period switches use that same history. Contributions refer to the selected index weighting. Open a company for its current details. Market caps are a dated snapshot, not live fundamentals." : "Výnosy období používají dostupnou uloženou denní historii. Roční historie se načítá pouze pro vybrané odvětví; změna období využívá stejnou historii. Příspěvky odpovídají zvolenému vážení indexu. Aktuální detail otevřete kliknutím na firmu. Kapitalizace jsou datovaný snapshot, nikoli živá fundamentální data."}</p>
  </section>;
}
