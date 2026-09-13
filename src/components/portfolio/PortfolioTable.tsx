"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AssetRow } from "@/components/portfolio/AssetRow";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { enrichedPositions } from "@/data/mock/assets";
import { getContributions } from "@/data/mock/portfolio";
import type { Locale } from "@/i18n/getDictionary";
import { track } from "@/lib/analytics/events";

export function PortfolioTable({ locale }: { locale: Locale }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState("value");
  const contributions = getContributions("1M");
  const rows = useMemo(
    () =>
      enrichedPositions
        .filter(
          (row) =>
            (type === "all" || row.asset.type === type) &&
            `${row.asset.name} ${row.asset.symbol}`.toLowerCase().includes(query.toLowerCase()),
        )
        .sort((a, b) =>
          sort === "allocation"
            ? b.allocationPct - a.allocationPct
            : sort === "name"
              ? a.asset.name.localeCompare(b.asset.name)
              : b.marketValue - a.marketValue,
        ),
    [query, type, sort],
  );
  return (
    <div>
      <div className="flex flex-wrap gap-3 border-b border-[var(--color-border-default)] p-4">
        <label className="relative min-w-64 flex-1">
          <span className="sr-only">Hledat aktivum</span>
          <Search size={16} className="absolute left-3 top-3.5 text-[var(--color-text-muted)]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hledat aktivum nebo ticker…"
            className="pl-10"
          />
        </label>
        <Select
          aria-label="Typ aktiva"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            track({ name: "portfolio_filter_changed", filter: e.target.value });
          }}
        >
          <option value="all">Všechny typy</option>
          <option value="stock">Akcie</option>
          <option value="etf">ETF</option>
          <option value="crypto">Crypto</option>
          <option value="cash">Hotovost</option>
        </Select>
        <Select
          aria-label="Řazení"
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            track({ name: "portfolio_sort_changed", column: e.target.value });
          }}
        >
          <option value="value">Hodnota ↓</option>
          <option value="allocation">Alokace ↓</option>
          <option value="name">Název A–Z</option>
        </Select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1050px]">
          <thead>
            <tr className="border-b border-[var(--color-border-default)] text-right text-[.65rem] uppercase tracking-[.09em] text-[var(--color-text-muted)]">
              <th className="px-4 py-3 text-left">Aktivum</th>
              <th className="px-3">Množství</th>
              <th className="px-3">Tržní hodnota</th>
              <th className="px-3">Alokace</th>
              <th className="px-3">Výnos 1M</th>
              <th className="px-3">Příspěvek</th>
              <th className="px-3">Nerealizované P/L</th>
              <th className="px-4">
                <span className="sr-only">Akce</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <AssetRow
                key={row.assetId}
                asset={row.asset}
                position={row}
                locale={locale}
                contribution={
                  contributions.find((item) => item.symbol === row.asset.symbol)
                    ?.contributionPctPoints ?? 0
                }
              />
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="p-12 text-center">
            <Badge>0 výsledků</Badge>
            <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
              Změňte hledání nebo filtr.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
