"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, LockKeyhole } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Locale } from "@/i18n/getDictionary";
import { track } from "@/lib/analytics/events";

export function LoginForm({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const openDemo = () => {
    setLoading(true);
    track({ name: "auth_login_submitted" });
    setTimeout(() => {
      track({ name: "auth_login_succeeded" });
      router.push(`/${locale}/dashboard`);
    }, 550);
  };
  return (
    <main className="grid min-h-screen bg-[var(--color-bg-surface)] lg:grid-cols-[1.12fr_.88fr]">
      <section className="relative hidden overflow-hidden bg-[#0b0c10] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-20 top-20 h-[420px] w-[420px] rounded-full border border-white/10" />
        <div className="absolute -right-5 top-36 h-[290px] w-[290px] rounded-full border border-white/10" />
        <div
          className="absolute bottom-0 left-0 h-72 w-full opacity-20"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px)",
            backgroundSize: "36px 36px",
          }}
        />
        <Logo inverse />
        <div className="relative max-w-xl">
          <Badge tone="ai">Portfolio intelligence</Badge>
          <h1 className="mt-6 font-serif text-6xl leading-[1.02] tracking-[-.055em]">
            Data jsou dostupná.
            <br />
            <span className="text-[#b9b2ef]">Porozumění je těžší.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-white/60">
            Lens ukazuje nejen výsledek, ale i jeho hlavní příčiny — s dohledatelnými metrikami u
            každého vysvětlení.
          </p>
        </div>
        <div className="relative flex gap-8 text-xs text-white/45">
          <span>Deterministické výpočty</span>
          <span>AI s důkazy</span>
          <span>Bez živých dat</span>
        </div>
      </section>
      <section className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="mt-12 lg:mt-0">
            <div className="flex items-center gap-2">
              <Badge>DEMO ACCESS</Badge>
              <span className="text-xs text-[var(--color-text-muted)]">Žádná reálná data</span>
            </div>
            <h2 className="mt-5 font-serif text-4xl tracking-[-.04em]">Vstupte do Lens</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
              Prozkoumejte fiktivní portfolio a celý insight flow.
            </p>
          </div>
          <form
            className="mt-9 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              if (!String(form.get("email")).includes("@")) {
                setError("Zadejte platnou e-mailovou adresu.");
                return;
              }
              openDemo();
            }}
          >
            <label className="block text-xs font-bold">
              E-mail
              <Input
                name="email"
                type="email"
                placeholder="demo@p2lens.app"
                className="mt-2"
                defaultValue="demo@p2lens.app"
              />
            </label>
            <label className="block text-xs font-bold">
              Heslo
              <div className="relative mt-2">
                <Input name="password" type="password" defaultValue="demoportfolio" />
                <Eye
                  size={16}
                  className="pointer-events-none absolute right-3 top-3.5 text-[var(--color-text-muted)]"
                />
              </div>
            </label>
            {error && (
              <p role="alert" className="text-sm text-[var(--color-data-negative)]">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Otevírám demo…" : "Přihlásit do dema"}
            </Button>
          </form>
          <div className="my-6 flex items-center gap-3 text-[.65rem] font-bold uppercase tracking-widest text-[var(--color-text-muted)]">
            <i className="h-px flex-1 bg-[var(--color-border-default)]" />
            nebo
            <i className="h-px flex-1 bg-[var(--color-border-default)]" />
          </div>
          <Button variant="secondary" className="w-full" onClick={openDemo} disabled={loading}>
            Otevřít demo portfolio <ArrowRight size={16} />
          </Button>
          <p className="mt-7 flex items-start gap-2 text-xs leading-5 text-[var(--color-text-muted)]">
            <LockKeyhole size={15} className="mt-0.5 shrink-0" />
            Toto je prezentační prototyp. Přihlášení je pouze simulované a nic se neukládá.
          </p>
        </div>
      </section>
    </main>
  );
}
