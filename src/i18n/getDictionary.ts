import cs from "./cs-CZ.json";
import en from "./en-US.json";

export const locales = ["cs-CZ", "en-US"] as const;
export type Locale = (typeof locales)[number];
export type Dictionary = typeof cs;

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}
export function getDictionary(locale: Locale): Dictionary {
  return locale === "en-US" ? en : cs;
}
