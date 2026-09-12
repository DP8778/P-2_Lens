import type { PortfolioAnalysis } from "@/lib/finance/portfolio-engine";
import { money, percent, points, allocation } from "@/components/charts/chart-formatters";
export function PortfolioSummary({
  analysis,
  locale,
  period,
  showBenchmark,
}: {
  analysis: PortfolioAnalysis;
  locale: string;
  period: string;
  showBenchmark: boolean;
}) {
  const m = analysis.metrics;
  const lead = m.topContributors[0];
  return (
    <section className="portfolio-summary" aria-label="Hlavní metriky">
      <div className="summary-primary">
        <p>
          Hodnota portfolia <span className="currency-tag">CZK</span>
        </p>
        <h1 data-testid="portfolio-value">{money(m.endValue, locale)}</h1>
        <div className="summary-return">
          <strong className={m.returnPct >= 0 ? "positive" : "negative"}>
            {m.returnPct >= 0 ? "↗" : "↘"} {percent(m.returnPct, locale)}
          </strong>
          <span>
            {m.absolutePnl > 0 ? "+" : ""}
            {money(m.absolutePnl, locale)}
          </span>
          <small>za {period}</small>
        </div>
      </div>
      <dl className="summary-context">
        {showBenchmark && (
          <div>
            <dt>Proti {analysis.benchmark}</dt>
            <dd>{points(m.benchmarkDeltaPct, locale)}</dd>
            <small>Rozdíl ve výnosu</small>
          </div>
        )}
        <div>
          <dt>Maximální pokles</dt>
          <dd>{percent(m.maxDrawdownPct, locale)}</dd>
          <small>Od předchozího maxima</small>
        </div>
        <div>
          <dt>Největší pozice</dt>
          <dd>{allocation(m.largestPositionPct, locale)}</dd>
          <small>{analysis.holdings[0]?.asset.symbol ?? "Žádné pozice"}</small>
        </div>
        {lead && (
          <div>
            <dt>Hlavní přispěvatel</dt>
            <dd>
              {lead.symbol} <span>{points(lead.contributionPctPoints, locale)}</span>
            </dd>
            <small>Příspěvek k výnosu</small>
          </div>
        )}
      </dl>
    </section>
  );
}
