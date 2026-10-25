import type { Metadata } from "next";
import "@/styles/globals.css";
import { appearanceInitScript } from "@/lib/appearance";

export const metadata: Metadata = {
  title: { default: "Lens", template: "%s · Lens" },
  description: "Portfolio intelligence that explains what changed and why.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="cs" data-theme="light" suppressHydrationWarning>
      <head><script id="lens-appearance" dangerouslySetInnerHTML={{ __html: appearanceInitScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
