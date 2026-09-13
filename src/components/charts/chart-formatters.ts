import { formatCurrency, formatDate, formatPercent } from "@/lib/formatting/formatters";
export const money = (value: number, locale = "cs-CZ") => formatCurrency(value, locale, "CZK");
export const percent = (value: number, locale = "cs-CZ") => formatPercent(value, locale);
export const points = (value: number, locale = "cs-CZ") =>
  `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2, signDisplay: "exceptZero" }).format(value)} p. b.`;
export const allocation = (value: number, locale = "cs-CZ") =>
  `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} %`;
export const dateLabel = (value: string, locale = "cs-CZ") => formatDate(value, locale);
