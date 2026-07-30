import Link from "next/link";
import { ArrowRight, CircleHelp } from "lucide-react";
import { LandingLeadForm } from "@/components/landing/LandingLeadForm";
import { MarketingFooter } from "@/components/landing/MarketingFooter";
import { MarketingHeader } from "@/components/landing/MarketingHeader";
import type { FaqPageContent } from "./faq-content";

type FaqMarketingPageProps = {
  content: FaqPageContent;
};

export function FaqMarketingPage({ content }: FaqMarketingPageProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: content.groups.flatMap((group) =>
      group.items.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    ),
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#02050a] text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(103,232,249,0.14),transparent_28%),radial-gradient(circle_at_80%_18%,rgba(255,255,255,0.08),transparent_24%),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:auto,auto,80px_80px,80px_80px]" />
      <MarketingHeader active={content.active} />

      <section className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-100/18 bg-cyan-100/10 px-4 py-2 text-sm font-semibold text-cyan-100">
              <CircleHelp className="h-4 w-4" />
              {content.badge}
            </div>
            <h1 className="mt-7 text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">{content.title}</h1>
            <p className="mt-6 max-w-3xl text-xl leading-9 text-white/62">{content.description}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={content.primaryCta.href} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-base font-semibold text-[#07101e] shadow-[0_0_34px_rgba(255,255,255,0.18)] transition hover:bg-white/90">
                {content.primaryCta.label}
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link href={content.secondaryCta.href} className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/7 px-6 text-base font-semibold text-white transition hover:bg-white/12">
                {content.secondaryCta.label}
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_0_44px_rgba(255,255,255,0.055)] backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100/64">Разделы</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {content.groups.map((group) => (
                <Link
                  key={group.id}
                  href={`#${group.id}`}
                  className="group rounded-3xl border border-white/10 bg-black/20 p-5 transition hover:-translate-y-0.5 hover:border-cyan-100/24 hover:bg-cyan-100/10"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-100/14 bg-cyan-100/10 text-cyan-100">
                    <group.icon className="h-5 w-5" />
                  </span>
                  <span className="mt-4 flex items-center justify-between gap-3 text-sm font-semibold text-white">
                    {group.title}
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-white/50">{group.items.length} вопросов</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-y border-white/10 bg-white/[0.035] py-16">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 lg:px-8">
          {content.groups.map((group) => (
            <section key={group.id} id={group.id} className="scroll-mt-24 rounded-[2rem] border border-white/10 bg-black/20 p-5 shadow-[0_0_44px_rgba(255,255,255,0.045)] backdrop-blur sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100/64">{group.eyebrow}</p>
                  <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">{group.title}</h2>
                  <p className="mt-3 max-w-3xl text-base leading-7 text-white/58">{group.description}</p>
                </div>
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-100/14 bg-cyan-100/10 text-cyan-100">
                  <group.icon className="h-6 w-6" />
                </span>
              </div>

              <div className="mt-7 grid gap-3 lg:grid-cols-2">
                {group.items.map((item, index) => (
                  <article key={item.question} className="rounded-3xl border border-white/10 bg-white/[0.045] p-5">
                    <p className="text-xs font-semibold text-cyan-100/64">{String(index + 1).padStart(2, "0")}</p>
                    <h3 className="mt-2 text-lg font-semibold">{item.question}</h3>
                    <p className="mt-3 text-sm leading-6 text-white/58">{item.answer}</p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start lg:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100/64">Ещё вопросы</p>
          <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">Напишите нам — поможем разобраться</h2>
          <p className="mt-4 text-lg leading-8 text-white/58">
            Если в FAQ не хватило деталей, оставьте контакт и вопрос. Сообщение уйдёт тем же маршрутом, что и формы на основном лендинге, а команда NearLoy вернётся с ответом.
          </p>
          <Link href={content.switchCta.href} className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/7 px-6 text-sm font-semibold text-white transition hover:bg-white/12">
            {content.switchCta.label}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <LandingLeadForm
          source={content.kind === "business" ? "business_landing" : "user_landing"}
          title={content.kind === "business" ? "Задать вопрос о подключении" : "Задать вопрос NearLoy"}
          note={
            content.kind === "business"
              ? "Опишите компанию и вопрос: подключение, кабинет, команда, выплаты, безопасность или пилотный сценарий."
              : "Опишите вопрос: бонусы, QR, карта партнёров, мобильное приложение, аккаунт или безопасность."
          }
        />
      </section>

      <MarketingFooter />
    </main>
  );
}
