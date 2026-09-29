import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssetIndustryContext } from "@/components/assets/AssetIndustryContext";
import { AssetDetailView } from "@/components/assets/AssetDetailView";
import { IndustryCompanies } from "@/components/markets/IndustryCompanies";
import { fundamentalsSource } from "@/lib/fundamentals/snapshot-source";
import { buildIndustryOverview } from "@/lib/finance/industry-overview";
import { buildCompanyIndustryContext } from "@/lib/finance/industry-context";
import { getBrowserMarketDataCache } from "@/lib/market-data/cache/market-cache";
import { industryAssetHref, industryBackHref, readIndustryNavigation, type IndustryNavigation } from "@/lib/markets/industry-navigation";
import { loadHistory } from "@/lib/market-data/service";
import { themeHistoryRange } from "@/lib/finance/theme-performance";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("@/components/portfolio/PortfolioProvider", () => ({ usePortfolio: () => ({ assets: fundamentalsSource.getIndustries().ai.members.map((m) => m.asset), holdings: [], market: { quotes: [], prices: [], fxRates: [] } }) }));
jest.mock("@/components/charts/AssetPriceChart", () => ({ AssetPriceChart: () => <div>Price chart</div> }));
jest.mock("@/components/portfolio/AddAssetDialog", () => ({ AddAssetDialog: () => null }));
jest.mock("@/lib/market-data/service", () => ({ loadHistory: jest.fn().mockRejectedValue(Error("offline")), loadQuotePreview: jest.fn().mockResolvedValue(undefined), loadFxQuote: jest.fn().mockResolvedValue(undefined) }));
const industry = fundamentalsSource.getIndustries().ai;
const asset = industry.members[0].asset;
const navigation: IndustryNavigation = { industry: "ai", period: "3M", weighting: "capitalization", asOf: "2026-09-25", version: industry.version };
beforeEach(async () => { jest.clearAllMocks(); await getBrowserMarketDataCache().clearMarketData(); });

test("table click and keyboard preserve identifiers; back URL reconstructs period and weighting", async () => {
  const overview = buildIndustryOverview(industry.members.map((m) => m.asset), [], new Map(), themeHistoryRange("3M", new Date("2026-09-25")));
  render(<IndustryCompanies overview={overview} timeframe="3M" locale="cs-CZ" navigation={navigation} />);
  await userEvent.type(screen.getByLabelText("Hledat firmu"), asset.symbol);
  const row = screen.getAllByRole("row")[1];
  await userEvent.click(within(row).getByText(asset.name, { selector: "td > span" }));
  expect(push).toHaveBeenCalledWith(industryAssetHref("cs-CZ", asset.id, navigation));
  row.focus(); await userEvent.keyboard("{Enter}");
  expect(push).toHaveBeenCalledTimes(2);
  const query = Object.fromEntries(new URL(industryAssetHref("cs-CZ", asset.id, navigation), "https://lens.test").searchParams);
  expect(readIndustryNavigation({ ...query, contribution: "999999" })).toEqual(navigation);
  const back = new URL(industryBackHref("cs-CZ", navigation), "https://lens.test");
  expect(readIndustryNavigation({ ...Object.fromEntries(back.searchParams), industry: back.searchParams.get("theme")! })).toEqual(navigation);
  expect(readIndustryNavigation({ industry: "unknown" })).toBeUndefined();
});
test("context derives values from saved history without loading the universe again", async () => {
  const range = themeHistoryRange(navigation.period, new Date("2026-09-25T12:00:00Z"));
  const cache = getBrowserMarketDataCache();
  const histories = new Map(industry.members.map(({ asset: member }) => [member.id, [range.from, range.to].map((date, i) => ({ assetId: member.id, date, close: 100 + i * 10, currency: "USD", adjustedForSplits: true }))]));
  for (const [id, points] of histories) await cache.putHistory({ key: id, assetId: id, ...range, points, updatedAt: new Date().toISOString(), provider: asset.provider, version: 1 });
  render(<AssetIndustryContext assetId={asset.id} locale="cs-CZ" industry={industry} navigation={navigation} />);
  await screen.findByText(`${industry.members.length}/${industry.members.length} firem zahrnuto`);
  expect(screen.getByText("Výnos odvětví Lens").nextElementSibling).toHaveTextContent("10");
  expect(screen.getByRole("link", { name: /Zpět na odvětví/ })).toHaveAttribute("href", industryBackHref("cs-CZ", navigation));
  expect(loadHistory).not.toHaveBeenCalled();
  expect(buildCompanyIndustryContext(asset.id, industry, histories, { ...navigation, version: "00000000" })).toMatchObject({ changed: true });
});
test("empty saved context discloses missing data instead of inventing returns", async () => {
  render(<AssetIndustryContext assetId={asset.id} locale="cs-CZ" industry={industry} navigation={navigation} />);
  await screen.findByText(/Historie odvětví není v tomto zařízení/);
  expect(screen.getByText("Příspěvek k indexu").nextElementSibling).toHaveTextContent("—");
  expect(loadHistory).not.toHaveBeenCalled();
});
test("direct Asset Detail has no industry context and a compact unavailable price state", async () => {
  render(<AssetDetailView assetId={asset.id} locale="cs-CZ" />);
  const unavailable = await screen.findByText("Historická data momentálně nejsou dostupná.");
  expect(unavailable).toHaveClass("asset-history-unavailable");
  expect(screen.queryByLabelText("Kontext odvětví")).not.toBeInTheDocument();
  await waitFor(() => expect(loadHistory).toHaveBeenCalledTimes(1));
});
