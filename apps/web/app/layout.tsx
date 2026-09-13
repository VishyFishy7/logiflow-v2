import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { Providers } from "@/components/providers";
import { FALLBACK_PRODUCT_NAME } from "@/lib/env";

import "./globals.css";

/**
 * §12.2 Typography. Inter for the UI, JetBrains Mono for identifiers
 * (tracking IDs, invoice numbers, action keys, IPs). The CSS token layer in
 * globals.css references these exact variables (`--font-inter`,
 * `--font-jetbrains-mono`) — do not rename them here.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const productName = FALLBACK_PRODUCT_NAME;

export const metadata: Metadata = {
  title: {
    default: `${productName} — Logistics operations`,
    template: `%s · ${productName}`,
  },
  description:
    "Multi-tenant logistics operations: shipments, checkpoints, leads, invoices and a masked public tracking page.",
  applicationName: productName,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Never lock zoom — the ops team uses this on phones at a warehouse gate (§13.4).
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0b" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} min-h-dvh bg-background font-sans text-foreground antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
