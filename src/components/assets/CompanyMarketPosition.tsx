"use client";

import { useState } from "react";
import { ShareDonut, shareColors } from "@/components/charts/ShareDonut";
import { companyMarketPosition, marketLeader } from "@/lib/finance/market-position";

export function CompanyMarketPosition({ assetId, locale }: { assetId: string; locale: "cs-CZ" | "en-US" }) {
  const [selected, setSelected] = useState("server-x86");
  const data = companyMarketPosition(assetId);
  if (!data?.markets.length) return null;
  const en = locale === "en-US";
  const market = data.markets.find(item => item.id === selected) ?? data.markets[0];
  const leader = marketLeader(market);
  const amd = market.shares.find(share => share.name === "AMD")!;
  const percent = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1, style: "percent" }).format(value / 100);
  const amount = new Intl.NumberFormat(locale, { style: "currency", currency: data.industry.currency, notation: "compact", maximumFractionDigits: 1 }).format(data.industry.value);
  const summary = market.shares.map(share => `${share.name}: ${percent(share.sharePct)}`).join("; ");
  return <section className="company-market-position" aria-labelledby="company-market-title">
    <header className="company-market-heading"><div><span>{en ? "Market and competitors" : "Trh a konkurence"}</span><h2 id="company-market-title">{en ? "Where does AMD compete?" : "Kde AMD soutěží a kdo vede?"}</h2></div><small>{en ? "Reviewed" : "Ověřeno"} <time dateTime={data.reviewedAt}>{new Date(`${data.reviewedAt}T12:00:00Z`).toLocaleDateString(locale)}</time></small></header>
    <div className="market-industry-size"><div><span>{data.industry.scope[locale]} · CY{data.industry.year}</span><strong>{amount}</strong></div><p>{en ? "Broader industry context. This category also contains other logic chips; its revenue is not the denominator of the unit shares below." : "Širší kontext odvětví. Kategorie obsahuje i další logické čipy; její tržby nejsou základem pro kusové podíly níže."} <a href={data.industry.source.url} target="_blank" rel="noreferrer">SIA / WSTS ↗</a></p></div>
    <div className="market-select" role="group" aria-label={en ? "Select a market" : "Vybrat trh"}>{data.markets.map(item => <button key={item.id} aria-pressed={market.id === item.id} onClick={() => setSelected(item.id)}>{item.title[locale]}</button>)}</div>
    <div className="market-position-card">
      <div className="market-position-copy"><span>{market.period} · {en ? "Estimated share of units shipped" : "Odhad podílu na dodaných kusech"}{market.rounded && (en ? " · rounded" : " · zaokrouhleno")}</span><h3>{market.title[locale]}</h3><p>{market.scope[locale]}</p>
        <dl><div><dt>{en ? "AMD share" : "Podíl AMD"}</dt><dd>{market.rounded && "≈ "}{percent(amd.sharePct)}</dd></div><div><dt>{en ? "Market leader" : "Největší hráč"}</dt><dd>{leader.name} <small>{market.rounded && "≈ "}{percent(leader.sharePct)}</small></dd></div>
        {"size" in market && market.size && <div><dt>{en ? "Market volume in the quarter" : "Velikost trhu za čtvrtletí"}</dt><dd>{new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(market.size.value)} <small>{en ? "cards shipped" : "dodaných karet"}</small></dd></div>}</dl>
      </div>
      <figure className="market-share-figure"><ShareDonut locale={locale} segments={market.shares} center={`${market.rounded ? "≈ " : ""}${percent(amd.sharePct)}`} caption={en ? "AMD · unit share" : "AMD · kusový podíl"} label={`${market.title[locale]}, ${market.period}. ${summary}. ${en ? "Unit shares, not revenue shares." : "Kusové podíly, nikoli podíly na tržbách."}`} />
        <figcaption><ul>{market.shares.map((share, index) => <li key={share.name}><i style={{ background: shareColors[index] }} aria-hidden="true" /><span>{share.name}</span><strong>{market.rounded && "≈ "}{percent(share.sharePct)}</strong></li>)}</ul></figcaption>
      </figure>
    </div>
    <p className="market-source-line">{market.researcher} · {market.sources.map((source, index) => <span key={source.url}>{index > 0 && " · "}<a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a>{source.kind === "secondary" && (en ? " (secondary reporting)" : " (sekundární zpravodajský zdroj)")}</span>)}</p>
    <div className="market-business-models"><header><h3>{en ? "How do their businesses differ?" : "Jak se liší jejich podnikání?"}</h3><p>{en ? "Company-described strategies; these are not proof of superior performance or future returns." : "Popsané strategie firem. Samy o sobě nedokládají vyšší výkon ani budoucí výnos."}</p></header>
      <div>{data.competitors.map(company => <article key={company.name}><header><h4>{company.name}</h4><span>{company.role[locale]}</span></header><p>{company.model[locale]}</p><h5>{en ? "Strategy for an advantage" : "Na čem staví výhodu"}</h5><p>{company.strategy[locale]}</p><div className="market-watch"><span>{en ? "Lens interpretation · what to watch" : "Interpretace Lens · co sledovat"}</span><p>{company.watch[locale]}</p></div><a href={company.source.url} target="_blank" rel="noreferrer">{company.source.title} ↗</a></article>)}</div>
    </div>
    <details className="market-context-methodology"><summary>{en ? "Definitions and data dates" : "Definice trhů a stáří dat"}</summary><p>{en ? "Company revenue mix, market unit share and industry sales answer different questions. CPU and AIB observations are Q2 2026 estimates; logic chip sales cover calendar 2025. AI accelerator share is not inferred from company Data Center revenues." : "Struktura tržeb firmy, kusový podíl na trhu a tržby celého odvětví odpovídají na různé otázky. Podíly CPU a AIB jsou odhady pro Q2 2026; tržby logických čipů patří do kalendářního roku 2025. Podíl AI akcelerátorů neodvozujeme z firemních tržeb segmentu Data Center."}</p><ul>{[data.industry.source, ...data.markets.flatMap(item => item.sources), ...data.competitors.map(company => company.source)].map(source => <li key={source.url}>{source.published} · <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul></details>
  </section>;
}
