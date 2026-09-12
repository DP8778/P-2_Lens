import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { isLocale } from "@/i18n/getDictionary";
export default async function SettingsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    <div className="page-enter mx-auto max-w-[1100px] p-4 sm:p-6 lg:p-8">
      <header className="mb-7">
        <Badge>Local preferences</Badge>
        <h1 className="mt-4 font-serif text-5xl tracking-[-.045em]">Nastavení</h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Jazyk, měna, vzhled a transparentní pravidla AI vrstvy.
        </p>
      </header>
      <SettingsPanel locale={lang} />
    </div>
  );
}
