import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./market.css";
import SmartsuppWidget from "@/components/smartsupp-widget";
import { LanguageProvider } from "@/components/i18n-provider";

export const metadata: Metadata = {
  title: "Tetratrades — Crypto Trading",
  description: "A modern crypto trading workspace to explore markets, manage a portfolio, and test strategies with simulated funds.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body suppressHydrationWarning><LanguageProvider>{children}<SmartsuppWidget/></LanguageProvider></body></html>;
}
