import { marketThemes } from "@/data/market-themes";
import { industryCompanies } from "@/data/market-industries";
import { buildIndustryIndex } from "@/lib/finance/industry-index";
import { buildIndustryOverview, industryMapData } from "@/lib/finance/industry-overview";
import { comparableIndustryIndices, interpretIndustryPulse } from "@/lib/finance/industry-pulse";

const assets = industryCompanies(marketThemes[0]);
const range = { from: "2026-09-01", to: "2026-09-25", interval: "1day" as const };
function fixture(returns: number[], caps = Object.fromEntries(assets.map((a) => [a.symbol, 100]))) {
  const histories = new Map(assets.slice(0, returns.length).map((asset, i) => [asset.id, [range.from, range.to].map((date, j) => ({ assetId: asset.id, date, close: j ? 100 + returns[i] : 100, currency: "USD", adjustedForSplits: true }))]));
  return { equal: buildIndustryIndex(assets, histories, range, "equal"), weighted: buildIndustryIndex(assets, histories, range, "capitalization", caps), overview: buildIndustryOverview(assets, assets, histories, range, caps) };
}
test("low coverage and stale histories cannot produce a confident interpretation", () => {
  const partial = fixture([10, 10]);
  expect(interpretIndustryPulse(partial.equal, partial.weighted, partial.overview).kind).toBe("insufficient");
  const full = fixture(assets.map(() => 10));
  expect(interpretIndustryPulse(full.equal, full.weighted, full.overview, 70, true).kind).toBe("insufficient");
  expect(interpretIndustryPulse(full.equal, full.weighted, full.overview).kind).toBe("broad-positive");
  const negative = fixture(assets.map(() => -10));
  expect(interpretIndustryPulse(negative.equal, negative.weighted, negative.overview).kind).toBe("broad-negative");
});
test("cohort and observed date differences disallow a shared chart and concentration claim", () => {
  const f = fixture(assets.map(() => 10), { [assets[0].symbol]: 100 });
  expect(comparableIndustryIndices(f.equal, f.weighted)).toBe(false);
  expect(interpretIndustryPulse(f.equal, f.weighted, f.overview).kind).toBe("different-cohorts");
  const full = fixture(assets.map(() => 10));
  if (full.weighted.status !== "complete") throw Error("fixture");
  const shifted = { ...full.weighted, points: full.weighted.points.map((p, i) => i === 0 ? { ...p, date: "2026-09-02" } : p) };
  expect(comparableIndustryIndices(full.equal, shifted)).toBe(false);
});
test("cap weighting and participation distinguish a narrow move from large-company leadership", () => {
  const caps = Object.fromEntries(assets.map((asset, i) => [asset.symbol, i === 0 ? 10000 : 100]));
  const narrow = fixture(assets.map((_, i) => i === 0 ? 20 : -1), caps);
  expect(interpretIndustryPulse(narrow.equal, narrow.weighted, narrow.overview, 99).kind).toBe("narrow-positive");
  const leading = fixture(assets.map((_, i) => i === 0 ? 20 : 1), caps);
  expect(interpretIndustryPulse(leading.equal, leading.weighted, leading.overview, 99).kind).toBe("large-leading");
});
test("treemap values are proportional to known capitalizations, excluding unknown and invalid caps", () => {
  const { overview } = fixture([], { [assets[0].symbol]: 900, [assets[1].symbol]: 100 });
  const data = industryMapData(overview);
  expect(data.data.map((d) => d.value)).toEqual([900, 100]);
  expect(data.data.map((d) => d.sharePct)).toEqual([90, 10]);
  expect(data.missing).toBe(16);
  expect(industryMapData({ ...overview, rows: overview.rows.map((r) => ({ ...r, marketCap: NaN })) }).data).toEqual([]);
});
