export function ChartLegend({ benchmark = true }: { benchmark?: boolean }) {
  return (
    <div className="flex items-center gap-4 text-xs text-[var(--color-text-secondary)]">
      <span className="flex items-center gap-1.5">
        <i className="h-0.5 w-4 bg-[var(--color-data-accent)]" />
        Portfolio
      </span>
      {benchmark && (
        <span className="flex items-center gap-1.5">
          <i className="h-0.5 w-4 border-t border-dashed border-[var(--color-text-muted)]" />
          Benchmark
        </span>
      )}
    </div>
  );
}
