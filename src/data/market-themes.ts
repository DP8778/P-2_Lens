import type { MarketAsset } from "@/lib/market-data/types";

export interface MarketTheme {
  id: string;
  name: string;
  constituents: MarketAsset[];
}

const stock = (symbol: string, name: string, exchange: "NASDAQ" | "NYSE", micCode: string): MarketAsset => ({
  id: `twelvedata:${micCode}:${symbol}`,
  provider: "twelvedata",
  providerSymbol: symbol,
  symbol,
  name,
  type: "stock",
  exchange,
  micCode,
  currency: "USD",
  country: "United States",
});

const stocks = {
  NVDA: stock("NVDA", "NVIDIA Corporation", "NASDAQ", "XNGS"),
  PLTR: stock("PLTR", "Palantir Technologies Inc.", "NASDAQ", "XNGS"),
  MSFT: stock("MSFT", "Microsoft Corporation", "NASDAQ", "XNGS"),
  GOOGL: stock("GOOGL", "Alphabet Inc.", "NASDAQ", "XNGS"),
  AVGO: stock("AVGO", "Broadcom Inc.", "NASDAQ", "XNGS"),
  AMD: stock("AMD", "Advanced Micro Devices, Inc.", "NASDAQ", "XNGS"),
  ANET: stock("ANET", "Arista Networks, Inc.", "NYSE", "XNYS"),
  TSM: stock("TSM", "Taiwan Semiconductor Manufacturing Company", "NYSE", "XNYS"),
  CRM: stock("CRM", "Salesforce, Inc.", "NYSE", "XNYS"),
  NOW: stock("NOW", "ServiceNow, Inc.", "NYSE", "XNYS"),
  SNOW: stock("SNOW", "Snowflake Inc.", "NYSE", "XNYS"),
  CRWD: stock("CRWD", "CrowdStrike Holdings, Inc.", "NASDAQ", "XNGS"),
  PANW: stock("PANW", "Palo Alto Networks, Inc.", "NASDAQ", "XNGS"),
  FTNT: stock("FTNT", "Fortinet, Inc.", "NASDAQ", "XNGS"),
  ZS: stock("ZS", "Zscaler, Inc.", "NASDAQ", "XNGS"),
} as const;

export const marketThemes: MarketTheme[] = [
  { id: "ai", name: "AI", constituents: [stocks.NVDA, stocks.PLTR, stocks.MSFT, stocks.GOOGL] },
  { id: "ai-infrastructure", name: "AI Infrastructure", constituents: [stocks.NVDA, stocks.AVGO, stocks.AMD, stocks.ANET] },
  { id: "semiconductors", name: "Semiconductors", constituents: [stocks.NVDA, stocks.AMD, stocks.AVGO, stocks.TSM] },
  { id: "saas-cloud", name: "SaaS / Cloud", constituents: [stocks.MSFT, stocks.CRM, stocks.NOW, stocks.SNOW] },
  { id: "cybersecurity", name: "Cybersecurity", constituents: [stocks.CRWD, stocks.PANW, stocks.FTNT, stocks.ZS] },
];

export const marketThemeAssets = Array.from(
  new Map(marketThemes.flatMap((theme) => theme.constituents).map((asset) => [asset.id, asset])).values(),
);
