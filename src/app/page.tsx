import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, BadgeCheck, BellRing, Building2, CircleHelp, Gift, MapPin, QrCode, Sparkles, TicketCheck, WalletCards } from "lucide-react";
import { LandingLeadForm } from "@/components/landing/LandingLeadForm";
import { MarketingAccountButton } from "@/components/landing/MarketingAccountButton";
import { MarketingFooter } from "@/components/landing/MarketingFooter";
import { MarketingHeader } from "@/components/landing/MarketingHeader";
import { MarketingPageReveal } from "@/components/landing/MarketingPageReveal";
import { OpenNearLoyDemo } from "@/components/landing/OpenNearLoyDemo";
import { SUBSCRIPTIONS_ENABLED } from "@/lib/features/subscriptions";

export const metadata: Metadata = {
  title: "NearLoy — бонусы, уровни и сервис для клиентов",
  description: "NearLoy помогает клиентам хранить бонусы, статусы, любимые компании и историю операций в одном удобном интерфейсе.",
};

type IconItem = {
  icon: LucideIcon;
  title: string;
  text: string;
};

const userHighlights: IconItem[] = [
  { icon: WalletCards, title: "Один кошелёк", text: "Баллы, статусы, любимые компании и история операций собраны в одном месте." },
  { icon: QrCode, title: "Быстро у кассы", text: "Покажите QR или короткий код, чтобы кассир нашёл профиль без лишних действий." },
  { icon: Gift, title: "Больше пользы", text: "Получайте бонусы, открывайте награды и следите за прогрессом уровней." },
  { icon: BellRing, title: "Понятные события", text: "Видно, когда начислены баллы, обновился уровень или появился новый статус." },
];

const steps = [
  { icon: WalletCards, title: "Откройте NearLoy", text: "Войдите в NearLoy и получите доступ к своему кошельку." },
  { icon: MapPin, title: "Найдите партнёра", text: "Карта и категории помогают выбрать компанию рядом или онлайн-сервис." },
  { icon: QrCode, title: "Покажите QR", text: "Кассир быстро найдёт профиль, начислит баллы и увидит ваш прогресс." },
  { icon: BadgeCheck, title: "Следите за выгодой", text: "История, статусы и награды остаются прозрачными и доступны в любой момент." },
];

const faqLinks = [
  { href: "/faq/clients", label: "FAQ для клиентов", icon: CircleHelp },
  { href: "/faq/business", label: "FAQ для бизнеса", icon: Building2 },
];

const socialLinks = [
  { href: "https://vk.com/nearloy", label: "VK", text: "Новости и обновления", icon: "vk" },
  { href: "https://max.ru/channel_nearloy", label: "MAX", text: "Канал NearLoy", icon: "max" },
] as const;

const subscriptionCards = [
  { title: "Кофе каждый день", text: "Подписка на ежедневный напиток с понятным лимитом использования.", icon: TicketCheck },
  { title: "Фитнес без лимита", text: "Безлимитный проход по подписке, если бизнес поддерживает такой сценарий.", icon: BadgeCheck },
  { title: "Партнёрские наборы", text: "Совместные предложения компаний: например, спорт плюс кофе.", icon: Sparkles },
];

function GlowCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-[0_0_44px_rgba(255,255,255,0.055)] backdrop-blur ${className}`}>
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent" />
      {children}
    </div>
  );
}

function ImagePanel({ src, title, text }: { src: string; title: string; text: string }) {
  return (
    <GlowCard className="p-3">
      <Image src={src} alt={title} width={960} height={600} className="aspect-[16/10] w-full rounded-[1.5rem] border border-white/10 object-cover" />
      <div className="p-4">
        <h3 className="text-xl font-semibold">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-white/58">{text}</p>
      </div>
    </GlowCard>
  );
}

function HeroImagePanel({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative mx-auto w-full max-w-[680px]">
      <div className="absolute inset-8 rounded-[3rem] bg-cyan-200/10 blur-3xl" />
      <Image
        src={src}
        alt={alt}
        width={1586}
        height={992}
        priority
        className="relative aspect-[16/10] w-full rounded-[2rem] border border-white/10 object-cover shadow-[0_0_80px_rgba(103,232,249,0.16)]"
      />
    </div>
  );
}

function SocialLogo({ kind, className = "h-10 w-10" }: { kind: "vk" | "max"; className?: string }) {
  if (kind === "vk") {
    return (
      <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
        <rect width="48" height="48" rx="14" fill="#0077FF" />
        <path
          fill="#fff"
          d="M25.6 33.4c-10.6 0-16.7-7.2-17-19.2h5.4c.2 8.8 4.1 12.6 7.2 13.4V14.2h5.1v7.6c3-.3 6.2-3.8 7.2-7.6h5.1c-.8 4.7-4.4 8.2-7 9.7 2.6 1.2 6.8 4.2 8.4 9.5h-5.7c-1.1-3.7-4-6.5-8-6.9v6.9h-.7Z"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="maxLogoGradient" x1="6" x2="42" y1="42" y2="6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#23C9F5" />
          <stop offset="0.48" stopColor="#2563EB" />
          <stop offset="1" stopColor="#A855F7" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#maxLogoGradient)" />
      <path
        fill="#fff"
        fillRule="evenodd"
        d="M24.6 10.2c-8.1 0-14.4 5.6-14.4 13.1 0 4.5 2.1 8.4 5.5 10.7l-.9 4.8c-.2 1.1 1 1.9 1.9 1.2l4.3-3.2c1.1.2 2.3.3 3.6.3 8.1 0 14.4-5.6 14.4-13.1S32.7 10.2 24.6 10.2Zm0 6.2c4.4 0 7.7 3.2 7.7 7.6s-3.3 7.6-7.7 7.6c-1 0-1.9-.1-2.8-.5l-1.4-.5-1.4 1.1.3-1.6-1.2-1.3a7 7 0 0 1-1.2-4.1c0-4.9 3.3-8.3 7.7-8.3Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#02050a] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(103,232,249,0.14),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(255,255,255,0.08),transparent_24%),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:auto,auto,80px_80px,80px_80px]" />
      <MarketingHeader active="users" />
      <MarketingPageReveal>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-8 lg:py-24">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-100/18 bg-cyan-100/10 px-4 py-2 text-sm font-semibold text-cyan-100">
            <Sparkles className="h-4 w-4" />
            Бонусы, уровни и статусы в одном интерфейсе
          </div>
          <h1 className="mt-7 max-w-4xl text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
            NearLoy: больше от любимых компаний
          </h1>
          <p className="mt-6 max-w-2xl text-xl leading-9 text-white/62">
            Храните бонусы, уровни, статусы и историю операций в телефоне. Показывайте QR на кассе, получайте сервис быстрее и используйте преимущества партнёров без пластиковых карт.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <MarketingAccountButton
              locale="ru"
              withArrow
              className="h-12 px-6 text-base"
              signedOutClassName="border-transparent bg-white text-[#07101e] shadow-[0_0_34px_rgba(255,255,255,0.18)] hover:bg-white/90"
            />
            <Link href="/business" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/7 px-6 text-base font-semibold text-white transition hover:bg-white/12">
              Я представляю бизнес
            </Link>
          </div>
        </div>

        <HeroImagePanel src="/landing/user-rewards-status.png" alt="NearLoy loyalty status dashboard with rewards and progress" />
      </section>

      <section id="features" className="relative z-10 border-y border-white/10 bg-white/[0.035] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {userHighlights.map((item) => (
              <GlowCard key={item.title} className="p-6">
                <item.icon className="h-7 w-7 text-cyan-100" />
                <h3 className="mt-5 text-xl font-semibold">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/58">{item.text}</p>
              </GlowCard>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100/64">NearLoy внутри</p>
            <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">QR, бонусы и уровни вместе</h2>
            <p className="mt-4 text-lg leading-8 text-white/58">
              NearLoy собирает ключевые сценарии клиента: быстрый QR на кассе, бонусы, уровни, статусы и историю действий. Всё выглядит как единый сервис, а не набор разрозненных карт.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                { icon: QrCode, label: "QR" },
                { icon: Gift, label: "Бонусы" },
                { icon: TicketCheck, label: "Награды" },
              ].map((item) => (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white/78"
                >
                  <item.icon className="h-4 w-4 text-cyan-100" />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
          <OpenNearLoyDemo />
        </div>
      </section>

      {SUBSCRIPTIONS_ENABLED ? (
        <section id="subscriptions" className="relative z-10 border-y border-white/10 bg-white/[0.035] py-16">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8">
            <ImagePanel
              src="/landing/user-rewards-status.png"
              title="Статусы и прогресс"
              text="Уровни, редкие статусы и уведомления помогают видеть личный прогресс без сложных правил."
            />
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100/64">Подписки</p>
              <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">Платите за понятную ценность, а не за случайные акции</h2>
              <div className="mt-6 grid gap-3">
                {subscriptionCards.map((item) => (
                  <div key={item.title} className="flex gap-4 rounded-3xl border border-white/10 bg-black/24 p-5">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-100/10 text-cyan-100">
                      <item.icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-semibold">{item.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-white/58">{item.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="relative z-10 py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100/64">Карта партнёров</p>
            <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">Компании рядом и онлайн-сервисы в одном поиске</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {steps.map((step, index) => (
                <div key={step.title} className="rounded-3xl border border-white/10 bg-white/[0.045] p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-cyan-100/70">0{index + 1}</span>
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-100/14 bg-cyan-100/10 text-cyan-100 shadow-[0_0_24px_rgba(103,232,249,0.08)]">
                      <step.icon className="h-5 w-5" />
                    </span>
                  </div>
                  <h3 className="mt-3 font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/56">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
          <ImagePanel src="/landing/user-map-partners.png" title="Партнёры на карте" text="Локации, категории и доступные преимущества помогают быстро выбрать место." />
        </div>
      </section>

      <section className="relative z-10 border-y border-white/10 bg-white/[0.035] py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100/64">Для бизнеса</p>
            <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">NearLoy помогает бизнесу возвращать клиентов</h2>
            <p className="mt-4 text-lg leading-8 text-white/58">
              Запускайте бонусы и уровни лояльности, управляйте кассой и командой, а финансовые показатели держите под контролем в одном рабочем пространстве.
            </p>
          </div>
          <GlowCard className="p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-2xl font-semibold">Кабинет для партнёров</h3>
                <p className="mt-2 text-sm leading-6 text-white/58">Инструменты для бонусов, сотрудников, выплат и роста повторных продаж.</p>
              </div>
              <Link href="/business" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-[#07101e] transition hover:bg-white/90">
                Перейти
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </GlowCard>
        </div>
      </section>

      <section className="relative z-10 border-y border-white/10 bg-[#050a10]/88 py-10">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100/64">Соцсети</p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Следите за NearLoy там, где удобно</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {socialLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className="group flex min-h-40 items-center justify-between gap-5 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.055] px-6 py-5 transition hover:-translate-y-0.5 hover:border-cyan-100/24 hover:bg-cyan-100/10"
              >
                <span>
                  <span className="block text-lg font-semibold text-white">{item.label}</span>
                  <span className="mt-2 block text-sm leading-6 text-white/52">{item.text}</span>
                </span>
                <span className="relative flex h-24 w-24 shrink-0 items-center justify-center">
                  <span className="absolute inset-0 rounded-[2rem] bg-cyan-100/10 blur-2xl transition group-hover:bg-cyan-100/20" />
                  <SocialLogo kind={item.icon} className="relative h-20 w-20 drop-shadow-[0_0_22px_rgba(103,232,249,0.18)]" />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100/64">Контакт</p>
            <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">Хотите попробовать NearLoy?</h2>
            <p className="mt-4 text-lg leading-8 text-white/58">
              Напишите, какой сценарий интересен: бонусы, карта партнёров, клиентское приложение или пилот с конкретной компанией.
            </p>
          </div>
          <LandingLeadForm source="user_landing" title="Запросить демонстрацию" />
        </div>
      </section>

      <section className="relative z-10 border-b border-white/10 bg-[#050a10]/88 py-10">
        <div className="mx-auto grid max-w-7xl gap-5 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100/64">FAQ</p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Есть вопросы? Собрали ответы</h2>
            <p className="mt-3 text-base leading-7 text-white/58">
              Коротко объясняем, как работают QR, бонусы, партнёры, мобильное приложение и подключение бизнеса.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {faqLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex min-h-20 items-center justify-between gap-3 rounded-3xl border border-white/10 bg-white/[0.055] px-5 py-4 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-cyan-100/24 hover:bg-cyan-100/10"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-100/14 bg-cyan-100/10 text-cyan-100">
                    <item.icon className="h-5 w-5" />
                  </span>
                  {item.label}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-1" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <MarketingFooter />
      </MarketingPageReveal>
    </main>
  );
}
