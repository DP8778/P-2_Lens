"use client";

import { ChevronDown, Database } from "lucide-react";
import { track } from "@/lib/analytics/events";

export function InsightEvidence({
  title,
  explanation,
  metricReference,
}: {
  title: string;
  explanation: string;
  metricReference: string;
}) {
  return (
    <details
      className="group rounded-[var(--radius-md)] border border-violet-900/10 bg-white/50 p-3"
      onToggle={(event) => {
        if (event.currentTarget.open)
          track({ name: "ai_insight_evidence_opened", reference: metricReference });
      }}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold">
        <span>{title}</span>
        <ChevronDown size={16} className="transition group-open:rotate-180" aria-hidden />
      </summary>
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{explanation}</p>
      <div className="mt-3 flex items-center gap-2 rounded-md bg-[var(--color-bg-elevated)] px-3 py-2 font-mono text-[.7rem] text-[var(--color-text-secondary)]">
        <Database size={13} aria-hidden />
        Zdrojová metrika: {metricReference}
      </div>
    </details>
  );
}
