export function calculateReturn(startValue: number, endValue: number): number {
  if (!Number.isFinite(startValue) || !Number.isFinite(endValue) || startValue === 0) return 0;
  return ((endValue - startValue) / Math.abs(startValue)) * 100;
}
