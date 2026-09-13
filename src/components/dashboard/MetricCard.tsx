import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/Card";

export function MetricCard({
  label,
  value,
  detail,
  trend = "neutral",
  featured = false,
}: {
  label: string;
  value: string;
  detail?: string;
  trend?: "positive" | "negative" | "neutral";
  featured?: boolean;
}) {
  const Icon = trend === "positive" ? ArrowUpRight : trend === "negative" ? ArrowDownRight : null;
  return (
    <Card
      className={`min-h-32 p-4 ${featured ? "bg-[var(--color-bg-ink)] text-[var(--color-bg-surface)]" : ""}`}
    >
      <div
        className={`text-xs font-semibold ${featured ? "text-white/60" : "text-[var(--color-text-muted)]"}`}
      >
        {label}
      </div>
      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <div className="tabular text-2xl font-semibold tracking-[-.04em]">{value}</div>
          {detail && (
            <div
              className={`mt-1 text-xs ${featured ? "text-white/55" : "text-[var(--color-text-muted)]"}`}
            >
              {detail}
            </div>
          )}
        </div>
        {Icon && (
          <Icon
            className={featured ? "text-[#77d6ab]" : trend}
            aria-label={trend === "positive" ? "Kladná změna" : "Záporná změna"}
          />
        )}
      </div>
    </Card>
  );
}
