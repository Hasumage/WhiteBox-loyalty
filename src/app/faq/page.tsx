import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleHelp } from "lucide-react";
import { MarketingFooter } from "@/components/landing/MarketingFooter";
import { MarketingHeader } from "@/components/landing/MarketingHeader";
import { faqHubCards } from "./faq-content";

export const metadata: Metadata = {
  title: "FAQ NearLoy — выберите раздел",
  description: "Выберите FAQ NearLoy для клиентов или для бизнеса. Отдельные страницы с вопросами по продукту и безопасности.",
};

export default function FaqHubPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#02050a] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(103,232,249,0.14),transparent_28%),radial-gradient(circle_at_80%_18%,rgba(255,255,255,0.08),transparent_24%),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:auto,auto,80px_80px,80px_80px]" />
      <MarketingHeader active="users" />

      <section className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="max-w-4xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-100/18 bg-cyan-100/10 px-4 py-2 text-sm font-semibold text-cyan-100">
            <CircleHelp className="h-4 w-4" />
            FAQ NearLoy
          </div>
          <h1 className="mt-7 text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">Выберите нужный раздел FAQ</h1>
          <p className="mt-6 max-w-3xl text-xl leading-9 text-white/62">
            У клиентов и бизнеса разные сценарии, поэтому мы разделили ответы на отдельные страницы. В каждой есть основной блок вопросов и отдельный блок безопасности.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {faqHubCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_0_44px_rgba(255,255,255,0.045)] transition hover:-translate-y-0.5 hover:border-cyan-100/24 hover:bg-cyan-100/10"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-100/14 bg-cyan-100/10 text-cyan-100">
                <card.icon className="h-5 w-5" />
              </span>
              <span className="mt-5 flex items-center justify-between gap-4 text-2xl font-semibold">
                {card.title}
                <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
              </span>
              <span className="mt-3 block text-sm leading-6 text-white/58">{card.text}</span>
            </Link>
          ))}
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}
