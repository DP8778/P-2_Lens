import type { FundamentalsRecord } from "@/lib/finance/industry-data";
import type { CompanyProfile } from "@/data/company-profiles";
import { buildFinancialAnatomy } from "@/lib/finance/financial-anatomy";
import { allocation, percent } from "@/components/charts/chart-formatters";

export function CompanyPrimer({ assetId, locale, fundamentals, profile }: {
  assetId: string;
  locale: "cs-CZ" | "en-US";
  fundamentals?: FundamentalsRecord;
  profile?: CompanyProfile;
}) {
  const en = locale === "en-US";
  const anatomy = buildFinancialAnatomy(assetId, fundamentals?.statements);
  if (!profile && anatomy.status === "unavailable") return null;
  return <section className="company-primer" aria-labelledby="company-primer-title">
    <header><span>{en ? "Company overview" : "Přehled firmy"}</span><h2 id="company-primer-title">{en ? "What does the company do and how does it earn?" : "Co firma dělá a jak vydělává?"}</h2></header>
    {profile && <p className="company-primer-description">{profile.description[locale]} <a href={profile.sourceUrl} target="_blank" rel="noreferrer">{profile.sourceLabel}</a></p>}
    {anatomy.status === "available" && <dl className="company-primer-facts">
      {anatomy.primaryRevenueSource && <div><dt>{en ? "Largest reported revenue source" : "Největší vykázaný zdroj tržeb"}</dt><dd>{anatomy.primaryRevenueSource.name} · {allocation(anatomy.primaryRevenueSource.sharePct, locale)}</dd></div>}
      <div><dt>{en ? "Statement period" : "Období výkazu"}</dt><dd>{anatomy.latest.durationMonths} {en ? "months to" : "měsíců do"} {new Date(`${anatomy.latest.period}T12:00:00Z`).toLocaleDateString(locale)}</dd></div>
      {anatomy.revenueGrowth !== undefined && <div><dt>{en ? "Revenue growth · YoY" : "Růst tržeb · meziročně"}</dt><dd>{percent(anatomy.revenueGrowth, locale)}</dd></div>}
      <div><dt>{en ? "Operating margin" : "Provozní marže"}</dt><dd>{percent(anatomy.operatingMargin, locale)}</dd></div>
    </dl>}
    {anatomy.status === "available" && <p className="company-primer-source">{en ? "Financial figures" : "Finanční údaje"}: <a href={anatomy.latest.source} target="_blank" rel="noreferrer">{en ? "verified income statement" : "ověřený výkaz zisku a ztráty"}</a>.</p>}
  </section>;
}
