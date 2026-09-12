export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: readonly T[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex flex-wrap gap-1 rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-1"
    >
      {items.map((item) => (
        <button
          key={item}
          role="tab"
          aria-selected={value === item}
          onClick={() => onChange(item)}
          className={`min-h-8 rounded-md px-3 text-xs font-bold transition ${value === item ? "bg-[var(--color-bg-ink)] text-[var(--color-bg-surface)] shadow-sm" : "text-[var(--color-text-secondary)] hover:bg-black/5"}`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
