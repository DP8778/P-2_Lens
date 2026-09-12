import { formatCurrency, formatDate, formatPercent } from "@/lib/formatting/formatters";
describe("locale formatting", () => {
  test("formats Czech percentages with explicit sign", () => {
    expect(formatPercent(6.5, "cs-CZ")).toContain("+6,5");
    expect(formatPercent(-2, "cs-CZ")).toContain("-2,0");
  });
  test("formats currency and date per locale", () => {
    expect(formatCurrency(1000, "en-US", "USD")).toContain("$1,000");
    expect(formatDate("2026-09-07T12:00:00.000Z", "cs-CZ")).toMatch(/2026/);
  });
});
