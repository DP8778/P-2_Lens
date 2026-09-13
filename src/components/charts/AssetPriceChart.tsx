"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PricePoint } from "@/types/finance";

export function AssetPriceChart({
  data,
  locale = "cs-CZ",
}: {
  data: PricePoint[];
  locale?: string;
}) {
  return (
    <div className="h-[280px] p-3">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="assetFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-warm)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--color-warm)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="timestamp"
            tickFormatter={(v) =>
              new Date(String(v)).toLocaleDateString(locale, { month: "short" })
            }
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
          />
          <YAxis
            domain={["auto", "auto"]}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "var(--color-text-muted)" }}
            width={54}
          />
          <Tooltip
            labelFormatter={(v) => new Date(String(v)).toLocaleDateString(locale)}
            formatter={(v) => [`$${Number(v ?? 0).toLocaleString(locale)}`, "Cena"]}
          />
          <Area
            dataKey="value"
            stroke="var(--color-warm)"
            strokeWidth={2.5}
            fill="url(#assetFill)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <p className="sr-only">
        Cenová řada začíná na {data[0]?.value} USD a končí na {data.at(-1)?.value} USD.
      </p>
    </div>
  );
}
