import { fetchMarketStatus, searchMarketAssets } from "@/lib/market-data/client";
import { MarketDataError } from "@/lib/market-data/errors";

describe("browser market-data client", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("validates the status response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ provider: "twelvedata", configured: false }),
    } as Response);

    await expect(fetchMarketStatus()).resolves.toEqual({
      provider: "twelvedata",
      configured: false,
    });
  });

  test("rejects a malformed successful search response", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ assets: "not-an-array" }),
    } as Response);

    await expect(searchMarketAssets("PLTR")).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      status: 502,
    });
  });

  test("retains normalized API errors and distinguishes network failures", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: { code: "RATE_LIMIT", message: "Limit", retryable: true } }),
    } as Response);
    await expect(searchMarketAssets("PLTR")).rejects.toMatchObject({
      code: "RATE_LIMIT",
      status: 429,
    });

    global.fetch = jest.fn().mockRejectedValue(new TypeError("network down"));
    await expect(searchMarketAssets("PLTR")).rejects.toEqual(
      expect.objectContaining<Partial<MarketDataError>>({ code: "UNAVAILABLE", status: 503 }),
    );
  });
});
