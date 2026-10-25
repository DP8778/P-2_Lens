import { expect, test } from "@playwright/test";
import { mockResearchMarket, researchDate } from "./fixtures/research-market";

const artifact = (name: string) => `artifacts/lens-presentation-review/${name}`;

test("portfolio explanation to demo NVIDIA statements", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/portfolio/context", route => route.abort());
  await page.route("**/api/ai/company-research", route => route.abort());
  await page.goto("/cs-CZ/dashboard");

  await expect(page.getByRole("button", { name: "1Y", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Příspěvky", exact: true }).click();
  await page.getByRole("button", { name: /NVDA, příspěvek/ }).click();
  await page.locator(".insight-evidence > summary").click();
  await expect(page.locator(".lens-insight footer")).toContainText("Základní vysvětlení aplikace");
  await expect(page.getByRole("img", { name: "Příspěvky aktiv k výnosu" })).toBeVisible();
  await page.screenshot({ path: artifact("01-portfolio-contributions-evidence.png"), fullPage: true });

  await page.getByRole("link", { name: "Detail NVDA", exact: true }).click();
  await expect(page).toHaveURL(/\/cs-CZ\/assets\/twelvedata(?::|%3A)XNGS(?::|%3A)NVDA\?source=demo&position=nvda$/);
  const url = new URL(page.url());
  expect(decodeURIComponent(url.pathname)).toBe("/cs-CZ/assets/twelvedata:XNGS:NVDA");
  expect(Object.fromEntries(url.searchParams)).toEqual({ source: "demo", position: "nvda" });
  await expect(page.getByRole("heading", { name: "NVIDIA Corporation", level: 1 })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("lens-demo-2026.09-v2");
  await expect(page.getByRole("heading", { name: "Jak z tržeb vzniká zisk?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Demo pozice" })).toBeVisible();
  await page.screenshot({ path: artifact("02-demo-nvidia-financial-anatomy.png"), fullPage: true });
});

test("Markets theme to AMD and exact return", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await mockResearchMarket(page);
  await page.route("**/api/ai/company-research", route => route.abort());
  await page.goto("/cs-CZ/markets?theme=ai");
  await page.getByRole("button", { name: /Semiconductors/ }).click();
  const pulse = page.getByRole("region", { name: "Lens Pulse", exact: true });
  await pulse.getByRole("button", { name: "3M", exact: true }).click();
  await pulse.getByRole("group", { name: "Vážení indexu" }).getByRole("button", { name: /Váženo kapitalizací/ }).click();
  await expect(page.locator(".theme-detail")).toHaveAttribute("data-performance-state", "reliable");
  const themeUrl = page.url();
  expect(new URL(themeUrl).searchParams.get("asOf")).toBe(researchDate);
  // Fixed off-canvas skip links can be duplicated by Playwright's stitched full-page capture.
  await page.addStyleTag({ content: ".skip-link:not(:focus) { display: none !important; }" });
  await page.screenshot({ path: artifact("03-markets-semiconductors.png"), fullPage: true });

  await page.getByText("Prozkoumat všechny firmy").click();
  const companies = page.locator(".industry-companies");
  await companies.getByRole("searchbox", { name: "Hledat firmu" }).fill("AMD");
  await companies.locator("tbody tr td").nth(1).click();
  await expect(page.getByRole("heading", { name: "Advanced Micro Devices, Inc.", level: 1 })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Kontext tématu" })).toContainText("3M");
  await expect(page.getByRole("heading", { name: "Jak z tržeb vzniká zisk?" })).toBeVisible();
  await page.screenshot({ path: artifact("04-amd-theme-context.png"), fullPage: true });
  await page.getByRole("link", { name: "Zpět na téma: Semiconductors" }).click();
  await expect(page).toHaveURL(themeUrl);
});

test("known NVIDIA keeps statements when price provider is unavailable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/market/**", async route => {
    if (new URL(route.request().url()).pathname.endsWith("/status")) {
      await route.fulfill({ json: { provider: "twelvedata", configured: false } });
    } else await route.abort();
  });
  await page.route("**/api/ai/company-research", route => route.abort());
  await page.goto("/cs-CZ/assets/twelvedata%3AXNGS%3ANVDA");
  await expect(page.getByRole("heading", { name: "NVIDIA Corporation", level: 1 })).toBeVisible();
  await expect(page.getByText(/Kurz pro NASDAQ není dostupný/)).toBeVisible();
  await expect(page.getByText("Historické ceny akcie nejsou dostupné.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Jak z tržeb vzniká zisk?" })).toBeVisible();
  await page.screenshot({ path: artifact("05-nvidia-statements-without-prices.png"), fullPage: true });
});

test("touch header keeps Portfolio and Markets available", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/portfolio/context", route => route.abort());
  await page.goto("/cs-CZ/dashboard");
  await expect(page.getByRole("link", { name: "Portfolio", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Markets", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: artifact("06-touch-navigation.png"), fullPage: false });
});

