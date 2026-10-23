import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IndustryMarketMap } from "@/components/markets/IndustryMarketMap";
import { buildIndustryOverview } from "@/lib/finance/industry-overview";
import { marketThemes } from "@/data/market-themes";

// jsdom has no layout: supply measured bounds, keeping the real Recharts layout engine.
test("real treemap geometry uses 9:1 cap areas and exposes keyboard context links", async () => {
  const bounds = jest.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 800, height: 400, top: 0, left: 0, bottom: 400, right: 800, x: 0, y: 0, toJSON: () => ({}) });
  try {
    const assets = marketThemes[0].constituents.slice(0, 3);
    const overview = buildIndustryOverview(assets, [], new Map(), { from: "2026-09-01", to: "2026-09-25", interval: "1day" }, { [assets[0].symbol]: 900, [assets[1].symbol]: 100 });
    const { container } = render(<IndustryMarketMap overview={overview} timeframe="3M" locale="cs-CZ" navigation={{ industry: "ai", period: "3M", weighting: "capitalization" }} />);
    const links = await screen.findAllByRole("link");
    expect(links).toHaveLength(2);
    const areas = [...container.querySelectorAll("a rect")].map((rect) => Number(rect.getAttribute("width")) * Number(rect.getAttribute("height")));
    expect(areas[0] / areas[1]).toBeCloseTo(9, 0);
    expect(screen.getByText(/1 firem bez kapitalizace vynecháno/)).toBeVisible();
    await userEvent.tab();
    expect(links[0]).toHaveFocus();
    expect(links[0]).toHaveAccessibleName(new RegExp(assets[0].name));
    expect(links[0]).toHaveAttribute("href", `/cs-CZ/assets/${encodeURIComponent(assets[0].id)}?industry=ai&period=3M&weighting=market-cap`);
    expect(links[0]).toHaveAccessibleName(/90 %/);
  } finally { bounds.mockRestore(); }
});
