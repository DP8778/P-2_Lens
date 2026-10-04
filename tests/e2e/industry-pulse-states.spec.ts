import { expect, test } from '@playwright/test';

test('Lens Pulse replaces progress with results while the market map remains available', async ({ page }, testInfo) => {
  // Deterministic transport fixtures only; the UI uses the real loader and coverage policy.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  let released = 13;
  let requests = 0;
  const waiting: Array<{ number: number; resolve: () => void }> = [];
  const release = (count: number) => {
    released = count;
    for (const pending of waiting.splice(0)) {
      if (pending.number <= count) pending.resolve();
      else waiting.push(pending);
    }
  };
  await page.route('**/api/market/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/history')) {
      const asset = JSON.parse(url.searchParams.get('asset')!);
      const number = ++requests;
      if (number > released) await new Promise<void>(resolve => waiting.push({ number, resolve }));
      const from = url.searchParams.get('from')!;
      const to = url.searchParams.get('to')!;
      const start = Date.parse(from);
      const days = Math.floor((Date.parse(to) - start) / 86_400_000) + 1;
      await route.fulfill({ json: {
        asset, range: { from, to, interval: '1day' }, source: 'network',
        points: Array.from({ length: days }, (_, i) => ({
          assetId: asset.id, date: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
          close: 100 + i * 0.1, currency: asset.currency, adjustedForSplits: true,
        })),
      } });
      return;
    }
    if (url.pathname.endsWith('/quotes')) {
      await route.fulfill({ json: { quotes: route.request().postDataJSON().assets.map((asset: { id: string; currency: string }) => ({
        assetId: asset.id, price: 123, currency: asset.currency, timestamp: new Date().toISOString(),
        marketState: 'closed', freshness: 'fresh', source: 'network', changePercent: 1,
      })) } });
      return;
    }
    await route.fulfill({ json: { provider: 'twelvedata', configured: true } });
  });
  await page.goto('/cs-CZ/markets?theme=semiconductors');
  await page.getByRole('button', { name: '1M', exact: true }).click();
  const pulse = page.getByRole('region', { name: 'Lens Pulse', exact: true });
  const progress = pulse.getByRole('progressbar', { name: 'Příprava cenové historie tématu' });
  await expect(progress).toHaveAttribute('aria-valuenow', '13');
  await expect(progress).toHaveAttribute('aria-valuemin', '0');
  await expect(progress).toHaveAttribute('aria-valuemax', '49');
  await expect(pulse).toContainText('13 z 49 společností připraveno · 27 %');
  await expect(pulse.locator('.theme-period-return')).toHaveCount(0);
  await expect(pulse.getByRole('group', { name: 'Vážení indexu' })).toHaveCount(0);
  await expect(page.locator('.industry-treemap a')).toHaveCount(49);
  await expect(page.locator('.industry-treemap a[aria-label*="Výnos nedostupný"]')).toHaveCount(36);
  await pulse.screenshot({ path: testInfo.outputPath('loading-13.png') });
  // Loading has a bounded footprint instead of the old 620px blank content area.
  const loadingHeight = (await pulse.boundingBox())!.height;
  expect(loadingHeight).toBeGreaterThan(300);
  expect(loadingHeight).toBeLessThan(520);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(progress).toBeVisible();
  expect((await pulse.boundingBox())!.height).toBeLessThan(450);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await pulse.screenshot({ path: testInfo.outputPath('loading-mobile.png') });
  await page.setViewportSize({ width: 1440, height: 1000 });
  release(21);
  await expect(progress).toHaveAttribute('aria-valuenow', '21');
  await expect(pulse).toContainText('21 z 49 společností připraveno · 43 %');
  await pulse.screenshot({ path: testInfo.outputPath('loading-21.png') });
  expect(await pulse.evaluate(element => ({
    animation: getComputedStyle(element).animationName,
    transition: getComputedStyle(element).transitionDuration,
  }))).toEqual({ animation: 'none', transition: '0s' });
  release(40);
  await expect(pulse).toHaveAttribute('data-view', 'ready');
  await expect(progress).toHaveCount(0);
  await expect(pulse).toContainText('Výnos za 1M');
  await expect(pulse.locator('.theme-period-return strong')).not.toHaveText('—');
  await expect(pulse.locator('.theme-history-chart')).toBeVisible();
  await expect(page.locator('.industry-treemap a')).toHaveCount(49);
  expect((await pulse.boundingBox())!.height).toBeLessThan(1050);
  await pulse.screenshot({ path: testInfo.outputPath('ready.png') });
  release(1000);
  await expect(page.locator('.theme-detail')).toHaveAttribute('data-performance-state', 'reliable');
  const loadedRequests = requests;
  for (const period of ['3M', '1Y', '1M']) {
    await page.getByRole('button', { name: period, exact: true }).click();
    await expect(pulse).toHaveAttribute('data-view', 'ready');
  }
  expect(requests).toBe(loadedRequests);
});
