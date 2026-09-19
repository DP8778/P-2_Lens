"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import type { Dictionary, Locale } from "@/i18n/getDictionary";
import { Logo } from "./Logo";
import { PortfolioProvider } from "@/components/portfolio/PortfolioProvider";
import { AnalysisProvider } from "@/components/portfolio/AnalysisProvider";
import { GlobalAssetSearch } from "./GlobalAssetSearch";
export function AppShell({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: Locale;
  dictionary: Dictionary;
}) {
  const pathname = usePathname();
  if (pathname.endsWith("/login")) return <>{children}</>;
  return (
    <PortfolioProvider>
      <AnalysisProvider>
        <div className="app-shell">
          <a className="skip-link" href="#main-content">
            Přejít k obsahu
          </a>
          <header className="top-nav">
            <Logo href={`/${locale}/dashboard`} />
            <nav aria-label="Hlavní navigace">
              <Link
                href={`/${locale}/dashboard`}
                aria-current={!pathname.endsWith("settings") ? "page" : undefined}
              >
                Portfolio
              </Link>
            </nav>
            <GlobalAssetSearch locale={locale} />
            <div className="nav-account">
              <Link className="icon-control" href={`/${locale}/settings`} aria-label="Nastavení">
                <Settings size={18} />
              </Link>
            </div>
          </header>
          <main id="main-content">{children}</main>
        </div>
      </AnalysisProvider>
    </PortfolioProvider>
  );
}
