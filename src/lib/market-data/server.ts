import "server-only";
import { TwelveDataProvider } from "./twelve-data/provider";

let provider: TwelveDataProvider | undefined;

export function getMarketDataProvider() {
  provider ??= new TwelveDataProvider();
  return provider;
}

