export function formatCurrency(value: number, locale = "cs-CZ", currency = "USD") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number, locale = "cs-CZ", digits = 1) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)} %`;
}

export function formatDate(value: string, locale = "cs-CZ") {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
