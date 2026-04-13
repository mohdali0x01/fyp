import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AidLedger — Transparent Aid for Pakistan",
    template: "%s | AidLedger",
  },
  description:
    "AidLedger is a blockchain-powered GRC framework ensuring transparent, tamper-proof, and accountable aid distribution across Pakistan.",
  keywords: ["aid", "blockchain", "Pakistan", "BISP", "transparency", "GRC", "Ehsaas"],
  robots: {
    index: true,
    follow: true,
  },
  // Security: prevent embedding in foreign iframes via metadata
  other: {
    "X-Frame-Options": "DENY",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* Urdu font for notification cards */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
