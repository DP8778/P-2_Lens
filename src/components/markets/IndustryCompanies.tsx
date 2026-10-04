"use client";

import { industryAssetHref, type IndustryNavigation } from "@/lib/markets/industry-navigation";
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
  const revenueCoverage = economics?.revenueCoverage ?? 0;
  const growthCoverage = economics?.growthCoverage ?? 0;
  const coverageLabel = (coverage: number) => `${coverage}/${overview.total} ${en ? "companies" : "firem"}`;
  return <div className="industry-overview-strip">
    <div><span>{en ? "Universe market capitalization" : "Kapitalizace univerza"}</span><strong>{totalCap ? cap(totalCap, locale) : "—"}</strong><small>{en ? "Lens universe · updated" : "Univerzum Lens · aktualizováno"} {industry?.updatedAt.slice(0, 10) ?? capitalizationSource.observedOn}</small></div>
    <div data-coverage={revenueCoverage < overview.total ? "partial" : "complete"}><span>{en ? "Sum of available annual revenue" : "Součet dostupných ročních tržeb"}</span><strong>{economics?.aggregateRevenue === undefined ? "—" : cap(economics.aggregateRevenue, locale)}</strong><span className="industry-financial-coverage">{revenueCoverage < overview.total ? (en ? "Partial reports" : "Částečné výkazy") : (en ? "Reports" : "Výkazy")} · {coverageLabel(revenueCoverage)}</span><small>FY {economics?.fiscalYear ?? "—"} · {en ? "available annual reports only" : "jen dostupné roční výkazy"}</small></div>
    <div data-coverage={growthCoverage < overview.total ? "partial" : "complete"}><span>{en ? "Revenue growth · YoY" : "Růst tržeb · meziročně"}</span><strong>{economics?.revenueGrowth === undefined ? "—" : percent(economics.revenueGrowth, locale)}</strong><span className="industry-financial-coverage">{growthCoverage < overview.total ? (en ? "Partial comparison" : "Částečné srovnání") : (en ? "Comparable reports" : "Srovnatelné výkazy")} · {coverageLabel(growthCoverage)}</span><small>{en ? "Same companies in both fiscal years" : "Stejné firmy v obou fiskálních letech"}</small></div>
    <div><span>{en ? "Tracked companies" : "Sledované firmy"}</span><strong>{overview.total}</strong><small>{en ? "Lens selection of up to 100 eligible US-listed companies" : "Výběr Lens až 100 způsobilých firem obchodovaných v USA"}</small></div>
    {economics?.oldestFetchedAt && <p className="industry-financial-freshness">{en ? "Oldest financial update" : "Nejstarší aktualizace výkazů"}: <time dateTime={economics.oldestFetchedAt}>{economics.oldestFetchedAt.slice(0, 10)}</time></p>}
    {economics && <details className="industry-economics-note"><summary>{en ? "About annual revenue comparability" : "Srovnatelnost ročních tržeb"}</summary><p>{en ? "Annual USD revenue, fiscal years ending in" : "Roční tržby v USD, fiskální roky končící v"} {economics.fiscalYear}. {en ? "Fiscal year-ends differ. YoY uses the same companies in both years; missing reports are excluded, not zero. The sum describes available reports in the Lens universe, not the whole global industry." : "Konce fiskálních roků se liší. Meziroční růst porovnává stejné firmy v obou letech; chybějící výkazy nejsou nuly. Součet popisuje dostupné výkazy univerza Lens, nikoli celé globální odvětví."}</p></details>}
  </div>;
}

export function IndustryBreadth({ overview, timeframe, locale, navigation }: { overview: IndustryOverview; timeframe: string; locale: string; navigation?: IndustryNavigation }) {
  const en = locale === "en-US";
  return <section className="industry-breadth" aria-label={en ? "Theme breadth" : "Šíře tématu"}>
    <header><h4>{en ? "Leaders and laggards" : "Nejlepší a nejhorší"} <small>· {timeframe}</small></h4><span>{en ? `Measured ${overview.measured}/${overview.total} tracked companies` : `Změřeno ${overview.measured}/${overview.total} sledovaných firem`}</span></header>

    <div className="industry-rankings">
      {[{ name: en ? "Leaders" : "Nejsilnější výnosy", rows: overview.leaders }, { name: en ? "Laggards" : "Nejslabší výnosy", rows: overview.laggards }].map((group) => <div key={group.name}><h5>{group.name} · {timeframe}</h5>{group.rows.length ? group.rows.map((row) => <Link key={row.asset.id} href={industryAssetHref(locale, row.asset.id, navigation)}><strong>{row.asset.symbol}</strong><span>{row.asset.name}</span><b>{percent(row.returnPct!, locale)}</b></Link>) : <p>{en ? "History unavailable" : "Historie není dostupná"}</p>}</div>)}
    </div>
    <p className="industry-data-note">{en ? "Rankings cover only companies with available period history, not the entire Lens universe. Missing values are not zero returns." : "Pořadí zahrnuje pouze firmy s dostupnou historií období, ne celé univerzum Lens. Chybějící hodnoty nejsou nulové výnosy."}</p>
  </section>;
}

export function IndustryCompanies({ overview, timeframe, locale, capDate = capitalizationSource.observedOn, capSource = capitalizationSource.source, navigation }: { overview: IndustryOverview; timeframe: string; locale: string; capDate?: string; capSource?: string; navigation?: IndustryNavigation }) {
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
    { key: "marketCap", label: en ? "Market cap" : "Kapitalizace" }, ...themeTimeframes.map((period) => ({ key: period, label: period })),
    { key: "contribution", label: `${en ? "Contribution" : "Příspěvek"} · ${timeframe}` },
  ];
  const sortBy = (key: string) => setSort(`${key}:${sortColumn === key && sortDirection === "asc" ? "desc" : "asc"}`);
  return <section className="industry-companies" aria-label={en ? "Universe companies" : "Firmy v univerzu"}>
    <header><h4>{en ? "Universe companies" : "Firmy v univerzu"}</h4><span>{rows.length} / {overview.total}</span></header>
    <div className="industry-table-controls">
      <label>{en ? "Find a company" : "Hledat firmu"}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={en ? "Name or ticker" : "Název nebo ticker"} /></label>
      <label>{en ? "Company size" : "Velikost firmy"}<select value={size} onChange={(event) => setSize(event.target.value)}><option value="all">{en ? "All sizes" : "Všechny velikosti"}</option>{["Large", "Mid", "Small"].map((value) => <option key={value}>{value}</option>)}<option value="Unknown">{en ? "Unknown" : "Neznámá"}</option></select></label>
      <label>{en ? "Sort companies" : "Řadit firmy"}<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="best">{en ? "Return: highest first" : "Výnos: od nejvyššího"}</option><option value="worst">{en ? "Return: lowest first" : "Výnos: od nejnižšího"}</option><option value="name">{en ? "Company name A–Z" : "Název firmy A–Z"}</option>{columns.flatMap((column) => ["asc", "desc"].map((direction) => <option key={`${column.key}:${direction}`} value={`${column.key}:${direction}`}>{column.label} {direction === "asc" ? "↑" : "↓"}</option>))}</select></label>
    </div>
    <p className="industry-data-note">{en ? "Size uses a dated market-cap snapshot: Large ≥ $10bn, Mid $2–10bn, Small < $2bn (including micro-cap)." : "Velikost vychází ze snapshotu kapitalizací: Large ≥ 10 mld. USD, Mid 2–10 mld., Small < 2 mld. (včetně micro-cap)."} <a href={capSource} target="_blank" rel="noreferrer">Stock Analysis · {capDate}</a></p>
    <div className="industry-table-scroll" tabIndex={0} aria-label={en ? "Company table, scroll horizontally" : "Tabulka firem, lze posouvat vodorovně"}>
      <table><caption className="sr-only">{en ? "Whole tracked Lens universe" : "Celé sledované univerzum Lens"} · {timeframe}</caption>
        <thead><tr>{columns.map((column) => <th key={column.key} scope="col" aria-sort={sortColumn === column.key ? sortDirection === "asc" ? "ascending" : "descending" : "none"}><button onClick={() => sortBy(column.key)} aria-label={`${column.label} · ${en ? "sort" : "řadit"}`}>{column.label} <span aria-hidden="true">{sortColumn === column.key ? sortDirection === "asc" ? "↑" : "↓" : "↕"}</span></button></th>)}</tr></thead>
        <tbody>{rows.map((row) => {
          const href = industryAssetHref(locale, row.asset.id, navigation);
          return <tr key={row.asset.id} tabIndex={0} className="industry-company-row"
            onClick={(event) => { if (!(event.target as HTMLElement).closest("a") && !event.metaKey && !event.ctrlKey) router.push(href); }}
            onKeyDown={(event) => { if (event.key === "Enter" && event.target === event.currentTarget) router.push(href); }}>
            <td><Link href={href}><strong>{row.asset.symbol}</strong><span className="sr-only">{row.asset.name}</span></Link></td>
            <td><span>{row.asset.name}</span><small>{row.size === "Unknown" ? (en ? "Unknown size" : "Velikost neznámá") : row.size}{row.inBasket ? (en ? " · In the index" : " · V indexu") : ""}</small></td>
            <td>{row.marketCap === undefined ? "—" : cap(row.marketCap, locale)}</td>
            {themeTimeframes.map((period) => <td key={period}>{row.returns[period] === undefined ? <span className="industry-missing" aria-label={en ? "No history" : "Bez historie"}>—</span> : percent(row.returns[period]!, locale)}</td>)}
            <td>{row.contributionPctPoints === undefined ? "—" : en ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2, signDisplay: "exceptZero" }).format(row.contributionPctPoints)} pp` : points(row.contributionPctPoints, locale)}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    {!rows.length && <p role="status">{en ? "No companies match these filters." : "Žádná firma neodpovídá filtrům."}</p>}
    <p className="industry-data-note">{en ? "Period returns use available saved daily history. Annual history loads for the selected theme only; period switches use that same history. Contributions refer to the selected index weighting. Open a company for its current details. Market caps are a dated snapshot, not live fundamentals." : "Výnosy období používají dostupnou uloženou denní historii. Roční historie se načítá pouze pro vybrané téma; změna období využívá stejnou historii. Příspěvky odpovídají zvolenému vážení indexu. Aktuální detail otevřete kliknutím na firmu. Kapitalizace jsou datovaný snapshot, nikoli živá fundamentální data."}</p>
  </section>;
}
