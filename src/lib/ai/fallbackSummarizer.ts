import type { InsightInput, InsightOutput } from "@/lib/validation/insightSchemas";

const pct = (value: number) =>
  `${value >= 0 ? "+" : ""}${value.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} %`;
const pp = (value: number) =>
  `${value >= 0 ? "+" : ""}${value.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} p. b.`;

export function buildFallbackInsight(input: InsightInput): InsightOutput {
  const lead = input.contributors[0];
  const drag = input.detractors[0];
  const direction = input.portfolio.returnPct >= 0 ? "vzrostlo" : "kleslo";
  return {
    headline: `Portfolio za ${input.period.label} ${direction} o ${Math.abs(input.portfolio.returnPct).toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} %`,
    summary: `Rozdíl proti zvolenému benchmarku je ${pp(input.benchmark.deltaPct)}. ${lead ? `Největším pozitivním příspěvkem byl ${lead.symbol}.` : "Pro období nejsou dostupní pozitivní přispěvatelé."}`,
    drivers: lead
      ? [
          {
            title: `${lead.symbol} táhl výsledek`,
            explanation: `${lead.symbol} byl největším pozitivním přispěvatelem vybraného období.`,
            metricReference: `${lead.symbol} contribution: ${pp(lead.contributionPctPoints)}`,
          },
        ]
      : [],
    watchouts: [
      ...(drag
        ? [
            {
              title: `${drag.symbol} výsledek tlumil`,
              explanation: `${drag.symbol} měl největší záporný příspěvek.`,
              metricReference: `${drag.symbol} contribution: ${pp(drag.contributionPctPoints)}`,
            },
          ]
        : []),
      {
        title: "Koncentrace portfolia",
        explanation: `Největší pozice tvoří ${input.exposure.largestPositionPct.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} % portfolia.`,
        metricReference: `Largest position: ${pct(input.exposure.largestPositionPct)}`,
      },
    ],
    dataQualityNote: input.dataQuality.estimated
      ? "Analýza používá stabilní demonstrační data, nikoli živé tržní kotace."
      : "Analýza vychází z dodaných strukturovaných metrik.",
    disclaimer: "Toto vysvětlení není investičním doporučením.",
  };
}
