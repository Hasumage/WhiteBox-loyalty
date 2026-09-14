import type { Metadata } from "next";
import { Suspense } from "react";
import { YandexMetrika } from "@/components/analytics/YandexMetrika";
import "./globals.css";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nearloy.ru").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "NearLoy — сервис лояльности, бонусы и Nearloy Hunt",
    template: "%s | NearLoy",
  },
  description: "NearLoy помогает клиентам хранить бонусы, статусы, подписки и игровые награды Nearloy Hunt, а компаниям — возвращать гостей через QR, карту партнёров и удобный кабинет.",
  keywords: ["NearLoy", "Nearloy", "Nearloy Hunt", "сервис лояльности", "бонусная система", "карта партнёров", "игра про город"],
  manifest: "/site.webmanifest",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "NearLoy",
    locale: "ru_RU",
    title: "NearLoy — бонусы, партнёры и Nearloy Hunt",
    description: "Единый сервис для бонусов, статусов, партнёрских предложений и городской игровой ветки Nearloy Hunt.",
    url: "/",
    images: [{ url: "/landing/user-rewards-status.png", width: 1200, height: 630, alt: "NearLoy: бонусы, статусы и награды" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "NearLoy — бонусы, партнёры и Nearloy Hunt",
    description: "Бонусы, статусы, карта партнёров и игровая ветка Nearloy Hunt в одном сервисе.",
    images: ["/landing/user-rewards-status.png"],
  },
  icons: {
    icon: [
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="dark" suppressHydrationWarning>
      <body className="antialiased dark twa bg-[var(--twa-bg)] text-foreground">
        <Suspense fallback={null}>
          <YandexMetrika />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
