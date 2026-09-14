import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  CircleDollarSign,
  Crown,
  Gift,
  Handshake,
  MapPinned,
  Megaphone,
  QrCode,
  ShieldCheck,
  Sparkles,
  Store,
  TicketCheck,
  Trophy,
  Users,
} from "lucide-react";
import { LandingLeadForm } from "@/components/landing/LandingLeadForm";
import { MarketingFooter } from "@/components/landing/MarketingFooter";
import { MarketingHeader } from "@/components/landing/MarketingHeader";
import { MarketingPageReveal } from "@/components/landing/MarketingPageReveal";

export const metadata: Metadata = {
  title: "NearLoy для бизнеса — программа лояльности, бонусы и QR для клиентов",
  description: "NearLoy помогает компаниям запускать программу лояльности: бонусы, QR-профили клиентов, статусы, подписки, роли сотрудников, финансы и партнёрские предложения.",
  keywords: ["NearLoy для бизнеса", "программа лояльности", "бонусная система для бизнеса", "QR лояльность", "подписки для клиентов", "сервис для партнёров"],
  alternates: { canonical: "/business" },
  openGraph: {
    title: "NearLoy для бизнеса — программа лояльности и возврат клиентов",
    description: "Бонусы, QR-профили, статусы, подписки, роли сотрудников и финансы в кабинете NearLoy.",
    url: "/business",
    images: [{ url: "/landing/business-hero-dashboard.png", width: 1200, height: 630, alt: "Кабинет NearLoy для бизнеса" }],
  },
};

type IconItem = {
  icon: LucideIcon;
  title: string;
  text: string;
};

const COMPANY_PRO_MONTHLY_PRICE_RUB = 4990;
const COMPANY_GO_MONTHLY_PRICE_RUB = 0;
const COMPANY_MAX_PRICE_LABEL = "По запросу";

function formatRubPrice(value: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);
}

type CompanyPlanPrice =
  | {
      kind: "monthly";
      rub: number;
    }
  | {
      kind: "custom";
      label: string;
    };

type CompanyPlan = {
  name: string;
  label: string;
  price: CompanyPlanPrice;
  title: string;
  text: string;
  icon: LucideIcon;
  tone: string;
  glow: string;
  points: Array<{ text: string; icon: LucideIcon }>;
  featured?: boolean;
};

function formatPlanPrice(price: CompanyPlanPrice) {
  return price.kind === "monthly" ? `${formatRubPrice(price.rub)} ₽ / месяц` : price.label;
}

const businessValue: IconItem[] = [
  { icon: TicketCheck, title: "Подписки как продукт", text: "Создавайте тарифы, услуги и лимиты: каждый день, каждую неделю, раз за период или без лимита." },
  { icon: QrCode, title: "Касса без лишних действий", text: "Кассир находит клиента по QR или короткому коду, начисляет баллы и погашает услуги." },
  { icon: BarChart3, title: "Понятные цифры", text: "Текущий доход, будущая выручка, активные клиенты и использование услуг видны в кабинете." },
  { icon: Users, title: "Команда и роли", text: "Владелец управляет руководителями и кассирами, не смешивая роли компании с ролями платформы." },
];

const financeItems = [
  { label: "Текущий доход", value: "₽ / день", icon: CircleDollarSign },
  { label: "Потенциал подписок", value: "до истечения", icon: BarChart3 },
  { label: "Возврат клиентов", value: "через сервис", icon: Trophy },
];

const cases = [
  { title: "Кофейня", text: "Ежедневный напиток, десерт раз в неделю и уровни по сумме покупок." },
  { title: "Фитнес", text: "Безлимитный проход, гостевые визиты и контроль активной подписки." },
  { title: "Салон", text: "Пакеты услуг, персональные бонусы и возвращаемость клиентов." },
  { title: "Онлайн-сервис", text: "Работа без физической точки, подписки и доставка преимуществ." },
];

const companyPlans = [
  {
    name: "GO",
    label: "Бесплатно",
    price: { kind: "monthly", rub: COMPANY_GO_MONTHLY_PRICE_RUB },
    title: "Лёгкий старт",
    text: "Базовая бесплатная подписка, то что нужно для ознакомления!",
    icon: Store,
    tone: "border-cyan-200/18 bg-cyan-200/8 text-cyan-50",
    glow: "from-cyan-300/24",
    points: [
      { text: "5 сотрудников и две точки на карте", icon: MapPinned },
      { text: "Программа лояльности", icon: TicketCheck },
      { text: "Личная индивидуальная страница компании", icon: Store },
    ],
  },
  {
    name: "PRO",
    label: "Основной тариф",
    price: { kind: "monthly", rub: COMPANY_PRO_MONTHLY_PRICE_RUB },
    title: "Максимальная лояльность",
    text: "Всё, что входит в подписку GO, плюс расширенные возможности для более активного использования сервиса.",
    icon: Sparkles,
    tone: "border-cyan-100/35 bg-cyan-100/14 text-white",
    glow: "from-cyan-200/34",
    points: [
      { text: "Расширенная бонусная система", icon: BarChart3 },
      { text: "Акции, промокоды и AI-ассистент", icon: Bot },
      { text: "Участие в розыгрыше для партнеров", icon: Trophy },
    ],
    featured: true,
  },
  {
    name: "MAX",
    label: "Индивидуально",
    price: { kind: "custom", label: COMPANY_MAX_PRICE_LABEL },
    title: "Под крупную сеть",
    text: "Персональный формат для компаний, которым нужны отдельные условия подключения.",
    icon: Crown,
    tone: "border-violet-200/22 bg-violet-300/10 text-violet-50",
    glow: "from-violet-300/26",
    points: [
      { text: "Индивидуальные лимиты", icon: Crown },
      { text: "Отдельные условия запуска", icon: Handshake },
      { text: "Приоритетное сопровождение", icon: ShieldCheck },
    ],
  },
] satisfies CompanyPlan[];

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

function CompanyPlansSection() {
  return (
    <section className="relative z-10 px-4 pb-14 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <GlowCard className="p-4 sm:p-6">
          <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-100/64">Тарифы платформы</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">GO для старта, PRO для роста</h2>
              <p className="mt-2 text-sm leading-6 text-white/56">
                Компания не блокируется без оплаты: бесплатный GO оставляет рабочий кабинет, а PRO открывает полную версию без рекламы.
              </p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-2xl border border-cyan-100/18 bg-cyan-100/10 px-4 py-2.5 text-sm font-semibold text-cyan-50">
              <Megaphone className="h-4 w-4" />
              GO монетизируется рекламой
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.95fr_1.1fr_0.95fr]">
            {companyPlans.map((plan, index) => (
              <div
                key={plan.name}
                className={`relative flex min-h-[430px] flex-col overflow-hidden rounded-[1.5rem] border p-4 sm:p-5 ${
                  plan.featured
                    ? "border-cyan-100/38 bg-cyan-100/[0.095] shadow-[0_0_70px_rgba(103,232,249,0.12)]"
                    : "border-white/10 bg-black/20"
                }`}
              >
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${plan.glow} via-transparent to-transparent`} />
                <div className="relative flex h-full flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <div className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-semibold ${plan.tone}`}>
                      <plan.icon className="h-4 w-4" />
                      Nearloy {plan.name}
                    </div>
                    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/54">
                      {plan.label}
                    </span>
                  </div>

                  <div className="mt-6">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${plan.tone}`}>
                        <span className="text-sm font-semibold">0{index + 1}</span>
                      </div>
                      <h3 className="text-xl font-semibold sm:text-2xl">{plan.title}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-white/58">{plan.text}</p>
                  </div>

                  <div className="mt-5 grid gap-2.5">
                    {plan.points.map((point) => (
                      <div key={point.text} className="flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 bg-black/28 px-3 py-2.5 text-sm text-white/72">
                        <point.icon className="h-4 w-4 shrink-0 text-cyan-100" />
                        <span>{point.text}</span>
                      </div>
                    ))}
                  </div>

                  <div
                    className={`mt-auto rounded-3xl border p-4 ${
                      plan.featured ? "border-cyan-100/20 bg-cyan-100/10" : "border-white/10 bg-black/24"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-100/64">Стоимость</p>
                        <p className="mt-1 text-2xl font-semibold">{formatPlanPrice(plan.price)}</p>
                      </div>
                      <CircleDollarSign className="h-7 w-7 text-cyan-100" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlowCard>
      </div>
    </section>
  );
}

export default function BusinessLandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#02050a] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(103,232,249,0.13),transparent_28%),radial-gradient(circle_at_86%_18%,rgba(255,255,255,0.08),transparent_24%),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:auto,auto,80px_80px,80px_80px]" />
      <MarketingHeader active="business" />
      <MarketingPageReveal>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-8 lg:py-24">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-100/18 bg-cyan-100/10 px-4 py-2 text-sm font-semibold text-cyan-100">
            <Store className="h-4 w-4" />
            NearLoy для компаний и предпринимателей
          </div>
          <h1 className="mt-7 max-w-4xl text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
            Запускайте, возвращайте и управляйте лояльностью как продуктом
          </h1>
          <p className="mt-6 max-w-2xl text-xl leading-9 text-white/62">
            NearLoy помогает бизнесу выпускать тарифы, начислять бонусы, контролировать услуги, видеть финансовую картину и работать с клиентами через удобный кабинет.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/company/register" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-base font-semibold text-[#07101e] shadow-[0_0_34px_rgba(255,255,255,0.18)] transition hover:bg-white/90">
              Зарегистрировать компанию
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link href="/" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/7 px-6 text-base font-semibold text-white transition hover:bg-white/12">
              Посмотреть для клиентов
            </Link>
          </div>
        </div>

        <ImagePanel
          src="/landing/business-hero-dashboard.png"
          title="Кабинет с финансовой картиной"
          text="Подписки, клиенты, выплаты, текущая и будущая прибыль в одном рабочем пространстве."
        />
      </section>

      <CompanyPlansSection />

      <section className="relative z-10 px-4 pb-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <GlowCard className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_0.72fr] lg:items-center">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(168,85,247,0.20),transparent_30%),radial-gradient(circle_at_88%_12%,rgba(34,211,238,0.16),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.09),transparent_42%)]" />
            <div className="relative">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-200/25 bg-violet-300/10 px-4 py-2 text-sm font-semibold text-violet-50">
                <Gift className="h-4 w-4" />
                Розыгрыш для бизнеса
              </div>
              <h2 className="mt-5 max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
                100 000 ₽ на развитие компании после 50 активных компаний
              </h2>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-white/62">
                Подключите российскую компанию к NearLoy и участвуйте в розыгрыше гранта на развитие бизнеса. Чем ближе отметка 50 активных компаний, тем ближе день выбора победителя.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link href="/business/giveaway" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-sm font-semibold text-[#07101e] transition hover:bg-white/90">
                  Смотреть розыгрыш
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="/business/giveaway/rules" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/7 px-6 text-sm font-semibold text-white transition hover:bg-white/12">
                  Правила участия
                </Link>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-[1.75rem] border border-cyan-100/18 bg-black/30 p-6">
              <Sparkles className="absolute right-5 top-5 h-8 w-8 text-cyan-100/70" />
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100/58">Цель</p>
              <p className="mt-4 text-5xl font-semibold">50</p>
              <p className="mt-2 text-sm leading-6 text-white/58">активных компаний в NearLoy</p>
              <div className="mt-6 h-3 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-cyan-200 via-violet-300 to-fuchsia-300" />
              </div>
              <p className="mt-3 text-xs text-white/45">Актуальный прогресс — на странице розыгрыша.</p>
            </div>
          </GlowCard>
        </div>
      </section>

      <section id="features" className="relative z-10 border-y border-white/10 bg-white/[0.035] py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {businessValue.map((item) => (
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
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-8">
          <ImagePanel
            src="/landing/business-cashier-qr.png"
            title="Касса и клиенты"
            text="Быстрый поиск клиента, начисление баллов и погашение услуг подписки без лишней нагрузки на кассира."
          />
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100/64">Работа в точке</p>
            <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">Кассиру достаточно найти клиента и выбрать действие</h2>
            <p className="mt-4 text-lg leading-8 text-white/58">
              Клиент показывает QR или называет короткий код. Система показывает профиль, баланс, уровень, активные подписки и доступные услуги. Повторное погашение сверх лимита блокируется автоматически.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {financeItems.map((item) => (
                <div key={item.label} className="rounded-3xl border border-white/10 bg-white/[0.045] p-5">
                  <item.icon className="h-5 w-5 text-cyan-100" />
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-white/42">{item.label}</p>
                  <p className="mt-2 text-2xl font-semibold">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-y border-white/10 bg-white/[0.035] py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100/64">Подписки</p>
            <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">Тарифы с услугами, лимитами и понятной статистикой</h2>
            <p className="mt-4 text-lg leading-8 text-white/58">
              Подписка не существует без услуг. Компания заранее описывает, что получает клиент, как часто можно использовать преимущество и кто имеет право его погашать.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {cases.map((item) => (
                <div key={item.title} className="rounded-3xl border border-white/10 bg-black/24 p-5">
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/58">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
          <GlowCard className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-100/60">Пример тарифа</p>
                <h3 className="mt-3 text-2xl font-semibold">Coffee Everyday</h3>
              </div>
              <TicketCheck className="h-9 w-9 text-cyan-100" />
            </div>
            <div className="mt-6 grid gap-3">
              {["Напиток из классического меню — 1 раз в день", "Десерт к напитку — 1 раз в неделю", "Бонусы начисляются по уровню клиента"].map((line) => (
                <div key={line} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-sm text-white/70">
                  <ShieldCheck className="h-4 w-4 text-cyan-100" />
                  {line}
                </div>
              ))}
            </div>
          </GlowCard>
        </div>
      </section>

      <section className="relative z-10 py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:px-8">
          <ImagePanel
            src="/landing/business-collaboration.png"
            title="Партнёрские подписки"
            text="Две компании могут собрать общий тариф, согласовать доли дохода и погашать только свои услуги."
          />
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100/64">Клуб партнёров</p>
            <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">Совместные предложения усиливают ценность для клиента</h2>
            <p className="mt-4 text-lg leading-8 text-white/58">
              Кофейня может объединиться с фитнес-клубом, салон — с магазином косметики, онлайн-сервис — с локальным партнёром. Клиент получает больше пользы, а компании разделяют доход по согласованным правилам.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {[Handshake, Building2, MapPinned].map((Icon, index) => (
                <span key={index} className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-100/18 bg-cyan-100/10 text-cyan-100">
                  <Icon className="h-5 w-5" />
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="relative z-10 border-y border-white/10 bg-white/[0.035] py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100/64">Связь с командой</p>
            <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">Обсудим, как NearLoy подойдёт вашему бизнесу</h2>
            <p className="mt-4 text-lg leading-8 text-white/58">
              Оставьте контакты и коротко опишите задачу: бонусы, подписки, касса, онлайн-формат или партнёрские предложения. Мы свяжемся, покажем подходящий сценарий и ответим на вопросы до регистрации компании.
            </p>
            <Link href="/company/register" className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/7 px-6 text-sm font-semibold text-white transition hover:bg-white/12">
              Перейти к регистрации компании
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <LandingLeadForm source="business_landing" title="Связаться с NearLoy" note="Это форма для связи с командой NearLoy. Если вы уже готовы создать кабинет партнёра, используйте отдельную кнопку регистрации компании." />
        </div>
      </section>

      <MarketingFooter />
      </MarketingPageReveal>
    </main>
  );
}
