import {
  buildAnalysis,
  initialTransactions,
  timeframeRange,
  timeline,
} from "@/lib/finance/portfolio-engine";
import { toLensFacts } from "@/lib/finance/lens-facts";
import {
  buildDeterministicInsight,
  buildInsightContext,
  mergeAiWording,
  shouldAcceptInsightResponse,
} from "@/lib/insights/insight-context";
import { insightContextSchema, insightResponseSchema } from "@/lib/validation/insightSchemas";
import type { PortfolioContext } from "@/lib/validation/portfolioContext";

const baseInput: PortfolioContext = {
  transactions: initialTransactions,
  selectedRange: null,
  timeframe: "1M",
  benchmarkId: "spy",
  compareAssetId: "",
  mode: "performance",
  showBenchmark: true,
  selectedPoint: null,
};

const makeContext = (
  input: PortfolioContext = baseInput,
  range: [number, number] = timeframeRange("1M"),
) => {
  const analysis = buildAnalysis(
    initialTransactions,
    range,
    input.benchmarkId,
    input.compareAssetId,
    input.selectedPoint,
  );
  return buildInsightContext(
    analysis,
    input,
    toLensFacts(analysis, input.timeframe === "CUSTOM" ? "ALL" : input.timeframe, {
      mode: input.mode,
      benchmarkVisible: input.showBenchmark,
    }),
  );
};

describe("contextual Lens Insight", () => {
  test("builds a schema-valid default context and deterministic fallback", () => {
    const context = makeContext();
    const response = buildDeterministicInsight(context);
    expect(context.scope.type).toBe("timeframe");
    expect(context.focus.type).toBe("overview");
    expect(insightResponseSchema.safeParse(response).success).toBe(true);
    expect(response.summary).toContain("SPY");
  });

  test("prioritizes selected range as analytical scope", () => {
    const input = {
      ...baseInput,
      selectedRange: [timeline[710], timeline[720]] as [string, string],
    };
    const context = makeContext(input, [710, 720]);
    expect(context.scope).toMatchObject({ type: "range", from: timeline[710], to: timeline[720] });
    expect(buildDeterministicInsight(context).scopeLabel).toContain("2026");
  });

  test("explains selected asset return, contribution and allocation", () => {
    const context = makeContext({ ...baseInput, compareAssetId: "btc" });
    const response = buildDeterministicInsight(context);
    expect(context.focus).toMatchObject({ type: "asset", label: "BTC" });
    expect(response.headline).toContain("BTC");
    expect(response.evidence.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "selected-asset-return",
        "selected-asset-contribution",
        "selected-asset-allocation",
      ]),
    );
  });

  test("treats a selected point as a dated state, including a verified trough", () => {
    const baseline = makeContext({ ...baseInput, mode: "drawdown" });
    const trough = baseline.risk.troughDate!;
    const context = makeContext({ ...baseInput, mode: "drawdown", selectedPoint: trough });
    const response = buildDeterministicInsight(context);
    expect(context.focus.type).toBe("point");
    expect(context.selection.point?.isTrough).toBe(true);
    expect(response.headline).toContain("Dno");
  });

  test("focuses Contribution on drivers and a significant residual", () => {
    const base = makeContext({ ...baseInput, mode: "contribution" });
    const context = insightContextSchema.parse({
      ...base,
      drivers: { ...base.drivers, residualPctPoints: 0.7 },
      evidence: [
        ...base.evidence.filter((item) => item.id !== "contribution-residual"),
        {
          id: "contribution-residual",
          label: "Ostatní efekt",
          metric: "residual",
          value: 0.7,
          unit: "percentage-point",
          source: "PortfolioAnalysis",
        },
      ],
    });
    const response = buildDeterministicInsight(context);
    expect(response.drivers.some((item) => item.evidenceIds.includes("top-contributor"))).toBe(true);
    expect(response.drivers.some((item) => item.evidenceIds.includes("contribution-residual"))).toBe(
      true,
    );
  });

  test("describes drawdown and unrecovered status factually", () => {
    const base = makeContext({ ...baseInput, mode: "drawdown" });
    const context = insightContextSchema.parse({
      ...base,
      risk: { ...base.risk, recoveryStatus: "unrecovered", recoveryDate: undefined },
    });
    const response = buildDeterministicInsight(context);
    expect(response.summary).toContain("nevrátilo");
    expect(response.evidence.some((item) => item.metric === "maxDrawdown")).toBe(true);
  });

  test("omits benchmark claims when comparison is unavailable", () => {
    const context = makeContext({ ...baseInput, showBenchmark: false });
    const response = buildDeterministicInsight(context);
    expect(context.performance.benchmark).toBeUndefined();
    expect(response.evidence.some((item) => item.metric === "benchmarkDelta")).toBe(false);
    expect(response.summary).not.toContain("SPY");
  });

  test("rejects stale response identity", () => {
    expect(shouldAcceptInsightResponse("btc", "btc")).toBe(true);
    expect(shouldAcceptInsightResponse("nvda", "btc")).toBe(false);
  });

  test("does not accept AI numeric claims or unknown evidence", () => {
    const context = makeContext();
    const response = mergeAiWording(context, {
      headline: "Výnos byl 999 %",
      summary: "Portfolio získalo 999 %.",
      drivers: [{ text: "Neověřený fakt 999", evidenceIds: ["missing"] }],
      riskNotes: [],
      limitations: [],
    });
    expect(response.headline).not.toContain("999");
    expect(response.summary).not.toContain("999");
    expect(response.evidence).toEqual(buildDeterministicInsight(context).evidence);
  });
});
