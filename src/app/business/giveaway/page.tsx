import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BadgeCheck, Building2, Camera, Gift, GraduationCap, Megaphone, Scale, Sparkles, Store, Trophy, Wrench } from "lucide-react";
import { MarketingFooter } from "@/components/landing/MarketingFooter";
import { MarketingHeader } from "@/components/landing/MarketingHeader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Розыгрыш 100 000 ₽ для бизнеса — NearLoy",
  description: "NearLoy разыграет 100 000 ₽ на развитие бизнеса после достижения цели в 50 активных компаний.",
};

const TARGET_COMPANY_COUNT = 50;
const PRIZE_LABEL = "100 000 ₽";

const giveawayUseCases = [
  {
    icon: Wrench,
    title: "Обновить оборудование",
    text: "Касса, кофемашина, рабочая техника, витрина или то, что быстрее всего улучшит сервис.",
    image: "/landing/giveaway-equipment.webp",
  },
  {
    icon: Megaphone,
    title: "Запустить локальную рекламу",
    text: "Тестировать промо, привести первых клиентов из района и усилить узнаваемость точки.",
    image: "/landing/giveaway-local-ads.webp",
  },
  {
    icon: Store,
    title: "Оформить пространство",
    text: "Освежить витрину, полки, свет, вывеску или зону, которую клиенты видят первой.",
    image: "/landing/giveaway-storefront.webp",
  },
  {
    icon: Camera,
    title: "Сделать сильный контент",
    text: "Провести съёмку меню, товаров, команды или интерьера для карточки и рекламы.",
    image: "/landing/giveaway-photoshoot.webp",
  },
  {
    icon: GraduationCap,
    title: "Прокачать команду",
    text: "Обучить сотрудников, собрать понятные сценарии сервиса и запустить первое предложение.",
    image: "/landing/giveaway-team.webp",
  },
];

async function getPaidCompanyCount() {
  try {
    const { prisma } = await import("@/lib/prisma");
    const now = new Date();

    const paidCompanyCount = await prisma.company.count({
      where: {
        isActive: true,
        billingAccount: {
          is: {
            status: "ACTIVE",
            currentPeriodEndsAt: { gt: now },
          },
        },
        OR: [
          {
            billingInvoices: {
              some: {
                status: "PAID",
                paidAmount: { gt: 0 },
              },
            },
          },
          {
            payments: {
              some: {
                purpose: "COMPANY_NEARLOY_SUBSCRIPTION",
                status: "SUCCEEDED",
                amount: { gt: 0 },
              },
            },
          },
        ],
      },
    });

    return { paidCompanyCount, isLive: true };
  } catch (error) {
    console.error("Failed to load giveaway progress", error);
    return { paidCompanyCount: 0, isLive: false };
  }
}

function ProgressVessel({ paidCompanyCount, progressPercent }: { paidCompanyCount: number; progressPercent: number }) {
  const liquidStyle = { height: `${progressPercent}%` } satisfies CSSProperties;

  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="absolute -inset-8 rounded-full bg-cyan-300/10 blur-3xl" />
      <div className="relative overflow-hidden rounded-[3.25rem] border border-cyan-100/25 bg-white/[0.045] p-5 shadow-[0_0_70px_rgba(34,211,238,0.10)]">
        <div className="relative h-[440px] overflow-hidden rounded-[2.75rem] border-2 border-cyan-100/25 bg-gradient-to-b from-white/[0.08] to-white/[0.02]">
          <div className="pointer-events-none absolute inset-x-10 top-7 h-5 rounded-full border border-white/20 bg-white/[0.08]" />
          <div className="absolute inset-x-0 bottom-0 overflow-hidden bg-gradient-to-t from-cyan-300/90 via-sky-300/75 to-violet-300/70 transition-[height] duration-700 ease-out" style={liquidStyle}>
            <div className="absolute -top-7 left-1/2 h-14 w-[135%] -translate-x-1/2 rounded-[50%] bg-cyan-50/36 blur-sm" />
            <div className="absolute -top-3 left-1/2 h-6 w-[118%] -translate-x-1/2 rounded-[50%] bg-white/24" />
            <div className="absolute left-10 top-1/4 h-4 w-4 rounded-full bg-white/30" />
            <div className="absolute right-14 top-1/2 h-3 w-3 rounded-full bg-white/25" />
            <div className="absolute left-1/2 top-2/3 h-5 w-5 rounded-full bg-white/20" />
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_26%_16%,rgba(255,255,255,0.22),transparent_22%),linear-gradient(90deg,rgba(255,255,255,0.18),transparent_18%,transparent_82%,rgba(255,255,255,0.12))]" />
          <div className="absolute inset-6 flex flex-col items-center justify-center text-center">
            <p className="rounded-full border border-white/18 bg-black/35 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-50">Заполнено</p>
            <p className="mt-5 text-7xl font-semibold tracking-tight">{progressPercent}%</p>
            <p className="mt-4 max-w-52 text-sm leading-6 text-white/68">
              {paidCompanyCount} из {TARGET_COMPANY_COUNT} активных компаний уже в цели розыгрыша.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function BusinessGiveawayPage() {
  const { paidCompanyCount, isLive } = await getPaidCompanyCount();
  const safeCount = Math.max(0, Math.min(paidCompanyCount, TARGET_COMPANY_COUNT));
  const progressPercent = Math.min(100, Math.round((safeCount / TARGET_COMPANY_COUNT) * 100));

  return (
    <main className="min-h-screen overflow-hidden bg-[#02050a] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(103,232,249,0.13),transparent_28%),radial-gradient(circle_at_84%_20%,rgba(168,85,247,0.16),transparent_26%),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:auto,auto,80px_80px,80px_80px]" />
      <MarketingHeader active="business" />

      <section className="relative z-10 mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-8 lg:py-20">
        <div>
          <Link href="/business" className="inline-flex items-center gap-2 text-sm font-semibold text-white/66 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Назад на лендинг
          </Link>
          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-violet-200/25 bg-violet-300/10 px-4 py-2 text-sm font-semibold text-violet-50">
            <Gift className="h-4 w-4" />
            Розыгрыш для компаний
          </div>
          <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
            {PRIZE_LABEL} на развитие бизнеса
          </h1>
          <p className="mt-6 max-w-2xl text-xl leading-9 text-white/64">
            Когда в NearLoy будет 50 активных российских компаний, мы проведём розыгрыш и выберем компанию, которая получит {PRIZE_LABEL} на развитие.
          </p>
          {!isLive ? (
            <p className="mt-4 rounded-2xl border border-amber-200/18 bg-amber-300/10 px-4 py-3 text-sm text-amber-50">
              Счётчик временно недоступен, но страница и правила работают. Попробуйте обновить позже.
            </p>
          ) : null}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/company/register" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-sm font-semibold text-[#07101e] transition hover:bg-white/90">
              Подключить компанию
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/business/giveaway/rules" className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/7 px-6 text-sm font-semibold text-white transition hover:bg-white/12">
              Открыть правила
            </Link>
          </div>
        </div>

        <ProgressVessel paidCompanyCount={safeCount} progressPercent={progressPercent} />
      </section>

      <section className="relative z-10 border-y border-white/10 bg-white/[0.035] py-14">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 sm:px-6 lg:grid-cols-4 lg:px-8">
          {[
            { icon: Building2, title: "Зарегистрируйте компанию", text: "Участвуют только реальные российские компании, ИП или самозанятые с корректными данными." },
            { icon: BadgeCheck, title: "Активируйте компанию", text: "Компания должна быть активной в NearLoy на дату формирования списка участников." },
            { icon: BadgeCheck, title: "Дождитесь отметки 50", text: "Сосуд на странице показывает прогресс до момента, когда можно проводить выбор победителя." },
            { icon: Trophy, title: "Получите шанс на приз", text: "Победитель подтверждает документы и получает денежный приз на развитие бизнеса." },
          ].map((item) => (
            <div key={item.title} className="rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-6">
              <item.icon className="h-7 w-7 text-cyan-100" />
              <h2 className="mt-5 text-xl font-semibold">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-white/58">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-6 px-4 py-14 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[2.25rem] border border-cyan-100/18 bg-cyan-300/[0.055] shadow-[0_0_80px_rgba(34,211,238,0.08)]">
          <div className="border-b border-white/10 p-6 sm:p-8">
            <Sparkles className="h-8 w-8 text-cyan-100" />
            <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">Что можно сделать на 100 000 ₽</h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-white/62">
              Приз можно направить на практичные улучшения: от оборудования и рекламы до визуального оформления, контента и команды.
            </p>
          </div>
          <div className="grid gap-4 bg-[#071019]/92 p-4 sm:p-6">
            {giveawayUseCases.map((item, index) => (
              <article
                key={item.title}
                className="group grid overflow-hidden rounded-[1.9rem] border border-white/10 bg-white/[0.045] shadow-[0_18px_60px_rgba(0,0,0,0.24)] transition duration-300 hover:-translate-y-0.5 hover:border-cyan-100/22 hover:bg-white/[0.065] md:grid-cols-[minmax(220px,0.36fr)_1fr]"
              >
                <div className="relative min-h-52 overflow-hidden bg-black/35 md:min-h-0">
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    sizes="(min-width: 1024px) 32vw, 100vw"
                    className="object-cover opacity-[0.78] saturate-[0.92] transition duration-500 group-hover:scale-[1.025] group-hover:opacity-95"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/12 via-black/10 to-black/58 md:bg-gradient-to-r" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_20%,rgba(103,232,249,0.16),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_34%,rgba(0,0,0,0.24))]" />
                  <div className="absolute left-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/16 bg-black/48 text-sm font-semibold text-white backdrop-blur-xl">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                </div>
                <div className="flex min-h-52 flex-col justify-center p-5 sm:p-7">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-100/18 bg-cyan-300/10 text-cyan-100 shadow-[0_0_35px_rgba(34,211,238,0.08)]">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div className="h-px flex-1 bg-gradient-to-r from-cyan-100/24 to-transparent" />
                  </div>
                  <h3 className="mt-5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{item.title}</h3>
                  <p className="mt-3 max-w-2xl text-base leading-7 text-white/60">{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-7">
          <Scale className="h-8 w-8 text-violet-100" />
          <h2 className="mt-5 text-2xl font-semibold">Коротко об условиях</h2>
          <p className="mt-3 text-sm leading-6 text-white/62">
            Один участник — одна компания. Компания должна существовать в РФ, соблюдать правила сервиса, не иметь признаков фиктивной регистрации и быть активной в NearLoy на дату розыгрыша.
          </p>
          <Link href="/business/giveaway/rules" className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/7 px-5 text-sm font-semibold text-white transition hover:bg-white/12">
            Полные правила
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
