import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const amd = "/cs-CZ/assets/twelvedata%3AXNGS%3AAMD";

for (const width of [1440, 768, 390]) {
  for (const theme of ["light", "dark"] as const) {
    test(`${theme} workspace: readable company charts and working controls at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("**/api/market/**", route => route.fulfill({ status: 503, json: { error: { code: "UNAVAILABLE", message: "Offline", retryable: true } } }));
      await page.route("**/api/ai/**", route => route.abort());
      await page.goto(amd);
      const toggle = page.getByRole("button", { name: theme === "light" ? "Světlý motiv" : "Tmavý motiv", exact: true });
      await toggle.focus();
      await page.keyboard.press("Enter");
      await expect(toggle).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const chart = page.getByRole("region", { name: "Jak se vyvíjí AMD?" });
      await expect(chart.locator('[role="graphics-document"]')).toBeVisible();
      // Contrast uses the actual browser-resolved palette, not hard-coded theme snapshots.
      const contrasts = await chart.evaluate(element => {
        const style = getComputedStyle(element);
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d")!;
        const luminance = (color: string) => {
          context.fillStyle = color;
          context.fillRect(0, 0, 1, 1);
          const rgb = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(value => {
            const v = value / 255;
            return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4;
          });
          return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
        };
        const background = luminance(style.backgroundColor);
        return ["--color-text-primary", "--color-text-secondary", "--color-text-muted", "--chart-revenue", "--chart-operating", "--chart-net"].map(token => {
          const foreground = luminance(style.getPropertyValue(token).trim());
          return { token, contrast: (Math.max(background, foreground) + .05) / (Math.min(background, foreground) + .05) };
        });
      });
      for (const { token, contrast } of contrasts) expect(contrast, token).toBeGreaterThanOrEqual(token.startsWith("--chart") ? 3 : 4.5);
      await page.getByRole("navigation", { name: "Sekce firmy" }).getByRole("link", { name: "Struktura tržeb", exact: true }).click();
      await expect(page).toHaveURL(/#company-revenue-mix-title$/);
      const revenue = page.getByRole("region", { name: "Čím AMD vydělává" });
      await revenue.getByRole("button", { name: "FY2024" }).click();
      await expect(revenue.getByRole("img")).toHaveAccessibleName(/FY2024.*48,8/);
      await revenue.getByRole("button", { name: "FY2025" }).click();
      await revenue.screenshot({ path: testInfo.outputPath(`revenue-${theme}-${width}.png`) });
      await page.getByRole("region", { name: "Kde AMD soutěží a kdo vede?" }).getByRole("button", { name: "Samostatné grafické karty pro PC" }).click();
      await expect(page.locator(".market-position-card")).toContainText("NVIDIA");
      await page.locator(".market-position-card").screenshot({ path: testInfo.outputPath(`market-${theme}-${width}.png`) });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(errors).toEqual([]);
    });
  }
}

for (const theme of ["light", "dark"] as const) {
  test(`${theme} preference survives navigation, reload, settings and SVG export`, async ({ page }) => {
    await page.goto(amd);
    await page.getByRole("button", { name: theme === "light" ? "Světlý motiv" : "Tmavý motiv", exact: true }).click();
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await page.getByRole("link", { name: "Nastavení", exact: true }).click();
    await expect(page.getByRole("button", { name: theme === "light" ? "Světlý" : "Tmavý", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: theme === "light" ? "Tmavý" : "Světlý", exact: true }).click();
    await expect(page.getByRole("button", { name: theme === "light" ? "Tmavý motiv" : "Světlý motiv", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: theme === "light" ? "Světlý" : "Tmavý", exact: true }).click();
    await page.getByRole("navigation", { name: "Hlavní navigace" }).getByRole("link", { name: "Portfolio", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportovat graf SVG" }).click();
    const file = await download;
    const svg = await readFile((await file.path())!, "utf8");
    expect(svg).toContain("--chart-line:");
    expect(svg).toContain("--chart-surface-top:");
    // The downloaded file must render without the app's external CSS.
    await page.goto(`data:text/html,${encodeURIComponent(svg)}`);
    const exported = await page.locator("svg").evaluate(element => {
      const style = getComputedStyle(element);
      return { line: style.getPropertyValue("--chart-line").trim(), surface: style.getPropertyValue("--chart-surface-top").trim() };
    });
    expect(exported.line).toMatch(/^#/);
    expect(exported.surface).toMatch(/^#/);
  });
}

test("appearance still switches when browser storage is blocked", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new DOMException("Blocked", "SecurityError"); };
    Storage.prototype.setItem = () => { throw new DOMException("Blocked", "SecurityError"); };
  });
  await page.goto(amd);
  await page.getByRole("button", { name: "Tmavý motiv", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Světlý motiv", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
