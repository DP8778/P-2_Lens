import Link from "next/link";
import { Button } from "@/components/ui/Button";
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-6 text-center">
      <div>
        <div className="eyebrow">404 · mimo záběr</div>
        <h1 className="mt-3 font-serif text-5xl">Tady nic nevidíme.</h1>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          Aktivum nebo stránka v demo datech neexistuje.
        </p>
        <Link href="/cs-CZ/dashboard">
          <Button className="mt-6">Zpět na přehled</Button>
        </Link>
      </div>
    </main>
  );
}
