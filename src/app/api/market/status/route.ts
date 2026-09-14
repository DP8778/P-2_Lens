import { getMarketDataProvider } from "@/lib/market-data/server";

export async function GET() {
  const provider = getMarketDataProvider();
  return Response.json({ provider: provider.id, configured: provider.configured });
}

