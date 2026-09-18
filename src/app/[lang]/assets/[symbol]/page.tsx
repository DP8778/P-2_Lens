import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/getDictionary";
import { AssetDetailView } from "@/components/assets/AssetDetailView";
export default async function AssetPage({
  params,
}: {
  params: Promise<{ lang: string; symbol: string }>;
}) {
  const { lang, symbol } = await params;
  if (!isLocale(lang)) notFound();
  let assetId = symbol;
  try { assetId = decodeURIComponent(symbol); } catch { /* Next may already provide a decoded segment. */ }
  return <AssetDetailView assetId={assetId} locale={lang} />;
}
