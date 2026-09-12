import { MockMarketDataProvider } from "@/lib/repositories/MockMarketDataProvider";

export async function GET() {
  const provider = new MockMarketDataProvider();
  return Response.json(await provider.getBitcoinQuote());
}
