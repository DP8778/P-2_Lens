import { render, screen } from "@testing-library/react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { DataQualityBadge } from "@/components/portfolio/DataQualityBadge";
import { AssetRow } from "@/components/portfolio/AssetRow";
import { PerformanceChart } from "@/components/charts/PerformanceChart";
import { enrichedPositions } from "@/data/mock/assets";
import { getPerformanceSeries } from "@/data/mock/portfolio";
describe("core components", () => {
  test("MetricCard names its value and non-color trend", () => {
    render(<MetricCard label="Výnos" value="+6,5 %" trend="positive" />);
    expect(screen.getByText("Výnos")).toBeInTheDocument();
    expect(screen.getByLabelText("Kladná změna")).toBeInTheDocument();
  });
  test("DataQualityBadge labels mock provenance", () => {
    render(<DataQualityBadge />);
    expect(screen.getByText(/mock/i)).toBeInTheDocument();
  });
  test("PerformanceChart exposes a textual summary", () => {
    render(<PerformanceChart data={getPerformanceSeries("1M")} normalized showBenchmark />);
    expect(screen.getByText(/počáteční hodnota/i)).toBeInTheDocument();
  });
  test("AssetRow keeps the asset link and signed values accessible", () => {
    const row = enrichedPositions[0];
    render(
      <table>
        <tbody>
          <AssetRow asset={row.asset} position={row} locale="cs-CZ" contribution={2.1} />
        </tbody>
      </table>,
    );
    expect(screen.getByRole("link", { name: /Bitcoin/i })).toHaveAttribute(
      "href",
      "/cs-CZ/assets/BTC",
    );
    expect(screen.getByText(/\+2,1/)).toBeInTheDocument();
  });
});
