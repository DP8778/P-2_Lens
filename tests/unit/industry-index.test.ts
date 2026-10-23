import { industryCompanies } from "@/data/market-industries";
import { marketThemes } from "@/data/market-themes";
import { buildIndustryIndex } from "@/lib/finance/industry-index";
import type { MarketAsset } from "@/lib/market-data/types";

const assets = industryCompanies(marketThemes[0]);
const range = { from: "2026-09-01", to: "2026-09-10", interval: "1day" as const };
const prices = (asset: MarketAsset, gain: number) => [100, 100 + gain / 2, 100 + gain].map((close, i) => ({ assetId: asset.id, close, currency: asset.currency, date: [range.from, "2026-09-05", range.to][i], adjustedForSplits: true }));

test("full tracked universe contributes to Index 100, not just the original basket", () => {
  const histories = new Map(assets.map((asset, i) => [asset.id, prices(asset, i < 4 ? 0 : 18)]));
  const result = buildIndustryIndex(assets, histories, range, "equal");
  expect(result.status).toBe("complete");
  if (result.status !== "complete") throw new Error("missing index");
  expect(result.coverage).toBe(18);
  expect(result.partial).toBe(false);
  expect(result.returnPct).toBeCloseTo(14);
  expect(result.points[0].value).toBeCloseTo(100);
  expect(result.contributors.reduce((sum, row) => sum + row.contributionPctPoints, 0)).toBeCloseTo(result.returnPct);
});

test("fixed market-cap weights reveal a large-company move hidden by equal weights", () => {
  const subset = assets.slice(0, 2);
  const histories = new Map(subset.map((asset, i) => [asset.id, prices(asset, i ? -10 : 10)]));
  const caps = { [subset[0].symbol]: 900, [subset[1].symbol]: 100 };
  const equal = buildIndustryIndex(subset, histories, range, "equal", caps);
  const weighted = buildIndustryIndex(subset, histories, range, "capitalization", caps);
  if (equal.status !== "complete" || weighted.status !== "complete") throw new Error("missing index");
  expect(equal.returnPct).toBeCloseTo(0);
  expect(weighted.returnPct).toBeCloseTo(8);
  expect(weighted.contributors.reduce((sum, row) => sum + row.contributionPctPoints, 0)).toBeCloseTo(8);
});

test("missing history, boundary gaps and missing caps reduce explicit coverage without invented returns", () => {
  const histories = new Map(assets.slice(0, 3).map((asset) => [asset.id, prices(asset, 10)]));
  histories.set(assets[2].id, prices(assets[2], 20).slice(1).map((point, i) => i === 0 ? { ...point, date: "2026-09-06" } : point));
  const equal = buildIndustryIndex(assets, histories, range, "equal");
  expect(equal).toMatchObject({ status: "complete", coverage: 2, total: 18, partial: true });
  const weighted = buildIndustryIndex(assets, histories, range, "capitalization", { [assets[0].symbol]: 100 });
  expect(weighted).toMatchObject({ status: "complete", coverage: 1, total: 18, partial: true });
  expect(buildIndustryIndex(assets, histories, range, "capitalization")).toMatchObject({ status: "unavailable", coverage: 0 });
  expect(buildIndustryIndex(assets, new Map(), range, "equal").status).toBe("unavailable");
});

test("an interior missing date uses the observed intersection", () => {
  const subset = assets.slice(0, 2);
  const histories = new Map(subset.map((asset, i) => [asset.id, prices(asset, 10).filter((_, j) => i === 0 || j !== 1)]));
  const index = buildIndustryIndex(subset, histories, range, "equal");
  if (index.status !== "complete") throw new Error("missing index");
  expect(index.points.map((point) => point.date)).toEqual([range.from, range.to]);
});
