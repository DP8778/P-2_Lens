import type { ReactNode } from "react";

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--color-bg-ink)] px-2.5 py-1.5 text-xs text-[var(--color-bg-surface)] shadow-md group-hover:block group-focus-within:block"
      >
        {label}
      </span>
    </span>
  );
}
