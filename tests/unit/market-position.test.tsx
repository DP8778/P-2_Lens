import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CompanyMarketPosition } from "@/components/assets/CompanyMarketPosition";
import { companyMarketPosition, marketLeader } from "@/lib/finance/market-position";

const id = "twelvedata:XNGS:AMD";

test("changing market changes the denominator and leader rather than presenting one AMD-wide share", async () => {
  const { container } = render(<CompanyMarketPosition assetId={id} locale="cs-CZ" />);
  const card = container.querySelector(".market-position-card") as HTMLElement;
  expect(within(card).getByRole("heading", { name: "Serverové procesory x86" })).toBeVisible();
  expect(card).toHaveTextContent("34,5");
  expect(within(card).getByText("Největší hráč").nextElementSibling).toHaveTextContent("Intel");
  expect(card).toHaveTextContent("Nezahrnuje Arm ani AI akcelerátory");
  const graphics = screen.getByRole("button", { name: "Samostatné grafické karty pro PC" });
  graphics.focus(); await userEvent.keyboard("{Enter}");
  expect(graphics).toHaveAttribute("aria-pressed", "true");
  expect(card).toHaveTextContent("12,5");
  expect(card).toHaveTextContent("zaokrouhleno");
  expect(within(card).getByText("Největší hráč").nextElementSibling).toHaveTextContent("NVIDIA");
  expect(card).toHaveTextContent("Bez integrovaných GPU, notebooků a datacenter");
  expect(within(card).getByRole("img")).toHaveAccessibleName(/Kusové podíly, nikoli podíly na tržbách/);
});

test("observations retain units, periods and secondary attribution; revenue totals never become shipment shares", () => {
  const data = companyMarketPosition(id)!;
  expect(data.industry.value).toBe(301_900_000_000);
  for (const market of data.markets) {
    expect(market.period).toBe("Q2 2026");
    expect(market.measure).toBe("unit-shipments");
    expect(market.shares.reduce((sum, share) => sum + share.sharePct, 0)).toBe(100);
    expect(market.sources.some(source => source.kind === "secondary")).toBe(true);
  }
  expect(marketLeader(data.markets[0]).name).toBe("Intel");
  expect(marketLeader(data.markets[1]).name).toBe("NVIDIA");
  expect(data.markets[1].shares.find(share => share.name === "AMD")?.sharePct).toBe(8);
});

test("business model comparison includes sourced strategies and explicitly labelled interpretation", () => {
  render(<CompanyMarketPosition assetId={id} locale="cs-CZ" />);
  expect(screen.getByRole("heading", { name: "Jak se liší jejich podnikání?" })).toBeVisible();
  expect(screen.getAllByText("Interpretace Lens · co sledovat")).toHaveLength(3);
  expect(screen.getByText(/otevřený software ROCm/)).toBeVisible();
  expect(screen.getByText(/CUDA-X/)).toBeVisible();
  expect(screen.getByText(/převážně vlastním produktům/)).toBeVisible();
  expect(screen.getByText(/sekundární zpravodajský zdroj/)).toBeVisible();
});

test("company-specific market research never leaks into another issuer", () => {
  const { container } = render(<CompanyMarketPosition assetId="twelvedata:XNGS:NVDA" locale="cs-CZ" />);
  expect(container).toBeEmptyDOMElement();
});
