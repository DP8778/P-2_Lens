import { readAssetEntryContext, readIndustryNavigation, type IndustrySearchParams } from "@/lib/markets/industry-navigation";
import { fundamentalsSource } from "@/lib/fundamentals/snapshot-source";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/getDictionary";
import { AssetDetailView } from "@/components/assets/AssetDetailView";
import { canonicalInstrumentId, knownDemoInstrument } from "@/lib/instruments/identity";
import { getMarketDataProvider } from "@/lib/market-data/server";
export default async function AssetPage({
  params, searchParams,
}: {
  searchParams: Promise<IndustrySearchParams>;
  params: Promise<{ lang: string; assetId: string }>;
}) {
  const { lang, assetId: routeAssetId } = await params;
  if (!isLocale(lang)) notFound();
  let requestedAssetId = routeAssetId;
  try { requestedAssetId = decodeURIComponent(routeAssetId); } catch { /* Next may already provide a decoded segment. */ }
  const query = await searchParams;
  const assetId = canonicalInstrumentId(requestedAssetId);
  const navigation = readIndustryNavigation(query);
  const industry = navigation ? fundamentalsSource.getIndustries()[navigation.industry] : undefined;
  const validContext = industry?.members.some((member) => member.asset.id === assetId);
  const legacyDemo = knownDemoInstrument(requestedAssetId)?.demoAssetId === requestedAssetId;
  const entry = legacyDemo
    ? { source: "demo" as const, positionAssetId: requestedAssetId }
    : readAssetEntryContext(query, assetId);
  return <AssetDetailView
    industry={validContext ? industry : undefined}
    industryNavigation={validContext ? navigation : undefined}
    assetId={assetId}
    initialAsset={fundamentalsSource.getInstrument(assetId)}
    entry={entry}
    marketConfigured={getMarketDataProvider().configured}
    locale={lang}
    fundamentals={fundamentalsSource.getCompany(assetId)}
  />;
}
