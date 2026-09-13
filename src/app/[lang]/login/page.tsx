import { notFound } from "next/navigation";
import { LoginForm } from "@/components/auth/LoginForm";
import { isLocale } from "@/i18n/getDictionary";
export default async function LoginPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return <LoginForm locale={lang} />;
}
