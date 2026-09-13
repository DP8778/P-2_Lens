import Link from "next/link";
export function Logo({ href = "/cs-CZ/dashboard" }: { href?: string; inverse?: boolean }) {
  return (
    <Link href={href} className="lens-logo" aria-label="Lens">
      <span className="lens-logo-mark" aria-hidden />
      Lens
    </Link>
  );
}
