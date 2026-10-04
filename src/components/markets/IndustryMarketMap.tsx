"use client";

import Link from "next/link";
import { useState } from "react";
import { ResponsiveContainer, Treemap } from "recharts";
import { industryMapData, type IndustryOverview } from "@/lib/finance/industry-overview";
import { industryAssetHref, type IndustryNavigation } from "@/lib/markets/industry-navigation";
import { percent } from "@/components/charts/chart-formatters";

export function IndustryMarketMap({ overview, timeframe, locale, navigation }: { overview: IndustryOverview; timeframe: string; locale: string; navigation?: IndustryNavigation }) {
  const en = locale === "en-US";
  const map = industryMapData(overview);
  const [active, setActive] = useState<string>();
  const selected = map.data.find((item) => item.row.asset.id === active) ?? map.data[0];
  const description = (item: typeof map.data[number]) => `${item.row.asset.name} (${item.name}) · ${new Intl.NumberFormat(locale, { style: "currency", currency: "USD", notation: "compact" }).format(item.value)} · ${item.row.returnPct === undefined ? (en ? "Return unavailable" : "Výnos nedostupný") : percent(item.row.returnPct, locale)} · ${item.sharePct.toLocaleString(locale, { maximumFractionDigits: 1 })} % ${en ? "of known capitalization" : "známé kapitalizace"}`;
  return <section className="industry-market-map" aria-label={en ? "Universe market map" : "Mapa univerza"}>
    <header><h4>{en ? "Universe market map" : "Mapa univerza"} · {timeframe}</h4><span>{map.data.length}/{overview.total} {en ? "known market caps" : "známých kapitalizací"}</span></header>
    <p className="industry-data-note">{en ? "Area = market capitalization. Labels show signed period returns; missing history is not zero." : "Plocha = tržní kapitalizace. Popisky uvádějí výnos období se znaménkem; chybějící historie není nula."} {map.missing > 0 && `${map.missing} ${en ? "companies without capitalization omitted; available in the table." : "firem bez kapitalizace vynecháno; najdete je v tabulce."}`}</p>
    {map.data.length ? <><div className="industry-treemap">
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 800, height: 360 }}>
        <Treemap data={map.data} dataKey="value" nameKey="name" isAnimationActive={false} content={(node) => {
          const item = map.data.find((entry) => entry.name === node.name);
          if (!item || node.depth !== 1) return <g />;
          const value = item.row.returnPct;
          const fill = value === undefined ? "#292d31" : value < -15 ? "#573b3c" : value < -5 ? "#443334" : value < 0 ? "#383030" : value > 15 ? "#365248" : value > 5 ? "#30453f" : value > 0 ? "#2d3835" : "#34393e";
          return <Link href={industryAssetHref(locale, item.row.asset.id, navigation)} aria-label={description(item)} onFocus={() => setActive(item.row.asset.id)} onMouseEnter={() => setActive(item.row.asset.id)} className="industry-treemap-link">
            <title>{description(item)}</title><rect x={node.x} y={node.y} width={node.width} height={node.height} fill={fill} stroke="#141719" strokeWidth={2} />
            {node.width > 38 && node.height > 22 && <text x={node.x + node.width / 2} y={node.y + node.height / 2 - (node.height > 44 ? 4 : -4)} textAnchor="middle" fill="#e7e9eb" fontSize={node.width > 90 ? 14 : 11}>{item.name}</text>}
            {node.width > 58 && node.height > 44 && <text x={node.x + node.width / 2} y={node.y + node.height / 2 + 14} textAnchor="middle" fill="#bcc4c8" fontSize={11}>{value === undefined ? "—" : percent(value, locale)}</text>}
          </Link>;
        }} />
      </ResponsiveContainer>
    </div><p className="industry-map-caption" aria-live="polite">{selected && description(selected)}</p></> : <p role="status">{en ? "Market capitalization unavailable." : "Kapitalizace není dostupná."}</p>}
  </section>;
}
