import { useRef, useState } from "react";
import type { AnalysisPoint } from "@/lib/finance/portfolio-engine";
import { timeline } from "@/lib/finance/portfolio-engine";
import { dateLabel } from "./chart-formatters";
export function ChartNavigator({
  data,
  range,
  onChange,
}: {
  data: AnalysisPoint[];
  range: [number, number];
  onChange: (range: [number, number]) => void;
}) {
  const drag = useRef<{
    x: number;
    range: [number, number];
    mode: "start" | "end" | "move";
  } | null>(null);
  const previewRef = useRef<[number, number]>(range);
  const [preview, setPreview] = useState<[number, number] | null>(null);
  const displayRange = preview ?? range;
  const updatePreview = (next: [number, number]) => {
    previewRef.current = next;
    setPreview(next);
  };
  const values = data.map((p) => p.portfolioValue);
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const path = values
    .map(
      (v, i) =>
        `${i ? "L" : "M"}${(i / (values.length - 1)) * 1000},${43 - ((v - min) / span) * 34}`,
    )
    .join(" ");
  return (
    <div className="chart-navigator">
      <svg
        viewBox="0 0 1000 52"
        preserveAspectRatio="none"
        aria-label="Přesunout vybrané období tažením"
        onPointerDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const local = e.clientX - rect.left;
          const left = (displayRange[0] / 730) * rect.width;
          const right = (displayRange[1] / 730) * rect.width;
          const mode =
            Math.abs(local - left) < 12 ? "start" : Math.abs(local - right) < 12 ? "end" : "move";
          previewRef.current = displayRange;
          setPreview(displayRange);
          drag.current = { x: e.clientX, range: displayRange, mode };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const delta = Math.round(
            ((e.clientX - drag.current.x) / e.currentTarget.getBoundingClientRect().width) * 730,
          );
          if (drag.current.mode === "start") {
            updatePreview([
              Math.max(0, Math.min(drag.current.range[1] - 1, drag.current.range[0] + delta)),
              drag.current.range[1],
            ]);
            return;
          }
          if (drag.current.mode === "end") {
            updatePreview([
              drag.current.range[0],
              Math.min(730, Math.max(drag.current.range[0] + 1, drag.current.range[1] + delta)),
            ]);
            return;
          }
          const width = drag.current.range[1] - drag.current.range[0];
          const start = Math.max(0, Math.min(730 - width, drag.current.range[0] + delta));
          updatePreview([start, start + width]);
        }}
        onPointerUp={() => {
          if (drag.current) onChange(previewRef.current);
          drag.current = null;
          setPreview(null);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setPreview(null);
        }}
      >
        <path d={path} fill="none" stroke="#777b83" strokeWidth="1.3" />
        <rect
          x={(displayRange[0] / 730) * 1000}
          y="1"
          width={((displayRange[1] - displayRange[0]) / 730) * 1000}
          height="50"
          fill="#ffffff0b"
          stroke="#ffffff55"
          rx="4"
        />
        {displayRange.map((value, index) => (
          <rect
            key={index}
            x={(value / 730) * 1000 - 3}
            y="12"
            width="6"
            height="28"
            rx="2"
            fill="#bcbcc8"
          />
        ))}
      </svg>
      <div className="navigator-inputs">
        <label>
          Od{" "}
          <input
            aria-label="Začátek období"
            type="range"
            min="0"
            max="729"
            value={range[0]}
            aria-valuetext={dateLabel(timeline[range[0]])}
            onChange={(e) => onChange([Math.min(Number(e.target.value), range[1] - 1), range[1]])}
          />
        </label>
        <label>
          Do{" "}
          <input
            aria-label="Konec období"
            type="range"
            min="1"
            max="730"
            value={range[1]}
            aria-valuetext={dateLabel(timeline[range[1]])}
            onChange={(e) => onChange([range[0], Math.max(Number(e.target.value), range[0] + 1)])}
          />
        </label>
      </div>
      <div className="navigator-labels">
        <span>{dateLabel(timeline[range[0]])}</span>
        <span>Posuňte výběr nebo upravte jeho okraje</span>
        <span>{dateLabel(timeline[range[1]])}</span>
      </div>
    </div>
  );
}
