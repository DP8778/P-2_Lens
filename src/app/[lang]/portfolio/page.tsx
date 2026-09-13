import { notFound } from "next/navigation";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { isLocale } from "@/i18n/getDictionary";
export default async function PortfolioPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <DashboardView locale={lang} />;
}
