import type { PortfolioAnalysis } from "@/lib/finance/portfolio-engine";
import type { ContextInsight, PortfolioContext } from "@/lib/validation/portfolioContext";
import { formatPercent, formatDate } from "@/lib/formatting/formatters";
const pp = (value: number) =>
  `${value.toLocaleString("cs-CZ", { maximumFractionDigits: 1, signDisplay: "exceptZero" })} p. b.`;
export function contextualInsight(
  analysis: PortfolioAnalysis,
  input: PortfolioContext,
): ContextInsight {
  const m = analysis.metrics;
  const lead = m.topContributors[0];
  const drag = m.topDetractors[0];
  const point = input.selected === null ? undefined : analysis.points[input.selected];
  let headline =
    m.returnPct >= 0
      ? `Růst${lead ? `, tažený ${lead.symbol}` : " portfolia"}`
      : `Období poklesu${drag ? `, nejvíce přispěl ${drag.symbol}` : ""}`;
  let summary = `Portfolio se za vybrané období změnilo o ${formatPercent(m.returnPct)}.${input.showBenchmark ? ` Rozdíl proti ${analysis.benchmark} je ${pp(m.benchmarkDeltaPct)}.` : ""}`;
  if (input.mode === "contribution") {
    headline = lead ? `${lead.symbol} přispívá nejvíce` : "Žádné kladné příspěvky";
    summary = `${lead ? `${lead.symbol} přidal ${pp(lead.contributionPctPoints)} k výnosu portfolia. ` : ""}${drag ? `${drag.symbol} výsledek tlumil příspěvkem ${pp(drag.contributionPctPoints)}. ` : "Žádná pozice neměla záporný příspěvek. "}Součet příspěvků odpovídá výnosu celého portfolia.`;
  }
  if (input.mode === "drawdown") {
    headline = m.maxDrawdownPct < 0 ? "Pokles od maxima v kontextu" : "Období bez poklesu";
    summary = `Největší pokles dosáhl ${formatPercent(m.maxDrawdownPct)}${m.maxDrawdownPct < 0 ? ` dne ${formatDate(analysis.trough.timestamp)}` : ""}. ${m.maxDrawdownPct === 0 ? "Portfolio se ve vybraném období nedostalo pod své průběžné maximum." : analysis.recovery ? `Předchozí maximum znovu dosáhlo ${formatDate(analysis.recovery.timestamp)}.` : "Do konce vybraného období se na předchozí maximum nevrátilo."}`;
  }
  if (analysis.compare && input.mode === "performance") {
    headline = `${analysis.compare} a portfolio`;
    summary = `${analysis.compare} se změnil o ${formatPercent(analysis.points.at(-1)!.assetReturnPct)}, portfolio o ${formatPercent(m.returnPct)}. Obě řady začínají na indexu 100.${input.showBenchmark ? ` Rozdíl portfolia proti ${analysis.benchmark} je ${pp(m.benchmarkDeltaPct)}.` : ""}`;
  }
  if (point) {
    headline = formatDate(point.timestamp);
    summary = `V tomto bodě bylo portfolio ${formatPercent(point.portfolioReturnPct)} proti začátku období.${input.showBenchmark ? ` Rozdíl proti ${analysis.benchmark}: ${pp(point.benchmarkDeltaPct)}.` : ""}${analysis.compare ? ` ${analysis.compare}: ${formatPercent(point.assetReturnPct)}.` : ""}${input.mode === "drawdown" ? ` Pokles od průběžného maxima: ${formatPercent(point.drawdown)}.` : ""}`;
  }
  if (!analysis.holdings.length) {
    headline = "Prostor pro vaše první aktivum";
    summary = "Přidejte pozici a Lens propojí její vývoj, příspěvek a podíl na portfoliu.";
  }
  return {
    headline,
    summary,
    context: point
      ? "Vybraný bod"
      : `${input.timeframe === "CUSTOM" ? "Vlastní období" : input.timeframe} · ${formatDate(m.startDate)} — ${formatDate(m.endDate)}`,
    mode: "deterministic",
  };
}
