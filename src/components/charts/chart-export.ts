import type { PortfolioAnalysis } from "@/lib/finance/portfolio-engine";
import type { ChartSettings } from "./ChartControls";
import { dateLabel } from "./chart-formatters";
export function exportPortfolioChart(
  svg: SVGSVGElement,
  analysis: PortfolioAnalysis,
  settings: ChartSettings,
  locale: string,
) {
  const ns = "http://www.w3.org/2000/svg";
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", ns);
  clone.setAttribute("viewBox", "0 -70 1000 460");
  clone.setAttribute("width", "1000");
  clone.setAttribute("height", "460");
  const background = document.createElementNS(ns, "rect");
  for (const [key, value] of Object.entries({
    x: "0",
    y: "-70",
    width: "1000",
    height: "460",
    fill: "#0d0e11",
  }))
    background.setAttribute(key, value);
  clone.prepend(background);
  const title = document.createElementNS(ns, "text");
  for (const [key, value] of Object.entries({
    x: "20",
    y: "-40",
    fill: "#eeeee9",
    "font-size": "18",
    "font-family": "Arial",
  }))
    title.setAttribute(key, value);
  title.textContent = `Lens · ${settings.mode === "drawdown" ? "Poklesy od maxima" : settings.mode === "contribution" ? "Příspěvky k výnosu" : "Vývoj portfolia"} · ${dateLabel(analysis.metrics.startDate, locale)} — ${dateLabel(analysis.metrics.endDate, locale)}`;
  clone.append(title);
  const legend = title.cloneNode() as SVGTextElement;
  legend.setAttribute("y", "-16");
  legend.setAttribute("font-size", "12");
  legend.setAttribute("fill", "#b2b4bc");
  legend.textContent =
    settings.mode === "performance"
      ? `Portfolio: plná čára${settings.showBenchmark ? ` · ${analysis.benchmark}: přerušovaná` : ""}${analysis.compare ? ` · ${analysis.compare}: tečkovaná · index 100` : settings.display === "value" ? " · CZK" : " · výnos %"} · Demo data`
      : `${settings.mode === "drawdown" ? "Pokles v %" : "Příspěvek v p. b."} · Demo data`;
  clone.append(legend);
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `lens-${settings.mode}-${analysis.metrics.endDate.slice(0, 10)}.svg`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
