"use client";

import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { mapClientXToPointIndex } from "@/lib/chart/chart-series";
import { ChartNavigator } from "./ChartNavigator";
import { ChartSurface } from "./ChartSurface";
import { chartOptions } from "./chart-options";

export type CompanySeries = { label: string; color: string; values: number[] };

/** The hero's SVG surface, point interaction and navigator, without portfolio transactions or valuations. */
export function CompanySeriesPlot({ dates, series, locale, label, formatValue, annual = false }: {
  dates: string[]; series: CompanySeries[]; locale: string; label: string;
  formatValue: (value: number) => string; annual?: boolean;
}) {
  const id = `company-${useId().replaceAll(":", "")}`;
  const [selection, setSelection] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [windowRange, setWindowRange] = useState<[number, number] | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: chartOptions.width, height: chartOptions.height });
  useEffect(() => {
    const plot = plotRef.current;
    if (!plot || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width), height = Math.round(entry.contentRect.height);
      if (width > 0 && height > 0) setSize(current => current.width === width && current.height === height ? current : { width, height });
    });
    observer.observe(plot);
    return () => observer.disconnect();
  }, []);
  const o = { ...chartOptions, ...size, right: size.width < 480 ? 60 : chartOptions.right };
  if (!dates.length || !series.length) return null;
  const maxIndex = dates.length - 1;
  const start = Math.min(windowRange?.[0] ?? 0, Math.max(0, maxIndex - 1));
  const end = Math.max(start, Math.min(windowRange?.[1] ?? maxIndex, maxIndex));
  const range: [number, number] = [start, end];
  const active = Math.max(start, Math.min(end, hover ?? selection ?? end));
  const dateLabel = (date: string) => annual ? `FY${date.slice(0, 4)}` : new Date(`${date}T12:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
  const values = series.flatMap((item) => item.values.slice(start, end + 1));
  const min = Math.min(...values, ...(annual ? [0] : [])), max = Math.max(...values, ...(annual ? [0] : []));
  const pad = (max - min || 1) * .12;
  const low = annual && min === 0 ? 0 : min - pad, high = max + pad;
  const x = (index: number) => o.left + (index - start) / Math.max(1, end - start) * (o.width - o.left - o.right);
  const y = (value: number) => o.top + (high - value) / (high - low) * (o.height - o.top - o.bottom);
  const path = (item: CompanySeries) => item.values.slice(start, end + 1).map((value, index) => `${index ? "L" : "M"}${x(start + index)},${y(value)}`).join(" ");
  const tickValue = (value: number) => new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
  const pointFromPointer = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return start + mapClientXToPointIndex(event.clientX, rect.left, rect.width, end - start + 1, o.left / o.width, o.right / o.width);
  };
  const tooltipWidth = Math.min(260, o.width - 16);
  const tooltipLeft = Math.max(8, Math.min(o.width - tooltipWidth - 8, x(active) + 14));
  const summary = `${label}. ${dateLabel(dates[start])} – ${dateLabel(dates[end])}. ${series.map(item => `${item.label}: ${formatValue(item.values[start])} → ${formatValue(item.values[end])}`).join(". ")}.`;
  return <div className="company-series">
    <div className="company-chart-readout" aria-live="polite" aria-atomic="true">
      <time dateTime={dates[active]}>{dateLabel(dates[active])}</time>
      {series.map(item => <span key={item.label}><i style={{ background: item.color }} aria-hidden="true" />{item.label}<strong>{formatValue(item.values[active])}</strong></span>)}
    </div>
    <div ref={plotRef} className="chart-plot company-chart-plot" onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${o.width} ${o.height}`} preserveAspectRatio="none" tabIndex={0} role="graphics-document"
        aria-label={`${label}. ${locale === "en-US" ? "Use arrows to select a point, Enter to pin, Escape to clear." : "Šipkami vyberte bod, Enterem připněte, Escape zrušte výběr."}`}
        onFocus={() => setHover(selection ?? end)} onBlur={() => setHover(null)}
        onPointerMove={event => setHover(pointFromPointer(event))}
        onPointerDown={event => { const index = pointFromPointer(event); setSelection(selection === index ? null : index); if (event.pointerType !== "mouse") setHover(null); }}
        onKeyDown={event => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            setSelection(event.key === "Home" ? start : event.key === "End" ? end : Math.max(start, Math.min(end, active + (event.key === "ArrowRight" ? 1 : -1)))); setHover(null);
          } else if (event.key === "Enter") { event.preventDefault(); setSelection(active); setHover(null); }
          else if (event.key === "Escape") { setSelection(null); setHover(null); }
        }}>
        <title>{label}</title><desc>{summary}</desc>
        <ChartSurface id={id} width={o.width} height={o.height} />
        <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={series[0].color} stopOpacity=".18" /><stop offset="100%" stopColor={series[0].color} stopOpacity="0" /></linearGradient></defs>
        {Array.from({ length: 4 }, (_, index) => high - (high - low) * index / 3).map(value => <g key={value}>
          <line x1={o.left} x2={o.width - o.right} y1={y(value)} y2={y(value)} stroke={o.grid} />
          <text x={o.width - o.right + 10} y={y(value) + 4} fill="#989ca5" fontSize="11">{tickValue(value)}</text>
        </g>)}
        <path d={`${path(series[0])} L${x(end)},${y(low)} L${x(start)},${y(low)} Z`} fill={`url(#${id}-fill)`} />
        {low < 0 && <line x1={o.left} x2={o.width - o.right} y1={y(0)} y2={y(0)} stroke="#ffffff40" strokeDasharray="4 4" />}
        {series.map((item, index) => <g key={item.label}>
          <path d={path(item)} fill="none" stroke={item.color} strokeWidth={index === 0 ? "2.3" : "1.8"} strokeDasharray={index === 2 ? "5 4" : undefined} vectorEffect="non-scaling-stroke" />
          {annual && item.values.slice(start, end + 1).map((value, offset) => <circle key={offset} cx={x(start + offset)} cy={y(value)} r="3" fill={item.color} />)}
          <circle cx={x(active)} cy={y(item.values[active])} r="4" fill={item.color} stroke="#101214" strokeWidth="2" />
        </g>)}
        <line x1={x(active)} x2={x(active)} y1={o.top} y2={o.height - o.bottom} stroke="#ffffff50" strokeDasharray="3 4" />
        {[...new Set([start, Math.floor((start + end) / 2), end])].map(index => <text key={index} x={x(index)} y={o.height - 12} textAnchor={index === start ? "start" : index === end ? "end" : "middle"} fill="#989ca5" fontSize="12">{dateLabel(dates[index])}</text>)}
      </svg>
      {(hover !== null || selection !== null) && <div className="company-chart-tooltip" role="status" style={{ left: tooltipLeft, width: tooltipWidth }}>
        <strong>{dateLabel(dates[active])}</strong>{series.map(item => <span key={item.label}>{item.label}<b>{formatValue(item.values[active])}</b></span>)}
      </div>}
    </div>
    {dates.length > 2 && <ChartNavigator data={dates.map((timestamp, index) => ({ timestamp, portfolioValue: series[0].values[index] }))} range={range} onChange={next => { setWindowRange(next); setSelection(null); setHover(null); }} locale={locale} />}
    <details className="company-chart-data"><summary>{locale === "en-US" ? "Chart data and sources" : "Data grafu a zdroje"}</summary><p>{summary}</p>
      <div className="industry-table-scroll"><table><thead><tr><th>{locale === "en-US" ? "Period" : "Období"}</th>{series.map(item => <th key={item.label}>{item.label}</th>)}</tr></thead><tbody>{dates.map((date, index) => <tr key={date}><th>{dateLabel(date)}</th>{series.map(item => <td key={item.label}>{formatValue(item.values[index])}</td>)}</tr>)}</tbody></table></div>
    </details>
  </div>;
}
