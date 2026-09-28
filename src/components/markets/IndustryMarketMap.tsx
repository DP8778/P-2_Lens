import Link from "next/link";
import type { IndustryOverview } from "@/lib/finance/industry-overview";
import { percent } from "@/components/charts/chart-formatters";

export function IndustryMarketMap({ overview, timeframe, locale }: { overview: IndustryOverview; timeframe: string; locale: string }) {
  const en = locale === "en-US";
  const rows = [...overview.rows].sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
  return <section className="industry-market-map" aria-label={en ? "Industry market map" : "Mapa odvětví"}>
    <header><h4>{en ? "Market map" : "Mapa odvětví"} · {timeframe}</h4><span>{overview.measured}/{overview.total} {en ? "returns available" : "dostupných výnosů"}</span></header>
    <p className="industry-data-note">{en ? "Equal-sized company tiles, ordered by market cap. Missing history is shown as a dash." : "Stejně velké dlaždice firem, seřazené podle kapitalizace. Chybějící historie je označená pomlčkou."}</p>
    <div className="industry-map-tiles">{rows.map((row) => <Link key={row.asset.id} href={`/${locale}/assets/${encodeURIComponent(row.asset.id)}`} className={row.returnPct === undefined ? "unavailable" : row.returnPct < 0 ? "falling" : "rising"} title={row.asset.name}>
      <strong>{row.asset.symbol}</strong><span>{row.returnPct === undefined ? "—" : percent(row.returnPct, locale)}</span><small>{row.returnPct === undefined ? (en ? "No history" : "Bez historie") : row.returnPct < 0 ? (en ? "Falling" : "Klesá") : row.returnPct > 0 ? (en ? "Rising" : "Roste") : (en ? "Unchanged" : "Beze změny")}</small>
    </Link>)}</div>
  </section>;
}
