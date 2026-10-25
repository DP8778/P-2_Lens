import { expect, test, type Page, type Route } from "@playwright/test";

const companies = [
  { symbol: "AMD", id: "twelvedata:XNGS:AMD", name: "Advanced Micro Devices" },
  { symbol: "TTD", id: "twelvedata:XNGM:TTD", name: "The Trade Desk" },
  { symbol: "NVDA", id: "twelvedata:XNGS:NVDA", name: "NVIDIA" },
];
const unavailable = { status: 503, json: { error: { code: "UNAVAILABLE", message: "Targeted history outage", retryable: false } } };

// Isolated browser fixtures: quotes stay available while historical prices fail.
// No fixture values are shipped in the application or persisted to snapshots.
async function isolateMarket(page: Page, failHistory: (route: Route) => Promise<void>) {
  await page.route("**/api/market/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/market/history") return failHistory(route);
    if (path === "/api/market/status") return route.fulfill({ json: { provider: "twelvedata", configured: true } });
    if (path === "/api/market/quotes") {
      const { assets } = route.request().postDataJSON() as { assets: { id: string; currency: string }[] };
      return route.fulfill({ json: { quotes: assets.map(asset => ({ assetId: asset.id, price: 123.45, currency: asset.currency,
        timestamp: new Date().toISOString(), marketState: "closed", freshness: "lastClose", source: "network" })) } });
    }
    if (path === "/api/market/fx") return route.fulfill({ json: { base: "USD", quote: "CZK", rate: 22, timestamp: new Date().toISOString(), freshness: "fresh", source: "network" } });
    return route.fulfill({ json: { assets: [] } });
  });
  await page.route("**/api/ai/**", route => route.fulfill({ status: 503, json: { error: { code: "no_key", message: "Research disabled in UI regression" } } }));
}

for (const company of companies) for (const width of [390, 768, 1440]) for (const theme of ["light", "dark"]) {
  test(`${company.symbol}: price outage, sections and keyboard · ${width}px ${theme} · CS/EN`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    let historyRequests = 0;
    await isolateMarket(page, async route => { historyRequests++; await route.fulfill(unavailable); });
    for (const locale of ["cs-CZ", "en-US"]) {
      const en = locale === "en-US";
      const before = historyRequests;
      await page.goto(`/${locale}/assets/${encodeURIComponent(company.id)}`);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(company.name);
      // Prove a real history request was intercepted, rather than relying on an unconfigured provider.
      await expect.poll(() => historyRequests).toBeGreaterThan(before);
      const themeButton = page.getByRole("button", { name: en ? (theme === "light" ? "Light theme" : "Dark theme") : (theme === "light" ? "Světlý motiv" : "Tmavý motiv"), exact: true });
      await themeButton.focus(); await page.keyboard.press("Enter");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.locator(".asset-detail-quote strong")).toContainText(en ? "123.45 USD" : "123,45 USD");
      const chart = page.locator(".company-history-chart");
      const notice = en ? "Historical share prices are unavailable." : "Historické ceny akcie nejsou dostupné.";
      await expect(chart.locator(".company-chart-heading .company-price-notice")).toHaveText(notice);
      await expect(chart.locator('[role="graphics-document"]')).toBeVisible();
      await expect(chart.locator(".company-chart-metrics")).toContainText("FY");
      await expect(chart.locator(".company-price-state")).toHaveCount(0);
      await chart.locator(".company-chart-sources summary").click();
      await expect(chart.locator(".company-chart-sources a").first()).toHaveAttribute("href", /^https:\/\//);
      await chart.locator(".company-chart-sources summary").click();
      const price = chart.getByRole("button", { name: en ? "Share price" : "Cena akcie", exact: true });
      await price.focus(); await page.keyboard.press("Enter");
      await expect(chart.locator(".company-price-state")).toContainText(notice);
      await expect(chart.locator('[role="graphics-document"]')).toHaveCount(0);
      const back = chart.getByRole("button", { name: en ? "Back to business performance" : "Zpět na Hospodaření", exact: true });
      await back.focus(); await page.keyboard.press("Enter");
      await expect(chart.locator('[role="graphics-document"]')).toBeVisible();

      const nav = page.locator(".company-section-nav");
      const links = nav.getByRole("link");
      if (company.symbol === "TTD") {
        await expect(links).toHaveText(en ? ["Development", "Platform economics", "Revenue to profit", "Market & competitors"] : ["Vývoj", "Ekonomika platformy", "Od tržeb k zisku", "Trh a konkurence"]);
        expect(await links.evaluateAll(items => items.map(item => item.getAttribute("href")))).toEqual(["#company-history-title", "#platform-economics-title", "#financial-anatomy-title", "#advertising-market-title"]);
      }
      for (let index = 0; index < await links.count(); index++) {
        const link = links.nth(index);
        const anchor = await link.getAttribute("href");
        await link.focus();
        await expect(link).toBeInViewport();
        await expect(link).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(new RegExp(`${anchor}$`));
        const heading = page.locator(anchor!);
        await expect(heading).toBeInViewport();
        const box = await heading.boundingBox();
        expect(box!.y).toBeGreaterThanOrEqual(20);
        expect(box!.y + box!.height).toBeLessThan(1000);
        if (company.symbol === "TTD") await expect(heading).toBeFocused();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await chart.scrollIntoViewIfNeeded();
      await chart.screenshot({ path: testInfo.outputPath(`${company.symbol}-${locale}-${width}-${theme}.png`) });
    }
    expect(errors).toEqual([]);
  });
}

test("manual financial selection survives the completion of a pending historical price request", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let requested = false;
  await isolateMarket(page, async route => { requested = true; await pending; await route.fulfill(unavailable); });
  await page.goto("/cs-CZ/assets/twelvedata%3AXNGS%3AAMD");
  await expect.poll(() => requested).toBe(true);
  const chart = page.locator(".company-history-chart");
  await chart.getByRole("button", { name: "Cena akcie", exact: true }).click();
  await expect(chart.getByRole("status")).toHaveText("Načítám historické ceny akcie…");
  const financial = chart.getByRole("button", { name: "Hospodaření", exact: true });
  await financial.focus(); await page.keyboard.press("Enter");
  release();
  await expect(chart.locator(".company-price-notice")).toHaveText("Historické ceny akcie nejsou dostupné.");
  await expect(financial).toHaveAttribute("aria-pressed", "true");
  await expect(chart.locator('[role="graphics-document"]')).toBeVisible();
});
