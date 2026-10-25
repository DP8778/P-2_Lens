import { test, expect } from "@playwright/test";
const ttd = "/cs-CZ/assets/twelvedata%3AXNGM%3ATTD";
for (const width of [390, 768, 1440]) for (const theme of ["light", "dark"]) {
  test(`TTD verified example without optional services: ${theme} ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/market/**", route => route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE", message: "Offline", retryable: true } } }));
    await page.route("**/api/ai/**", route => route.abort());
    await page.goto(`${ttd}?industry=semiconductors`);
    const toggle = page.getByRole("button", { name: theme === "light" ? "Světlý motiv" : "Tmavý motiv", exact: true });
    await toggle.focus(); await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("The Trade Desk");
    await expect(page.getByRole("region", { name: "Jak se vyvíjí TTD?" }).locator('[role="graphics-document"]')).toBeVisible();
    await expect(page.locator(".platform-economics")).toContainText("13,39");
    await expect(page.locator(".platform-economics")).toContainText("21,62");
    await expect(page.locator(".financial-anatomy")).toContainText("Provoz platformy");
    await expect(page.locator(".financial-anatomy")).not.toContainText("Hrubá marže");
    await expect(page.locator(".asset-context-navigation")).toHaveCount(0);
    await expect(page.locator(".advertising-context")).toContainText("Google Display & Video 360");
    await expect(page.locator(".advertising-context")).not.toContainText("NVIDIA");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.locator(".platform-economics")).toBeVisible();
    const chart = page.getByRole("region", { name: "Jak se vyvíjí TTD?" });
    const graph = chart.locator('[role="graphics-document"]');
    await graph.focus(); await page.keyboard.press("ArrowLeft");
    await chart.getByRole("button", { name: "Cena akcie", exact: true }).click();
    await expect(chart).toContainText(/Historie ceny|Cenová historie|cenová|cen|Cena/);
    await chart.getByRole("button", { name: "Hospodaření", exact: true }).click();
    await expect(graph).toBeVisible();
    expect(errors).toEqual([]);
  });
}
test("Markets exposes both real examples and can return from TTD without a fabricated industry context", async ({ page }) => {
  await page.goto("/cs-CZ/markets");
  await page.getByRole("link", { name: /The Trade Desk Reklamní platforma/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("The Trade Desk");
  await page.locator(".asset-detail-navigation").getByRole("link", { name: "Markets", exact: true }).click();
  await page.getByRole("link", { name: /AMD Čipy/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Advanced Micro Devices");
  await expect(page.locator("#company-revenue-mix-title")).toBeVisible();
});
