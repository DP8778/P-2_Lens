"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, ArrowUpRight } from "lucide-react";
import type { Dictionary, Locale } from "@/i18n/getDictionary";
import { Logo } from "./Logo";
import { PortfolioProvider } from "@/components/portfolio/PortfolioProvider";
import { AnalysisProvider } from "@/components/portfolio/AnalysisProvider";
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
                aria-current={pathname.endsWith("dashboard") ? "page" : undefined}
              >
                Přehled
              </Link>
              <Link
                href={`/${locale}/portfolio#holdings`}
                aria-current={pathname.endsWith("portfolio") ? "page" : undefined}
              >
                Portfolio
              </Link>
              <Link
                href={`/${locale}/insights#lens-insight`}
                aria-current={pathname.endsWith("insights") ? "page" : undefined}
              >
                Souvislosti
                <ArrowUpRight size={12} />
              </Link>
            </nav>
            <div className="nav-account">
              <span className="local-status">Lokální portfolio</span>
              <Link className="icon-control" href={`/${locale}/settings`} aria-label="Nastavení">
                <Settings size={18} />
              </Link>
              <span className="user-avatar" aria-label="Demo investor">
                DI
              </span>
            </div>
          </header>
          <main id="main-content">{children}</main>
        </div>
      </AnalysisProvider>
    </PortfolioProvider>
  );
}
