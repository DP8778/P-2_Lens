"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const colors = ["#4e62d7", "#df7049", "#087f5b", "#9e78c7", "#c69b32", "#a8aca7"];
export function AllocationChart({
  data,
}: {
  data: { name: string; symbol: string; value: number }[];
}) {
  return (
    <div className="grid grid-cols-[150px_1fr] items-center gap-3 p-5 pt-1">
      <div className="h-[150px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="symbol"
              innerRadius={48}
              outerRadius={68}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((item, index) => (
                <Cell key={item.symbol} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) =>
                `${Number(value).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} %`
              }
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2">
        {data.slice(0, 5).map((item, index) => (
          <div key={item.symbol} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex items-center gap-2">
              <span
                className="block h-2 w-2 shrink-0 rounded-full"
                style={{ background: colors[index] }}
              />
              {item.symbol}
            </span>
            <strong className="tabular">{item.value.toLocaleString("cs-CZ")} %</strong>
          </div>
        ))}
      </div>
      <p className="sr-only">
        Největší pozice je {data[0]?.name} s podílem {data[0]?.value} procent.
      </p>
    </div>
  );
}
