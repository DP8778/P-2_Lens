export function DrawdownChart({ value }: { value: number }) {
  return (
    <div className="p-5 pt-2">
      <div className="flex items-end justify-between">
        <span className="text-xs text-[var(--color-text-secondary)]">Maximum drawdown</span>
        <strong className="tabular text-xl negative">
          {value.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} %
        </strong>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--color-border-default)]">
        <div
          className="h-full rounded-full bg-[var(--color-data-negative)]"
          style={{ width: `${Math.min(100, Math.abs(value) * 5)}%` }}
        />
      </div>
      <p className="mt-3 text-xs leading-5 text-[var(--color-text-muted)]">
        Největší pokles od lokálního maxima ve zvoleném období.
      </p>
    </div>
  );
}
