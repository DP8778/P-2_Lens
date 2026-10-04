"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/i18n/getDictionary";
import { marketThemes } from "@/data/market-themes";
import type { IndustryView } from "@/lib/finance/industry-data";
import { dateLabel } from "@/components/charts/chart-formatters";
import { industryBackHref, readIndustryNavigation, type IndustryNavigation } from "@/lib/markets/industry-navigation";
import { ThemeDetail } from "./ThemeDetail";

export type IndustryDiscovery = { companies: number; updatedAt: string; version: string };
type Props = { locale: Locale; variant?: "compact" | "full"; industries?: Record<string, IndustryView>; discovery?: Record<string, IndustryDiscovery> };

/** Discovery uses snapshot metadata only: no quotes, history or compatibility-basket returns. */
export function MarketPulse({ locale, variant = "compact", industries, discovery }: Props) {
  const en = locale === "en-US";
  if (variant === "full") return <MarketsExplorer locale={locale} industries={industries} />;
  return <section className="market-pulse compact" aria-labelledby="market-pulse-title-compact">
    <header><div><span>{en ? "Lens universes" : "Univerza Lens"}</span><h2 id="market-pulse-title-compact">{en ? "Explore themes" : "Prozkoumat témata"}</h2></div><Link href={`/${locale}/markets`}>{en ? "Open Markets →" : "Otevřít Markets →"}</Link></header>
    <div className="market-theme-grid">{marketThemes.map(theme => {
      const snapshot = discovery?.[theme.id];
      return <Link className="market-theme-card" href={`/${locale}/markets?theme=${theme.id}`} key={theme.id}>
        <span>{theme.name}</span>
        <strong>{snapshot ? `${snapshot.companies} ${en ? "companies" : "firem"}` : en ? "Explore theme" : "Prozkoumat téma"}</strong>
        <small>{snapshot ? `${en ? "Snapshot" : "Data k"} ${dateLabel(snapshot.updatedAt.slice(0, 10), locale)}` : en ? "Lens universe" : "Univerzum Lens"}</small>
        <small>{en ? "Open theme →" : "Otevřít téma →"}</small>
      </Link>;
    })}</div>
  </section>;
}

function MarketsExplorer({ locale, industries }: Pick<Props, "locale" | "industries">) {
  const en = locale === "en-US";
  const search = useSearchParams();
  // Preserve duplicate parameters as arrays so the existing validator rejects them.
  const query = Object.fromEntries([...search.keys()].map(key => [key, search.getAll(key).length > 1 ? search.getAll(key) : search.get(key)!]));
  const requested = readIndustryNavigation({ ...query, industry: query.theme });
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const selectedTheme = marketThemes.find(theme => theme.id === requested?.industry) ?? marketThemes[0];
  const industry = industries?.[selectedTheme.id];
  const navigation: IndustryNavigation = { industry: selectedTheme.id, period: requested?.period ?? "1M", weighting: requested?.weighting ?? "equal", asOf: requested?.asOf ?? today, version: requested?.version ?? industry?.version };
  // One research visit occupies one history entry. Next's native History integration
  // updates useSearchParams without a server render, scroll reset or loader restart.
  const navigate = (next: IndustryNavigation) => window.history.replaceState(null, "", industryBackHref(locale, next));
  return <section className="market-pulse full" aria-labelledby="market-pulse-title-full">
    <header><div><span>{en ? "Lens universes" : "Univerza Lens"}</span><h2 id="market-pulse-title-full">{en ? "Technology themes" : "Technologická témata"}</h2></div></header>
    <div className="market-theme-grid">{marketThemes.map(theme => <button className="market-theme-card" aria-pressed={selectedTheme.id === theme.id} key={theme.id} onClick={() => navigate({ ...navigation, industry: theme.id, version: industries?.[theme.id]?.version })}>
      <span>{theme.name}<small className="industry-selector-count">{industries?.[theme.id] ? `${industries[theme.id].members.length} ${en ? "tracked companies" : "sledovaných firem"}` : en ? "Membership unavailable" : "Členství není dostupné"}</small></span>
      <small>{en ? "Lens universe →" : "Univerzum Lens →"}</small>
    </button>)}</div>
    {industry ? <ThemeDetail theme={selectedTheme} locale={locale} industry={industry} initialNavigation={navigation} onNavigationChange={navigate} /> : <p role="status">{en ? "Verified theme membership is unavailable." : "Ověřené členství tématu není dostupné."}</p>}
  </section>;
}
