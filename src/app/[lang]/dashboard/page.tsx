import { notFound } from "next/navigation";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { getDictionary, isLocale } from "@/i18n/getDictionary";
export default async function DashboardPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <DashboardView locale={lang} dictionary={getDictionary(lang)} />;
}
