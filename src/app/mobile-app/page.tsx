import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Bell, Download, Gift, MapPin, QrCode, ShieldCheck, Sparkles, Smartphone, Zap } from "lucide-react";
import { MarketingFooter } from "@/components/landing/MarketingFooter";
import { MarketingHeader } from "@/components/landing/MarketingHeader";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nearloy.ru").replace(/\/$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Мобильное приложение NearLoy",
  description: "Скачайте NearLoy для Android: карты лояльности, QR, бонусы, партнёры рядом и уведомления в одном мобильном приложении.",
  alternates: { canonical: "/mobile-app" },
  openGraph: {
    title: "Мобильное приложение NearLoy",
    description: "Карты лояльности, QR, бонусы и партнёры рядом в телефоне.",
    url: "/mobile-app",
    siteName: "NearLoy",
    images: ["/images/mobile-app/nearloy-mobile-hero.png"],
    locale: "ru_RU",
    type: "website",
  },
};

const benefits = [
  { title: "Карты всегда с собой", text: "QR, уровни и баллы открываются за пару касаний, без пластиковых карт и поиска сообщений.", icon: QrCode },
  { title: "Партнёры рядом", text: "Карта помогает быстро найти места, где можно копить баллы и пользоваться подписками.", icon: MapPin },
  { title: "Уведомления по делу", text: "Напоминания о новых бонусах, сроках подписок и важных событиях приходят вовремя.", icon: Bell },
  { title: "Быстрее вход", text: "Мобильная оболочка ведёт сразу в личный кабинет NearLoy и сохраняет привычный интерфейс.", icon: Zap },
];

const scenarios = [
  "Показать QR на кассе и сразу увидеть начисление.",
  "Открыть карту рядом с собой и выбрать партнёра.",
  "Проверить активные подписки перед визитом.",
  "Получить уведомление о бонусе, пока предложение ещё актуально.",
];

export default function MobileAppPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#02050a] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:84px_84px]" />
      <MarketingHeader />

      <section className="relative z-10 mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.86fr_1.14fr] lg:px-8 lg:py-16">
        <div className="flex flex-col justify-center">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-100/24 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-50">
            <Smartphone className="h-4 w-4" />
            NearLoy для телефона
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl">Лояльность, которая помещается в карман</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-white/66">
            Мобильное приложение NearLoy собирает карты, QR, бонусы, подписки и партнёров рядом в одном спокойном интерфейсе.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a
              href="/downloads/nearloy-android.apk"
              download="NearLoy-Android-v0.1.2.apk"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-sm font-semibold text-[#07101e] transition hover:bg-white/90"
            >
              <Download className="h-4 w-4" />
              Скачать приложение
            </a>
            <Link
              href="/mobile-entry"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/7 px-6 text-sm font-semibold text-white transition hover:bg-white/12"
            >
              Открыть мобильный вход
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="relative min-h-[360px] overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] shadow-[0_0_90px_rgba(34,211,238,0.08)]">
          <Image
            src="/images/mobile-app/nearloy-mobile-hero.png"
            alt="Мокап мобильного приложения NearLoy с картами лояльности и картой партнёров"
            fill
            priority
            sizes="(min-width: 1024px) 58vw, 100vw"
            className="object-cover"
          />
        </div>
      </section>

      <section id="features" className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <article key={benefit.title} className="rounded-[1.75rem] border border-white/10 bg-[#071019]/82 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-100/18 bg-cyan-300/10 text-cyan-100">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-xl font-semibold">{benefit.title}</h2>
                <p className="mt-2 text-sm leading-6 text-white/58">{benefit.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">
        <div className="relative min-h-[520px] overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035]">
          <Image
            src="/images/mobile-app/nearloy-mobile-cafe.png"
            alt="NearLoy на телефоне в сценарии покупки в кафе"
            fill
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="object-cover"
          />
        </div>
        <div className="flex flex-col justify-center rounded-[2rem] border border-white/10 bg-black/24 p-6 sm:p-8">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-100/22 bg-emerald-300/10 px-4 py-2 text-sm font-semibold text-emerald-50">
            <Sparkles className="h-4 w-4" />
            Почему приложение удобнее
          </div>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">Меньше действий между покупкой и бонусом</h2>
          <p className="mt-4 text-base leading-7 text-white/62">
            NearLoy в приложении ощущается как привычный инструмент: быстро открыть QR, посмотреть баланс, выбрать место рядом и не пропустить важное уведомление.
          </p>
          <div className="mt-6 grid gap-3">
            {scenarios.map((scenario) => (
              <div key={scenario} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-white/66">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-100" />
                <span>{scenario}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="relative z-10 mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="grid gap-6 rounded-[2rem] border border-cyan-100/18 bg-cyan-300/[0.055] p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.055] px-4 py-2 text-sm font-semibold text-white/72">
              <Gift className="h-4 w-4 text-amber-100" />
              Android APK уже доступен
            </div>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight">Скачайте NearLoy и войдите в свой аккаунт</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/58">
              После установки приложение откроет актуальный мобильный интерфейс NearLoy. Обычные обновления интерфейса будут приходить через web-deploy.
            </p>
          </div>
          <a
            href="/downloads/nearloy-android.apk"
            download="NearLoy-Android-v0.1.2.apk"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-sm font-semibold text-[#07101e] transition hover:bg-white/90"
          >
            <Download className="h-4 w-4" />
            Скачать
          </a>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
