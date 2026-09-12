"use client";

import { useState } from "react";
import { Clock3, ThumbsDown, ThumbsUp } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

const history = [
  {
    id: 1,
    date: "7. 9. 2026 · 12:04",
    period: "1M",
    benchmark: "Demo benchmark",
    title: "Portfolio za 1M vzrostlo o 6,5 %",
    summary:
      "Bitcoin a NVIDIA vytvořily většinu kladného příspěvku, zatímco Apple a Novo Nordisk výsledek mírně tlumily.",
    rating: "up",
  },
  {
    id: 2,
    date: "2. 9. 2026 · 09:18",
    period: "1Y",
    benchmark: "S&P 500 mock",
    title: "Roční výkon táhla koncentrace v růstových aktivech",
    summary:
      "Portfolio překonalo benchmark, ale největší pozice současně zvýšily citlivost na několik málo titulů.",
    rating: null,
  },
  {
    id: 3,
    date: "18. 8. 2026 · 17:42",
    period: "3M",
    benchmark: "Demo benchmark",
    title: "Růst pokračoval navzdory hlubšímu poklesu",
    summary:
      "Výsledek zůstal kladný, maximální drawdown však ukázal vyšší kolísání v průběhu období.",
    rating: "down",
  },
];
export function InsightHistory() {
  const [ratings, setRatings] = useState<Record<number, string | null>>(
    Object.fromEntries(history.map((item) => [item.id, item.rating])),
  );
  return (
    <div className="space-y-3">
      {history.map((item) => (
        <Card key={item.id} className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge tone="ai">{item.period}</Badge>
              <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                <Clock3 size={13} />
                {item.date}
              </span>
            </div>
            <span className="text-xs text-[var(--color-text-muted)]">{item.benchmark}</span>
          </div>
          <h2 className="mt-5 text-xl font-semibold tracking-[-.025em]">{item.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
            {item.summary}
          </p>
          <div className="mt-5 flex items-center gap-2 border-t border-[var(--color-border-default)] pt-4">
            <span className="mr-2 text-xs text-[var(--color-text-muted)]">Hodnocení</span>
            <button
              aria-label="Užitečné"
              aria-pressed={ratings[item.id] === "up"}
              onClick={() => setRatings((r) => ({ ...r, [item.id]: "up" }))}
              className={`grid h-9 w-9 place-items-center rounded-lg border ${ratings[item.id] === "up" ? "positive border-emerald-700" : "border-[var(--color-border-default)]"}`}
            >
              <ThumbsUp size={14} />
            </button>
            <button
              aria-label="Není užitečné"
              aria-pressed={ratings[item.id] === "down"}
              onClick={() => setRatings((r) => ({ ...r, [item.id]: "down" }))}
              className={`grid h-9 w-9 place-items-center rounded-lg border ${ratings[item.id] === "down" ? "negative border-red-700" : "border-[var(--color-border-default)]"}`}
            >
              <ThumbsDown size={14} />
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}
