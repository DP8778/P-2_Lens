import { marketDataErrorResponse } from "@/lib/market-data/errors";
import { getMarketDataProvider } from "@/lib/market-data/server";
import { fxQuerySchema } from "@/lib/market-data/validation";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = fxQuerySchema.safeParse({
    from: params.get("from"),
    to: params.get("to"),
    start: params.get("start") || undefined,
    end: params.get("end") || undefined,
  });
  if (!parsed.success)
    return Response.json({ error: { code: "INVALID_QUERY", message: "Neplatný měnový pár." } }, { status: 400 });
  try {
    const provider = getMarketDataProvider();
    if (parsed.data.start && parsed.data.end)
      return Response.json(
        await provider.getFxHistory(parsed.data.from, parsed.data.to, {
          from: parsed.data.start,
          to: parsed.data.end,
          interval: "1day",
        }),
      );
    return Response.json(await provider.getFxRate(parsed.data.from, parsed.data.to));
  } catch (error) {
    return marketDataErrorResponse(error);
  }
}

