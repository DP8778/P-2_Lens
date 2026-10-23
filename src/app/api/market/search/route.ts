import { marketDataErrorResponse } from "@/lib/market-data/errors";
import { getMarketDataProvider } from "@/lib/market-data/server";
import { searchQuerySchema } from "@/lib/market-data/validation";

export async function GET(request: Request) {
  const parsed = searchQuerySchema.safeParse(new URL(request.url).searchParams.get("q") ?? "");
  if (!parsed.success)
    return Response.json({ error: { code: "INVALID_QUERY", message: "Zadejte alespoň 2 znaky." } }, { status: 400 });
  try {
    const assets = await getMarketDataProvider().searchAssets(parsed.data);
    return Response.json({ assets });
  } catch (error) {
    return marketDataErrorResponse(error);
  }
}

