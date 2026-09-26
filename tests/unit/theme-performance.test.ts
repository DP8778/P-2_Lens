import { buildThemePerformance, themeHistoryRange } from "@/lib/finance/theme-performance";
import { marketThemes } from "@/data/market-themes";
import type { MarketPricePoint } from "@/lib/market-data/types";

const assets = marketThemes[0].constituents;
const range = { from: "2026-09-21", to: "2026-09-23", interval: "1day" as const };
const histories = () => new Map(assets.map((asset, index) => [asset.id, [100, 100 + index * 5, 90 + index * 10].map((close, day) => ({ assetId: asset.id, date: `2026-09-${21 + day}`, close: close * (index + 1), currency: "USD", adjustedForSplits: true }))]));

test("equal starting weights normalize disparate prices to 100 and rank period returns", () => {
  const result = buildThemePerformance(assets, histories(), range);
  expect(result.status).toBe("complete");
  if (result.status !== "complete") throw new Error("Expected complete series");
  expect(result.points[0].value).toBe(100);
  expect(result.points.at(-1)!.value).toBeCloseTo(105);
  expect(result.returnPct).toBeCloseTo(5);
  expect(result.positive).toBe(2);
  expect(result.leaders.map((item) => item.asset.symbol)).toEqual(["GOOGL", "MSFT"]);
  expect(result.laggards.map((item) => item.asset.symbol)).toEqual(["NVDA", "PLTR"]);
});

test.each(["missing", "gap", "zero", "nan", "duplicate", "currency", "identity"])("never computes performance from %s history", (reason) => {
  const data = histories();
  const points = data.get(assets[0].id)!;
  if (reason === "missing") data.delete(assets[0].id);
  if (reason === "gap") points.splice(1, 1);
  if (reason === "zero") points[0].close = 0;
  if (reason === "nan") points[0].close = NaN;
  if (reason === "duplicate") points.push(points[0]);
  if (reason === "currency") points[0].currency = "EUR";
  if (reason === "identity") points[0].assetId = "other";
  const result = buildThemePerformance(assets, data, range);
  expect(result.status).toBe("partial");
  expect(result).not.toHaveProperty("returnPct");
  expect(result).not.toHaveProperty("points");
});

test("rejects histories truncated equally for all constituents", () => {
  expect(buildThemePerformance(assets, histories(), { ...range, from: "2026-08-01" }).status).toBe("partial");
  expect(buildThemePerformance(assets, histories(), { ...range, to: "2026-10-01" }).status).toBe("partial");
  const data = new Map<string, MarketPricePoint[]>([...histories()].map(([id, points]) => [id, [points[0], { ...points[2], date: "2026-09-30" }]]));
  expect(buildThemePerformance(assets, data, { ...range, to: "2026-09-30" }).status).toBe("partial");
});

test("accepts weekend boundaries, sorts prices and excludes out-of-range points", () => {
  const data = histories();
  data.forEach((points) => { points.push({ ...points[0], date: "2026-09-01", close: 1 }); points.reverse(); });
  const result = buildThemePerformance(assets, data, { ...range, from: "2026-09-19" });
  expect(result.status).toBe("complete");
  if (result.status === "complete") expect(result.points[0]).toEqual({ date: "2026-09-21", value: 100 });
});

test.each([['1W', '2026-09-18'], ['1M', '2026-08-26'], ['3M', '2026-06-27'], ['1Y', '2025-09-25']] as const)("%s uses completed daily closes and a deterministic range", (period, from) => {
  expect(themeHistoryRange(period, new Date("2026-09-26T12:00:00Z"))).toEqual({ from, to: "2026-09-25", interval: "1day" });
});
