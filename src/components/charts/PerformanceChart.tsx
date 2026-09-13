"use client";

import {
  Area,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
} from "recharts";
import type { PortfolioPerformancePoint } from "@/types/finance";
import { formatCurrency, formatPercent } from "@/lib/formatting/formatters";
import { ChartTooltip } from "./ChartTooltip";

export function PerformanceChart({
  data,
  normalized,
  showBenchmark,
  locale = "cs-CZ",
}: {
  data: PortfolioPerformancePoint[];
  normalized: boolean;
  showBenchmark: boolean;
  locale?: string;
}) {
  if (!data.length) return null;
  const start = data[0];
  const end = data.at(-1)!;
  const change = end.portfolioReturnPct;
  return (
    <div className="px-2 pb-4">
      <p className="sr-only">
        Portfolio se za vybrané období změnilo o {formatPercent(change, locale)}. Počáteční hodnota
        byla {formatCurrency(start.portfolioValue, locale)}, konečná{" "}
        {formatCurrency(end.portfolioValue, locale)}.
      </p>
      <div className="h-[310px] w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 18, right: 18, bottom: 2, left: 0 }}>
            <defs>
              <linearGradient id="performanceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-data-accent)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="var(--color-data-accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="var(--color-border-default)"
              strokeDasharray="2 5"
            />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(value) =>
                new Date(value).toLocaleDateString(locale, { month: "short", day: "numeric" })
              }
              tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={55}
            />
            <YAxis
              tickFormatter={(value) =>
                normalized ? `${value.toFixed(0)} %` : `${Math.round(value / 1000)}k`
              }
              tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={45}
              domain={["auto", "auto"]}
            />
            <Tooltip content={<ChartTooltip normalized={normalized} locale={locale} />} />
            <Area
              type="monotone"
              dataKey={normalized ? "portfolioReturnPct" : "portfolioValue"}
              name="Portfolio"
              stroke="var(--color-data-accent)"
              strokeWidth={2.5}
              fill="url(#performanceFill)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
            />
            {normalized && showBenchmark && (
              <Line
                type="monotone"
                dataKey="benchmarkReturnPct"
                name="Benchmark"
                stroke="var(--color-text-muted)"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
