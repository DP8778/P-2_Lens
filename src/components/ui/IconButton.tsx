import type { ButtonHTMLAttributes, ReactNode } from "react";

export function IconButton({
  label,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      aria-label={label}
      className={`inline-grid min-h-10 min-w-10 place-items-center rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] transition hover:border-[var(--color-border-strong)] ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
