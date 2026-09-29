import { readIndustryNavigation, type IndustrySearchParams } from "@/lib/markets/industry-navigation";
import { fundamentalsSource } from "@/lib/fundamentals/snapshot-source";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/getDictionary";
import { AssetDetailView } from "@/components/assets/AssetDetailView";
export default async function AssetPage({
  params, searchParams,
}: {
  searchParams: Promise<IndustrySearchParams>;
  params: Promise<{ lang: string; assetId: string }>;
}) {
  const { lang, assetId: routeAssetId } = await params;
  if (!isLocale(lang)) notFound();
  let assetId = routeAssetId;
  try { assetId = decodeURIComponent(routeAssetId); } catch { /* Next may already provide a decoded segment. */ }
  const navigation = readIndustryNavigation(await searchParams);
  const industry = navigation ? fundamentalsSource.getIndustries()[navigation.industry] : undefined;
  const validContext = industry?.members.some((member) => member.asset.id === assetId);
  return <AssetDetailView industry={validContext ? industry : undefined} industryNavigation={validContext ? navigation : undefined} assetId={assetId} locale={lang} fundamentals={fundamentalsSource.getCompany(assetId)} />;
}
