import type { ReactNode } from "react";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "negative" | "ai" | "warning";
}) {
  const tones = {
    neutral:
      "border-[var(--color-border-default)] text-[var(--color-text-secondary)] bg-[var(--color-bg-elevated)]",
    positive: "border-emerald-700/20 text-[var(--color-data-positive)] bg-emerald-700/8",
    negative: "border-red-700/20 text-[var(--color-data-negative)] bg-red-700/8",
    ai: "border-violet-700/15 text-[var(--color-ai-ink)] bg-[var(--color-ai-surface)]",
    warning: "border-orange-700/20 text-orange-800 bg-orange-100/70",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[.65rem] font-bold uppercase tracking-[.09em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
