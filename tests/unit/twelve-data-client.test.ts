jest.mock("server-only", () => ({}));

import { TwelveDataClient } from "@/lib/market-data/twelve-data/client";

describe("TwelveDataClient configuration", () => {
  const originalKey = process.env.TWELVE_DATA_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.TWELVE_DATA_API_KEY;
    else process.env.TWELVE_DATA_API_KEY = originalKey;
    global.fetch = originalFetch;
  });

  test("is not configured when TWELVE_DATA_API_KEY is missing or whitespace", () => {
    delete process.env.TWELVE_DATA_API_KEY;
    expect(new TwelveDataClient().configured).toBe(false);
    expect(new TwelveDataClient("   ").configured).toBe(false);
  });

  test("is configured without exposing the key and normalizes transport failures", async () => {
    const client = new TwelveDataClient("private-test-key");
    expect(client.configured).toBe(true);
    global.fetch = jest.fn().mockRejectedValue(new TypeError("offline"));

    await expect(client.get("/symbol_search", { symbol: "PLTR" })).rejects.toMatchObject({
      code: "UNAVAILABLE",
      status: 502,
    });
  });
});
