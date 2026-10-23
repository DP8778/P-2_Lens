import { marketDataErrorResponse } from "@/lib/market-data/errors";
import { getMarketDataProvider } from "@/lib/market-data/server";
import { historyQuerySchema, twelveDataAssetSchema } from "@/lib/market-data/validation";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = historyQuerySchema.safeParse({
    asset: params.get("asset"),
    from: params.get("from"),
    to: params.get("to"),
    interval: params.get("interval") || "1day",
  });
  if (!parsed.success)
    return Response.json({ error: { code: "INVALID_QUERY", message: "Neplatný historický rozsah." } }, { status: 400 });
  const asset = twelveDataAssetSchema.safeParse(
    (() => {
      try {
        return JSON.parse(parsed.data.asset);
      } catch {
        return null;
      }
    })(),
  );
  if (!asset.success)
    return Response.json({ error: { code: "INVALID_QUERY", message: "Neplatné aktivum." } }, { status: 400 });
  try {
    return Response.json(await getMarketDataProvider().getHistory(asset.data, parsed.data));
  } catch (error) {
    return marketDataErrorResponse(error);
  }
}
