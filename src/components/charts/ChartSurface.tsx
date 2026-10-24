import { chartOptions as o } from "./chart-options";

/** Shared plot surface for the portfolio hero and individual company charts. */
export function ChartSurface({ id, width = o.width, height = o.height }: { id: string; width?: number; height?: number }) {
  return <g aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-plot`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#14161b" /><stop offset="48%" stopColor="#0d0f13" /><stop offset="100%" stopColor="#090a0d" />
      </linearGradient>
      <radialGradient id={`${id}-aura`} cx="62%" cy="20%" r="78%">
        <stop offset="0%" stopColor="#c7c3ee" stopOpacity=".085" /><stop offset="42%" stopColor="#8e91a7" stopOpacity=".025" /><stop offset="100%" stopColor="#050608" stopOpacity="0" />
      </radialGradient>
      <filter id={`${id}-texture`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="3" seed="17" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" />
      </filter>
    </defs>
    <rect width={width} height={height} fill={`url(#${id}-plot)`} />
    <rect width={width} height={height} fill={`url(#${id}-aura)`} />
    <rect width={width} height={height} fill="#d9dce5" opacity=".035" filter={`url(#${id}-texture)`} pointerEvents="none" />
  </g>;
}
