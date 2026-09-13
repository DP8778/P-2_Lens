"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ContributionChart({
  data,
}: {
  data: { symbol: string; contributionPctPoints: number }[];
}) {
  return (
    <div className="h-48 p-4 pt-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: -20, right: 24 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="symbol"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
          />
          <Tooltip
            formatter={(v) =>
              `${Number(v).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} p. b.`
            }
          />
          <Bar dataKey="contributionPctPoints" radius={4}>
            {data.map((item) => (
              <Cell
                key={item.symbol}
                fill={
                  item.contributionPctPoints >= 0
                    ? "var(--color-data-positive)"
                    : "var(--color-data-negative)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="sr-only">
        Příspěvky k výkonu:{" "}
        {data.map((d) => `${d.symbol} ${d.contributionPctPoints} procentního bodu`).join(", ")}.
      </p>
    </div>
  );
}
