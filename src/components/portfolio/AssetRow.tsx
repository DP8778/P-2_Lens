import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/formatting/formatters";
import type { Locale } from "@/i18n/getDictionary";
import type { Asset, Position } from "@/types/finance";

export function AssetRow({
  asset,
  position,
  locale,
  contribution = 0,
}: {
  asset: Asset;
  position: Position;
  locale: Locale;
  contribution?: number;
}) {
  const pnl = position.marketValue - position.quantity * position.averageCost;
  const periodReturn =
    ((position.currentPrice - position.previousPrice) / position.previousPrice) * 100;
  return (
    <tr className="group border-b border-[var(--color-border-default)] last:border-0 hover:bg-black/[.025]">
      <td className="py-4 pl-4">
        <Link href={`/${locale}/assets/${asset.symbol}`} className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-full border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] text-xs font-bold">
            {asset.symbol.slice(0, 2)}
          </span>
          <span>
            <strong className="block text-sm">{asset.name}</strong>
            <span className="text-xs text-[var(--color-text-muted)]">
              {asset.symbol} · {asset.type}
            </span>
          </span>
        </Link>
      </td>
      <td className="tabular px-3 py-4 text-right text-sm">
        {position.quantity.toLocaleString(locale, { maximumFractionDigits: 3 })}
      </td>
      <td className="tabular px-3 py-4 text-right text-sm font-semibold">
        {formatCurrency(position.marketValue, locale)}
      </td>
      <td className="tabular px-3 py-4 text-right text-sm">
        {formatPercent(position.allocationPct, locale)}
      </td>
      <td
        className={`tabular px-3 py-4 text-right text-sm ${periodReturn >= 0 ? "positive" : "negative"}`}
      >
        {formatPercent(periodReturn, locale)}
      </td>
      <td
        className={`tabular px-3 py-4 text-right text-sm ${contribution >= 0 ? "positive" : "negative"}`}
      >
        {formatPercent(contribution, locale)} p. b.
      </td>
      <td className={`tabular px-3 py-4 text-right text-sm ${pnl >= 0 ? "positive" : "negative"}`}>
        {formatCurrency(pnl, locale)}
      </td>
      <td className="pr-4 text-right">
        <Link
          aria-label={`Otevřít ${asset.symbol}`}
          href={`/${locale}/assets/${asset.symbol}`}
          className="inline-grid h-9 w-9 place-items-center rounded-lg opacity-40 transition group-hover:opacity-100"
        >
          <ArrowUpRight size={17} />
        </Link>
      </td>
    </tr>
  );
}
