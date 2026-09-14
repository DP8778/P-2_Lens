"use client";
import { useId, useMemo, useRef, useState } from "react";
import type { PortfolioAnalysis } from "@/lib/finance/portfolio-engine";
import { timeline } from "@/lib/finance/portfolio-engine";
import { useAnalysisContext } from "@/components/portfolio/AnalysisProvider";
import { usePortfolio } from "@/components/portfolio/PortfolioProvider";
import {
  mapClientXToPointIndex,
  mapDateToPointIndex,
  mapSelectedRangeToIndices,
  mapTransactionsToAnnotations,
} from "@/lib/chart/chart-series";
import { chartGeometry } from "./chart-data";
import { chartOptions as o } from "./chart-options";
import { ChartControls, type ChartSettings } from "./ChartControls";
import { HeroChartTooltip } from "./HeroChartTooltip";
import { ChartNavigator } from "./ChartNavigator";
import { ChartAnnotations } from "./ChartAnnotations";
import { ChartSummary } from "./ChartSummary";
import { ChartLegend } from "./ChartLegend";
import { ContributionView } from "./ContributionView";
import { DrawdownSummary } from "./DrawdownSummary";
import { money, percent, points, dateLabel } from "./chart-formatters";
import { exportPortfolioChart } from "./chart-export";

export function PortfolioHeroChart({
  analysis,
  visibleAnalysis,
  overview,
  locale,
  timelineDates = timeline,
}: {
  analysis: PortfolioAnalysis;
  visibleAnalysis: PortfolioAnalysis;
  overview: PortfolioAnalysis;
  locale: string;
  timelineDates?: string[];
}) {
  const { state, dispatch } = useAnalysisContext();
  const { transactions, mode } = usePortfolio();
  const [hover, setHover] = useState<number | null>(null);
  const [rangeMode, setRangeMode] = useState(false);
  const [rangeStart, setRangeStart] = useState<number | null>(null);
  const [rangeHover, setRangeHover] = useState<number | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string>();
  const svgRef = useRef<SVGSVGElement>(null);
  const gradient = useId().replaceAll(":", "");
  const plotGradient = `${gradient}-plot`;
  const plotAura = `${gradient}-aura`;
  const plotTexture = `${gradient}-texture`;
  const lineGradient = `${gradient}-line`;
  const lineGlow = `${gradient}-glow`;
  const data = state.mode === "performance" ? visibleAnalysis.points : analysis.points;
  const settings: ChartSettings = {
    mode: state.mode,
    display: state.display,
    benchmark: state.benchmarkId,
    showBenchmark: state.showBenchmark,
    compare: state.compareAssetId,
    annotations: state.annotations,
    navigator: state.navigator,
  };
  const range = mapSelectedRangeToIndices(state.viewportRange, timelineDates);
  const selected = mapDateToPointIndex(data, state.selectedPoint);
  const onSelect = (index: number | null) =>
    dispatch({ type: "point", value: index === null ? null : (data[index]?.timestamp ?? null) });
  const onSettings = (next: ChartSettings) =>
    dispatch({
      type: "settings",
      value: {
        mode: next.mode,
        display: next.display,
        benchmarkId: next.benchmark,
        compareAssetId: next.compare,
        showBenchmark: next.showBenchmark,
        annotations: next.annotations,
        navigator: next.navigator,
      },
    });
  const onRange = (next: [number, number]) =>
    dispatch({ type: "viewport", value: [timelineDates[next[0]], timelineDates[next[1]]] });
  const g = useMemo(
    () =>
      chartGeometry(
        data,
        settings.mode,
        settings.display,
        settings.showBenchmark,
        !!settings.compare,
      ),
    [data, settings.mode, settings.display, settings.showBenchmark, settings.compare],
  );
  const events = useMemo(
    () => mapTransactionsToAnnotations(transactions, data),
    [transactions, data],
  );
  const active =
    selected === null && hover === null ? null : Math.min(hover ?? selected ?? 0, data.length - 1);
  const point = active === null ? null : data[Math.min(active, data.length - 1)];
  const isDrawdown = settings.mode === "drawdown";
  const contributionRows = analysis.contribution.items;
  const baseline = isDrawdown ? g.y(0) : o.height - o.bottom;
  const exportChart = () => {
    const svg = svgRef.current;
    if (!svg) return;
    exportPortfolioChart(svg, analysis, settings, locale);
  };
  const summary = `Portfolio ${dateLabel(analysis.metrics.startDate, locale)} až ${dateLabel(analysis.metrics.endDate, locale)}: ${money(analysis.metrics.endValue, locale)}, výnos ${percent(analysis.metrics.returnPct, locale)}. Maximální pokles ${percent(analysis.metrics.maxDrawdownPct, locale)}. ${settings.showBenchmark ? `${analysis.benchmark}: ${percent(analysis.metrics.benchmarkReturnPct, locale)}.` : ""}`;
  return (
    <section className="hero-chart surface" aria-label="Analýza portfolia">
      <ChartSummary
        analysis={analysis}
        timeframe={state.timeframe}
        showBenchmark={state.showBenchmark}
        locale={locale}
      />
      <ChartControls
        settings={settings}
        onChange={onSettings}
        timeframe={state.timeframe}
        onTimeframe={(value) => dispatch({ type: "timeframe", value })}
        onExport={exportChart}
        compareAssets={analysis.holdings.map((holding) => holding.asset)}
        allowNasdaqBenchmark={mode === "demo"}
      />
      <ChartLegend
        analysis={analysis}
        showBenchmark={state.showBenchmark}
        compareAssetId={state.compareAssetId}
        onBenchmark={() =>
          dispatch({ type: "settings", value: { showBenchmark: !state.showBenchmark } })
        }
        onClearCompare={() => dispatch({ type: "settings", value: { compareAssetId: "" } })}
        locale={locale}
      />
      {settings.mode === "drawdown" && <DrawdownSummary analysis={analysis} locale={locale} />}
      {settings.mode === "contribution" ? (
        <ContributionView analysis={analysis} locale={locale} />
      ) : (
        <div
          className={`chart-plot${rangeMode ? " range-selecting" : ""}`}
          onPointerLeave={() => {
            setHover(null);
            if (rangeStart === null) setRangeHover(null);
          }}
        >
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
                setHover(null);
              }
              if (e.key === "Escape") {
                onSelect(null);
                setHover(null);
                setRangeMode(false);
                setRangeStart(null);
                setRangeHover(null);
              }
              if (e.key === "Enter") {
                const index = active ?? data.length - 1;
                if (rangeMode) {
                  if (rangeStart === null) setRangeStart(index);
                  else {
                    const [from, to] = [rangeStart, index].sort((a, b) => a - b);
                    if (from !== to)
                      dispatch({
                        type: "range",
                        value: [data[from].timestamp, data[to].timestamp],
                      });
                    setRangeMode(false);
                    setRangeStart(null);
                    setRangeHover(null);
                  }
                } else {
                  onSelect(index);
                  setHover(null);
                }
              }
            }}
            onPointerMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const index = mapClientXToPointIndex(
                e.clientX,
                rect.left,
                rect.width,
                data.length,
                o.left / o.width,
                o.right / o.width,
              );
              setHover(index);
              if (rangeMode) setRangeHover(index);
            }}
            onPointerDown={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const index = mapClientXToPointIndex(
                e.clientX,
                rect.left,
                rect.width,
                data.length,
                o.left / o.width,
                o.right / o.width,
              );
              if (rangeMode) {
                if (rangeStart === null) {
                  setRangeStart(index);
                  setRangeHover(index);
                } else {
                  const [from, to] = [rangeStart, index].sort((a, b) => a - b);
                  if (from !== to)
                    dispatch({ type: "range", value: [data[from].timestamp, data[to].timestamp] });
                  setRangeMode(false);
                  setRangeStart(null);
                  setRangeHover(null);
                }
                return;
              }
              onSelect(selected === index ? null : index);
              if (e.pointerType !== "mouse") setHover(null);
            }}
          >
            <title>{isDrawdown ? "Pokles od maxima" : "Vývoj portfolia"}</title>
            <desc>{summary}</desc>
            <defs>
              <linearGradient id={plotGradient} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#14161b" />
                <stop offset="48%" stopColor="#0d0f13" />
                <stop offset="100%" stopColor="#090a0d" />
              </linearGradient>
              <radialGradient id={plotAura} cx="62%" cy="20%" r="78%">
                <stop offset="0%" stopColor="#c7c3ee" stopOpacity=".085" />
                <stop offset="42%" stopColor="#8e91a7" stopOpacity=".025" />
                <stop offset="100%" stopColor="#050608" stopOpacity="0" />
              </radialGradient>
              <filter id={plotTexture} x="0" y="0" width="100%" height="100%">
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency=".72"
                  numOctaves="3"
                  seed="17"
                  stitchTiles="stitch"
                />
                <feColorMatrix type="saturate" values="0" />
              </filter>
              <linearGradient id={lineGradient} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={isDrawdown ? "#c9a5aa" : "#c7cbd3"} />
                <stop offset="54%" stopColor={isDrawdown ? "#ddb8bd" : "#f3f1eb"} />
                <stop offset="100%" stopColor={isDrawdown ? "#c9a5aa" : "#d8d5f2"} />
              </linearGradient>
              <filter id={lineGlow} x="-10%" y="-25%" width="120%" height="150%">
                <feGaussianBlur stdDeviation="4.5" />
              </filter>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={isDrawdown ? "#b98e94" : "#dce0e8"}
                  stopOpacity=".17"
                />
                <stop offset="100%" stopColor="#dce0e8" stopOpacity="0" />
              </linearGradient>
            </defs>
            <rect width={o.width} height={o.height} fill={`url(#${plotGradient})`} />
            <rect width={o.width} height={o.height} fill={`url(#${plotAura})`} />
            <rect
              width={o.width}
              height={o.height}
              fill="#d9dce5"
              opacity=".035"
              filter={`url(#${plotTexture})`}
              pointerEvents="none"
            />
            {rangeMode && rangeStart !== null && rangeHover !== null && (
              <rect
                className="range-selection-overlay"
                x={Math.min(g.x(rangeStart), g.x(rangeHover))}
                y={o.top}
                width={Math.abs(g.x(rangeHover) - g.x(rangeStart))}
                height={o.height - o.top - o.bottom}
                fill="#eef0f20b"
                stroke="#d8dbe066"
                strokeDasharray="4 4"
              />
            )}
            {!rangeMode && state.selectedRange && settings.mode === "performance" && (() => {
              const [from, to] = mapSelectedRangeToIndices(
                state.selectedRange,
                data.map((item) => item.timestamp),
              );
              return (
                <rect
                  className="range-selection-overlay"
                  x={g.x(from)}
                  y={o.top}
                  width={Math.max(2, g.x(to) - g.x(from))}
                  height={o.height - o.top - o.bottom}
                  fill="#eef0f20b"
                  stroke="#d8dbe055"
                  strokeDasharray="4 4"
                  pointerEvents="none"
                />
              );
            })()}
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
                  {isDrawdown
                    ? `${t.toFixed(1)} %`
                    : settings.compare || settings.showBenchmark || settings.display === "percent"
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
              stroke={isDrawdown ? "#c9a5aa" : "#d8d5f2"}
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity=".22"
              filter={`url(#${lineGlow})`}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
            <path
              d={g.line(g.key)}
              fill="none"
              stroke={`url(#${lineGradient})`}
              strokeWidth="2.15"
              strokeLinecap="round"
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
            {isDrawdown && analysis.drawdown.trough && (
              <>
                {analysis.drawdown.peak && (() => {
                  const index = data.findIndex((item) => item.timestamp === analysis.drawdown.peak?.date);
                  return index < 0 ? null : (
                    <g aria-label={`Vrchol ${dateLabel(analysis.drawdown.peak.date, locale)}`}>
                      <circle cx={g.x(index)} cy={g.y(0)} r="4" fill="#aeb2ba" />
                      <text x={g.x(index)} y={g.y(0) + 18} textAnchor="middle" fill="#989ca5" fontSize="10">Vrchol</text>
                    </g>
                  );
                })()}
                <g
                  role="button"
                  tabIndex={0}
                  aria-label="Vybrat dno maximálního poklesu"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(data.findIndex((item) => item.timestamp === analysis.drawdown.trough?.date));
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(data.findIndex((item) => item.timestamp === analysis.drawdown.trough?.date));
                    }
                  }}
                >
                  <circle
                    cx={g.x(data.indexOf(analysis.trough))}
                    cy={g.y(analysis.trough.drawdown)}
                    r="6"
                    fill="#c9a5aa"
                  />
                </g>
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
                  <g aria-label={`Obnova ${dateLabel(analysis.recovery.timestamp, locale)}`}>
                    <circle
                      cx={g.x(data.indexOf(analysis.recovery))}
                      cy={g.y(0)}
                      r="5"
                      fill="#eeeee9"
                    />
                    <text
                      x={g.x(data.indexOf(analysis.recovery))}
                      y={g.y(0) + 18}
                      textAnchor="middle"
                      fill="#989ca5"
                      fontSize="10"
                    >
                      Obnova
                    </text>
                  </g>
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
            {settings.annotations &&
              events.slice(-6).map((event) => (
                <g
                  key={event.id}
                  className="transaction-marker"
                  role="button"
                  tabIndex={0}
                  aria-label={`${event.type === "buy" ? "Nákup" : "Prodej"} ${event.assetId} ${event.date}`}
                  onClick={(eventClick) => {
                    eventClick.stopPropagation();
                    setSelectedEventId(event.id);
                    onSelect(event.index);
                  }}
                  onKeyDown={(keyboardEvent) => {
                    if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                      keyboardEvent.preventDefault();
                      setSelectedEventId(event.id);
                      onSelect(event.index);
                    }
                  }}
                >
                  <line
                    x1={g.x(event.index)}
                    x2={g.x(event.index)}
                    y1={o.height - o.bottom - 17}
                    y2={o.height - o.bottom}
                    stroke="#aeb2ba66"
                  />
                  <circle
                    cx={g.x(event.index)}
                    cy={o.height - o.bottom - 22}
                    r="7"
                    fill="#15171b"
                    stroke="#bfc2c9"
                  />
                  <text
                    x={g.x(event.index)}
                    y={o.height - o.bottom - 18}
                    textAnchor="middle"
                    fill="#f0f0ec"
                    fontSize="9"
                  >
                    {event.type === "buy" ? "+" : "−"}
                  </text>
                </g>
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
              selected={selected !== null && hover === null}
              benchmark={settings.showBenchmark ? analysis.benchmark : undefined}
              compare={analysis.compare}
              mode={settings.mode}
              locale={locale}
              positionPercent={(g.x(active ?? 0) / o.width) * 100}
            />
          )}
          {selectedEventId &&
            (() => {
              const event = events.find((candidate) => candidate.id === selectedEventId);
              if (!event) return null;
              return (
                <div className="chart-event-popover glass" role="status">
                  <strong>
                    {event.type.toUpperCase()} {event.assetId.toUpperCase()}
                  </strong>
                  <span>{dateLabel(`${event.date}T12:00:00.000Z`, locale)}</span>
                  <p>
                    {event.quantity.toLocaleString(locale, { maximumFractionDigits: 8 })} jednotek
                  </p>
                  <button
                    onClick={() => setSelectedEventId(undefined)}
                    aria-label="Zavřít detail transakce"
                  >
                    ×
                  </button>
                </div>
              );
            })()}
        </div>
      )}
      <div className="chart-bottom">
        <div className="chart-selection-actions">
          <button
            className="range-select-button"
            aria-pressed={rangeMode}
            onClick={() => {
              setRangeMode(!rangeMode);
              setRangeStart(null);
              setRangeHover(null);
              setSelectedEventId(undefined);
            }}
          >
            {rangeMode ? "Zrušit výběr období" : "Vybrat období"}
          </button>
          <p className="tertiary">
            {rangeMode ? (
              rangeStart === null ? (
                "Zvolte začátek období"
              ) : (
                "Zvolte konec období"
              )
            ) : selected !== null ? (
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
        </div>
        {settings.annotations && <ChartAnnotations events={events} onSelect={onSelect} assets={analysis.holdings.map((holding) => holding.asset)} />}
      </div>
      {state.selectedRange && (
        <div className="analysis-range-chip" role="status">
          <span>
            Analyzováno: {dateLabel(state.selectedRange[0], locale)} — {dateLabel(state.selectedRange[1], locale)}
          </span>
          <button onClick={() => dispatch({ type: "clearRange" })}>Zrušit rozsah ×</button>
        </div>
      )}
      {analysis.missingPriceAssetIds.length > 0 && (
        <p className="chart-data-warning" role="status">
          Chybí cena pro {analysis.missingPriceAssetIds.join(", ")}; dostupné řady zůstávají
          zobrazené.
        </p>
      )}
      {state.compareAssetId && !analysis.compare && (
        <p className="chart-data-warning" role="status">
          Vybrané aktivum nemá pro toto období dostupnou srovnávací řadu.
        </p>
      )}
      {data.length < 2 && analysis.holdings.length > 0 && (
        <p className="chart-data-warning" role="status">
          Pro zvolené období není dost historických bodů. Aktuální hodnota zůstává dostupná.
        </p>
      )}
      {!analysis.holdings.length && (
        <div className="chart-empty-state" role="status">
          <strong>Graf čeká na první aktivum</strong>
          <span>Po přidání transakce zde uvidíte vývoj portfolia.</span>
        </div>
      )}
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
                      <td>{p.symbol}</td>
                      <td>{points(p.contributionPctPoints, locale)}</td>
                      <td>{percent(p.periodReturnPct, locale)}</td>
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
