import { marketDataErrorResponse } from "@/lib/market-data/errors";
import { getMarketDataProvider } from "@/lib/market-data/server";
import { quotesRequestSchema } from "@/lib/market-data/validation";

export async function POST(request: Request) {
  const parsed = quotesRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: { code: "INVALID_QUERY", message: "Neplatný seznam aktiv." } }, { status: 400 });
  try {
    const quotes = await getMarketDataProvider().getQuotes(parsed.data.assets);
    return Response.json({ quotes });
  } catch (error) {
    return marketDataErrorResponse(error);
  }
}

