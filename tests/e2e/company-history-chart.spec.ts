import { expect, test } from "@playwright/test";

for (const width of [1440, 768, 390]) {
  test(`AMD hero remains useful without price or AI services at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/market/**", route => route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE", message: "Unavailable", retryable: true } } }));
    await page.route("**/api/ai/company-research", route => route.fulfill({ status: 503, json: { error: { code: "no_key", message: "Unavailable" } } }));
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/cs-CZ/assets/twelvedata%3AXNGS%3AAMD");
    const chart = page.getByRole("region", { name: "Jak se vyvíjí AMD?" });
    await expect(chart.locator('[role="graphics-document"]')).toBeVisible();
    await expect(chart.locator(".company-chart-metrics")).toContainText("34,64");
    await expect(chart.locator(".company-chart-metrics")).toContainText("3,69");
    await expect(chart.locator(".company-chart-metrics")).toContainText("4,34");
    const graph = chart.locator('[role="graphics-document"]');
    await expect.poll(async () => graph.evaluate(svg => Math.abs((svg as SVGSVGElement).viewBox.baseVal.width - svg.getBoundingClientRect().width))).toBeLessThan(2);
    await graph.focus(); await page.keyboard.press("Home"); await page.keyboard.press("Enter");
    await chart.getByRole("button", { name: "Hospodaření", exact: true }).focus();
    await expect(chart.locator(".company-chart-readout")).toContainText("FY2021");
    await chart.getByRole("button", { name: "Index 100", exact: true }).click();
    await graph.focus(); await page.keyboard.press("Home");
    await expect(chart.locator(".company-chart-readout strong")).toHaveText(["100", "100", "100"]);
    await chart.getByRole("slider", { name: "Začátek období" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(chart.getByRole("slider", { name: "Začátek období" })).toHaveValue("1");
    await chart.getByRole("button", { name: "USD", exact: true }).click();
    await chart.getByRole("button", { name: "Cena akcie", exact: true }).click();
    await expect(chart.locator('[role="graphics-document"]')).toHaveCount(0);
    await chart.getByRole("button", { name: "Zpět na Hospodaření" }).click();
    await expect(chart.locator('[role="graphics-document"]')).toBeVisible();
    await chart.getByText("Data grafu a zdroje", { exact: true }).click();
    await chart.getByRole("button", { name: "Hospodaření", exact: true }).focus();
    await expect(chart.getByRole("table")).toContainText("FY2022");
    await chart.getByText("Data grafu a zdroje", { exact: true }).click();
    await expect(page.locator(".company-research-status")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Čím se firma zabývá?" })).toHaveCount(0);
    await expect(page.locator(".asset-performance-strip")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await chart.screenshot({ path: testInfo.outputPath(`amd-hero-${width}.png`) });
    expect(errors).toEqual([]);
  });
}
