import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/i18n/getDictionary";
export default async function AssetPage({
  params,
}: {
  params: Promise<{ lang: string; symbol: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  redirect(`/${lang}/dashboard`);
}
