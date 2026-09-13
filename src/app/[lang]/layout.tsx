import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getDictionary, isLocale } from "@/i18n/getDictionary";

export function generateStaticParams() {
  return [{ lang: "cs-CZ" }, { lang: "en-US" }];
}
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <AppShell locale={lang} dictionary={getDictionary(lang)}>
      {children}
    </AppShell>
  );
}
