export const chartOptions = {
  width: 1000,
  height: 390,
  left: 16,
  right: 80,
  top: 28,
  bottom: 42,
  line: "var(--chart-line)",
  benchmark: "var(--chart-benchmark)",
  compare: "var(--chart-compare)",
  grid: "var(--chart-grid)",
};
export const chartModes = [
  { value: "performance", label: "Vývoj" },
  { value: "contribution", label: "Příspěvky" },
  { value: "drawdown", label: "Poklesy" },
] as const;
