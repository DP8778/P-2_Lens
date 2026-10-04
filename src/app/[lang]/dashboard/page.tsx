import { fundamentalsSource } from "@/lib/fundamentals/snapshot-source";
import { notFound } from "next/navigation";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { getDictionary, isLocale } from "@/i18n/getDictionary";
export default async function DashboardPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const discovery = Object.fromEntries(Object.entries(fundamentalsSource.getIndustries()).map(([id, industry]) => [id, { companies: industry.members.length, updatedAt: industry.updatedAt, version: industry.version }]));
  return <DashboardView industryDiscovery={discovery} locale={lang} dictionary={getDictionary(lang)} />;
}
