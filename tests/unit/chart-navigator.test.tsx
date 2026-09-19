import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { ChartNavigator } from "@/components/charts/ChartNavigator";
import type { AnalysisPoint } from "@/lib/finance/portfolio-engine";

const points = Array.from({ length: 5 }, (_, index) => ({
  timestamp: `2026-09-${String(index + 10).padStart(2, "0")}`,
  portfolioValue: 100 + index,
  portfolioReturnPct: index,
  absolutePnl: index,
  benchmarkReturnPct: index,
  benchmarkDeltaPct: 0,
  assetReturnPct: index,
  portfolioIndex: 100 + index,
  benchmarkIndex: 100 + index,
  assetIndex: 100 + index,
  drawdown: 0,
})) satisfies AnalysisPoint[];

describe("ChartNavigator dynamic timeline", () => {
  test("derives slider bounds and labels from its own data", () => {
    render(<ChartNavigator data={points} range={[1, 4]} onChange={() => undefined} />);
    expect(screen.getByRole("slider", { name: "Začátek období" })).toHaveAttribute("max", "3");
    expect(screen.getByRole("slider", { name: "Konec období" })).toHaveAttribute("max", "4");
    expect(screen.getByRole("slider", { name: "Začátek období" })).toHaveAttribute("aria-valuetext", expect.stringContaining("11"));
    expect(screen.getByRole("slider", { name: "Konec období" })).toHaveAttribute("aria-valuetext", expect.stringContaining("14"));
  });

  test("does not contain the former demo-length magic constant", () => {
    const source = readFileSync("src/components/charts/ChartNavigator.tsx", "utf8");
    expect(source).not.toMatch(/\b730\b/);
  });
});
