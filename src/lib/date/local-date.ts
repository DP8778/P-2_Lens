export function localDateISO(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addLocalDays(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  return localDateISO(new Date(year, month - 1, day + days, 12));
}
