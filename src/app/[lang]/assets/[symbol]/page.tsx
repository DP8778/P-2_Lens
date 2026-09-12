import { notFound } from "next/navigation";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { assetCatalog } from "@/data/mock/catalog";
import { isLocale } from "@/i18n/getDictionary";
export default async function AssetPage({
  params,
}: {
  params: Promise<{ lang: string; symbol: string }>;
}) {
  const { lang, symbol } = await params;
  if (!isLocale(lang)) notFound();
  const asset = assetCatalog.find((item) => item.symbol === symbol.toUpperCase());
  if (!asset) notFound();
  return <DashboardView locale={lang} initialAssetId={asset.id} />;
}
