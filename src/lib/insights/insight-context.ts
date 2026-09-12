import type { PortfolioAnalysis } from "@/lib/finance/portfolio-engine";
import type { LensFacts } from "@/lib/finance/lens-facts";
import type { PortfolioContext } from "@/lib/validation/portfolioContext";
import {
  insightContextSchema,
  insightResponseSchema,
  type AiInsightWording,
  type InsightContext,
  type InsightEvidence,
  type InsightResponse,
} from "@/lib/validation/insightSchemas";
import { formatDate, formatPercent } from "@/lib/formatting/formatters";

const pp = (value: number) =>
  `${value.toLocaleString("cs-CZ", { maximumFractionDigits: 1, signDisplay: "exceptZero" })} p. b.`;
const czk = (value: number) =>
  new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(value);
const share = (value: number) =>
  `${value.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} %`;

const evidence = (
  id: string,
  label: string,
  metric: InsightEvidence["metric"],
  value: number,
  unit: InsightEvidence["unit"],
  options: Pick<InsightEvidence, "detail" | "action"> = {},
): InsightEvidence => ({
  id,
  label,
  metric,
  value,
  unit,
  source: "PortfolioAnalysis",
  ...options,
});

/** Selects verified facts for the current persistent analysis context. */
export function buildInsightContext(
  analysis: PortfolioAnalysis,
  analysisContext: PortfolioContext,
  facts: LensFacts,
): InsightContext {
  const selectedRange = analysisContext.selectedRange;
  const scope: InsightContext["scope"] = {
    type: selectedRange ? "range" : analysisContext.timeframe === "ALL" ? "overview" : "timeframe",
    label: selectedRange
      ? `${formatDate(facts.period.from)} — ${formatDate(facts.period.to)}`
      : analysisContext.timeframe,
    from: facts.period.from,
    to: facts.period.to,
  };
  const focus: InsightContext["focus"] = facts.selection.point
    ? { type: "point", label: formatDate(facts.selection.point.timestamp) }
    : facts.selection.asset
      ? { type: "asset", label: facts.selection.asset.symbol }
      : analysisContext.mode !== "performance"
        ? {
            type: "mode",
            label: analysisContext.mode === "contribution" ? "Příspěvky" : "Poklesy",
          }
        : { type: "overview", label: "Portfolio" };
  const items: InsightEvidence[] = [
    evidence(
      "portfolio-return",
      "Výnos portfolia",
      "portfolioReturn",
      facts.portfolio.returnPct,
      "percent",
    ),
    evidence(
      "portfolio-value",
      "Hodnota portfolia",
      "portfolioValue",
      facts.portfolio.endValue,
      "CZK",
    ),
  ];
  if (analysisContext.showBenchmark) {
    items.push(
      evidence(
        "benchmark-return",
        facts.benchmark.name,
        "benchmarkReturn",
        facts.benchmark.returnPct,
        "percent",
        { action: { type: "showBenchmark" } },
      ),
      evidence(
        "benchmark-delta",
        `Rozdíl proti ${facts.benchmark.name}`,
        "benchmarkDelta",
        facts.benchmark.deltaPct,
        "percentage-point",
        { action: { type: "showBenchmark" } },
      ),
    );
  }
  const addContribution = (item: typeof facts.contribution.topContributor, id: string) => {
    if (!item) return;
    items.push(
      evidence(id, item.symbol, "assetContribution", item.contributionPctPoints, "percentage-point", {
        detail: "Příspěvek k výnosu",
        action: item.assetId ? { type: "selectAsset", assetId: item.assetId } : undefined,
      }),
    );
  };
  addContribution(facts.contribution.topContributor, "top-contributor");
  addContribution(facts.contribution.topDetractor, "top-detractor");
  if (Math.abs(facts.contribution.residualPctPoints) >= 0.1)
    items.push(
      evidence(
        "contribution-residual",
        "Ostatní efekt",
        "residual",
        facts.contribution.residualPctPoints,
        "percentage-point",
        { detail: "Timing, poplatky, cash-flow a skládání" },
      ),
    );
  items.push(
    evidence("max-drawdown", "Maximální pokles", "maxDrawdown", facts.risk.maxDrawdownPct, "percent", {
      detail: facts.risk.troughDate ? `Dno ${formatDate(facts.risk.troughDate)}` : undefined,
      action: facts.risk.troughDate
        ? { type: "selectDrawdown", timestamp: facts.risk.troughDate }
        : undefined,
    }),
  );
  if (facts.exposure.largestPositionSymbol)
    items.push(
      evidence(
        "largest-position",
        `Největší pozice · ${facts.exposure.largestPositionSymbol}`,
        "largestPosition",
        facts.exposure.largestPositionPct,
        "percent",
      ),
    );
  if (facts.selection.asset) {
    const asset = facts.selection.asset;
    items.push(
      evidence("selected-asset-return", `${asset.symbol} · výnos`, "assetReturn", asset.returnPct, "percent", {
        action: { type: "selectAsset", assetId: asset.assetId },
      }),
      evidence(
        "selected-asset-contribution",
        `${asset.symbol} · příspěvek`,
        "assetContribution",
        asset.contributionPctPoints,
        "percentage-point",
        { action: { type: "selectAsset", assetId: asset.assetId } },
      ),
      evidence(
        "selected-asset-allocation",
        `${asset.symbol} · současná alokace`,
        "assetAllocation",
        asset.currentAllocationPct,
        "percent",
        { action: { type: "selectAsset", assetId: asset.assetId } },
      ));
  }
  if (facts.selection.point) {
    items.push(
      evidence(
        "selected-point-value",
        `Hodnota ${formatDate(facts.selection.point.timestamp)}`,
        "portfolioValue",
        facts.selection.point.value,
        "CZK",
        { detail: "Vybraný bod grafu" },
      ),
      evidence(
        "selected-point-drawdown",
        "Pokles ve vybraném bodě",
        "currentDrawdown",
        facts.selection.point.drawdownPct,
        "percent",
      ),
    );
  }
  const limitations = [
    ...(facts.dataQuality.estimated ? ["Analýza používá deterministická demo data."] : []),
    ...(facts.dataQuality.missingPriceAssetIds.length
      ? [`Chybí cena pro: ${facts.dataQuality.missingPriceAssetIds.join(", ")}.`]
      : []),
    ...(!analysisContext.showBenchmark ? ["Srovnání s benchmarkem je vypnuté."] : []),
  ];
  // The analysis parameter deliberately stays at the trust boundary; only LensFacts supply values.
  void analysis;
  return insightContextSchema.parse({
    datasetVersion: "lens-demo-2026.09-v1",
    scope,
    focus,
    mode: analysisContext.mode,
    performance: {
      portfolioReturnPct: facts.portfolio.returnPct,
      portfolioValueCzk: facts.portfolio.endValue,
      benchmark: analysisContext.showBenchmark
        ? {
            symbol: facts.benchmark.name,
            returnPct: facts.benchmark.returnPct,
            deltaPctPoints: facts.benchmark.deltaPct,
          }
        : undefined,
    },
    drivers: {
      topContributor: facts.contribution.topContributor,
      topDetractor: facts.contribution.topDetractor,
      residualPctPoints: facts.contribution.residualPctPoints,
    },
    risk: {
      maxDrawdownPct: facts.risk.maxDrawdownPct,
      currentDrawdownPct: facts.risk.currentDrawdownPct,
      peakDate: facts.risk.peakDate,
      troughDate: facts.risk.troughDate,
      recoveryDate: facts.risk.recoveryDate,
      recoveryStatus: facts.risk.recoveryStatus,
      largestPosition: facts.exposure.largestPositionSymbol
        ? {
            symbol: facts.exposure.largestPositionSymbol,
            allocationPct: facts.exposure.largestPositionPct,
          }
        : undefined,
      top3Pct: facts.exposure.top3Pct,
      cashPct: facts.exposure.cashPct,
    },
    selection: facts.selection,
    evidence: items.slice(0, 12),
    limitations,
  });
}

const claim = (text: string, ...evidenceIds: string[]) => ({ text, evidenceIds });

/** Produces the complete product response without network or generative dependencies. */
export function buildDeterministicInsight(context: InsightContext): InsightResponse {
  const p = context.performance;
  const asset = context.selection.asset;
  const point = context.selection.point;
  const lead = context.drivers.topContributor;
  const drag = context.drivers.topDetractor;
  let headline =
    p.portfolioReturnPct >= 0
      ? `Růst${lead ? `, tažený ${lead.symbol}` : " portfolia"}`
      : `Pokles${drag ? `, nejvíce tlumený ${drag.symbol}` : " portfolia"}`;
  let summary = `Portfolio se v tomto rozsahu změnilo o ${formatPercent(p.portfolioReturnPct)}.`;
  const drivers = [] as InsightResponse["drivers"];
  const riskNotes = [] as InsightResponse["riskNotes"];

  if (p.benchmark) {
    summary += ` Proti ${p.benchmark.symbol} je rozdíl ${pp(p.benchmark.deltaPctPoints)}.`;
  }
  if (point) {
    headline = point.isTrough ? "Dno maximálního poklesu" : `Portfolio k ${formatDate(point.timestamp)}`;
    summary = `V tomto bodě mělo portfolio hodnotu ${czk(point.value)}, výnos od začátku rozsahu ${formatPercent(point.returnPct)} a pokles od průběžného maxima ${formatPercent(point.drawdownPct)}.`;
    if (point.benchmarkDeltaPct !== undefined)
      summary += ` Rozdíl proti benchmarku byl ${pp(point.benchmarkDeltaPct)}.`;
    riskNotes.push(
      claim(
        point.isTrough
          ? "Vybraný bod je dnem maximálního poklesu v tomto analytickém rozsahu."
          : "Vybraný bod popisuje stav k jednomu datu; nevysvětluje sám celý trend.",
        "selected-point-drawdown",
      ),
    );
  } else if (asset) {
    headline = `${asset.symbol} v kontextu portfolia`;
    summary = `${asset.symbol} se změnil o ${formatPercent(asset.returnPct)} a k výnosu portfolia přispěl ${pp(asset.contributionPctPoints)} Průměrná alokace byla ${share(asset.averageAllocationPct)}, současná ${share(asset.currentAllocationPct)}.`;
    drivers.push(
      claim(
        Math.abs(asset.returnPct) > Math.abs(asset.contributionPctPoints) * 3
          ? "Výnos aktiva a jeho dopad na portfolio se liší, protože contribution závisí také na velikosti a době držení pozice."
          : "Příspěvek spojuje výnos aktiva s jeho skutečnou vahou a dobou držení.",
        "selected-asset-return",
        "selected-asset-contribution",
      ),
    );
  } else if (context.mode === "contribution") {
    headline = lead ? `${lead.symbol} vysvětluje největší část růstu` : "Bez kladného přispěvatele";
    summary = `${lead ? `${lead.symbol} přispěl ${pp(lead.contributionPctPoints)} ` : ""}${drag ? `${drag.symbol} výsledek tlumil příspěvkem ${pp(drag.contributionPctPoints)}` : "Žádné aktivum nemělo záporný příspěvek."}`;
  } else if (context.mode === "drawdown") {
    headline = context.risk.maxDrawdownPct < 0 ? "Hloubka poklesu v kontextu" : "Období bez poklesu";
    summary = `Maximální pokles byl ${formatPercent(context.risk.maxDrawdownPct)}${context.risk.peakDate && context.risk.troughDate ? ` mezi ${formatDate(context.risk.peakDate)} a ${formatDate(context.risk.troughDate)}` : ""}.`;
    summary +=
      context.risk.recoveryStatus === "recovered" && context.risk.recoveryDate
        ? ` Předchozí maximum bylo obnoveno ${formatDate(context.risk.recoveryDate)}.`
        : context.risk.recoveryStatus === "unrecovered"
          ? " Portfolio se do konce rozsahu na předchozí maximum nevrátilo."
          : " Portfolio se nedostalo pod své průběžné maximum.";
  }

  if (!point && !asset) {
    if (lead)
      drivers.push(
        claim(`${lead.symbol} byl největší kladný přispěvatel: ${pp(lead.contributionPctPoints)}.`, "top-contributor"),
      );
    if (drag)
      drivers.push(
        claim(`${drag.symbol} měl největší záporný příspěvek: ${pp(drag.contributionPctPoints)}.`, "top-detractor"),
      );
    if (Math.abs(context.drivers.residualPctPoints) >= 0.1)
      drivers.push(
        claim(
          `Ostatní efekt ${pp(context.drivers.residualPctPoints)} zachycuje timing, poplatky, cash-flow a skládání výnosů.`,
          "contribution-residual",
        ),
      );
  }
  if (!point) {
    riskNotes.push(
      claim(`Maximální pokles ve zvoleném rozsahu byl ${formatPercent(context.risk.maxDrawdownPct)}.`, "max-drawdown"),
    );
    if (context.risk.largestPosition)
      riskNotes.push(
        claim(
          `${context.risk.largestPosition.symbol} tvoří ${share(context.risk.largestPosition.allocationPct)} současné hodnoty portfolia.`,
          "largest-position",
        ),
      );
  }
  const relevantIds = new Set(
    [...drivers, ...riskNotes].flatMap((item) => item.evidenceIds),
  );
  if (point) {
    relevantIds.add("selected-point-value");
    relevantIds.add("selected-point-drawdown");
  }
  if (asset) {
    relevantIds.add("selected-asset-return");
    relevantIds.add("selected-asset-contribution");
    relevantIds.add("selected-asset-allocation");
  }
  relevantIds.add("portfolio-return");
  if (p.benchmark) relevantIds.add("benchmark-delta");
  return insightResponseSchema.parse({
    scopeLabel: context.scope.label,
    headline,
    summary,
    drivers,
    riskNotes,
    evidence: context.evidence.filter((item) => relevantIds.has(item.id)).slice(0, 8),
    limitations: context.limitations.slice(0, 3),
    mode: "deterministic",
  });
}

/** Keeps all computed evidence server-owned while accepting AI wording only. */
export function mergeAiWording(
  context: InsightContext,
  wording: AiInsightWording,
): InsightResponse {
  const fallback = buildDeterministicInsight(context);
  const validIds = new Set(context.evidence.map((item) => item.id));
  const containsNumber = (value: string) => /\d/.test(value);
  const validateClaims = (claims: AiInsightWording["drivers"]) =>
    claims.filter(
      (item) =>
        !containsNumber(item.text) &&
        item.evidenceIds.length > 0 &&
        item.evidenceIds.every((id) => validIds.has(id)),
    );
  return insightResponseSchema.parse({
    ...fallback,
    headline: containsNumber(wording.headline) ? fallback.headline : wording.headline,
    summary: containsNumber(wording.summary) ? fallback.summary : wording.summary,
    drivers: validateClaims(wording.drivers).length
      ? validateClaims(wording.drivers)
      : fallback.drivers,
    riskNotes: validateClaims(wording.riskNotes).length
      ? validateClaims(wording.riskNotes)
      : fallback.riskNotes,
    limitations: [
      ...new Set([
        ...context.limitations,
        ...wording.limitations.filter((item) => !containsNumber(item)),
      ]),
    ].slice(0, 3),
    mode: "ai",
  });
}

export function shouldAcceptInsightResponse(activeKey: string, responseKey: string) {
  return activeKey === responseKey;
}
