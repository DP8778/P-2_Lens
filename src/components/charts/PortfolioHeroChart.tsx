"use client";
import { useId, useRef, useState } from "react";
import type { Timeframe } from "@/types/finance";
import type { PortfolioAnalysis } from "@/lib/finance/portfolio-engine";
import { chartGeometry } from "./chart-data";
import { chartOptions as o } from "./chart-options";
import { ChartControls, type ChartSettings } from "./ChartControls";
import { HeroChartTooltip } from "./HeroChartTooltip";
import { ChartNavigator } from "./ChartNavigator";
import { ChartAnnotations } from "./ChartAnnotations";
import { money, percent, points, dateLabel } from "./chart-formatters";
import { exportPortfolioChart } from "./chart-export";

export function PortfolioHeroChart({
  analysis,
  overview,
  settings,
  onSettings,
  range,
  onRange,
  timeframe,
  onTimeframe,
  selected,
  onSelect,
  locale,
}: {
  analysis: PortfolioAnalysis;
  overview: PortfolioAnalysis;
  settings: ChartSettings;
  onSettings: (s: ChartSettings) => void;
  range: [number, number];
  onRange: (range: [number, number]) => void;
  timeframe: Timeframe | "CUSTOM";
  onTimeframe: (t: Timeframe) => void;
  selected: number | null;
  onSelect: (i: number | null) => void;
  locale: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gradient = useId().replaceAll(":", "");
  const data = analysis.points;
  const g = chartGeometry(
    data,
    settings.mode,
    settings.display,
    settings.showBenchmark,
    !!settings.compare,
  );
  const active =
    selected === null && hover === null ? null : Math.min(selected ?? hover ?? 0, data.length - 1);
  const point = active === null ? null : data[Math.min(active, data.length - 1)];
  const isDrawdown = settings.mode === "drawdown";
  const contributionRows = [...analysis.holdings].sort(
    (a, b) => b.contributionPctPoints - a.contributionPctPoints,
  );
  const maxBar = Math.max(...contributionRows.map((p) => Math.abs(p.contributionPctPoints)), 0.001);
  const baseline = isDrawdown ? g.y(0) : o.height - o.bottom;
  const exportChart = () => {
    const svg = svgRef.current;
    if (!svg) return;
    exportPortfolioChart(svg, analysis, settings, locale);
  };
  const summary = `Portfolio ${dateLabel(analysis.metrics.startDate, locale)} až ${dateLabel(analysis.metrics.endDate, locale)}: ${money(analysis.metrics.endValue, locale)}, výnos ${percent(analysis.metrics.returnPct, locale)}. Maximální pokles ${percent(analysis.metrics.maxDrawdownPct, locale)}. ${settings.showBenchmark ? `${analysis.benchmark}: ${percent(analysis.metrics.benchmarkReturnPct, locale)}.` : ""}`;
  return (
    <section className="hero-chart surface" aria-label="Analýza portfolia">
      <ChartControls
        settings={settings}
        onChange={onSettings}
        timeframe={timeframe}
        onTimeframe={onTimeframe}
        onExport={exportChart}
      />
      {settings.mode === "contribution" ? (
        <div className="contribution-view">
          <svg ref={svgRef} viewBox="0 0 1000 390" role="img" aria-label="Příspěvky aktiv k výnosu">
            <title>Příspěvky aktiv · p. b.</title>
            <desc>
              {contributionRows
                .map((p) => `${p.asset.symbol} ${points(p.contributionPctPoints)}`)
                .join("; ")}
            </desc>
            <rect width="1000" height="390" fill="#0d0e11" />
            <line x1="500" x2="500" y1="15" y2="350" stroke="#ffffff33" />
            {contributionRows.map((p, i) => {
              const y = 30 + i * (310 / Math.max(contributionRows.length, 1));
              const width = (Math.abs(p.contributionPctPoints) / maxBar) * 310;
              return (
                <g key={p.assetId}>
                  <text x="20" y={y + 5} fill="#eeeee9" fontSize="14" fontFamily="Arial">
                    {p.asset.symbol}
                  </text>
                  <rect
                    x={p.contributionPctPoints < 0 ? 500 - width : 500}
                    y={y - 11}
                    width={width}
                    height={Math.min(20, 230 / contributionRows.length)}
                    rx="3"
                    fill={p.contributionPctPoints < 0 ? "#b98e94" : "#d5d6d7"}
                  />
                  <text
                    x="975"
                    y={y + 5}
                    textAnchor="end"
                    fill="#eeeee9"
                    fontFamily="Arial"
                    fontSize="14"
                  >
                    {points(p.contributionPctPoints, locale)}
                  </text>
                </g>
              );
            })}
            <text
              x="500"
              y="378"
              textAnchor="middle"
              fill="#989ca5"
              fontFamily="Arial"
              fontSize="12"
            >
              0 p. b.
            </text>
          </svg>
          {!contributionRows.length && <p>Portfolio zatím neobsahuje žádné pozice.</p>}
        </div>
      ) : (
        <div className="chart-plot" onPointerLeave={() => setHover(null)}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${o.width} ${o.height}`}
            preserveAspectRatio="none"
            tabIndex={0}
            role="graphics-document"
            aria-label="Graf portfolia. Šipkami vyberte bod, Enterem potvrďte, Escape zrušte výběr."
            onFocus={() => setHover(selected ?? data.length - 1)}
            onBlur={() => setHover(null)}
            onKeyDown={(e) => {
              if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                const index = selected ?? hover ?? data.length - 1;
                onSelect(
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? data.length - 1
                      : Math.max(
                          0,
                          Math.min(data.length - 1, index + (e.key === "ArrowRight" ? 1 : -1)),
                        ),
                );
              }
              if (e.key === "Escape") {
                onSelect(null);
                setHover(null);
              }
              if (e.key === "Enter") onSelect(active ?? data.length - 1);
            }}
            onPointerMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setHover(
                Math.max(
                  0,
                  Math.min(
                    data.length - 1,
                    Math.round(
                      ((((e.clientX - rect.left) / rect.width) * o.width - o.left) /
                        (o.width - o.left - o.right)) *
                        (data.length - 1),
                    ),
                  ),
                ),
              );
            }}
            onPointerDown={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const index = Math.max(
                0,
                Math.min(
                  data.length - 1,
                  Math.round(
                    ((((e.clientX - rect.left) / rect.width) * o.width - o.left) /
                      (o.width - o.left - o.right)) *
                      (data.length - 1),
                  ),
                ),
              );
              onSelect(selected === index ? null : index);
            }}
          >
            <title>{isDrawdown ? "Pokles od maxima" : "Vývoj portfolia"}</title>
            <desc>{summary}</desc>
            <rect width={o.width} height={o.height} fill="#0d0e11" />
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={isDrawdown ? "#b98e94" : "#dce0e8"}
                  stopOpacity=".17"
                />
                <stop offset="100%" stopColor="#dce0e8" stopOpacity="0" />
              </linearGradient>
            </defs>
            {g.ticks.map((t) => (
              <g key={t}>
                <line x1={o.left} x2={o.width - o.right} y1={g.y(t)} y2={g.y(t)} stroke={o.grid} />
                <text
                  x={o.width - o.right + 14}
                  y={g.y(t) + 4}
                  fill="#989ca5"
                  fontSize="12"
                  fontFamily="Arial"
                >
                  {isDrawdown || (!settings.compare && settings.display === "percent")
                    ? `${t.toFixed(1)} %`
                    : settings.compare
                      ? t.toFixed(0)
                      : `${Math.round(t / 1000)} tis.`}
                </text>
              </g>
            ))}
            <path
              d={`${g.line(g.key)} L${g.x(data.length - 1)},${baseline} L${g.x(0)},${baseline} Z`}
              fill={`url(#${gradient})`}
            />
            {!isDrawdown && settings.showBenchmark && (
              <path
                d={g.line(g.benchmarkKey)}
                fill="none"
                stroke={o.benchmark}
                strokeWidth="1.5"
                strokeDasharray="5 6"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {!isDrawdown && settings.compare && (
              <path
                d={g.line("assetIndex")}
                fill="none"
                stroke={o.compare}
                strokeWidth="1.7"
                strokeDasharray="2 4"
                vectorEffect="non-scaling-stroke"
              />
            )}
            <path
              d={g.line(g.key)}
              fill="none"
              stroke={isDrawdown ? "#c9a5aa" : o.line}
              strokeWidth="2"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {settings.annotations && !isDrawdown && analysis.trough.drawdown < 0 && (
              <g aria-label={`Největší pokles ${dateLabel(analysis.trough.timestamp, locale)}`}>
                <line
                  x1={g.x(data.indexOf(analysis.trough))}
                  x2={g.x(data.indexOf(analysis.trough))}
                  y1={g.y(analysis.trough[g.key])}
                  y2={o.height - o.bottom}
                  stroke="#ffffff1a"
                  strokeDasharray="2 4"
                />
                <circle
                  cx={g.x(data.indexOf(analysis.trough))}
                  cy={o.height - o.bottom}
                  r="7"
                  fill="#1b1c22"
                  stroke="#92959f"
                />
                <text
                  x={g.x(data.indexOf(analysis.trough))}
                  y={o.height - o.bottom + 4}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#eeeee9"
                >
                  ↓
                </text>
              </g>
            )}
            {isDrawdown && (
              <>
                <circle
                  cx={g.x(data.indexOf(analysis.trough))}
                  cy={g.y(analysis.trough.drawdown)}
                  r="5"
                  fill="#c9a5aa"
                />
                <text
                  x={g.x(data.indexOf(analysis.trough))}
                  y={Math.max(18, g.y(analysis.trough.drawdown) - 14)}
                  textAnchor="middle"
                  fill="#e4c5c9"
                  fontSize="12"
                >
                  {percent(analysis.trough.drawdown, locale)}
                </text>
                {analysis.recovery && (
                  <circle
                    cx={g.x(data.indexOf(analysis.recovery))}
                    cy={g.y(0)}
                    r="5"
                    fill="#eeeee9"
                  />
                )}
              </>
            )}
            {[0, Math.floor((data.length - 1) / 2), data.length - 1].map((index, i) => (
              <text
                key={i}
                x={g.x(index)}
                y={o.height - 12}
                textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
                fill="#989ca5"
                fontSize="12"
                fontFamily="Arial"
              >
                {dateLabel(data[index].timestamp, locale)}
              </text>
            ))}
            {point && active !== null && (
              <g>
                <line
                  x1={g.x(active)}
                  x2={g.x(active)}
                  y1={o.top}
                  y2={o.height - o.bottom}
                  stroke="#ffffff55"
                  strokeDasharray="3 4"
                />
                <circle
                  cx={g.x(active)}
                  cy={g.y(point[g.key])}
                  r="5"
                  fill="#eeeee9"
                  stroke="#0d0e11"
                  strokeWidth="2"
                />
              </g>
            )}
          </svg>
          {point && (
            <HeroChartTooltip
              point={point}
              selected={selected !== null}
              benchmark={settings.showBenchmark ? analysis.benchmark : undefined}
              compare={analysis.compare}
              locale={locale}
            />
          )}
        </div>
      )}
      <div className="chart-bottom">
        <p className="tertiary">
          {selected !== null ? (
            <button
              onClick={() => {
                onSelect(null);
                setHover(null);
              }}
            >
              Zrušit výběr bodu ×
            </button>
          ) : (
            "Vyberte bod pro podrobnosti · graf lze ovládat šipkami"
          )}
        </p>
        {settings.annotations && <ChartAnnotations analysis={analysis} onSelect={onSelect} />}
      </div>
      {settings.navigator && (
        <ChartNavigator data={overview.points} range={range} onChange={onRange} />
      )}
      <details className="chart-data-table">
        <summary>Textový přehled dat</summary>
        <p>{summary}</p>
        <div>
          <table>
            <thead>
              <tr>
                <th>{settings.mode === "contribution" ? "Aktivum" : "Datum"}</th>
                <th>{settings.mode === "contribution" ? "Příspěvek" : "Hodnota"}</th>
                <th>Výnos</th>
                {settings.mode !== "contribution" && (
                  <>
                    <th>{analysis.benchmark}</th>
                    <th>Pokles</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {settings.mode === "contribution"
                ? contributionRows.map((p) => (
                    <tr key={p.assetId}>
                      <td>{p.asset.symbol}</td>
                      <td>{points(p.contributionPctPoints, locale)}</td>
                      <td>{percent(p.returnPct, locale)}</td>
                    </tr>
                  ))
                : data.map((p) => (
                    <tr key={p.timestamp}>
                      <td>{dateLabel(p.timestamp, locale)}</td>
                      <td>{money(p.portfolioValue, locale)}</td>
                      <td>{percent(p.portfolioReturnPct, locale)}</td>
                      <td>{percent(p.benchmarkReturnPct, locale)}</td>
                      <td>{percent(p.drawdown, locale)}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
