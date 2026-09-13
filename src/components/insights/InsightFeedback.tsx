"use client";

import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { track } from "@/lib/analytics/events";

export function InsightFeedback() {
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const rate = (next: "up" | "down") => {
    setRating(next);
    track({
      name: next === "up" ? "ai_insight_feedback_positive" : "ai_insight_feedback_negative",
    });
  };
  return (
    <div className="flex items-center gap-2">
      <span className="mr-1 text-xs text-[var(--color-text-muted)]">Pomohlo vysvětlení?</span>
      <button
        aria-pressed={rating === "up"}
        onClick={() => rate("up")}
        className={`grid h-9 w-9 place-items-center rounded-lg border ${rating === "up" ? "border-[var(--color-data-positive)] bg-emerald-50 positive" : "border-[var(--color-border-default)]"}`}
        aria-label="Užitečné"
      >
        <ThumbsUp size={15} />
      </button>
      <button
        aria-pressed={rating === "down"}
        onClick={() => rate("down")}
        className={`grid h-9 w-9 place-items-center rounded-lg border ${rating === "down" ? "border-[var(--color-data-negative)] bg-red-50 negative" : "border-[var(--color-border-default)]"}`}
        aria-label="Není užitečné"
      >
        <ThumbsDown size={15} />
      </button>
    </div>
  );
}
