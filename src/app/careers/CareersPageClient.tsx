"use client";

import Link from "next/link";
import { ArrowRight, BadgeCheck, BriefcaseBusiness, HeartHandshake, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n/use-i18n";
import { getCareerPrinciples, getCareerRoles, getCareersPageCopy } from "./careerRoles";

export function CareersPageClient() {
  const { locale } = useI18n("ru");
  const copy = getCareersPageCopy(locale);
  const principles = getCareerPrinciples(locale);
  const roles = getCareerRoles(locale);

  return (
    <>
      <section className="relative z-10 mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8 lg:py-20">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-100/22 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-50">
            <BriefcaseBusiness className="h-4 w-4" />
            {copy.badge}
          </div>
          <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
            {copy.title}
          </h1>
          <p className="mt-6 max-w-2xl text-xl leading-9 text-white/62">{copy.subtitle}</p>
        </div>

        <div className="relative">
          <div className="absolute -inset-8 rounded-full bg-cyan-300/10 blur-3xl" />
          <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_0_90px_rgba(34,211,238,0.08)]">
            <div className="grid gap-4">
              {principles.map((principle, index) => (
                <div key={principle} className="rounded-[1.5rem] border border-white/10 bg-black/24 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100/62">
                      0{index + 1}
                    </span>
                    <Sparkles className="h-5 w-5 text-cyan-100" />
                  </div>
                  <p className="mt-4 text-base leading-7 text-white/70">{principle}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-y border-white/10 bg-white/[0.035] py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-100/64">
                {copy.rolesEyebrow}
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{copy.rolesTitle}</h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-white/56">{copy.rolesIntro}</p>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {roles.map((vacancy) => (
              <Link
                key={vacancy.slug}
                href={vacancy.href}
                className={[
                  "group block overflow-hidden rounded-[2rem] border border-white/10 bg-[#071019]/92 p-5 shadow-[0_18px_70px_rgba(0,0,0,0.24)] transition duration-300 hover:-translate-y-0.5 hover:border-cyan-100/24 hover:bg-white/[0.06]",
                  vacancy.featured ? "lg:col-span-2 lg:p-7" : "",
                ].join(" ")}
              >
                <div className={vacancy.featured ? "grid gap-5 lg:grid-cols-[0.78fr_1fr] lg:items-center" : ""}>
                  <div>
                    <div className="flex items-start justify-between gap-5">
                      <div className="flex min-w-0 items-start gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-100/18 bg-cyan-300/10 text-cyan-100 shadow-[0_0_35px_rgba(34,211,238,0.08)]">
                          <vacancy.icon className="h-6 w-6" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/40">
                            {vacancy.tag}
                          </p>
                          <h3 className="mt-2 text-2xl font-semibold tracking-tight">{vacancy.title}</h3>
                        </div>
                      </div>
                      {vacancy.featured ? (
                        <BadgeCheck className="h-5 w-5 shrink-0 text-cyan-100/70" />
                      ) : (
                        <ArrowRight className="h-5 w-5 shrink-0 text-white/46 transition group-hover:translate-x-1 group-hover:text-cyan-100" />
                      )}
                    </div>
                    <p className="mt-5 text-base leading-7 text-white/62">{vacancy.intro}</p>
                  </div>

                  <div className="mt-5 grid gap-2 lg:mt-0">
                    {vacancy.points.map((point) => (
                      <div
                        key={point}
                        className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-sm leading-6 text-white/62"
                      >
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-100" />
                        {point}
                      </div>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[2.25rem] border border-cyan-100/18 bg-cyan-300/[0.055] p-6 shadow-[0_0_80px_rgba(34,211,238,0.08)] sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-100/22 bg-violet-300/10 px-4 py-2 text-sm font-semibold text-violet-50">
                <HeartHandshake className="h-4 w-4" />
                {copy.applyBadge}
              </div>
              <h2 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">{copy.applyTitle}</h2>
              <p className="mt-4 max-w-3xl text-base leading-7 text-white/62">{copy.applyText}</p>
            </div>
            <Link
              href="/#contact"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 text-sm font-semibold text-[#07101e] transition hover:bg-white/90"
            >
              {copy.applyCta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
