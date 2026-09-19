import { notFound } from "next/navigation";
import { MarketPulse } from "@/components/markets/MarketPulse";
import { isLocale } from "@/i18n/getDictionary";

export default async function MarketsPage({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ theme?: string }> }) {
  const [{ lang }, { theme }] = await Promise.all([params, searchParams]);
  if (!isLocale(lang)) notFound();
  return (
    <div className="markets-page page-enter">
      <header><span>Market Pulse</span><h1>Markets</h1><p>Jednoduchý pohled na dnešní vývoj technologických témat.</p></header>
      <MarketPulse locale={lang} variant="full" initialThemeId={theme} />
    </div>
  );
}
