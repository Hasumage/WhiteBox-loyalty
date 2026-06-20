import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, BarChart3, Building2, CircleDollarSign, Handshake, MapPinned, QrCode, ShieldCheck, Store, TicketCheck, Trophy, Users } from "lucide-react";
import { LandingLeadForm } from "@/components/landing/LandingLeadForm";
import { MarketingHeader } from "@/components/landing/MarketingHeader";

export const metadata: Metadata = {
  title: "NearLoy для бизнеса — подписки, бонусы и возврат клиентов",
  description: "NearLoy помогает компаниям запускать подписки, начислять бонусы, управлять клиентами, ролями, финансами и партнёрскими предложениями.",
};

type IconItem = {
  icon: LucideIcon;
  title: string;
  text: string;
};

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

export default function BusinessLandingPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#02050a] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(103,232,249,0.13),transparent_28%),radial-gradient(circle_at_86%_18%,rgba(255,255,255,0.08),transparent_24%),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:auto,auto,80px_80px,80px_80px]" />
      <MarketingHeader active="business" />

      <section className="relative z-10 mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-8 lg:py-24">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-100/18 bg-cyan-100/10 px-4 py-2 text-sm font-semibold text-cyan-100">
            <Store className="h-4 w-4" />
            NearLoy для компаний и предпринимателей
          </div>
          <h1 className="mt-7 max-w-4xl text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
            Запускайте подписки, возвращайте клиентов и управляйте лояльностью как продуктом
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

      <section className="relative z-10 border-y border-white/10 bg-white/[0.035] py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100/64">Подключение</p>
            <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">Company-доступ выдаётся проверенным партнёрам</h2>
            <p className="mt-4 text-lg leading-8 text-white/58">
              Оставьте заявку, пройдите верификацию и получите кабинет компании. После подтверждения можно настраивать профиль, команду, подписки, уровни и финансы.
            </p>
          </div>
          <LandingLeadForm source="business_landing" title="Подключить компанию" note="Опишите бизнес и желаемый сценарий: бонусы, подписки, касса, онлайн-формат или партнёрская подписка." />
        </div>
      </section>
    </main>
  );
}
