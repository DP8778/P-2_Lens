import { SlidersHorizontal, Download } from "lucide-react";
import { assetCatalog } from "@/data/mock/catalog";
import type { Timeframe } from "@/types/finance";
import type { ChartDisplay, ChartMode } from "@/lib/finance/portfolio-engine";
import { chartModes } from "./chart-options";
import type { Asset } from "@/lib/finance/domain";
import { ComparePicker } from "./ComparePicker";
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
  compareAssets = assetCatalog,
  allowNasdaqBenchmark = true,
}: {
  settings: ChartSettings;
  onChange: (next: ChartSettings) => void;
  timeframe: Timeframe | "CUSTOM";
  onTimeframe: (value: Timeframe) => void;
  onExport: () => void;
  compareAssets?: Asset[];
  allowNasdaqBenchmark?: boolean;
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
                  <option value="spy">S&P 500 benchmark</option>
                  {allowNasdaqBenchmark && <option value="qqq">Nasdaq 100 benchmark</option>}
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
        <div className="chart-view-controls">
          <ComparePicker
            assets={compareAssets}
            selected={s.compare}
            benchmarkSelected={s.showBenchmark}
            onSelect={(compare) => onChange({ ...s, compare })}
            onSelectBenchmark={() => onChange({ ...s, compare: "", showBenchmark: true })}
          />
          {s.compare || s.showBenchmark ? (
            <span className="comparison-scale" title="Srovnávací řady začínají na hodnotě 100">
              Index 100
            </span>
          ) : (
            <div className="segmented compact" aria-label="Zobrazení hodnoty">
              <button
                disabled={s.mode !== "performance"}
                aria-pressed={s.display === "value"}
                onClick={() => onChange({ ...s, display: "value" })}
              >
                Hodnota
              </button>
              <button
                disabled={s.mode !== "performance"}
                aria-pressed={s.display === "percent"}
                onClick={() => onChange({ ...s, display: "percent" })}
              >
                %
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
