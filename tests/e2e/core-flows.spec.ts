import { test, expect } from "@playwright/test";

test("opens the portfolio, switches modes, compares and selects a chart point", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/cs-CZ/dashboard");
  await expect(page.getByTestId("portfolio-value")).toBeVisible();
  await expect(page.locator(".insight-copy h3")).toBeVisible();
  await expect(page.locator(".hero-chart")).toBeVisible();
  await expect(page.locator("#holdings")).toBeAttached();
  await expect(page.locator(".portfolio-drivers")).toHaveCount(0);
  await page.screenshot({ path: "test-results/lens-desktop.png", fullPage: true });
  const before = await page.locator(".summary-return").innerText();
  await page.getByRole("button", { name: "1Y", exact: true }).click();
  await expect(page.locator(".summary-return")).not.toHaveText(before);
  await page.getByRole("button", { name: "Příspěvky", exact: true }).click();
  await expect(page.getByRole("img", { name: "Příspěvky aktiv k výnosu" })).toBeVisible();
  await expect(page.locator(".contribution-summary")).toContainText("Výnos portfolia");
  await page.getByRole("button", { name: /BTC, příspěvek/ }).click();
  await expect(page.getByRole("button", { name: /BTC, příspěvek/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Vývoj", exact: true }).click();
  await expect(page.locator(".chart-legend")).toContainText("BTC");
  await expect(page.locator(".insight-copy h3")).toContainText("BTC");
  const evidenceDisclosure = page.locator(".insight-evidence > summary");
  await expect(evidenceDisclosure).toHaveAttribute("aria-expanded", "false");
  await evidenceDisclosure.click();
  await expect(evidenceDisclosure).toHaveAttribute("aria-expanded", "true");
  const btcEvidence = page.getByRole("button", { name: /BTC · příspěvek.*Zobrazit v grafu/ });
  await expect(btcEvidence).toBeVisible();
  await btcEvidence.click();
  await expect(page.locator(".chart-legend")).toContainText("BTC");
  await page.getByRole("button", { name: "Odebrat porovnání BTC" }).click();
  await page.getByRole("button", { name: "Poklesy", exact: true }).click();
  await expect(page.locator(".insight-copy")).toContainText("pokles");
  await expect(page.locator(".drawdown-summary")).toContainText("Max. pokles");
  const troughButton = page.getByRole("button", { name: "Vybrat dno maximálního poklesu" });
  if (await troughButton.count()) {
    await troughButton.click();
    await expect(page.locator(".hero-tooltip")).toContainText("Pokles od maxima");
    await expect(page.locator(".insight-copy h3")).toContainText("Dno");
  }
  await page.getByRole("button", { name: "Vývoj", exact: true }).click();
  const chartOptions = page.locator(".chart-options");
  const chartOptionsTrigger = page.getByLabel("Nastavení grafu", { exact: true });
  await chartOptionsTrigger.click();
  await page.getByLabel("Benchmark", { exact: true }).selectOption("qqq");
  if ((await chartOptions.getAttribute("open")) !== null) await chartOptionsTrigger.click();
  await page.locator(".compare-trigger").click();
  await page.locator(".compare-results").getByRole("option", { name: /BTC Bitcoin/ }).click();
  await expect(page.locator(".chart-legend")).toContainText("Index 100");
  await expect(page.locator(".insight-copy h3")).toContainText("BTC");
  if ((await chartOptions.getAttribute("open")) !== null) await chartOptionsTrigger.click();
  const chart = page.locator('.chart-plot svg[role="graphics-document"]');
  await chart.focus();
  await page.keyboard.press("Home");
  await expect(page.locator(".hero-tooltip")).toContainText("Vybraný bod");
  await expect(page.locator(".insight-copy")).toContainText("V tomto bodě");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".hero-tooltip")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".hero-tooltip")).toHaveCount(0);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportovat graf SVG" }).click();
  expect((await download).suggestedFilename()).toMatch(/lens-performance.*\.svg/);
  await page.screenshot({ path: "test-results/lens-compare.png", fullPage: true });
});

test("demo remains deterministic and read-only", async ({ page }) => {
  await page.goto("/cs-CZ/dashboard");
  const before = await page.getByTestId("portfolio-value").innerText();
  await expect(page.getByRole("button", { name: "Použít vlastní portfolio" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Přidat aktivum" })).toHaveCount(0);
  await page.getByRole("link", { name: "Detail BTC", exact: true }).click();
  await expect(page).toHaveURL(/\/cs-CZ\/assets\/btc$/);
  await page.goto("/cs-CZ/dashboard");
  await expect(page.getByTestId("portfolio-value")).toHaveText(before);
});

test("legacy portfolio and insights redirect while asset detail remains a real route", async ({ page }) => {
  for (const route of ["portfolio", "insights"]) {
    await page.goto(`/cs-CZ/${route}`);
    await expect(page).toHaveURL(/\/cs-CZ\/dashboard$/);
  }
  await page.goto("/cs-CZ/assets/NVDA");
  await expect(page).toHaveURL(/\/cs-CZ\/assets\/NVDA$/);
});

test("dialogs trap focus, close with Escape and return focus", async ({ page }) => {
  await page.goto("/cs-CZ/dashboard");
  const trigger = page.getByRole("button", { name: "Použít vlastní portfolio" });
  await trigger.click();
  const add = page.getByRole("button", { name: "Přidat první aktivum" });
  await add.click();
  await page.getByRole("button", { name: "Zavřít", exact: true }).focus();
  await page.keyboard.press("Shift+Tab");
  expect(await page.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(add).toBeFocused();
});

test("navigator mění pouze viewport a vlastní rozsah řídí analýzu", async ({ page }) => {
  await page.goto("/cs-CZ/dashboard");
  const analyticalPeriod = await page.locator(".analytics-heading > span").innerText();
  const start = page.getByRole("slider", { name: "Začátek období" });
  await start.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".analytics-heading > span")).toHaveText(analyticalPeriod);
  await page.getByLabel("Nastavení grafu", { exact: true }).click();
  await page.getByLabel("Události", { exact: true }).check();
  await page.getByLabel("Nastavení grafu", { exact: true }).click();
  await page.locator(".annotation-buttons > button").first().click();
  await expect(page.locator(".hero-tooltip")).toContainText("Vybraný bod");
  const beforeRange = await page.locator(".analytics-heading > span").innerText();
  await page.getByRole("button", { name: "Vybrat období", exact: true }).click();
  const chart = page.locator('.chart-plot svg[role="graphics-document"]');
  const box = await chart.boundingBox();
  if (!box) throw new Error("Chart nemá rozměry");
  await chart.click({ position: { x: box.width * 0.28, y: box.height * 0.5 } });
  await expect(page.getByText("Zvolte konec období")).toBeVisible();
  await chart.click({ position: { x: box.width * 0.72, y: box.height * 0.5 } });
  await expect(page.locator(".analytics-heading > span")).not.toHaveText(beforeRange);
  await expect(page.locator(".analysis-range-chip")).toContainText("Analyzováno");
  await expect(page.locator(".insight-scope")).toContainText(/2026/);
  await page.getByRole("button", { name: "Zrušit rozsah ×" }).click();
  await expect(page.locator(".analysis-range-chip")).toHaveCount(0);
});

test("touch layout stays within the viewport and keeps data usable offline", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/portfolio/context", (route) => route.abort());
  await page.goto("/cs-CZ/dashboard");
  await expect(page.locator(".lens-insight footer")).toContainText("ověřený výklad zůstává aktivní");
  await expect(page.locator(".insight-evidence")).toBeVisible();
  await expect(page.locator(".insight-evidence > summary")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(page.locator("#insight-evidence-rows")).not.toBeVisible();
  const mobilePlotHeight = await page.locator(".chart-plot").evaluate((element) =>
    Math.round(element.getBoundingClientRect().height),
  );
  expect(mobilePlotHeight).toBeGreaterThanOrEqual(280);
  expect(mobilePlotHeight).toBeLessThanOrEqual(340);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page.getByTestId("portfolio-value")).toBeVisible();
  await page.locator("#holdings").scrollIntoViewIfNeeded();
  const mobileRowHeight = await page.locator(".holdings-table tbody tr").first().evaluate((element) => Math.round(element.getBoundingClientRect().height));
  expect(mobileRowHeight).toBeLessThanOrEqual(130);
  await expect(page.locator(".holdings-table tbody tr").first().locator("td").nth(4)).not.toBeVisible();
  await page.getByRole("link", { name: "Detail BTC", exact: true }).click();
  await expect(page).toHaveURL(/\/cs-CZ\/assets\/btc$/);
  await page.goto("/cs-CZ/dashboard");
  await page.getByRole("button", { name: "Použít vlastní portfolio" }).click();
  await page.getByRole("button", { name: "Přidat první aktivum" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.getByRole("dialog").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.screenshot({ path: "test-results/lens-mobile-dialog.png", fullPage: true });
  await page.getByRole("button", { name: "Zavřít", exact: true }).click();
  await page.screenshot({ path: "test-results/lens-mobile.png", fullPage: true });
});

test("chart uses bounded viewport-aware heights without grid stretch", async ({ page }) => {
  const viewports = [
    { width: 1366, height: 768, min: 320, max: 340 },
    { width: 1440, height: 900, min: 350, max: 385 },
    { width: 1600, height: 900, min: 350, max: 375 },
    { width: 1920, height: 1080, min: 390, max: 415 },
  ];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/cs-CZ/dashboard");
    const layout = await page.locator(".hero-analytics").evaluate((element) => ({
      alignItems: getComputedStyle(element).alignItems,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    const plotHeight = await page.locator(".chart-plot").evaluate((element) =>
      Math.round(element.getBoundingClientRect().height),
    );
    const lensHeadlineTop = await page.locator(".insight-copy h3").evaluate((element) =>
      element.getBoundingClientRect().top,
    );
    expect(layout.alignItems).toBe("start");
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.viewportWidth);
    expect(plotHeight).toBeGreaterThanOrEqual(viewport.min);
    expect(plotHeight).toBeLessThanOrEqual(viewport.max);
    expect(plotHeight).toBeLessThan(viewport.height);
    expect(lensHeadlineTop).toBeLessThan(viewport.height);
  }
});
