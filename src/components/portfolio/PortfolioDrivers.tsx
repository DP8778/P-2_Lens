import type { PortfolioAnalysis } from "@/lib/finance/portfolio-engine";
import { allocation, points } from "@/components/charts/chart-formatters";
export function PortfolioDrivers({
  analysis,
  locale,
}: {
  analysis: PortfolioAnalysis;
  locale: string;
}) {
  const drivers = [
    ...analysis.metrics.topContributors.slice(0, 2),
    ...analysis.metrics.topDetractors.slice(0, 1),
  ];
  return (
    <section className="portfolio-drivers">
      <div>
        <h2>Co tvoří výsledek</h2>
        <div className="driver-list">
          {drivers.length ? (
            drivers.map((p) => (
              <div key={p.symbol}>
                <span className="driver-arrow">{p.contributionPctPoints >= 0 ? "↗" : "↘"}</span>
                <span>
                  <strong>{p.symbol}</strong>
                  <small>
                    {p.contributionPctPoints >= 0 ? "Přispívá k růstu" : "Tlumí výsledek"}
                  </small>
                </span>
                <b className={p.contributionPctPoints >= 0 ? "positive" : "negative"}>
                  {points(p.contributionPctPoints, locale)}
                </b>
              </div>
            ))
          ) : (
            <p className="tertiary">Pro zvolené období není žádný příspěvek.</p>
          )}
        </div>
      </div>
      <div>
        <h2>Rozložení portfolia</h2>
        <div
          className="allocation-strip"
          role="img"
          aria-label={analysis.holdings
            .map((p) => `${p.asset.symbol}: ${allocation(p.allocationPct, locale)}`)
            .join(", ")}
        >
          {analysis.holdings.map((p, i) => (
            <span
              key={p.assetId}
              style={{ flex: p.allocationPct, background: `hsl(230 7% ${76 - (i % 6) * 10}%)` }}
            />
          ))}
        </div>
        <div className="allocation-labels">
          {analysis.holdings.map((p) => (
            <span key={p.assetId}>
              <strong>{p.asset.symbol}</strong>
              {allocation(p.allocationPct, locale)}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
