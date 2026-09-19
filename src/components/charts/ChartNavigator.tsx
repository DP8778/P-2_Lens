import { useRef, useState } from "react";
import type { AnalysisPoint } from "@/lib/finance/portfolio-engine";
import { dateLabel } from "./chart-formatters";

const clampRange = (range: [number, number], maxIndex: number): [number, number] => {
  if (maxIndex <= 0) return [0, 0];
  const start = Math.max(0, Math.min(maxIndex - 1, range[0]));
  const end = Math.max(start + 1, Math.min(maxIndex, range[1]));
  return [start, end];
};

export function ChartNavigator({ data, range, onChange }: {
  data: AnalysisPoint[];
  range: [number, number];
  onChange: (range: [number, number]) => void;
}) {
  const maxIndex = Math.max(0, data.length - 1);
  const denominator = Math.max(1, maxIndex);
  const drag = useRef<{ x: number; range: [number, number]; mode: "start" | "end" | "move" } | null>(null);
  const previewRef = useRef<[number, number]>(clampRange(range, maxIndex));
  const [preview, setPreview] = useState<[number, number] | null>(null);
  const displayRange = clampRange(preview ?? range, maxIndex);
  const updatePreview = (next: [number, number]) => {
    const clamped = clampRange(next, maxIndex);
    previewRef.current = clamped;
    setPreview(clamped);
  };
  const values = data.map((point) => point.portfolioValue);
  const min = values.length ? Math.min(...values) : 0;
  const span = values.length ? Math.max(...values) - min || 1 : 1;
  const path = values.map((value, index) =>
    `${index ? "L" : "M"}${(index / denominator) * 1000},${43 - ((value - min) / span) * 34}`,
  ).join(" ");
  const dateAt = (index: number) => data[Math.max(0, Math.min(maxIndex, index))]?.timestamp ?? "";

  return (
    <div className="chart-navigator">
      <svg
        viewBox="0 0 1000 52"
        preserveAspectRatio="none"
        aria-label="Přesunout vybrané období tažením"
        onPointerDown={(event) => {
          if (maxIndex <= 0) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const local = event.clientX - rect.left;
          const left = (displayRange[0] / denominator) * rect.width;
          const right = (displayRange[1] / denominator) * rect.width;
          const mode = Math.abs(local - left) < 12 ? "start" : Math.abs(local - right) < 12 ? "end" : "move";
          previewRef.current = displayRange;
          setPreview(displayRange);
          drag.current = { x: event.clientX, range: displayRange, mode };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!drag.current || maxIndex <= 0) return;
          const delta = Math.round(((event.clientX - drag.current.x) / event.currentTarget.getBoundingClientRect().width) * maxIndex);
          if (drag.current.mode === "start") {
            updatePreview([Math.max(0, Math.min(drag.current.range[1] - 1, drag.current.range[0] + delta)), drag.current.range[1]]);
            return;
          }
          if (drag.current.mode === "end") {
            updatePreview([drag.current.range[0], Math.min(maxIndex, Math.max(drag.current.range[0] + 1, drag.current.range[1] + delta))]);
            return;
          }
          const width = drag.current.range[1] - drag.current.range[0];
          const start = Math.max(0, Math.min(maxIndex - width, drag.current.range[0] + delta));
          updatePreview([start, start + width]);
        }}
        onPointerUp={() => {
          if (drag.current) onChange(previewRef.current);
          drag.current = null;
          setPreview(null);
        }}
        onPointerCancel={() => { drag.current = null; setPreview(null); }}
      >
        <path d={path} fill="none" stroke="#777b83" strokeWidth="1.3" />
        <rect x={(displayRange[0] / denominator) * 1000} y="1" width={((displayRange[1] - displayRange[0]) / denominator) * 1000} height="50" fill="#ffffff0b" stroke="#ffffff55" rx="4" />
        {displayRange.map((value, index) => <rect key={index} x={(value / denominator) * 1000 - 3} y="12" width="6" height="28" rx="2" fill="#bcbcc8" />)}
      </svg>
      <div className="navigator-inputs">
        <label>
          Od{" "}
          <input aria-label="Začátek období" type="range" min="0" max={Math.max(0, maxIndex - 1)} value={displayRange[0]} aria-valuetext={dateLabel(dateAt(displayRange[0]))} onChange={(event) => onChange(clampRange([Number(event.target.value), displayRange[1]], maxIndex))} />
        </label>
        <label>
          Do{" "}
          <input aria-label="Konec období" type="range" min={Math.min(1, maxIndex)} max={maxIndex} value={displayRange[1]} aria-valuetext={dateLabel(dateAt(displayRange[1]))} onChange={(event) => onChange(clampRange([displayRange[0], Number(event.target.value)], maxIndex))} />
        </label>
      </div>
      <div className="navigator-labels">
        <span>{dateLabel(dateAt(displayRange[0]))}</span>
        <span>Posuňte výběr nebo upravte jeho okraje</span>
        <span>{dateLabel(dateAt(displayRange[1]))}</span>
      </div>
    </div>
  );
}
