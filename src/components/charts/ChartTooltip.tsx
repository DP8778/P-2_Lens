import { formatCurrency, formatPercent } from "@/lib/formatting/formatters";

interface PayloadItem {
  dataKey?: string | number;
  value?: number;
  color?: string;
  name?: string;
}
export function ChartTooltip({
  active,
  payload,
  label,
  normalized = false,
  locale = "cs-CZ",
}: {
  active?: boolean;
  payload?: PayloadItem[];
  label?: string;
  normalized?: boolean;
  locale?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-3 text-xs shadow-[var(--shadow-md)]">
      <div className="mb-2 font-semibold text-[var(--color-text-muted)]">
        {label ? new Date(label).toLocaleDateString(locale) : ""}
      </div>
      {payload.map((item) => (
        <div key={String(item.dataKey)} className="mt-1 flex min-w-40 justify-between gap-5">
          <span>{item.name}</span>
          <strong className="tabular">
            {normalized
              ? formatPercent(Number(item.value), locale)
              : formatCurrency(Number(item.value), locale)}
          </strong>
        </div>
      ))}
    </div>
  );
}
