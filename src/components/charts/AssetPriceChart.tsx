"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MarketPricePoint } from "@/lib/market-data/types";

export function AssetPriceChart({
  data,
  currency,
  locale = "cs-CZ",
}: {
  data: MarketPricePoint[];
  currency: string;
  locale?: string;
}) {
  const price = (value: number) => `${value.toLocaleString(locale, { maximumFractionDigits: 2 })} ${currency}`;
  return (
    <div className="asset-price-chart" data-testid="asset-price-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 16, right: 14, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id="assetPriceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-text-primary)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--color-text-primary)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#ffffff0b" />
          <XAxis dataKey="date" axisLine={false} tickLine={false} minTickGap={42} tickFormatter={(value) => new Date(`${String(value)}T12:00:00`).toLocaleDateString(locale, { day: "numeric", month: "short" })} tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
          <YAxis orientation="right" domain={["auto", "auto"]} axisLine={false} tickLine={false} width={66} tickFormatter={(value) => Number(value).toLocaleString(locale, { maximumFractionDigits: 1 })} tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} />
          <Tooltip
            cursor={{ stroke: "#ffffff2c" }}
            contentStyle={{ background: "#17191b", border: "1px solid #ffffff18", borderRadius: 8, fontSize: 12 }}
            labelFormatter={(value) => new Date(`${String(value)}T12:00:00`).toLocaleDateString(locale)}
            formatter={(value) => [price(Number(value ?? 0)), "Cena"]}
          />
          <Area dataKey="close" type="monotone" stroke="var(--color-text-primary)" strokeWidth={2.25} fill="url(#assetPriceFill)" dot={false} activeDot={{ r: 4, fill: "var(--color-text-primary)", stroke: "#101112" }} />
        </AreaChart>
      </ResponsiveContainer>
      <p className="sr-only">Cenová řada začíná na {data[0] ? price(data[0].close) : "—"} a končí na {data.at(-1) ? price(data.at(-1)!.close) : "—"}.</p>
    </div>
  );
}
