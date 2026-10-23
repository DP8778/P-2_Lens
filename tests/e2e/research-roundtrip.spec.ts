import { expect, test, type Page } from "@playwright/test";
import { mockResearchMarket, researchDate } from "./fixtures/research-market";

async function expectNoPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`theme research survives refresh and AMD round trip at ${viewport.width}px`, async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const requests = await mockResearchMarket(page);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/cs-CZ/markets?theme=ai");
    const initialHistoryLength = await page.evaluate(() => history.length);
    await page.getByRole("button", { name: /Semiconductors/ }).click();
    await expect(page).toHaveURL(/theme=semiconductors/);
    await expect(page.locator(".theme-detail")).toHaveAttribute("data-performance-state", "reliable");
    const pulse = page.getByRole("region", { name: "Lens Pulse", exact: true });
    const period = pulse.getByRole("button", { name: "3M", exact: true });
    await period.click();
    await expect(page).toHaveURL(/period=3M/);
    const weighting = pulse.getByRole("group", { name: "Vážení indexu" }).getByRole("button", { name: /Váženo kapitalizací|Market-cap weighted/ });
    await weighting.click();
    await expect(page).toHaveURL(/weighting=market-cap/);
    await expect(weighting).toHaveAttribute("aria-pressed", "true");
    await expect(pulse.locator(".theme-period-return")).toContainText("3M");
    await expect(pulse.locator(".theme-period-return")).toContainText(/kapitalizac|Market-cap/);
    const researchUrl = page.url();
    const query = new URL(researchUrl).searchParams;
    expect(Object.fromEntries(query)).toMatchObject({ theme: "semiconductors", period: "3M", weighting: "market-cap", asOf: researchDate });
    expect(query.get("version")).toMatch(/^[a-f0-9]{8,64}$/);
    expect([...query.keys()].sort()).toEqual(["asOf", "period", "theme", "version", "weighting"]);
    // Selection replaces the research entry rather than spamming browser history.
    expect(await page.evaluate(() => history.length)).toBe(initialHistoryLength);
    const loadedHistoryCount = requests.historySymbols.length;
    await expectNoPageOverflow(page);
    if (viewport.width < 500) {
      const items = await page.locator(".industry-participation > div").evaluateAll((elements) => elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { x: box.x, width: box.width };
      }));
      expect(items).toHaveLength(3);
      expect(new Set(items.map((item) => Math.round(item.x))).size).toBe(1);
      for (const item of items) expect(item.width).toBeGreaterThan(250);
      expect((await page.locator(".industry-treemap").boundingBox())!.height).toBeLessThanOrEqual(340);
    }
    await pulse.screenshot({ path: testInfo.outputPath("theme-ready.png") });
    await page.reload();
    await expect(page).toHaveURL(researchUrl);
    await expect(page.locator(".theme-detail")).toHaveAttribute("data-performance-state", "reliable");
    await expect(period).toHaveAttribute("aria-pressed", "true");
    await expect(weighting).toHaveAttribute("aria-pressed", "true");
    expect(requests.historySymbols).toHaveLength(loadedHistoryCount);
    await page.getByText(/Prozkoumat všechny firmy/).click();
    const companies = page.locator(".industry-companies");
    await companies.getByRole("searchbox", { name: "Hledat firmu" }).fill("AMD");
    const row = companies.locator("tbody tr");
    await expect(row).toHaveCount(1);
    // Exercise the whole clickable row, not just its nested ticker link.
    await row.locator("td").nth(1).click();
    await expect(page.getByRole("heading", { name: "Advanced Micro Devices, Inc." })).toBeVisible();
    const assetQuery = new URL(page.url()).searchParams;
    expect(Object.fromEntries(assetQuery)).toEqual({ industry: "semiconductors", period: "3M", weighting: "market-cap", asOf: query.get("asOf"), version: query.get("version") });
    await expect(page.getByLabel("Období grafu").getByRole("button", { name: "3M", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("asset-price-chart")).toBeVisible();
    const context = page.getByRole("complementary", { name: "Kontext tématu" });
    await expect(context).toContainText("Semiconductors");
    await expect(context).toContainText("3M");
    await expect(context).toContainText(/Market-cap|kapitalizac/);
    await expect(context).toContainText("49/49");
    await expect(page.locator(".financial-anatomy")).toBeVisible();
    await expectNoPageOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("amd-context.png"), fullPage: false });
    // Asset Detail already extends its own daily history through today; Markets
    // uses completed daily closes. Only that AMD tail is requested, never the universe.
    expect(requests.historySymbols.slice(loadedHistoryCount)).toEqual(["AMD"]);
    const companyHistoryCount = requests.historySymbols.length;
    const back = page.getByRole("navigation", { name: "Navigace aktiva" }).getByRole("link", { name: "Zpět na téma: Semiconductors" });
    await expect(back).toHaveAttribute("href", new URL(researchUrl).pathname + new URL(researchUrl).search);
    await back.click();
    await expect(page).toHaveURL(researchUrl);
    await expect(page.locator(".theme-detail")).toHaveAttribute("data-performance-state", "reliable");
    await expect(period).toHaveAttribute("aria-pressed", "true");
    await expect(weighting).toHaveAttribute("aria-pressed", "true");
    expect(requests.historySymbols).toHaveLength(companyHistoryCount);
    await expectNoPageOverflow(page);
    expect(errors).toEqual([]);
  });
}
