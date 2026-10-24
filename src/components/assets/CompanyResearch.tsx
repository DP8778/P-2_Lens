"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { MarketAsset } from "@/lib/market-data/types";
import type { Locale } from "@/i18n/getDictionary";
import { CompanyResearchError, loadCompanyResearch, researchIsFresh, savedCompanyResearch } from "@/lib/company-research/client";
import { companyResearchRequestSchema, type CompanyResearch, type ResearchErrorCode } from "@/lib/company-research/schema";

export function useCompanyResearch(asset: MarketAsset | undefined, locale: Locale) {
  const request = useMemo(() => asset?.type === "stock" ? companyResearchRequestSchema.safeParse({
    assetId: asset.id, symbol: asset.symbol, companyName: asset.name, assetType: "stock", locale,
    ...(asset.exchange ? { exchange: asset.exchange } : {}), ...(asset.micCode ? { micCode: asset.micCode } : {}), ...(asset.country ? { country: asset.country } : {}),
  }) : undefined, [asset, locale]);
  const key = `${asset?.id}:${locale}`;
  const [state, setState] = useState<{ key: string; data?: CompanyResearch; loading: boolean; error?: ResearchErrorCode }>();
  const [refreshIndex, setRefreshIndex] = useState(0);
  const refresh = useCallback(() => setRefreshIndex(index => index + 1), []);
  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      if (!request.success) { setState({ key, loading: false, error: "invalid_identity" }); return; }
      const data = savedCompanyResearch(request.data);
      setState({ key, data, loading: true });
      try {
        const research = await loadCompanyResearch(request.data, refreshIndex > 0);
        if (!cancelled) setState({ key, data: research, loading: false });
      } catch (error) {
        if (!cancelled) setState({ key, data, loading: false, error: error instanceof CompanyResearchError ? error.code : "unavailable" });
      }
    })();
    return () => { cancelled = true; };
  }, [request, key, refreshIndex]);
  const current = state?.key === key ? state : undefined;
  return { data: current?.data, loading: !!request && (current?.loading ?? true), error: current?.error, refresh };
}
type ResearchState = ReturnType<typeof useCompanyResearch>;
const errorCopy = (code: ResearchErrorCode, en: boolean) => code === "no_key"
  ? en ? "Company research is unavailable: OpenAI research is not configured." : "Firemní výzkum není dostupný: OpenAI výzkum není nakonfigurovaný."
  : code === "rate_limited" ? en ? "The research limit has been reached. Please try refreshing later." : "Limit firemních výzkumů je vyčerpán. Obnovu zkuste za chvíli."
  : en ? "Current research could not be refreshed." : "Aktuální výzkum se nepodařilo obnovit.";

function ResearchItems({ data, section, locale }: { data: CompanyResearch; section: keyof CompanyResearch["sections"]; locale: string }) {
  const en = locale === "en-US";
  const items = data.sections[section];
  return items.length ? <div className="company-research-items">{items.map((item, index) => <article key={index}>
    {section === "developments" && <small>{item.eventDate ? <time dateTime={item.eventDate}>{new Date(`${item.eventDate}T12:00:00Z`).toLocaleDateString(locale)}</time> : en ? "Event date not verified" : "Datum události není ověřeno"}</small>}
    <p>{item.text}</p>
    <div className="research-citations" aria-label={en ? "Evidence for this item" : "Zdroje tohoto bodu"}>{item.sourceIds.map(id => {
      const source = data.sources.find(candidate => candidate.id === id)!;
      return <a key={id} href={source.url} target="_blank" rel="noreferrer" title={source.title}>{source.title} · {source.domain}</a>;
    })}</div>
  </article>)}</div> : <p className="research-section-intro">{en ? "Not enough sourced evidence for this section." : "Pro tuto část není dostatek zdrojovaných podkladů."}</p>;
}

export function CompanyOverview({ research, locale }: { research: ResearchState; locale: string }) {
  const en = locale === "en-US";
  return <section className="company-overview" aria-labelledby="company-overview-title">
    <header className="company-research-heading"><div><span>{en ? "Company · web research" : "Firma · webový výzkum"}</span><h2 id="company-overview-title">{en ? "What does the company do?" : "Čím se firma zabývá?"}</h2></div><button className="research-refresh" onClick={research.refresh} disabled={research.loading}>{en ? "Refresh research" : "Obnovit výzkum"}</button></header>
    <div aria-live="polite">
      {research.loading && <p role="status">{en ? "Lens is reviewing current company sources…" : "Lens prochází aktuální firemní zdroje…"}</p>}
      {research.error && <p role="status">{errorCopy(research.error, en)}{research.data && (en ? " The last available research remains below." : " Níže zůstává poslední dostupný výzkum.")}</p>}
    </div>
    {research.data && <>
      <p className="research-freshness">{en ? "Research updated" : "Výzkum aktualizován"}: <time dateTime={research.data.researchedAt}>{new Date(research.data.researchedAt).toLocaleString(locale)}</time>{(!researchIsFresh(research.data) || research.error) && (en ? " · Saved research" : " · Uložený výzkum")}</p>
      <ResearchItems data={research.data} section="overview" locale={locale} />
    </>}
    {!research.data && !research.loading && <p className="research-section-intro">{en ? "A company description will appear only with cited evidence. Verified prices and statements remain available below." : "Popis firmy zobrazíme pouze s citovanými podklady. Ověřené ceny a výkazy jsou dál dostupné níže."}</p>}
  </section>;
}

export function CompanyResearchSections({ research, locale }: { research: ResearchState; locale: string }) {
  const en = locale === "en-US", data = research.data;
  if (!data) return <section className="company-research-status" aria-labelledby="company-research-status-title" aria-live="polite">
    <div><h2 id="company-research-status-title">{en ? "Company research" : "Firemní výzkum"}</h2>
      <p role="status">{research.loading
        ? (en ? "Looking up sourced company developments…" : "Vyhledávám firemní události se zdroji…")
        : (en ? "Current developments, growth opportunities and risks are unavailable. Reported financials above remain available." : "Aktuální události, možnosti růstu a rizika nejsou dostupné. Výkazy firmy výše zůstávají k dispozici.")}</p>
    </div><button className="research-refresh" onClick={research.refresh} disabled={research.loading}>{en ? "Refresh research" : "Obnovit výzkum"}</button>
  </section>;
  return <div className="company-research" data-state={research.loading ? "loading" : data ? "ready" : "unavailable"}>
    <CompanyOverview research={research} locale={locale} />
    <section aria-labelledby="company-developments-title"><span className="research-eyebrow">{en ? "Sourced developments" : "Události se zdroji"}</span><h2 id="company-developments-title">{en ? "What has changed recently?" : "Co se kolem firmy změnilo?"}</h2>
      <p className="research-section-intro">{en ? "Publicly reported events help explain changes in the business. Their significance is an interpretation, not a proven cause of the share price." : "Veřejně popsané události pomáhají vysvětlit změny podnikání. Jejich význam je interpretace, nikoli prokázaná příčina pohybu ceny."}</p>
      {data ? <><p className="research-freshness">{data.horizonDays === 180 ? (en ? "Search widened to 180 days because recent evidence was limited." : "Kvůli omezeným aktuálním podkladům byl výzkum rozšířen na 180 dní.") : (en ? "Search horizon: last 90 days." : "Výzkum pokrývá posledních 90 dní.")}</p><ResearchItems data={data} section="developments" locale={locale} /></> : <p role="status">{research.loading ? (en ? "Collecting sources in the same company research session…" : "Zdroje se připravují v rámci stejného firemního výzkumu…") : (en ? "Current developments are unavailable." : "Aktuální události nejsou dostupné.")}</p>}
    </section>
    <section aria-labelledby="company-ai-title"><span className="research-eyebrow">Lens AI Research</span><h2 id="company-ai-title">{en ? "Opportunities, risks and what to watch" : "Možnosti růstu, rizika a co sledovat"}</h2>
      <p className="research-section-intro">{en ? "AI synthesizes public sources and verified Lens data. This is analytical context, not investment advice. Growth drivers are conditional possibilities, not predictions." : "AI syntetizuje veřejné zdroje a ověřená data Lens. Jde o analytický kontext, nikoli investiční doporučení. Možnosti růstu jsou podmíněné, nejde o předpovědi."}</p>
      {data ? <>{data.limited && <p className="research-freshness">{en ? "Evidence is incomplete; unsupported items have been omitted." : "Podklady nejsou úplné; nedoložené body se nezobrazují."}</p>}
        <div className="research-interpretation-grid">{([['growth', en ? 'Where could growth come from?' : 'Odkud by mohl přijít růst?'], ['risks', en ? 'What could go wrong?' : 'Co by mohlo růst ohrozit?'], ['watch', en ? 'What should I watch?' : 'Co dál sledovat?']] as const).map(([section, title]) => <section key={section}><h3>{title}</h3><ResearchItems data={data} section={section} locale={locale} /></section>)}</div>
        <details className="research-sources"><summary>{en ? "Sources and freshness" : "Zdroje a aktuálnost"}</summary><p>{en ? "Research updated" : "Výzkum aktualizován"}: {new Date(data.researchedAt).toLocaleString(locale)}. {en ? "Links come from web-search citations. Publication dates are not provided by the citation metadata." : "Odkazy pocházejí z citací webového vyhledávání. Citační metadata neobsahují datum publikace."}</p><ul>{data.sources.map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title} · {source.domain}</a></li>)}</ul></details>
      </> : <p>{en ? "No supported research is available yet; Lens does not generate substitute claims." : "Zdrojovaný výzkum zatím není dostupný; Lens nevytváří náhradní tvrzení."}</p>}
    </section>
  </div>;
}
