export const chartOptions = {
  width: 1000,
  height: 390,
  left: 16,
  right: 80,
  top: 28,
  bottom: 42,
  line: "#eeeee9",
  benchmark: "#969ba4",
  compare: "#b5b2e4",
  grid: "#ffffff0d",
};
export const chartModes = [
  { value: "performance", label: "Vývoj" },
  { value: "contribution", label: "Příspěvky" },
  { value: "drawdown", label: "Poklesy" },
] as const;
