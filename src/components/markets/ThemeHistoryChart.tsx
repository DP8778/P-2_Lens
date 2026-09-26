"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ThemeHistoryChart({ points, locale }: { points: { date: string; value: number }[]; locale: string }) {
  return (
    <div className="theme-history-chart" aria-label="Historický vývoj tématu, Index 100">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 16, right: 12, bottom: 2, left: 0 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="#ffffff0b" />
          <XAxis dataKey="date" axisLine={false} tickLine={false} minTickGap={48} tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickFormatter={(value) => new Date(`${value}T12:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "short" })} />
          <YAxis orientation="right" domain={["auto", "auto"]} axisLine={false} tickLine={false} width={52} tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} tickFormatter={(value) => Number(value).toLocaleString(locale, { maximumFractionDigits: 1 })} />
          <ReferenceLine y={100} stroke="#ffffff35" strokeDasharray="4 4" />
          <Tooltip contentStyle={{ background: "#17191b", border: "1px solid #ffffff18", borderRadius: 8, fontSize: 12 }} labelFormatter={(value) => new Date(`${value}T12:00:00Z`).toLocaleDateString(locale)} formatter={(value) => [Number(value).toLocaleString(locale, { maximumFractionDigits: 2 }), "Index 100"]} />
          <Area dataKey="value" type="linear" stroke="var(--color-text-primary)" strokeWidth={2.25} fill="var(--color-text-primary)" fillOpacity={0.06} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
