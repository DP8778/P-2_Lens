import { SlidersHorizontal, Download } from "lucide-react";
import { assetCatalog } from "@/data/mock/catalog";
import type { Timeframe } from "@/types/finance";
import type { ChartDisplay, ChartMode } from "@/lib/finance/portfolio-engine";
import { chartModes } from "./chart-options";
export interface ChartSettings {
  mode: ChartMode;
  display: ChartDisplay;
  benchmark: "spy" | "qqq";
  showBenchmark: boolean;
  compare: string;
  annotations: boolean;
  navigator: boolean;
}
export function ChartControls({
  settings: s,
  onChange,
  timeframe,
  onTimeframe,
  onExport,
}: {
  settings: ChartSettings;
  onChange: (next: ChartSettings) => void;
  timeframe: Timeframe | "CUSTOM";
  onTimeframe: (value: Timeframe) => void;
  onExport: () => void;
}) {
  return (
    <div className="chart-controls">
      <div className="control-row">
        <div className="segmented" aria-label="Režim grafu">
          {chartModes.map((m) => (
            <button
              key={m.value}
              aria-pressed={s.mode === m.value}
              onClick={() => onChange({ ...s, mode: m.value })}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="control-actions">
          <button className="icon-control" onClick={onExport} aria-label="Exportovat graf SVG">
            <Download size={16} />
          </button>
          <details className="chart-options">
            <summary aria-label="Nastavení grafu">
              <SlidersHorizontal size={16} />
              <span>Nastavení grafu</span>
            </summary>
            <div className="options-panel glass">
              <label>
                Benchmark
                <select
                  aria-label="Benchmark"
                  value={s.benchmark}
                  onChange={(e) => onChange({ ...s, benchmark: e.target.value as "spy" | "qqq" })}
                >
                  <option value="spy">SPY · S&P 500</option>
                  <option value="qqq">QQQ · Nasdaq 100</option>
                </select>
              </label>
              <label>
                Porovnat aktivum
                <select
                  aria-label="Porovnat aktivum"
                  value={s.compare}
                  onChange={(e) => onChange({ ...s, compare: e.target.value })}
                >
                  <option value="">Bez porovnání</option>
                  {assetCatalog
                    .filter((a) => a.type !== "cash")
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.symbol} · {a.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="check-control">
                <input
                  type="checkbox"
                  checked={s.annotations}
                  onChange={(e) => onChange({ ...s, annotations: e.target.checked })}
                />
                Události
              </label>
              <label className="check-control">
                <input
                  type="checkbox"
                  checked={s.navigator}
                  onChange={(e) => onChange({ ...s, navigator: e.target.checked })}
                />
                Navigátor období
              </label>
            </div>
          </details>
        </div>
      </div>
      <div className="control-row">
        <div className="timeframes" aria-label="Časové období">
          {(["1W", "1M", "3M", "YTD", "1Y", "ALL"] as Timeframe[]).map((t) => (
            <button key={t} aria-pressed={timeframe === t} onClick={() => onTimeframe(t)}>
              {t}
            </button>
          ))}
          {timeframe === "CUSTOM" && <span className="tertiary">Vlastní</span>}
        </div>
        <div className="segmented compact" aria-label="Zobrazení hodnoty">
          <button
            disabled={s.mode !== "performance" || !!s.compare}
            aria-pressed={s.display === "value" && !s.compare}
            onClick={() => onChange({ ...s, display: "value" })}
          >
            Hodnota
          </button>
          <button
            disabled={s.mode !== "performance" || !!s.compare}
            aria-pressed={s.display === "percent" && !s.compare}
            onClick={() => onChange({ ...s, display: "percent" })}
          >
            %
          </button>
        </div>
      </div>
      <div className="chart-legend">
        <span>
          <i className="legend-line" />
          Portfolio
        </span>
        <button
          aria-pressed={s.showBenchmark}
          onClick={() => onChange({ ...s, showBenchmark: !s.showBenchmark })}
        >
          <i className="legend-line dashed" />
          {s.benchmark.toUpperCase()}
          <span className="tertiary">{s.showBenchmark ? "✓" : "+"}</span>
        </button>
        {s.compare && (
          <button onClick={() => onChange({ ...s, compare: "" })}>
            <i className="legend-line compare" />
            {s.compare.toUpperCase()} ×
          </button>
        )}
        <small>
          {s.mode === "drawdown"
            ? "Od průběžného maxima"
            : s.compare
              ? "Index · začátek období = 100"
              : s.mode === "contribution"
                ? "Příspěvek k výnosu · p. b."
                : s.display === "value"
                  ? "CZK"
                  : "Od začátku období"}
        </small>
      </div>
    </div>
  );
}
