import { MarketDataError } from "@/lib/market-data/errors";
import {
  invertFxRate,
  normalizeHistory,
  normalizeQuote,
  normalizeSearchResponse,
} from "@/lib/market-data/twelve-data/normalizers";
import { normalizeTwelveDataError } from "@/lib/market-data/twelve-data/errors";

const search = {
  status: "ok",
  data: [
    { symbol: "ABC", instrument_name: "ABC US", exchange: "NASDAQ", mic_code: "XNAS", exchange_timezone: "America/New_York", instrument_type: "Common Stock", country: "United States", currency: "USD" },
    { symbol: "ABC", instrument_name: "ABC Europe", exchange: "Xetra", mic_code: "XETR", exchange_timezone: "Europe/Berlin", instrument_type: "ETF", country: "Germany", currency: "EUR" },
    { symbol: "ABC1", instrument_name: "Unsupported", exchange: "OTC", instrument_type: "Bond", currency: "USD" },
  ],
};

describe("Twelve Data normalizers", () => {
  test("normalizes stocks and ETFs with listing-stable composite identities", () => {
    const result = normalizeSearchResponse(search);
    expect(result).toHaveLength(2);
    expect(result.map((asset) => asset.id)).toEqual(["twelvedata:XNAS:ABC", "twelvedata:XETR:ABC"]);
    expect(result.map((asset) => asset.type)).toEqual(["stock", "etf"]);
  });

  test("normalizes USD and EUR quotes and market state", () => {
    const [usd, eur] = normalizeSearchResponse(search);
    expect(normalizeQuote({ symbol: "ABC", currency: "USD", close: "201.50", timestamp: 1_789_400_000, is_market_open: true }, usd)).toMatchObject({ price: 201.5, currency: "USD", marketState: "open", freshness: "fresh" });
    expect(normalizeQuote({ symbol: "ABC", currency: "EUR", close: "101.25", datetime: "2026-09-14", is_market_open: false }, eur)).toMatchObject({ price: 101.25, currency: "EUR", marketState: "closed", freshness: "lastClose" });
  });

  test("normalizes split-adjusted daily history in ascending order", () => {
    const [asset] = normalizeSearchResponse(search);
    const points = normalizeHistory({ meta: { currency: "USD" }, status: "ok", values: [{ datetime: "2026-09-14", close: "102" }, { datetime: "2026-09-12", close: "100" }] }, asset);
    expect(points.map((point) => point.date)).toEqual(["2026-09-12", "2026-09-14"]);
    expect(points.every((point) => point.adjustedForSplits)).toBe(true);
  });

  test("rejects malformed and missing prices", () => {
    const [asset] = normalizeSearchResponse(search);
    expect(() => normalizeQuote({ symbol: "ABC", currency: "USD", close: "bad" }, asset)).toThrow(MarketDataError);
    expect(() => normalizeHistory({ status: "ok", values: [] }, asset)).toThrow(MarketDataError);
  });

  test("inverts FX orientation safely", () => {
    expect(invertFxRate(0.04)).toBeCloseTo(25);
    expect(() => invertFxRate(0)).toThrow(MarketDataError);
  });

  test("normalizes rate limits and invalid symbols without leaking provider shape", () => {
    expect(normalizeTwelveDataError(429, { code: 429, message: "credits exhausted" })).toMatchObject({ code: "RATE_LIMIT", retryable: true, status: 429 });
    expect(normalizeTwelveDataError(400, { code: 400, message: "invalid symbol" })).toMatchObject({ code: "INVALID_SYMBOL", retryable: false, status: 400 });
  });
});
