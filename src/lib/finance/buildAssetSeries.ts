import type { PricePoint } from "@/types/finance";

export function buildAssetSeries(symbol: string, currentPrice: number): PricePoint[] {
  const seed = [...symbol].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const factors = [0.76, 0.79, 0.77, 0.83, 0.86, 0.84, 0.91, 0.94, 0.9, 0.96, 0.93, 0.98, 0.95, 1];
  return factors.map((factor, index) => ({
    timestamp: new Date(Date.UTC(2025, 7 + index, 1)).toISOString(),
    value: Number((currentPrice * factor * (1 + Math.sin(seed + index) * 0.012)).toFixed(2)),
  }));
}
