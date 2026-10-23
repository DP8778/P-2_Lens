import { render, screen, within } from "@testing-library/react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { DataQualityBadge } from "@/components/portfolio/DataQualityBadge";
import { AssetRow } from "@/components/portfolio/AssetRow";
import { PerformanceChart } from "@/components/charts/PerformanceChart";
import { enrichedPositions } from "@/data/mock/assets";
import { getPerformanceSeries } from "@/data/mock/portfolio";
import { HoldingsTable } from "@/components/portfolio/HoldingsTable";
import {
  buildAnalysis,
  initialTransactions,
  timeframeRange,
} from "@/lib/finance/portfolio-engine";
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
      `/cs-CZ/assets/${encodeURIComponent(row.asset.id)}`,
    );
    expect(screen.getByText(/\+2,1/)).toBeInTheDocument();
  });
  test("cash balance is not presented as an investment return", () => {
    const analysis = buildAnalysis(initialTransactions, timeframeRange("1M"));
    render(
      <HoldingsTable
        analysis={analysis}
        holdings={analysis.holdings}
        locale="cs-CZ"
        onAdd={() => undefined}
        period="1M"
      />,
    );
    const cashRow = screen.getByRole("link", { name: "Detail CZK" }).closest("tr")!;
    expect(
      within(cashRow).getByLabelText("Výnos období není pro hotovost relevantní"),
    ).toHaveTextContent("—");
    expect(
      within(cashRow).getByLabelText("Příspěvek není pro hotovost relevantní"),
    ).toHaveTextContent("—");
  });
});
