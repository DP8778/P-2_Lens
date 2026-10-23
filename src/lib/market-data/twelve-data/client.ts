import "server-only";
import { marketDataConfig } from "../config";
import { MarketDataError } from "../errors";
import { normalizeTwelveDataError, type TwelveDataErrorBody } from "./errors";

const baseUrl = "https://api.twelvedata.com";

export class TwelveDataClient {
  private readonly apiKey?: string;

  constructor(apiKey = process.env.TWELVE_DATA_API_KEY) {
    this.apiKey = apiKey?.trim() || undefined;
  }

  get configured() {
    return Boolean(this.apiKey);
  }

  async get(path: string, params: Record<string, string | number | undefined>) {
    if (!this.apiKey)
      throw new MarketDataError(
        "AUTH",
        "Live market data nejsou nakonfigurována. Nastavte TWELVE_DATA_API_KEY.",
        false,
        503,
      );
    const url = new URL(path, baseUrl);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, String(value));
    });
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Authorization: `apikey ${this.apiKey}`, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(marketDataConfig.requestTimeoutMs),
      });
    } catch {
      throw new MarketDataError(
        "UNAVAILABLE",
        "Twelve Data se nepodařilo kontaktovat.",
        true,
        502,
      );
    }
    const body = (await response.json().catch(() => ({}))) as TwelveDataErrorBody;
    if (!response.ok || body.status === "error") {
      throw normalizeTwelveDataError(response.status, body);
    }
    return body;
  }
}
