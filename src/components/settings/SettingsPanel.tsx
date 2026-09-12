"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Moon, ShieldCheck, SlidersHorizontal, Sun } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import type { Locale } from "@/i18n/getDictionary";
import { track } from "@/lib/analytics/events";

export function SettingsPanel({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [privacy, setPrivacy] = useState(false);
  const [theme, setTheme] = useState("dark");
  const setAppearance = (value: string) => {
    setTheme(value);
    document.documentElement.dataset.theme = value === "dark" ? "dark" : "light";
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <div className="flex items-center gap-3">
          <SlidersHorizontal size={20} />
          <h2 className="section-title">Preference</h2>
        </div>
        <div className="mt-6 space-y-5">
          <label className="block text-xs font-bold">
            Jazyk rozhraní
            <Select
              className="mt-2 w-full"
              value={locale}
              onChange={(e) => {
                track({ name: "settings_locale_changed", locale: e.target.value });
                router.push(`/${e.target.value}/settings`);
              }}
            >
              <option value="cs-CZ">Čeština (Česko)</option>
              <option value="en-US">English (US)</option>
            </Select>
          </label>
          <label className="block text-xs font-bold">
            Měna ocenění portfolia
            <Select className="mt-2 w-full" defaultValue="CZK">
              <option>CZK</option>
            </Select>
          </label>
          <label className="block text-xs font-bold">
            Délka vysvětlení
            <Select className="mt-2 w-full" defaultValue="concise">
              <option value="concise">Stručné</option>
              <option value="detailed" disabled>
                Podrobné · připravujeme
              </option>
            </Select>
          </label>
        </div>
      </Card>
      <Card className="p-5">
        <h2 className="section-title">Vzhled</h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Vyberte pracovní prostředí podle okolního světla.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            aria-pressed={theme === "light"}
            onClick={() => setAppearance("light")}
            className={`min-h-28 rounded-xl border p-4 text-left ${theme === "light" ? "border-[var(--color-text-primary)]" : "border-[var(--color-border-default)]"}`}
          >
            <Sun className="mb-6" />
            <strong className="text-sm">Světlý</strong>
          </button>
          <button
            aria-pressed={theme === "dark"}
            onClick={() => setAppearance("dark")}
            className={`min-h-28 rounded-xl border bg-[#17211e] p-4 text-left text-white ${theme === "dark" ? "border-[#b9b2ef]" : "border-transparent"}`}
          >
            <Moon className="mb-6" />
            <strong className="text-sm">Tmavý</strong>
          </button>
        </div>
      </Card>
      <Card className="p-5 lg:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-3">
            <ShieldCheck className="positive" />
            <div>
              <h2 className="section-title">Soukromí a AI</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
                Do AI vrstvy se posílají pouze agregované, vypočítané metriky. Žádný e-mail,
                přístupové údaje, celé portfolio ani volné poznámky.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setPrivacy(true);
              track({ name: "privacy_disclosure_opened" });
            }}
          >
            Jak data proudí
          </Button>
        </div>
        <label className="mt-6 flex items-center justify-between gap-4 border-t border-[var(--color-border-default)] pt-5 text-sm">
          <span>
            <strong className="block">Anonymní produktová analytika</strong>
            <small className="text-[var(--color-text-muted)]">
              Pouze názvy událostí a bezpečné parametry
            </small>
          </span>
          <input type="checkbox" className="h-5 w-5" defaultChecked />
        </label>
      </Card>
      <Dialog open={privacy} onClose={() => setPrivacy(false)} title="Jak data proudí">
        <ol className="space-y-4 text-sm leading-6 text-[var(--color-text-secondary)]">
          <li>
            <strong className="text-[var(--color-text-primary)]">1. Výpočet:</strong> finanční
            vrstva vytvoří výnos, příspěvky, drawdown a expozice ze stejných demo cen jako graf.
          </li>
          <li>
            <strong className="text-[var(--color-text-primary)]">2. Redukce:</strong> server ověří
            pozice a vybraný kontext. Model dostane jen vypočítané souhrny bez osobních údajů.
          </li>
          <li>
            <strong className="text-[var(--color-text-primary)]">3. Vysvětlení:</strong> model smí
            čísla pouze vysvětlit a odkázat na zdrojovou metriku.
          </li>
          <li>
            <strong className="text-[var(--color-text-primary)]">4. Fallback:</strong> bez API klíče
            vytvoří stejný typ shrnutí deterministická funkce.
          </li>
        </ol>
      </Dialog>
    </div>
  );
}
