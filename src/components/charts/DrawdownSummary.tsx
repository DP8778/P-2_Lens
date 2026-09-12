import type { PortfolioAnalysis } from "@/lib/finance/portfolio-engine";
import { dateLabel, percent } from "./chart-formatters";

export function DrawdownSummary({ analysis, locale }: { analysis: PortfolioAnalysis; locale: string }) {
  const d = analysis.drawdown;
  const status =
    d.status === "no-drawdown"
      ? "Bez poklesu"
      : d.status === "recovered"
        ? `Obnoveno za ${d.recoveryDays} dní`
        : "Dosud neobnoveno";
  return (
    <dl className="drawdown-summary" aria-label="Souhrn poklesu od maxima">
      <div><dt>Max. pokles</dt><dd>{percent(d.maxDrawdown, locale)}</dd></div>
      <div><dt>Aktuální pokles</dt><dd>{percent(d.currentDrawdown, locale)}</dd></div>
      {d.peak && <div><dt>Vrchol</dt><dd>{dateLabel(d.peak.date, locale)}</dd></div>}
      {d.trough && <div><dt>Dno</dt><dd>{dateLabel(d.trough.date, locale)}</dd></div>}
      <div><dt>Obnova</dt><dd>{status}</dd></div>
    </dl>
  );
}
