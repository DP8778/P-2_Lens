import { AlertCircle, BrainCircuit, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import type { InsightOutput } from "@/lib/validation/insightSchemas";
import { InsightEvidence } from "./InsightEvidence";
import { InsightFeedback } from "./InsightFeedback";

export type InsightState = "default" | "generating" | "success" | "demo" | "rate_limited" | "error";
export function InsightCard({
  state = "default",
  insight,
  onRequest,
}: {
  state?: InsightState;
  insight?: InsightOutput;
  onRequest?: () => void;
}) {
  return (
    <Card className="relative overflow-hidden border-violet-900/10 bg-[var(--color-ai-surface)]">
      <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-white/30 blur-2xl" />
      <div className="relative p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--color-ai-ink)] text-white">
              <Sparkles size={18} aria-hidden />
            </span>
            <div>
              <div className="eyebrow text-[var(--color-ai-ink)]">Explanatory layer</div>
              <h2 className="section-title">Lens Insight</h2>
            </div>
          </div>
          {state !== "default" && (
            <Badge
              tone={
                state === "success"
                  ? "ai"
                  : state === "demo"
                    ? "neutral"
                    : state === "rate_limited"
                      ? "warning"
                      : state === "error"
                        ? "negative"
                        : "ai"
              }
            >
              {state === "generating"
                ? "Zpracovávám"
                : state === "success"
                  ? "AI-generated"
                  : state === "demo"
                    ? "Demo insight"
                    : state === "rate_limited"
                      ? "AI vytížené"
                      : "Nedostupné"}
            </Badge>
          )}
        </div>
        {state === "default" && (
          <div className="mt-8 grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <h3 className="max-w-xl text-xl font-semibold tracking-[-.025em]">
                Čísla už máte. Teď zjistěte, co je spojilo.
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--color-text-secondary)]">
                Lens použije pouze vypočítané metriky tohoto období a ukáže důkazy ke každému
                tvrzení.
              </p>
            </div>
            <Button onClick={onRequest} icon={<BrainCircuit size={17} />}>
              Vysvětlit toto období
            </Button>
          </div>
        )}
        {state === "generating" && (
          <div className="mt-7" role="status" aria-live="polite">
            <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
              Propojuji výsledek s jeho hlavními vlivy…
            </p>
            <div className="space-y-3">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="mt-5 h-16 w-full" />
            </div>
          </div>
        )}
        {(state === "error" || state === "rate_limited") && !insight && (
          <div className="mt-7 flex gap-3 rounded-lg bg-white/60 p-4">
            <AlertCircle className="shrink-0 text-[var(--color-data-negative)]" />
            <div>
              <strong>
                {state === "rate_limited"
                  ? "AI vysvětlení je momentálně vytížené"
                  : "Vysvětlení se nepodařilo vytvořit"}
              </strong>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Základní deterministická analýza zůstává dostupná.
              </p>
              <Button variant="secondary" className="mt-3" onClick={onRequest}>
                Zkusit znovu
              </Button>
            </div>
          </div>
        )}
        {insight && state !== "generating" && (
          <div className="mt-7">
            <h3 className="max-w-2xl text-xl font-semibold tracking-[-.025em]">
              {insight.headline}
            </h3>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)]">
              {insight.summary}
            </p>
            {state === "rate_limited" && (
              <p className="mt-4 flex gap-2 rounded-lg bg-orange-100/70 p-3 text-sm text-orange-900">
                <AlertCircle size={18} className="shrink-0" />
                AI je momentálně vytížené. Zobrazuji programově sestavenou základní analýzu.
              </p>
            )}
            {state === "error" && (
              <p className="mt-4 flex gap-2 rounded-lg bg-red-50/80 p-3 text-sm text-red-900">
                <AlertCircle size={18} className="shrink-0" />
                AI vysvětlení není dostupné. Zobrazuji programově sestavenou základní analýzu.
              </p>
            )}
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {insight.drivers.map((item) => (
                <InsightEvidence key={item.metricReference} {...item} />
              ))}
              {insight.watchouts.map((item) => (
                <InsightEvidence key={item.metricReference} {...item} />
              ))}
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-violet-900/10 pt-4">
              <div>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {insight.dataQualityNote}
                </p>
                <p className="mt-1 text-[.68rem] text-[var(--color-text-muted)]">
                  {insight.disclaimer}
                </p>
              </div>
              <InsightFeedback />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
