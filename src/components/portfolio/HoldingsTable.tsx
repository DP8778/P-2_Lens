import { useState } from "react";
import { ArrowUpRight, Plus, Search } from "lucide-react";
import type { HoldingMetric } from "@/lib/finance/portfolio-engine";
import { assetTypeLabels } from "@/data/mock/catalog";
import { money, percent, points, allocation } from "@/components/charts/chart-formatters";
export function HoldingsTable({
  holdings,
  locale,
  onSelect,
  onAdd,
  period,
}: {
  holdings: HoldingMetric[];
  locale: string;
  onSelect: (holding: HoldingMetric) => void;
  onAdd: () => void;
  period: string;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState("value");
  const filtered = holdings
    .filter(
      (p) =>
        `${p.asset.name} ${p.asset.symbol}`.toLowerCase().includes(query.toLowerCase()) &&
        (type === "all" || p.asset.type === type),
    )
    .sort((a, b) =>
      sort === "name"
        ? a.asset.name.localeCompare(b.asset.name)
        : sort === "contribution"
          ? b.contributionPctPoints - a.contributionPctPoints
          : b.marketValue - a.marketValue,
    );
  return (
    <section className="holdings-section" id="holdings" aria-labelledby="holdings-title">
      <header className="section-heading">
        <div>
          <h2 id="holdings-title">
            Pozice <span className="count-badge">{holdings.length}</span>
          </h2>
          <p>Vaše aktiva a jejich podíl na výsledku · {period}</p>
        </div>
        <button className="quiet-button" onClick={onAdd}>
          <Plus size={16} />
          Přidat aktivum
        </button>
      </header>
      <div className="holdings-filters">
        <label className="search-field">
          <Search size={16} />
          <input
            aria-label="Hledat pozici"
            placeholder="Hledat pozici"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select aria-label="Typ aktiva" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="all">Všechny typy</option>
          {Object.entries(assetTypeLabels).map(([key, value]) => (
            <option key={key} value={key}>
              {value}
            </option>
          ))}
        </select>
        <select aria-label="Řazení pozic" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="value">Hodnota ↓</option>
          <option value="contribution">Příspěvek ↓</option>
          <option value="name">Název A–Z</option>
        </select>
      </div>
      <div className="holdings-table-wrap surface">
        <table className="holdings-table">
          <thead>
            <tr>
              <th>Aktivum</th>
              <th>Hodnota</th>
              <th>Alokace</th>
              <th>Prům. cena</th>
              <th>P/L od nákupu</th>
              <th>Výnos období</th>
              <th>Příspěvek</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.assetId} onClick={() => onSelect(p)}>
                <td>
                  <button
                    className="holding-asset"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(p);
                    }}
                    aria-label={`Detail ${p.asset.symbol}`}
                  >
                    <span className={`asset-monogram ${p.asset.type}`}>
                      {p.asset.symbol.slice(0, 2)}
                    </span>
                    <span>
                      <strong>
                        {p.asset.symbol}
                        <ArrowUpRight size={12} />
                      </strong>
                      <small>{p.asset.name}</small>
                    </span>
                  </button>
                </td>
                <td data-label="Hodnota">{money(p.marketValue, locale)}</td>
                <td data-label="Alokace">
                  <span>{allocation(p.allocationPct, locale)}</span>
                  <div className="allocation-meter">
                    <i style={{ width: `${p.allocationPct}%` }} />
                  </div>
                </td>
                <td data-label="Prům. cena">{money(p.averageCostCzk, locale)}</td>
                <td data-label="P/L od nákupu" className={p.pnl >= 0 ? "positive" : "negative"}>
                  {p.pnl > 0 ? "+" : ""}
                  {money(p.pnl, locale)}
                  <small>{percent(p.pnlPct, locale)}</small>
                </td>
                {p.asset.type === "cash" ? (
                  <>
                    <td data-label="Výnos období" aria-label="Výnos období není pro hotovost relevantní">—</td>
                    <td data-label="Příspěvek" aria-label="Příspěvek není pro hotovost relevantní">—</td>
                  </>
                ) : (
                  <>
                    <td
                      data-label="Výnos období"
                      className={p.returnPct >= 0 ? "positive" : "negative"}
                    >
                      {percent(p.returnPct, locale)}
                    </td>
                    <td data-label="Příspěvek">{points(p.contributionPctPoints, locale)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && (
          <div className="empty-holdings">
            <h3>
              {holdings.length
                ? "Žádné odpovídající pozice"
                : "Vaše portfolio začíná prvním aktivem"}
            </h3>
            <p>
              {holdings.length
                ? "Upravte hledání nebo filtr."
                : "Vyberte akcii, ETF, kryptoměnu nebo hotovost."}
            </p>
            {!holdings.length && (
              <button className="primary-button" onClick={onAdd}>
                Přidat aktivum
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
