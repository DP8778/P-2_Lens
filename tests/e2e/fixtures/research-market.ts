import type { Page } from "@playwright/test";
import snapshot from "../../../src/lib/fundamentals/snapshots/current.json";
import type { MarketAsset } from "../../../src/lib/market-data/types";

export const researchDate = "2026-10-04";

/** Deterministic test transport; all displayed prices are fixtures, never live provider data. */
export async function mockResearchMarket(page: Page) {
  const historySymbols: string[] = [];
  const quoteBatches: string[][] = [];
  const assets = Object.values(snapshot.industries).flatMap((industry) => industry.members.map((member) => member.asset));
  await page.clock.setFixedTime(new Date(`${researchDate}T12:00:00Z`));
  await page.route("**/api/portfolio/context", (route) => route.abort());
  await page.route("**/api/market/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/history")) {
      const asset = JSON.parse(url.searchParams.get("asset")!) as MarketAsset;
      historySymbols.push(asset.symbol);
      const from = url.searchParams.get("from")!;
      const to = url.searchParams.get("to")!;
      const start = Date.parse(from);
      const days = Math.floor((Date.parse(to) - start) / 86_400_000) + 1;
      const slope = (Array.from(asset.symbol).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 9 - 3) * 0.03;
      await route.fulfill({ json: {
        asset, range: { from, to, interval: "1day" }, source: "network",
        points: Array.from({ length: days }, (_, i) => ({
          assetId: asset.id, date: new Date(start + i * 86_400_000).toISOString().slice(0, 10),
          close: 100 + i * slope, currency: asset.currency, adjustedForSplits: true,
        })),
      } });
      return;
    }
    if (url.pathname.endsWith("/quotes")) {
      const batch = route.request().postDataJSON().assets as MarketAsset[];
      quoteBatches.push(batch.map((asset) => asset.symbol));
      await route.fulfill({ json: { quotes: batch.map((asset) => ({
        assetId: asset.id, price: 123, change: 1.2, changePercent: 1,
        currency: asset.currency, timestamp: `${researchDate}T12:00:00Z`,
        marketState: "closed", freshness: "lastClose", source: "network",
      })) } });
      return;
    }
    if (url.pathname.endsWith("/search")) {
      const symbol = url.searchParams.get("q")?.toUpperCase();
      const asset = assets.find((candidate) => candidate.symbol === symbol);
      await route.fulfill({ json: { assets: asset ? [asset] : [] } });
      return;
    }
    if (url.pathname.endsWith("/fx")) {
      await route.fulfill({ json: { base: "USD", quote: "CZK", rate: 21.3, timestamp: `${researchDate}T12:00:00Z`, freshness: "fresh", source: "network" } });
      return;
    }
    if (url.pathname.endsWith("/bitcoin")) {
      await route.fulfill({ json: { price: 115000 } });
      return;
    }
    await route.fulfill({ json: { provider: "twelvedata", configured: true } });
  });
  return { historySymbols, quoteBatches };
}
