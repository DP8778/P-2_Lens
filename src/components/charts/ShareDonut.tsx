export const shareColors = ["var(--share-1)", "var(--share-2)", "var(--share-3)", "var(--share-4)"];

/** Values are already validated percentages, with an always-visible legend supplied by the caller. */
export function ShareDonut({ segments, center, caption, label, locale = "cs-CZ" }: {
  segments: { name: string; sharePct: number; color?: string }[];
  center: string; caption: string; label: string; locale?: string;
}) {
  const circumference = 2 * Math.PI * 92;
  return <svg className="share-donut" viewBox="0 0 260 260" role="img" aria-label={label}>
    <title>{label}</title>
    <circle cx="130" cy="130" r="92" fill="none" stroke="var(--color-bg-subtle)" strokeWidth="28" />
    {segments.map((segment, index) => <circle key={segment.name} cx="130" cy="130" r="92" fill="none"
      stroke={segment.color ?? shareColors[index % shareColors.length]} strokeWidth="28"
      strokeDasharray={`${circumference * segment.sharePct / 100} ${circumference}`}
      strokeDashoffset={-circumference * segments.slice(0, index).reduce((sum, item) => sum + item.sharePct, 0) / 100}
      transform="rotate(-90 130 130)"><title>{`${segment.name}: ${segment.sharePct.toLocaleString(locale, { maximumFractionDigits: 1 })} %`}</title></circle>)}
    <text x="130" y="126" textAnchor="middle" fill="var(--color-text-primary)" fontSize="20" fontWeight="500">{center}</text>
    <text x="130" y="151" textAnchor="middle" fill="var(--color-text-muted)" fontSize="12">{caption}</text>
  </svg>;
}
