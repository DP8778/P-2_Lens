import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  icon?: ReactNode;
};

export function Button({ variant = "primary", icon, className = "", children, ...props }: Props) {
  const styles = {
    primary:
      "bg-[var(--color-bg-ink)] text-[var(--color-bg-surface)] border-transparent hover:opacity-90",
    secondary:
      "bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] border-[var(--color-border-default)] hover:border-[var(--color-border-strong)]",
    ghost: "bg-transparent text-[var(--color-text-secondary)] border-transparent hover:bg-black/5",
  };
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-[var(--radius-md)] border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
