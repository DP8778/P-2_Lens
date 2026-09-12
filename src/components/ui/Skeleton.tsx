export function Skeleton({ className = "h-5 w-full" }: { className?: string }) {
  return <div aria-hidden="true" className={`skeleton ${className}`} />;
}
