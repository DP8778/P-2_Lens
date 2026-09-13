export function calculateAllocation(positionValue: number, portfolioValue: number): number {
  if (portfolioValue <= 0) return 0;
  return (positionValue / portfolioValue) * 100;
}
