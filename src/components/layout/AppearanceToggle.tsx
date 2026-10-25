"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { appearanceStorageKey, type Appearance } from "@/lib/appearance";

const changeEvent = "lens:appearance";
const snapshot = (): Appearance => document.documentElement.dataset.theme === "dark" ? "dark" : "light";
const serverSnapshot = (): Appearance => "light";

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== appearanceStorageKey && event.key !== null) return;
    document.documentElement.dataset.theme = event.newValue === "dark" ? "dark" : "light";
    onChange();
  };
  window.addEventListener(changeEvent, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(changeEvent, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAppearance() {
  const theme = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const setAppearance = (value: Appearance) => {
    document.documentElement.dataset.theme = value;
    try { localStorage.setItem(appearanceStorageKey, value); } catch { /* The current session still works without storage. */ }
    window.dispatchEvent(new Event(changeEvent));
  };
  return { theme, setAppearance };
}

export function AppearanceToggle({ locale }: { locale: string }) {
  const { theme, setAppearance } = useAppearance();
  const en = locale === "en-US";
  return <div className="appearance-toggle" role="group" aria-label={en ? "Appearance" : "Vzhled"}>
    <button type="button" aria-label={en ? "Light theme" : "Světlý motiv"} title={en ? "Light theme" : "Světlý motiv"} aria-pressed={theme === "light"} onClick={() => setAppearance("light")}><Sun size={16} /><span>{en ? "Light" : "Světlý"}</span></button>
    <button type="button" aria-label={en ? "Dark theme" : "Tmavý motiv"} title={en ? "Dark theme" : "Tmavý motiv"} aria-pressed={theme === "dark"} onClick={() => setAppearance("dark")}><Moon size={16} /><span>{en ? "Dark" : "Tmavý"}</span></button>
  </div>;
}
