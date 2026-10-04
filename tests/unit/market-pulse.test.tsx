import { StrictMode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarketPulse } from "@/components/markets/MarketPulse";
import { fundamentalsSource } from "@/lib/fundamentals/snapshot-source";
import { readIndustryNavigation, type IndustryNavigation } from "@/lib/markets/industry-navigation";

jest.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }));
jest.mock("@/components/markets/ThemeDetail", () => ({ ThemeDetail: ({ initialNavigation, onNavigationChange }: { initialNavigation: IndustryNavigation; onNavigationChange: (next: IndustryNavigation) => void }) => <div data-testid="detail">
  <output>{JSON.stringify(initialNavigation)}</output>
  <button onClick={() => onNavigationChange({ ...initialNavigation, period: "3M" })}>3M</button>
  <button onClick={() => onNavigationChange({ ...initialNavigation, weighting: "capitalization" })}>Váženo kapitalizací</button>
</div> }));
const industries = fundamentalsSource.getIndustries();
const discovery = Object.fromEntries(Object.entries(industries).map(([id, item]) => [id, { companies: item.members.length, updatedAt: item.updatedAt, version: item.version }]));
const originalFetch = global.fetch;
beforeEach(() => { window.history.replaceState(null, "", "/cs-CZ/markets"); global.fetch = jest.fn(); });
afterEach(() => { global.fetch = originalFetch; });

test("Dashboard discovers canonical snapshot universes without compatibility returns or price requests", () => {
  render(<StrictMode><MarketPulse locale="cs-CZ" discovery={discovery} /></StrictMode>);
  const ai = screen.getByRole("link", { name: /^AI 60 firem/ });
  expect(ai).toHaveAttribute("href", "/cs-CZ/markets?theme=ai");
  expect(ai).toHaveTextContent("Data k");
  expect(ai).not.toHaveTextContent(/%|roste|klesá|4\/4/);
  expect(screen.getByRole("link", { name: /^Semiconductors 49 firem/ })).toBeVisible();
  expect(global.fetch).not.toHaveBeenCalled();
});

test("full Markets uses canonical membership and removes the four-stock basket and quotes", () => {
  render(<MarketPulse locale="cs-CZ" variant="full" industries={industries} />);
  expect(screen.getByRole("button", { name: /^AI 60 sledovaných firem/ })).toHaveAttribute("aria-pressed", "true");
  expect(screen.queryByText(/Složení výpočtového koše/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Cena nedostupná|Data nejsou dostupná/)).not.toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});

test("theme, period and weighting replace URL state; re-render and fresh mount reconstruct it", async () => {
  const user = userEvent.setup();
  const props = { locale: "cs-CZ" as const, variant: "full" as const, industries };
  const { rerender, unmount } = render(<MarketPulse {...props} />);
  const entries = window.history.length;
  await user.click(screen.getByRole("button", { name: /^Semiconductors 49/ }));
  expect(new URLSearchParams(location.search).get("theme")).toBe("semiconductors");
  rerender(<MarketPulse {...props} />);
  await user.click(screen.getByRole("button", { name: "3M" }));
  expect(new URLSearchParams(location.search).get("period")).toBe("3M");
  rerender(<MarketPulse {...props} />);
  await user.click(screen.getByRole("button", { name: "Váženo kapitalizací" }));
  const query = new URLSearchParams(location.search);
  expect(query.get("weighting")).toBe("market-cap");
  expect(query.get("asOf")).toBe(new Date().toISOString().slice(0, 10));
  expect(query.get("version")).toBe(industries.semiconductors.version);
  expect([...query.keys()].sort()).toEqual(["asOf", "period", "theme", "version", "weighting"]);
  expect(window.history.length).toBe(entries);
  unmount();
  render(<MarketPulse {...props} />);
  expect(screen.getByRole("button", { name: /^Semiconductors 49/ })).toHaveAttribute("aria-pressed", "true");
  expect(JSON.parse(within(screen.getByTestId("detail")).getByRole("status").textContent!)).toMatchObject({ industry: "semiconductors", period: "3M", weighting: "capitalization", version: industries.semiconductors.version });
  expect(global.fetch).not.toHaveBeenCalled();
});

test("view changes preserve explicit asOf and valid snapshot version", async () => {
  window.history.replaceState(null, "", `/cs-CZ/markets?theme=semiconductors&period=1Y&weighting=equal&asOf=2026-09-25&version=${industries.semiconductors.version}`);
  render(<MarketPulse locale="cs-CZ" variant="full" industries={industries} />);
  await userEvent.click(screen.getByRole("button", { name: "3M" }));
  expect(new URLSearchParams(location.search).get("asOf")).toBe("2026-09-25");
  expect(new URLSearchParams(location.search).get("version")).toBe(industries.semiconductors.version);
});

test.each([
  { industry: "unknown" }, { industry: "ai", period: "ALL" }, { industry: "ai", weighting: "price" },
  { industry: "ai", asOf: "2026-02-30" }, { industry: "ai", version: "<script>" },
  { industry: ["ai", "semiconductors"] }, { industry: "ai", period: ["1M", "1Y"] },
])("invalid research params remain rejected: %j", query => {
  expect(readIndustryNavigation(query)).toBeUndefined();
});

test("missing canonical membership is disclosed rather than replaced by the compatibility universe", () => {
  render(<MarketPulse locale="cs-CZ" variant="full" />);
  expect(screen.getByText("Ověřené členství tématu není dostupné.")).toBeVisible();
  expect(screen.queryByTestId("detail")).not.toBeInTheDocument();
  expect(screen.queryByText("18 sledovaných firem")).not.toBeInTheDocument();
});


test("clearing the query restores defaults rather than retaining a previous research state", () => {
  window.history.replaceState(null, "", "/cs-CZ/markets?theme=semiconductors&period=3M&weighting=market-cap");
  const { rerender } = render(<MarketPulse locale="cs-CZ" variant="full" industries={industries} />);
  expect(screen.getByRole("button", { name: /^Semiconductors 49/ })).toHaveAttribute("aria-pressed", "true");
  window.history.replaceState(null, "", "/cs-CZ/markets");
  rerender(<MarketPulse locale="cs-CZ" variant="full" industries={industries} />);
  expect(screen.getByRole("button", { name: /^AI 60/ })).toHaveAttribute("aria-pressed", "true");
  expect(JSON.parse(within(screen.getByTestId("detail")).getByRole("status").textContent!)).toMatchObject({ industry: "ai", period: "1M", weighting: "equal" });
});
