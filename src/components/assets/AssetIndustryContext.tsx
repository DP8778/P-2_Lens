"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { marketThemes } from "@/data/market-themes";
import type { IndustryView } from "@/lib/finance/industry-data";
import { buildCompanyIndustryContext } from "@/lib/finance/industry-context";
import { industryBackHref, type IndustryNavigation } from "@/lib/markets/industry-navigation";
import { getBrowserMarketDataCache } from "@/lib/market-data/cache/market-cache";
import { marketDataConfig } from "@/lib/market-data/config";
import { percent, points } from "@/components/charts/chart-formatters";

export function AssetIndustryContext({ assetId, locale, industry, navigation }: { assetId: string; locale: string; industry: IndustryView; navigation: IndustryNavigation }) {
  const en = locale === "en-US";
  const [result, setResult] = useState<{ value: ReturnType<typeof buildCompanyIndustryContext>; stale: boolean }>();
  useEffect(() => {
    let cancelled = false;
    const cache = getBrowserMarketDataCache();
    void Promise.all(industry.members.map(async (member) => ({ id: member.asset.id, record: await cache.getHistory(member.asset.id).catch(() => undefined) }))).then((records) => {
      if (cancelled) return;
      const histories = new Map(records.flatMap(({ id, record }) => record ? [[id, record.points] as const] : []));
      setResult({ value: buildCompanyIndustryContext(assetId, industry, histories, navigation), stale: records.some(({ record }) => record && Date.now() - Date.parse(record.updatedAt) > marketDataConfig.historyFreshMs) });
    });
    return () => { cancelled = true; };
  }, [assetId, industry, navigation]);
  const value = result?.value;
  const name = marketThemes.find((theme) => theme.id === navigation.industry)?.name ?? navigation.industry;
  return <aside className="asset-industry-context" aria-label={en ? "Industry context" : "Kontext odvětví"}>
    <header><Link href={industryBackHref(locale, navigation)}>← {en ? "Back to industry" : "Zpět na odvětví"}: {name}</Link><span>{navigation.period} · {navigation.weighting === "equal" ? "Equal-weight" : "Market-cap weighted"}</span></header>
    {!result ? <p role="status">{en ? "Reading saved industry context…" : "Načítám uložený kontext odvětví…"}</p> : value && <>
      <dl><div><dt>{en ? "Stock return" : "Výnos akcie"}</dt><dd>{value.changed || value.returnPct === undefined ? "—" : percent(value.returnPct, locale)}</dd></div><div><dt>{en ? "Index contribution" : "Příspěvek k indexu"}</dt><dd>{value.changed || value.contribution === undefined ? "—" : points(value.contribution, locale)}</dd></div><div><dt>{en ? "Lens industry return" : "Výnos odvětví Lens"}</dt><dd>{value.changed || value.industryReturn === undefined ? "—" : percent(value.industryReturn, locale)}</dd></div><div><dt>{en ? "Market-cap rank" : "Pořadí kapitalizace"}</dt><dd>#{value.rank} / {value.total}</dd></div></dl>
      <p className="industry-data-note">{value.changed ? (en ? "Membership changed; historical context unavailable." : "Členství se změnilo; původní kontext není dostupný.") : `${value.coverage}/${value.total} ${en ? "companies included" : "firem zahrnuto"}${value.partial ? (en ? " · partial index" : " · neúplný index") : ""}`}{result.stale && (en ? " · Saved history may be stale." : " · Uložená historie může být zastaralá.")}{!value.changed && value.industryReturn === undefined && (value.coverage ? (en ? " · Insufficient coverage for an industry return." : " · Nedostatečné pokrytí pro výnos odvětví.") : (en ? " · Industry history is not saved on this device." : " · Historie odvětví není v tomto zařízení uložená."))}</p>
      {!value.changed && !value.partial && !result.stale && value.driver && <p>{value.driver === "positive" ? (en ? "One of the three strongest positive contributors in this period." : "Jeden ze tří nejsilnějších kladných přispěvatelů v tomto období.") : (en ? "One of the three strongest negative contributors in this period." : "Jeden ze tří nejsilnějších záporných přispěvatelů v tomto období.")}</p>}
    </>}
  </aside>;
}
