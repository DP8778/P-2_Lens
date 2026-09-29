import { readIndustryNavigation, type IndustrySearchParams } from "@/lib/markets/industry-navigation";
import { fundamentalsSource } from "@/lib/fundamentals/snapshot-source";
import { notFound } from "next/navigation";
import { MarketPulse } from "@/components/markets/MarketPulse";
import { isLocale } from "@/i18n/getDictionary";

export default async function MarketsPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<IndustrySearchParams> }) {
  const [{ lang }, query] = await Promise.all([params, searchParams]);
  const theme = typeof query.theme === "string" ? query.theme : undefined;
  const navigation = readIndustryNavigation({ ...query, industry: theme });
  if (!isLocale(lang)) notFound();
  return (
    <div className="markets-page page-enter">
      <header><span>Market Pulse</span><h1>Markets</h1><p>Technologická odvětví, sledované firmy a jejich vývoj v čase.</p></header>
      <MarketPulse initialNavigation={navigation} locale={lang} variant="full" initialThemeId={theme} industries={fundamentalsSource.getIndustries()} />
    </div>
  );
}
