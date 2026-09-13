import { redirect } from "next/navigation";
import { isLocale } from "@/i18n/getDictionary";
export default async function LocaleHome({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  redirect(`/${isLocale(lang) ? lang : "cs-CZ"}/dashboard`);
}
