import { buildThemePerformance, themeHistoryRange } from "@/lib/finance/theme-performance";
import { marketThemes } from "@/data/market-themes";

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

test.each(["missing", "zero", "nan", "duplicate", "currency", "identity"])("never computes performance from %s history", (reason) => {
  const data = histories();
  const points = data.get(assets[0].id)!;
  if (reason === "missing") data.delete(assets[0].id);
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


test("one missing interior date uses common dates without changing endpoint performance", () => {
  const data = histories();
  data.get(assets[0].id)!.splice(1, 1);
  const result = buildThemePerformance(assets, data, range);
  expect(result.status).toBe("complete");
  if (result.status !== "complete") throw new Error("Expected complete series");
  expect(result.points).toEqual([{ date: range.from, value: 100 }, { date: range.to, value: 105 }]);
  expect(result.returnPct).toBeCloseTo(5);
});

test("normalizes every constituent on the first common date", () => {
  const data = histories();
  data.get(assets[0].id)!.shift();
  const result = buildThemePerformance(assets, data, range);
  expect(result.status).toBe("complete");
  if (result.status !== "complete") throw new Error("Expected complete series");
  expect(result.points[0]).toEqual({ date: "2026-09-22", value: 100 });
  expect(result.returnPct).toBeCloseTo((90 / 100 + 100 / 105 + 110 / 110 + 120 / 115) * 25 - 100);
});

test.each(["start", "end"])("a constituent missing %s coverage remains partial", (boundary) => {
  const data = histories();
  const longerRange = { ...range, from: "2026-09-10", to: "2026-09-30" };
  data.forEach((points, id) => {
    if (id !== assets[0].id || boundary !== "start") points.unshift({ ...points[0], date: longerRange.from });
    if (id !== assets[0].id || boundary !== "end") points.push({ ...points.at(-1)!, date: longerRange.to });
  });
  expect(buildThemePerformance(assets, data, longerRange).status).toBe("partial");
});

test("requires at least two common dates even if each history has two prices", () => {
  const data = histories();
  data.get(assets[0].id)!.shift();
  data.get(assets[1].id)!.pop();
  expect(buildThemePerformance(assets, data, range).status).toBe("partial");
});
