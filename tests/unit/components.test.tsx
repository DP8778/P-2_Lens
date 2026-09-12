import { render, screen } from "@testing-library/react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { InsightCard } from "@/components/insights/InsightCard";
import { DataQualityBadge } from "@/components/portfolio/DataQualityBadge";
import { AssetRow } from "@/components/portfolio/AssetRow";
import { PerformanceChart } from "@/components/charts/PerformanceChart";
import { enrichedPositions } from "@/data/mock/assets";
import { getPerformanceSeries } from "@/data/mock/portfolio";
import { buildInsightInput } from "@/lib/ai/buildInsightInput";
import { buildFallbackInsight } from "@/lib/ai/fallbackSummarizer";
import { buildPortfolioMetrics } from "@/lib/finance/buildPortfolioMetrics";
describe("core components", () => {
  test("MetricCard names its value and non-color trend", () => {
    render(<MetricCard label="Výnos" value="+6,5 %" trend="positive" />);
    expect(screen.getByText("Výnos")).toBeInTheDocument();
    expect(screen.getByLabelText("Kladná změna")).toBeInTheDocument();
  });
  test("InsightCard renders evidence and disclaimer", () => {
    const insight = buildFallbackInsight(buildInsightInput(buildPortfolioMetrics("1M"), "1M"));
    render(<InsightCard state="demo" insight={insight} />);
    expect(screen.getByText(insight.headline)).toBeInTheDocument();
    expect(screen.getByText(/není investičním doporučením/i)).toBeInTheDocument();
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
