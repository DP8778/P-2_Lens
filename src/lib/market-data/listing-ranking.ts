import type { MarketAsset } from "./types";

const planOrder = ["basic", "grow", "pro", "ultra", "enterprise", "custom"];
const primaryMics = new Set([
  "XNGS", "XNAS", "XNYS", "ARCX", "XLON", "XETR", "XPAR", "XAMS", "XTSE", "XASX", "XHKG", "XTKS",
]);
const primaryExchanges = new Set([
  "NASDAQ", "NYSE", "NYSE ARCA", "LSE", "XETRA", "EURONEXT", "TSX", "ASX", "HKEX", "TSE",
]);

const normalized = (value: string) => value.trim().toLocaleLowerCase("en-US");

export function normalizeCompanyName(value: string) {
  return normalized(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function accessRank(asset: MarketAsset) {
  const value = asset.access?.global ?? asset.access?.plan ?? asset.access?.planBusiness;
  if (!value) return planOrder.length + 1;
  const rank = planOrder.findIndex((plan) => normalized(value).includes(plan));
  return rank < 0 ? planOrder.length : rank;
}

function venueRank(asset: MarketAsset) {
  if (asset.micCode && primaryMics.has(asset.micCode.toUpperCase())) return 0;
  if (primaryExchanges.has(asset.exchange.toUpperCase())) return 0;
  if (asset.country?.toLowerCase().includes("united states") && asset.currency === "USD") return 1;
  return 2;
}

function listingScore(asset: MarketAsset, query: string) {
  const needle = normalized(query);
  return [
    normalized(asset.symbol) === needle ? 0 : 1,
    accessRank(asset),
    venueRank(asset),
    normalized(asset.name) === needle ? 0 : 1,
    asset.type === "stock" || asset.type === "etf" ? 0 : 1,
  ] as const;
}

export function rankMarketListings(assets: MarketAsset[], query: string) {
  return assets
    .map((asset, providerIndex) => ({ asset, providerIndex, score: listingScore(asset, query) }))
    .sort((a, b) => {
      for (let index = 0; index < a.score.length; index += 1) {
        const difference = a.score[index] - b.score[index];
        if (difference) return difference;
      }
      return a.providerIndex - b.providerIndex || a.asset.id.localeCompare(b.asset.id);
    })
    .map(({ asset }) => asset);
}

export function isSameCompanyListing(left: MarketAsset, right: MarketAsset) {
  return left.symbol.toUpperCase() === right.symbol.toUpperCase()
    && normalizeCompanyName(left.name) === normalizeCompanyName(right.name);
}
