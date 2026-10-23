import { connection } from "next/server";
import { fundamentalsSource } from "@/lib/fundamentals/snapshot-source";
import { notFound } from "next/navigation";
import { MarketPulse } from "@/components/markets/MarketPulse";
import { isLocale } from "@/i18n/getDictionary";

export default async function MarketsPage({ params }: { params: Promise<{ lang: string }> }) {
  // Request-time rendering supplies the current URL to the client research view.
  await connection();
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <div className="markets-page page-enter">
      <header><span>{lang === "en-US" ? "Lens universes" : "Univerza Lens"}</span><h1>Markets</h1><p>{lang === "en-US" ? "Technology themes, tracked companies and their development over time." : "Technologická témata, sledované firmy a jejich vývoj v čase."}</p></header>
      <MarketPulse locale={lang} variant="full" industries={fundamentalsSource.getIndustries()} />
    </div>
  );
}
