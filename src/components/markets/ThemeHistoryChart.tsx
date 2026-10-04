"use client";

import type { IndustryWeighting } from "@/lib/finance/industry-index";
import { Line, LineChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ThemeHistoryChart({ points, locale, comparison, weighting = "equal" }: { weighting?: IndustryWeighting; points: { date: string; value: number }[]; locale: string; comparison?: { date: string; value: number }[] }) {
  const equalLabel = "Equal-weight";
  const capLabel = locale === "en-US" ? "Market-cap weighted" : "Váženo kapitalizací";
  const selectedLabel = weighting === "equal" ? equalLabel : capLabel;
  return (
    <div className="theme-history-chart" aria-label={`${locale === "en-US" ? "Theme history, Index 100. Selected" : "Historický vývoj tématu, Index 100. Zvoleno"}: ${selectedLabel}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points.map((point, index) => ({ ...point, weighted: comparison?.[index]?.value }))} margin={{ top: 16, right: 12, bottom: 2, left: 0 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="#ffffff0b" />
          <XAxis dataKey="date" axisLine={false} tickLine={false} minTickGap={48} tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickFormatter={(value) => new Date(`${value}T12:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "short" })} />
          <YAxis orientation="right" domain={["auto", "auto"]} axisLine={false} tickLine={false} width={52} tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickFormatter={(value) => Number(value).toLocaleString(locale, { maximumFractionDigits: 1 })} />
          <ReferenceLine y={100} stroke="#ffffff35" strokeDasharray="4 4" />
          <Tooltip contentStyle={{ background: "#17191b", border: "1px solid #ffffff18", borderRadius: 8, fontSize: 12 }} labelFormatter={(value) => new Date(`${value}T12:00:00Z`).toLocaleDateString(locale)} formatter={(value, name) => [Number(value).toLocaleString(locale, { maximumFractionDigits: 2 }), name]} />
          <Line name={comparison ? equalLabel : selectedLabel} dataKey="value" type="linear" stroke="var(--color-text-primary)" strokeWidth={weighting === "equal" || !comparison ? 3 : 1.5} strokeDasharray={!comparison && weighting === "capitalization" ? "6 4" : undefined} fill="var(--color-text-primary)" fillOpacity={0.06} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          {comparison && <Line name={capLabel} dataKey="weighted" type="linear" stroke="#a5b8c5" strokeDasharray="6 4" strokeWidth={weighting === "capitalization" ? 3 : 1.5} dot={false} isAnimationActive={false} />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
