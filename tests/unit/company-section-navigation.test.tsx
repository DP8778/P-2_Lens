import { render, screen, waitFor, within } from "@testing-library/react";
import { AssetDetailView } from "@/components/assets/AssetDetailView";
import { fundamentalsSource } from "@/lib/fundamentals/snapshot-source";

jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/components/portfolio/PortfolioProvider", () => {
  const portfolio = { assets: [], holdings: [], market: { quotes: [], prices: [], fxRates: [] } };
  return { usePortfolio: () => portfolio };
});
jest.mock("@/components/assets/CompanyResearch", () => ({
  ...jest.requireActual("@/components/assets/CompanyResearch"),
  useCompanyResearch: () => ({ loading: false, error: "unavailable", refresh: jest.fn() }),
}));
jest.mock("@/lib/market-data/service", () => ({
  loadQuotePreview: jest.fn().mockRejectedValue(new Error("Quote unavailable")),
  loadHistory: jest.fn().mockRejectedValue(new Error("History unavailable")),
  loadFxQuote: jest.fn().mockRejectedValue(new Error("FX unavailable")),
}));

const ttd = "twelvedata:XNGM:TTD";
const anchors = ["#company-history-title", "#platform-economics-title", "#financial-anatomy-title", "#advertising-market-title"];

test.each(["cs-CZ", "en-US"] as const)("TTD %s links follow the rendered sections and omit unavailable platform economics", async locale => {
  const initialAsset = fundamentalsSource.getInstrument(ttd)!;
  const fundamentals = fundamentalsSource.getCompany(ttd)!;
  const { container, rerender } = render(<AssetDetailView assetId={ttd} locale={locale} initialAsset={initialAsset} fundamentals={fundamentals} marketConfigured={false} />);
  await waitFor(() => expect(container.querySelector(".quote-unavailable")).toBeInTheDocument());
  const nav = screen.getByRole("navigation", { name: locale === "en-US" ? "Company sections" : "Sekce firmy" });
  const links = within(nav).getAllByRole("link");
  expect(links.map(link => link.getAttribute("href"))).toEqual(anchors);
  expect(links.map(link => link.textContent)).toEqual(locale === "en-US"
    ? ["Development", "Platform economics", "Revenue to profit", "Market & competitors"]
    : ["Vývoj", "Ekonomika platformy", "Od tržeb k zisku", "Trh a konkurence"]);
  const targets = anchors.map(anchor => container.querySelector(anchor)!);
  for (const target of targets) expect(target).toHaveAttribute("tabindex", "-1");
  for (let index = 1; index < targets.length; index++) expect(targets[index - 1].compareDocumentPosition(targets[index]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  rerender(<AssetDetailView assetId={ttd} locale={locale} initialAsset={initialAsset} fundamentals={{ ...fundamentals, statements: [] }} marketConfigured={false} />);
  expect(within(nav).getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(anchors.filter(anchor => anchor !== "#platform-economics-title"));
  expect(container.querySelector("#platform-economics-title")).not.toBeInTheDocument();
  for (const link of within(nav).getAllByRole("link")) expect(container.querySelector(link.getAttribute("href")!)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Hospodaření|Business performance/ })).not.toBeInTheDocument();
  expect(container).not.toHaveTextContent(/výkazy výše zůstávají k dispozici|Reported financials above remain available/);
});

test.each([
  ["twelvedata:XNGS:AMD", ["#company-history-title", "#company-revenue-mix-title", "#company-market-title", "#financial-anatomy-title"]],
  ["twelvedata:XNGS:NVDA", ["#company-history-title", "#financial-anatomy-title"]],
])("%s retains its own section navigation", async (assetId, expected) => {
  const { container } = render(<AssetDetailView assetId={assetId} locale="cs-CZ" initialAsset={fundamentalsSource.getInstrument(assetId)!} fundamentals={fundamentalsSource.getCompany(assetId)} marketConfigured={false} />);
  await waitFor(() => expect(container.querySelector(".quote-unavailable")).toBeInTheDocument());
  const links = within(screen.getByRole("navigation", { name: "Sekce firmy" })).getAllByRole("link");
  expect(links.map(link => link.getAttribute("href"))).toEqual(expected);
  for (const link of links) expect(container.querySelector(link.getAttribute("href")!)).toBeInTheDocument();
});
