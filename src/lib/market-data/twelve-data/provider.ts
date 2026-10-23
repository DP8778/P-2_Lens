import "server-only";
import type { MarketDataProvider } from "../provider";
import { MarketDataError } from "../errors";
import type { DateRange, MarketAsset, MarketQuote } from "../types";
import { rankMarketListings } from "../listing-ranking";
import { TwelveDataClient } from "./client";
import {
  normalizeFxRate,
  normalizeHistory,
  normalizeQuote,
  normalizeSearchResponse,
  invertFxRate,
} from "./normalizers";

const providerSymbol = (asset: MarketAsset) =>
  asset.exchange ? `${asset.providerSymbol}:${asset.exchange}` : asset.providerSymbol;

export class TwelveDataProvider implements MarketDataProvider {
  readonly id = "twelvedata" as const;
  constructor(private readonly client = new TwelveDataClient()) {}

  get configured() {
    return this.client.configured;
  }

  async searchAssets(query: string) {
    const response = await this.client.get("/symbol_search", {
      symbol: query,
      outputsize: 30,
      show_plan: "true",
    });
    return rankMarketListings(normalizeSearchResponse(response), query);
  }

  async getQuote(asset: MarketAsset) {
    const response = await this.client.get("/quote", {
      symbol: asset.providerSymbol,
      exchange: asset.exchange,
      mic_code: asset.micCode,
    });
    return normalizeQuote(response, asset);
  }

  async getQuotes(assets: MarketAsset[]): Promise<MarketQuote[]> {
    if (assets.length === 1) return [await this.getQuote(assets[0])];
    const response = (await this.client.get("/quote", {
      symbol: assets.map(providerSymbol).join(","),
    })) as Record<string, unknown>;
    return assets.flatMap((asset) => {
      const candidate = response[providerSymbol(asset)] ?? response[asset.providerSymbol];
      if (!candidate) return [];
      try {
        return [normalizeQuote(candidate, asset)];
      } catch {
        return [];
      }
    });
  }

  async getHistory(asset: MarketAsset, range: DateRange) {
    const response = await this.client.get("/time_series", {
      symbol: asset.providerSymbol,
      exchange: asset.exchange,
      mic_code: asset.micCode,
      interval: range.interval,
      start_date: range.from,
      end_date: range.to,
      order: "ASC",
      outputsize: 5000,
    });
    const points = normalizeHistory(response, asset);
    if (!points.length)
      throw new MarketDataError("NO_HISTORY", "Pro aktivum nejsou dostupná historická data.", false, 404);
    return { asset, range, points, source: "network" as const };
  }

  async getFxRate(from: string, to: string) {
    if (from === to)
      return {
        base: from,
        quote: to,
        rate: 1,
        timestamp: new Date().toISOString(),
        freshness: "fresh" as const,
        source: "network" as const,
      };
    try {
      const response = (await this.client.get("/exchange_rate", { symbol: `${from}/${to}` })) as {
        rate?: string | number;
        timestamp?: number;
      };
      return normalizeFxRate(response, from, to, response.timestamp);
    } catch (error) {
      if (!(error instanceof MarketDataError) || !["NOT_FOUND", "INVALID_SYMBOL"].includes(error.code)) throw error;
      const inverse = (await this.client.get("/exchange_rate", { symbol: `${to}/${from}` })) as {
        rate?: string | number;
        timestamp?: number;
      };
      const normalized = normalizeFxRate(inverse, to, from, inverse.timestamp);
      return { ...normalized, base: from, quote: to, rate: invertFxRate(normalized.rate) };
    }
  }

  async getFxHistory(from: string, to: string, range: DateRange) {
    if (from === to)
      return {
        base: from,
        quote: to,
        range,
        points: [{ base: from, quote: to, date: range.from, rate: 1 }],
        source: "network" as const,
      };
    const asset: MarketAsset = {
      id: `fx:${from}:${to}`,
      provider: "twelvedata",
      providerSymbol: `${from}/${to}`,
      symbol: `${from}/${to}`,
      name: `${from}/${to}`,
      type: "cash",
      exchange: "FX",
      currency: to,
    };
    const request = async (base: string, quote: string) =>
      this.client.get("/time_series", {
        symbol: `${base}/${quote}`,
        interval: "1day",
        start_date: range.from,
        end_date: range.to,
        order: "ASC",
        outputsize: 5000,
      });
    let response: unknown;
    let inverted = false;
    try {
      response = await request(from, to);
    } catch (error) {
      if (!(error instanceof MarketDataError) || !["NOT_FOUND", "INVALID_SYMBOL"].includes(error.code)) throw error;
      response = await request(to, from);
      inverted = true;
    }
    const points = normalizeHistory(response, asset).map((point) => ({
      base: from,
      quote: to,
      date: point.date,
      rate: inverted ? invertFxRate(point.close) : point.close,
    }));
    if (!points.length)
      throw new MarketDataError("NO_HISTORY", "Historický měnový kurz není dostupný.", false, 404);
    return { base: from, quote: to, range, points, source: "network" as const };
  }
}
