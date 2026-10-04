import { expect, test } from "@playwright/test";
import { mockResearchMarket } from "./fixtures/research-market";

test("Dashboard discovers canonical universes without loading theme quotes or history", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const requests = await mockResearchMarket(page);
  await page.goto("/cs-CZ/dashboard");
  const pulse = page.locator(".market-pulse.compact");
  await expect(pulse).toBeVisible();
  for (const [name, count] of [["AI", 60], ["AI Infrastructure", 38], ["Semiconductors", 49], ["SaaS / Cloud", 33], ["Cybersecurity", 23]] as const) {
    const card = pulse.getByRole("link").filter({ has: page.getByText(name, { exact: true }) });
    await expect(card).toContainText(`${count}`);
    await expect(card).not.toContainText("%");
  }
  await page.waitForLoadState("networkidle");
  expect(requests.historySymbols).toEqual([]);
  expect(requests.quoteBatches).toEqual([]);
  await pulse.screenshot({ path: testInfo.outputPath("dashboard-universes.png") });
  await pulse.getByRole("link").filter({ has: page.getByText("Semiconductors", { exact: true }) }).click();
  await expect(page).toHaveURL(/\/cs-CZ\/markets\?theme=semiconductors/);
  await expect(page.locator(".theme-detail-header h3")).toHaveText("Semiconductors");
  await expect(page.locator(".market-constituents")).toHaveCount(0);
  await expect(page.locator(".industry-companies tbody tr")).toHaveCount(49);
});

test("direct PLTR detail keeps annual price metrics and Financial Anatomy", async ({ page }, testInfo) => {
  await mockResearchMarket(page);
  await page.goto(`/cs-CZ/assets/${encodeURIComponent("twelvedata:XNGS:PLTR")}`);
  await expect(page.getByRole("heading", { name: "Palantir Technologies Inc." })).toBeVisible();
  const performance = page.getByLabel("Výkonnost aktiva");
  for (const label of ["1W", "1M", "1Y", "52W high", "52W low"]) await expect(performance).toContainText(label);
  await expect(performance).not.toContainText("—");
  await expect(page.getByTestId("asset-price-chart")).toBeVisible();
  await expect(page.getByLabel("Období grafu").getByRole("button", { name: "1M", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".asset-industry-context")).toHaveCount(0);
  await expect(page.locator(".financial-anatomy")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("direct-pltr.png"), fullPage: false });
});
