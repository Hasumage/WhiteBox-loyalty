"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ClipboardList,
  HeartHandshake,
  Megaphone,
  MessageCircle,
  Percent,
  Presentation,
  Search,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { useI18n } from "@/lib/i18n/use-i18n";

const taskIcons = [Search, MessageCircle, Presentation, ClipboardList, HeartHandshake, TrendingUp];
const rewardIcons = [Percent, HeartHandshake, Megaphone];

const b2bCopy = {
  ru: {
    back: "Назад к вакансиям",
    badge: "Главная роль запуска",
    title: "Менеджер по привлечению B2B-клиентов",
    lead:
      "NearLoy — стартап в сфере программ лояльности, бонусов и работы с постоянными клиентами. Мы помогаем бизнесу запускать специальные предложения, анализировать активность и возвращать клиентов чаще.",
    mission:
      "Сейчас проект находится на стадии запуска. Нам нужен человек, который сможет привлекать первые компании и вместе с командой выстроить устойчивую систему B2B-продаж.",
    contact: "Написать руководителю проекта",
    tasksLink: "Что предстоит делать",
    tasksEyebrow: "Основные задачи",
    tasksTitle: "От первого контакта до подключённой компании",
    tasksBadge: "Локальный бизнес, SaaS и партнёрства",
    candidateTitle: "Кого мы ищем",
    candidateText:
      "Опыт в B2B-продажах, маркетинге, локальном бизнесе, SaaS или программах лояльности будет преимуществом. Но важнее самостоятельность, ответственность и способность доводить переговоры до результата.",
    candidateResultTitle: "Как выглядит сильный результат",
    candidateResultText:
      "Первые подключённые компании, понятная воронка и честная обратная связь от бизнеса, которая помогает улучшать продукт.",
    candidateResultTags: ["подключения", "воронка", "обратная связь"],
    growthTitle: "Как может расти роль",
    growthText:
      "Это не классическая вакансия с фиксированным набором задач. На старте менеджер напрямую влияет на продукт, коммерческую модель и подход к работе с компаниями.",
    growthNote:
      "По мере роста NearLoy позиция может перерасти в роль руководителя направления B2B-продаж и маркетинга с собственной командой, процессами и бюджетом.",
    applyBadge: "Как откликнуться",
    applyTitle: "Напишите пару строк о себе и опыте",
    applyText:
      "Расскажите, с какими бизнесами работали, как ищете клиентов и почему вам интересен запуск B2B-направления NearLoy. Длинное резюме не обязательно — важнее ясность и реальный интерес к задаче.",
    tasks: [
      {
        title: "Искать подходящие компании",
        text: "Кафе, салоны, сервисы, магазины и другие локальные бизнесы, где NearLoy может усилить повторные покупки.",
      },
      {
        title: "Начинать диалог",
        text: "Выходить на владельцев и руководителей, задавать правильные вопросы и быстро понимать контекст бизнеса.",
      },
      {
        title: "Проводить презентации",
        text: "Показывать практическую пользу NearLoy на Zoom-встречах и в коротких демонстрациях.",
      },
      {
        title: "Вести путь до подключения",
        text: "Фиксировать договорённости, статусы, контакты и сопровождать компанию до запуска.",
      },
      {
        title: "Поддерживать отношения",
        text: "Оставаться на связи с привлечёнными клиентами и помогать им получать пользу от продукта.",
      },
      {
        title: "Строить систему продаж",
        text: "Участвовать в скриптах, коммерческих предложениях, обратной связи и будущем найме менеджеров.",
      },
    ],
    rewards: [
      {
        title: "30% от подписки",
        text: "Основная модель — процент от стоимости подписки каждой привлечённой компании.",
      },
      {
        title: "Доход сохраняется",
        text: "Выплата продолжается всё время, пока компания пользуется NearLoy и оплачивает подписку.",
      },
      {
        title: "Маркетинговое направление",
        text: "Дополнительно направление маркетинга может получать 50% дохода от рекламы в развиваемых соцсетях, пабликах и каналах проекта. Сумма распределяется внутри команды направления.",
      },
    ],
    traits: [
      "самостоятельно ищет потенциальных клиентов",
      "не боится первым начинать диалог",
      "говорит с предпринимателями на языке выгоды",
      "слушает и выявляет реальные проблемы бизнеса",
      "готов создавать систему продаж, а не только работать по инструкции",
      "понимает стартап-этап и ценит долгосрочный доход от клиентской базы",
    ],
    growth: [
      "более формализованная структура сотрудничества",
      "сохранение дохода от привлечённых компаний",
      "дополнительный процент от оборота подписок собственных клиентов",
      "появление маркетингового бюджета",
      "участие в формировании и управлении отделом привлечения и маркетинга",
    ],
  },
  en: {
    back: "Back to careers",
    badge: "Launch key role",
    title: "B2B Client Acquisition Manager",
    lead:
      "NearLoy is a startup in loyalty programs, rewards and recurring customer engagement. We help businesses launch special offers, analyze activity and bring customers back more often.",
    mission:
      "The product is at launch stage. We need someone who can attract first companies and help the team build a stable B2B sales system.",
    contact: "Message the project lead",
    tasksLink: "What you will do",
    tasksEyebrow: "Key responsibilities",
    tasksTitle: "From first contact to an onboarded company",
    tasksBadge: "Local business, SaaS and partnerships",
    candidateTitle: "Who we are looking for",
    candidateText:
      "Experience in B2B sales, marketing, local business, SaaS or loyalty programs is a plus. Independence, responsibility and the ability to move negotiations to results matter more.",
    candidateResultTitle: "What strong results look like",
    candidateResultText:
      "Clear first onboardings, a tidy pipeline and honest business feedback that helps improve the product.",
    candidateResultTags: ["onboardings", "pipeline", "feedback"],
    growthTitle: "How the role can grow",
    growthText:
      "This is not a classic role with a fixed checklist. At launch, the manager directly influences the product, commercial model and the way we work with companies.",
    growthNote:
      "As NearLoy grows, the position can evolve into leadership of B2B sales and marketing with a team, processes and budget.",
    applyBadge: "How to apply",
    applyTitle: "Write a few lines about yourself and your experience",
    applyText:
      "Tell us which businesses you have worked with, how you find clients and why launching NearLoy’s B2B direction sounds interesting. A long CV is optional — clarity and genuine interest matter more.",
    tasks: [
      {
        title: "Find suitable companies",
        text: "Cafes, salons, services, shops and other local businesses where NearLoy can improve repeat purchases.",
      },
      {
        title: "Start conversations",
        text: "Reach owners and managers, ask the right questions and quickly understand the business context.",
      },
      {
        title: "Run presentations",
        text: "Show the practical value of NearLoy in Zoom meetings and short product demos.",
      },
      {
        title: "Guide to onboarding",
        text: "Track agreements, statuses, contacts and support the company through launch.",
      },
      {
        title: "Maintain relationships",
        text: "Stay connected with referred clients and help them get value from the product.",
      },
      {
        title: "Build the sales system",
        text: "Contribute to scripts, commercial offers, feedback loops and future manager onboarding.",
      },
    ],
    rewards: [
      {
        title: "30% of subscription",
        text: "The main model is a percentage of the subscription value from each referred company.",
      },
      {
        title: "Recurring income",
        text: "The payout continues while the company uses NearLoy and pays for the subscription.",
      },
      {
        title: "Marketing direction",
        text: "The marketing direction may additionally receive 50% of advertising revenue from social channels, publics and media channels developed for the project. This amount is distributed inside the direction team.",
      },
    ],
    traits: [
      "finds potential clients independently",
      "is not afraid to start the first conversation",
      "speaks to entrepreneurs in terms of practical value",
      "listens carefully and uncovers real business problems",
      "is ready to build a sales system, not just follow instructions",
      "understands startup stage and values long-term portfolio income",
    ],
    growth: [
      "a more formal collaboration structure",
      "preserved income from referred companies",
      "additional percentage from subscription turnover of own clients",
      "marketing budget over time",
      "participation in building and managing the acquisition and marketing department",
    ],
  },
} as const;

export function B2BManagerCareerPageClient() {
  const { locale } = useI18n("ru");
  const copy = b2bCopy[locale] ?? b2bCopy.ru;

  return (
    <>
      <section className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <Link
          href="/careers"
          className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {copy.back}
        </Link>

        <div className="mt-8 overflow-hidden rounded-[2.75rem] border border-cyan-100/18 bg-[linear-gradient(135deg,rgba(14,116,144,0.2),rgba(124,58,237,0.12)_46%,rgba(2,5,10,0.94))] shadow-[0_0_100px_rgba(34,211,238,0.08)]">
          <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[0.95fr_1.05fr] lg:p-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-100/24 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-50">
                <Megaphone className="h-4 w-4" />
                {copy.badge}
              </div>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl">{copy.title}</h1>
              <p className="mt-5 text-lg leading-8 text-white/66">{copy.lead}</p>
              <p className="mt-4 text-base leading-7 text-white/56">{copy.mission}</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="https://t.me/Hasumage"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-sm font-semibold text-[#07101e] transition hover:bg-white/90"
                >
                  {copy.contact}
                  <MessageCircle className="h-4 w-4" />
                </Link>
                <a
                  href="#tasks"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/7 px-6 text-sm font-semibold text-white transition hover:bg-white/12"
                >
                  {copy.tasksLink}
                </a>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              {copy.rewards.map((card, index) => {
                const Icon = rewardIcons[index] ?? Sparkles;
                return (
                  <div key={card.title} className="rounded-[1.75rem] border border-white/10 bg-black/24 p-5">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-100/18 bg-cyan-300/10 text-cyan-100">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h2 className="mt-4 text-xl font-semibold">{card.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-white/58">{card.text}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div id="tasks" className="border-t border-white/10 p-6 sm:p-8 lg:p-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100/64">
                  {copy.tasksEyebrow}
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">{copy.tasksTitle}</h2>
              </div>
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-white/58">
                <Building2 className="h-4 w-4 text-cyan-100" />
                {copy.tasksBadge}
              </div>
            </div>

            <div className="mt-6 flex snap-x gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {copy.tasks.map((task, index) => {
                const Icon = taskIcons[index] ?? ClipboardList;
                return (
                  <article
                    key={task.title}
                    className="min-w-[250px] snap-start rounded-[1.75rem] border border-white/10 bg-[#071019]/82 p-5 shadow-[0_14px_50px_rgba(0,0,0,0.22)] sm:min-w-[300px]"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.06] text-cyan-100">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold">{task.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/58">{task.text}</p>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="grid gap-5 border-t border-white/10 p-6 sm:p-8 lg:grid-cols-[0.95fr_1.05fr] lg:p-10">
            <div className="rounded-[2rem] border border-white/10 bg-black/20 p-6">
              <div className="flex items-center gap-3">
                <Users className="h-6 w-6 text-cyan-100" />
                <h2 className="text-2xl font-semibold">{copy.candidateTitle}</h2>
              </div>
              <p className="mt-4 text-base leading-7 text-white/60">{copy.candidateText}</p>
              <div className="mt-5 grid gap-2">
                {copy.traits.map((trait) => (
                  <div
                    key={trait}
                    className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-sm leading-6 text-white/62"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-100" />
                    <span>{trait}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-[1.5rem] border border-cyan-100/18 bg-[linear-gradient(135deg,rgba(34,211,238,0.12),rgba(124,58,237,0.08))] p-5">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-5 w-5 text-cyan-100" />
                  <h3 className="text-base font-semibold text-white">{copy.candidateResultTitle}</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-white/62">{copy.candidateResultText}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {copy.candidateResultTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/10 bg-white/[0.055] px-3 py-1 text-xs font-semibold text-cyan-50/78"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-black/20 p-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-6 w-6 text-violet-100" />
                <h2 className="text-2xl font-semibold">{copy.growthTitle}</h2>
              </div>
              <p className="mt-4 text-base leading-7 text-white/60">{copy.growthText}</p>
              <div className="mt-6 space-y-3">
                {copy.growth.map((step, index) => (
                  <div key={step} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-violet-100/20 bg-violet-300/10 text-sm font-semibold text-violet-50">
                      {index + 1}
                    </span>
                    <p className="text-sm leading-6 text-white/62">{step}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-[1.5rem] border border-cyan-100/18 bg-cyan-300/10 p-4 text-sm leading-6 text-cyan-50/80">
                {copy.growthNote}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[2.25rem] border border-cyan-100/18 bg-cyan-300/[0.055] p-6 shadow-[0_0_80px_rgba(34,211,238,0.08)] sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-100/22 bg-violet-300/10 px-4 py-2 text-sm font-semibold text-violet-50">
                <Sparkles className="h-4 w-4" />
                {copy.applyBadge}
              </div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">{copy.applyTitle}</h2>
              <p className="mt-4 max-w-3xl text-base leading-7 text-white/62">{copy.applyText}</p>
            </div>
            <Link
              href="https://t.me/Hasumage"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-sm font-semibold text-[#07101e] transition hover:bg-white/90"
            >
              {copy.contact}
              <MessageCircle className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
