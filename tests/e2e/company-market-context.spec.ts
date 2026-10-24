import { expect, test } from "@playwright/test";

for (const width of [1440, 768, 390]) {
  test(`AMD revenue donut and scoped competitive context work offline at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/market/**", route => route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE", message: "Offline", retryable: true } } }));
    await page.route("**/api/ai/company-research", route => route.abort());
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/cs-CZ/assets/twelvedata%3AXNGS%3AAMD");
    const revenue = page.getByRole("region", { name: "Čím AMD vydělává" });
    await expect(revenue.getByRole("img", { name: /Struktura tržeb AMD, FY2025/ })).toBeVisible();
    await revenue.getByRole("button", { name: "FY2024" }).focus();
    await page.keyboard.press("Enter");
    await expect(revenue.getByRole("img", { name: /FY2024/ })).toHaveAccessibleName(/48,8/);
    await expect(revenue).toContainText("25,79");
    await revenue.getByRole("button", { name: "FY2025" }).click();
    await revenue.screenshot({ path: testInfo.outputPath(`revenue-donut-${width}.png`) });
    const market = page.getByRole("region", { name: "Kde AMD soutěží a kdo vede?" });
    const card = market.locator(".market-position-card");
    await expect(card).toContainText("34,5");
    await expect(card).toContainText("Intel");
    await market.getByRole("button", { name: "Samostatné grafické karty pro PC" }).focus();
    await page.keyboard.press("Enter");
    await expect(card).toContainText("12,5");
    await expect(card).toContainText("NVIDIA");
    await expect(card).toContainText("Odhad podílu na dodaných kusech");
    await expect(card.getByRole("img")).toHaveAccessibleName(/AMD: 8.*NVIDIA: 90/);
    await expect(market.getByRole("heading", { name: "Jak se liší jejich podnikání?" })).toBeVisible();
    await expect(market.getByText("Interpretace Lens · co sledovat")).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await market.screenshot({ path: testInfo.outputPath(`market-context-${width}.png`) });
    expect(errors).toEqual([]);
  });
}
