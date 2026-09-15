import { useMemo, useState } from "react";
import { ArrowUpRight, ListFilter, Plus, Search } from "lucide-react";
import type { HoldingMetric, PortfolioAnalysis } from "@/lib/finance/portfolio-engine";
import { assetTypeLabels } from "@/data/mock/catalog";
import { money, percent, points, allocation } from "@/components/charts/chart-formatters";
import { ConcentrationPanel } from "./ConcentrationPanel";

type SortMetric = "value" | "allocation" | "pnl" | "return" | "contribution";
const sortLabels: Record<SortMetric, string> = {
  value: "Hodnota",
  allocation: "Alokace",
  pnl: "P/L",
  return: "Výnos období",
  contribution: "Příspěvek",
};

export function HoldingsTable({
  analysis,
  holdings,
  locale,
  onSelect,
  onAdd,
  period,
  editable = true,
}: {
  analysis: PortfolioAnalysis;
  holdings: HoldingMetric[];
  locale: string;
  onSelect: (holding: HoldingMetric) => void;
  onAdd: () => void;
  period: string;
  editable?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [currency, setCurrency] = useState("all");
  const [sort, setSort] = useState<SortMetric>("value");
  const [descending, setDescending] = useState(true);
  const scalable = holdings.length >= 10;
  const currencies = [...new Set(holdings.map((holding) => holding.asset.currency))].sort();
  const filtered = useMemo(
    () =>
      holdings
        .filter(
          (holding) =>
            `${holding.asset.name} ${holding.asset.symbol}`
              .toLowerCase()
              .includes(query.toLowerCase()) &&
            (type === "all" || holding.asset.type === type) &&
            (currency === "all" || holding.asset.currency === currency),
        )
        .sort((a, b) => {
          const metric = (holding: HoldingMetric) =>
            sort === "allocation"
              ? holding.allocationPct
              : sort === "pnl"
                ? holding.pnl
                : sort === "return"
                  ? holding.returnPct
                  : sort === "contribution"
                    ? holding.contributionPctPoints
                    : holding.marketValue;
          return (metric(b) - metric(a)) * (descending ? 1 : -1);
        }),
    [currency, descending, holdings, query, sort, type],
  );
  const sortValue = `${sort}:${descending ? "desc" : "asc"}`;

  return (
    <section className="holdings-section" id="holdings" aria-labelledby="holdings-title">
      <header className="section-heading">
        <div>
          <h2 id="holdings-title">
            Pozice <span className="count-badge">{holdings.length}</span>
          </h2>
          <p>Aktiva a jejich podíl na výsledku · {period}</p>
        </div>
        {editable && (
          <button className="quiet-button" onClick={onAdd}>
            <Plus size={16} />
            Přidat investici
          </button>
        )}
      </header>

      <div className={`holdings-toolbar ${scalable ? "is-scalable" : "is-compact"}`}>
        {scalable && (
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="Hledat pozici"
              placeholder="Hledat pozici"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        )}
        <select
          aria-label="Řazení pozic"
          value={sortValue}
          onChange={(event) => {
            const [metric, direction] = event.target.value.split(":") as [SortMetric, "asc" | "desc"];
            setSort(metric);
            setDescending(direction === "desc");
          }}
        >
          {Object.entries(sortLabels).flatMap(([metric, label]) => [
            <option key={`${metric}:desc`} value={`${metric}:desc`}>{label} ↓</option>,
            <option key={`${metric}:asc`} value={`${metric}:asc`}>{label} ↑</option>,
          ])}
        </select>
        <details className="holdings-concentration">
          <summary>Koncentrace</summary>
          <ConcentrationPanel analysis={analysis} locale={locale} compact />
        </details>
        {scalable && (
          <details className="holdings-filter-disclosure">
            <summary><ListFilter size={15} />Filtry</summary>
            <div className="holdings-filter-panel surface">
              <label className="mobile-holdings-sort">
                Řazení
                <select
                  aria-label="Řazení pozic na mobilu"
                  value={sortValue}
                  onChange={(event) => {
                    const [metric, direction] = event.target.value.split(":") as [SortMetric, "asc" | "desc"];
                    setSort(metric);
                    setDescending(direction === "desc");
                  }}
                >
                  {Object.entries(sortLabels).flatMap(([metric, label]) => [
                    <option key={`${metric}:desc`} value={`${metric}:desc`}>{label} ↓</option>,
                    <option key={`${metric}:asc`} value={`${metric}:asc`}>{label} ↑</option>,
                  ])}
                </select>
              </label>
              <label>
                Typ
                <select aria-label="Typ aktiva" value={type} onChange={(event) => setType(event.target.value)}>
                  <option value="all">Všechny typy</option>
                  {Object.entries(assetTypeLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
                </select>
              </label>
              <label>
                Měna
                <select aria-label="Měna instrumentu" value={currency} onChange={(event) => setCurrency(event.target.value)}>
                  <option value="all">Všechny měny</option>
                  {currencies.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
            </div>
          </details>
        )}
      </div>

      <div className="holdings-table-wrap">
        <table className="holdings-table">
          <thead>
            <tr>
              <th>Aktivum</th>
              <th>Hodnota</th>
              <th>Alokace</th>
              <th>P/L od nákupu</th>
              <th>Výnos období</th>
              <th>Příspěvek</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((holding) => (
              <tr key={holding.assetId}>
                <td>
                  <button className="holding-asset" onClick={() => onSelect(holding)} aria-label={`Detail ${holding.asset.symbol}`}>
                    <span className={`asset-monogram ${holding.asset.type}`}>{holding.asset.symbol.slice(0, 2)}</span>
                    <span>
                      <strong>{holding.asset.symbol}<ArrowUpRight size={12} /></strong>
                      <small>{holding.asset.name}</small>
                    </span>
                  </button>
                </td>
                <td data-label="Hodnota">{money(holding.marketValue, locale)}</td>
                <td data-label="Alokace">
                  <span>{allocation(holding.allocationPct, locale)}</span>
                  <div className="allocation-meter"><i style={{ width: `${holding.allocationPct}%` }} /></div>
                </td>
                <td data-label="P/L" className={holding.pnl >= 0 ? "positive" : "negative"}>
                  {holding.pnl > 0 ? "+" : ""}{money(holding.pnl, locale)}
                  <small>{percent(holding.pnlPct, locale)}</small>
                </td>
                {holding.asset.type === "cash" ? (
                  <>
                    <td data-label="Výnos období" aria-label="Výnos období není pro hotovost relevantní">—</td>
                    <td data-label="Příspěvek" aria-label="Příspěvek není pro hotovost relevantní">—</td>
                  </>
                ) : (
                  <>
                    <td data-label="Výnos období" className={holding.returnPct >= 0 ? "positive" : "negative"}>{percent(holding.returnPct, locale)}</td>
                    <td data-label="Příspěvek" className={holding.contributionPctPoints >= 0 ? "positive" : "negative"}>{points(holding.contributionPctPoints, locale)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <p className="holdings-empty" role="status">Žádná pozice neodpovídá zvolenému hledání a filtrům.</p>}
      </div>
    </section>
  );
}
