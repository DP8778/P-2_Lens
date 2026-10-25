import Link from "next/link";
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
      <section className="company-examples" aria-labelledby="examples-title"><h2 id="examples-title">{lang === "en-US" ? "Explore two business models" : "Dva příklady, dva obchodní modely"}</h2><p>{lang === "en-US" ? "Verified annual statements remain available without price or AI services. Examples are independent of index membership." : "Ověřené roční výkazy fungují i bez cen a AI. Výběr příkladů je nezávislý na členství v indexech."}</p><div><Link href={`/${lang}/assets/twelvedata%3AXNGS%3AAMD`}><strong>AMD</strong><span>{lang === "en-US" ? "Chips · three revenue segments" : "Čipy · tři výnosové segmenty"} ↗</span></Link><Link href={`/${lang}/assets/twelvedata%3AXNGM%3ATTD`}><strong>The Trade Desk</strong><span>{lang === "en-US" ? "Advertising platform · spend and revenue" : "Reklamní platforma · výdaje a tržby"} ↗</span></Link></div></section>
      <MarketPulse locale={lang} variant="full" industries={fundamentalsSource.getIndustries()} />
    </div>
  );
}
