export function calculateContribution(allocationPct: number, assetReturnPct: number): number {
  return (allocationPct / 100) * assetReturnPct;
}
