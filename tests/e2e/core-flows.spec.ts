import { test, expect } from "@playwright/test";

test("opens the portfolio, switches modes, compares and selects a chart point", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/cs-CZ/dashboard");
  await expect(page.getByTestId("portfolio-value")).toBeVisible();
  await expect(page.locator(".insight-copy h3")).toBeVisible();
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
  await page.getByLabel("Nastavení grafu", { exact: true }).click();
  await page.getByLabel("Benchmark", { exact: true }).selectOption("qqq");
  await page.getByLabel("Porovnat aktivum", { exact: true }).selectOption("btc");
  await expect(page.locator(".chart-legend")).toContainText("Index 100");
  await expect(page.locator(".insight-copy h3")).toContainText("BTC");
  await page.getByLabel("Nastavení grafu", { exact: true }).click();
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

test("adds, persists, merges, edits and removes a holding", async ({ page }) => {
  await page.goto("/cs-CZ/dashboard");
  const before = await page.getByTestId("portfolio-value").innerText();
  await page.getByRole("button", { name: "Přidat aktivum", exact: true }).first().click();
  await page.getByLabel("Hledat ticker nebo aktivum").fill("ETH");
  await page.getByRole("button", { name: /ETH Ethereum/ }).click();
  await page.getByLabel("Množství", { exact: true }).fill("2");
  await page.getByLabel("Průměrná nákupní cena", { exact: true }).fill("3000");
  await page.getByRole("button", { name: "Zkontrolovat pozici" }).click();
  await expect(page.getByText("Alokace aktiva po uložení")).toBeVisible();
  await page.getByRole("button", { name: "Přidat do portfolia", exact: true }).click();
  await expect(page.getByRole("heading", { name: "ETH je v portfoliu" })).toBeVisible();
  await page.getByRole("button", { name: "Zpět do portfolia" }).click();
  await expect(page.getByTestId("portfolio-value")).not.toHaveText(before);
  const after = await page.getByTestId("portfolio-value").innerText();
  await page.reload();
  await expect(page.getByTestId("portfolio-value")).toHaveText(after);
  await page.getByRole("button", { name: "Detail ETH", exact: true }).click();
  await page.getByRole("button", { name: "Přidat k pozici" }).click();
  await expect(page.getByText(/Aktivum již držíte/)).toBeVisible();
  await page.getByLabel("Množství", { exact: true }).fill("1");
  await page.getByLabel("Průměrná nákupní cena", { exact: true }).fill("4500");
  await page.getByRole("button", { name: "Zkontrolovat pozici" }).click();
  await page.getByRole("button", { name: "Přidat ke stávající pozici" }).click();
  await page.getByRole("button", { name: "Zpět do portfolia" }).click();
  await expect(page.getByRole("button", { name: "Detail ETH", exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "Detail ETH", exact: true }).click();
  await page.getByRole("button", { name: "Upravit pozici" }).click();
  await expect(page.getByLabel("Množství", { exact: true })).toHaveValue("3");
  await expect(page.getByLabel("Průměrná nákupní cena", { exact: true })).toHaveValue("3500");
  await page.getByLabel("Množství", { exact: true }).fill("4");
  await page.getByRole("button", { name: "Zkontrolovat pozici" }).click();
  await page.getByRole("button", { name: "Uložit změny" }).click();
  await page.getByRole("button", { name: "Zpět do portfolia" }).click();
  await page.getByRole("button", { name: "Detail ETH", exact: true }).click();
  await page.getByRole("button", { name: "Odebrat z portfolia" }).click();
  await page.getByRole("button", { name: "Odebrat pozici", exact: true }).click();
  await expect(page.getByTestId("portfolio-value")).toHaveText(before);
});

test("validates input, traps focus, reports storage failure and closes with Escape", async ({
  page,
}) => {
  await page.goto("/cs-CZ/dashboard");
  const add = page.getByRole("button", { name: "Přidat aktivum", exact: true }).first();
  await add.click();
  await page.getByLabel("Hledat ticker nebo aktivum").fill("unknown-asset");
  await expect(page.getByText(/Žádné výsledky/)).toBeVisible();
  await page.getByLabel("Hledat ticker nebo aktivum").fill("AAPL");
  await page.getByRole("button", { name: /AAPL Apple/ }).click();
  await page.getByLabel("Množství", { exact: true }).fill("-2");
  await page.getByRole("button", { name: "Zkontrolovat pozici" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Množství");
  await page.getByLabel("Množství", { exact: true }).fill("2");
  await page.getByLabel("Průměrná nákupní cena", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Zkontrolovat pozici" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("cena");
  await page.getByLabel("Průměrná nákupní cena", { exact: true }).fill("200");
  await page.getByRole("button", { name: "Zkontrolovat pozici" }).click();
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error("disabled");
    };
  });
  await page.getByRole("button", { name: "Přidat ke stávající pozici" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("nepodařilo uložit");
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
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page.getByTestId("portfolio-value")).toBeVisible();
  await page.getByRole("button", { name: "Detail BTC", exact: true }).click();
  await page.getByRole("button", { name: "Porovnat v grafu" }).click();
  await expect(page.locator(".chart-legend")).toContainText("BTC");
  await page.getByRole("button", { name: "Přidat aktivum", exact: true }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.getByRole("dialog").evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await page.screenshot({ path: "test-results/lens-mobile-dialog.png", fullPage: true });
  await page.getByRole("button", { name: "Zavřít", exact: true }).click();
  await page.screenshot({ path: "test-results/lens-mobile.png", fullPage: true });
});
