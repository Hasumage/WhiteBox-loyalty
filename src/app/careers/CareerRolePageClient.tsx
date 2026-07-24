"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n/use-i18n";
import { getCareerRole } from "./careerRoles";

type CareerRolePageClientProps = {
  slug: string;
};

export function CareerRolePageClient({ slug }: CareerRolePageClientProps) {
  const { locale } = useI18n("ru");
  const role = getCareerRole(slug, locale);
  const copy =
    locale === "ru"
      ? {
          back: "Назад к вакансиям",
          write: "Написать NearLoy",
          details: "Посмотреть детали",
          important: "Что важно",
          growth: "Куда можно вырасти",
        }
      : {
          back: "Back to careers",
          write: "Contact NearLoy",
          details: "View details",
          important: "What matters",
          growth: "Growth path",
        };

  if (!role) return null;

  return (
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
              <role.icon className="h-4 w-4" />
              {role.detail.badge}
            </div>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl">{role.title}</h1>
            <p className="mt-5 text-lg leading-8 text-white/66">{role.detail.lead}</p>
            <p className="mt-4 text-base leading-7 text-white/56">{role.detail.mission}</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/#contact"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-sm font-semibold text-[#07101e] transition hover:bg-white/90"
              >
                {copy.write}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#details"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/7 px-6 text-sm font-semibold text-white transition hover:bg-white/12"
              >
                {copy.details}
              </a>
            </div>
          </div>

          <div className="grid gap-4">
            {role.detail.focus.map((item) => (
              <article key={item.title} className="rounded-[1.75rem] border border-white/10 bg-black/24 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-100/18 bg-cyan-300/10 text-cyan-100">
                  <item.icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-xl font-semibold">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-white/58">{item.text}</p>
              </article>
            ))}
          </div>
        </div>

        <div id="details" className="grid gap-5 border-t border-white/10 p-6 sm:p-8 lg:grid-cols-2 lg:p-10">
          <section className="rounded-[2rem] border border-white/10 bg-black/20 p-6">
            <div className="flex items-center gap-3">
              <BriefcaseBusiness className="h-6 w-6 text-cyan-100" />
              <h2 className="text-2xl font-semibold">{copy.important}</h2>
            </div>
            <div className="mt-5 grid gap-2">
              {role.detail.expectations.map((item) => (
                <div
                  key={item}
                  className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-sm leading-6 text-white/62"
                >
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-100" />
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/10 bg-black/20 p-6">
            <div className="flex items-center gap-3">
              <Sparkles className="h-6 w-6 text-violet-100" />
              <h2 className="text-2xl font-semibold">{copy.growth}</h2>
            </div>
            <div className="mt-5 grid gap-2">
              {role.detail.growth.map((item) => (
                <div
                  key={item}
                  className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-sm leading-6 text-white/62"
                >
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-100" />
                  {item}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
