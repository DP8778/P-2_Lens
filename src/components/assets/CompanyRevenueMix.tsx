"use client";

import { useState } from "react";
import type { CompanyProfile } from "@/data/company-profiles";
import type { RevenueBreakdownPeriod } from "@/lib/finance/revenue-breakdown";

export function CompanyRevenueMix({ periods, profile, locale, companyLabel }: {
  periods: RevenueBreakdownPeriod[];
  profile?: CompanyProfile;
  locale: "cs-CZ" | "en-US";
  companyLabel: string;
}) {
  const en = locale === "en-US";
  const [selectedPeriod, setSelectedPeriod] = useState(periods[0].period);
  const period = periods.find((candidate) => candidate.period === selectedPeriod) ?? periods[0];
  const amount = (value: number) => new Intl.NumberFormat(locale, {
    style: "currency", currency: period.currency, notation: "compact", maximumFractionDigits: 2,
  }).format(value);
  const percentage = (value: number, signed = false) => new Intl.NumberFormat(locale, {
    style: "percent", maximumFractionDigits: 1, ...(signed ? { signDisplay: "exceptZero" as const } : {}),
  }).format(value / 100);
  const summary = period.segments.map((segment) =>
    `${segment.name}: ${amount(segment.revenue)}, ${percentage(segment.sharePct)}`).join("; ");
  return <section className="company-revenue-mix" aria-labelledby="company-revenue-mix-title">
    <div className="revenue-mix-heading">
      <header><span>{en ? "Reported segments" : "Vykázané segmenty"}</span><h2 id="company-revenue-mix-title">{en ? `How ${companyLabel} makes money` : `Čím ${companyLabel} vydělává`}</h2></header>
      <div className="revenue-period-switcher" role="group" aria-label={en ? "Fiscal year" : "Fiskální rok"}>
        {periods.map((candidate) => <button key={candidate.period} type="button" aria-pressed={candidate.period === period.period} onClick={() => setSelectedPeriod(candidate.period)}>FY{candidate.fiscalYear}</button>)}
      </div>
    </div>
    {profile && <p className="company-revenue-description">{profile.description[locale]} <a href={profile.sourceUrl} target="_blank" rel="noreferrer">{profile.sourceLabel}</a></p>}
    <p className="revenue-period-label"><strong>FY{period.fiscalYear}</strong> · {period.durationMonths} {en ? "months ended" : "měsíců do"} <time dateTime={period.period}>{new Date(`${period.period}T12:00:00Z`).toLocaleDateString(locale)}</time> · {period.currency}</p>
    <figure className="revenue-mix-figure" aria-labelledby="company-revenue-mix-title">
      <ul>{period.segments.map((segment) => <li key={segment.name}>
        <div className="revenue-segment-label"><strong>{segment.name}</strong><span>{amount(segment.revenue)} · {percentage(segment.sharePct)}</span></div>
        <div className="revenue-segment-track" aria-hidden="true"><span style={{ width: `${segment.sharePct}%` }} /></div>
        <p>{segment.changePct === undefined
          ? (en ? "Comparison base for FY2025" : "Srovnávací základ pro FY2025")
          : `${en ? "Year on year" : "Meziročně"} ${percentage(segment.changePct, true)}`}</p>
      </li>)}</ul>
      <figcaption><strong>{en ? `Text summary for FY${period.fiscalYear}:` : `Textový přehled pro FY${period.fiscalYear}:`}</strong> {summary}.</figcaption>
    </figure>
    <div className="revenue-mix-notes">
      <p>{en ? "Data Center includes server CPUs, GPU and AI accelerators, networking and other data-center products. The reported figure is not AI revenue." : "Data Center zahrnuje serverové CPU, GPU a AI akcelerátory, síťové prvky i další produkty pro datová centra. Vykázaný údaj proto není tržbou z AI."}</p>
      {period.segmentBasis === "retrospectively-adjusted" && <p>{en ? "FY2024 is shown in the segment structure retrospectively adjusted by AMD after Client and Gaming were combined in FY2025." : "FY2024 je zobrazen ve struktuře, kterou AMD retrospektivně upravilo po spojení segmentů Client a Gaming od FY2025."}</p>}
      <p>{en ? "Amounts were normalized from a USD millions table to USD units." : "Částky jsou z tabulky v milionech USD převedeny na jednotky USD."} <a href={period.source} target="_blank" rel="noreferrer">{companyLabel} · {en ? "primary statement" : "primární výkaz"}</a></p>
    </div>
  </section>;
}
