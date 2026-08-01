"use client";

import Link from "next/link";
import { BriefcaseBusiness, Gift, Scale, Sparkles } from "lucide-react";
import { NearLoyLogo } from "@/components/brand/NearLoyLogo";
import { useI18n } from "@/lib/i18n/use-i18n";

const footerCopy = {
  ru: {
    tagline: "Ваш город. Ваши места. Ваши бонусы.",
    careers: "Вакансии",
    userTerms: "Правила для пользователей",
    companyTerms: "Правила для компаний",
    copyright: "Инфраструктура лояльности.",
    note: "Сделано для быстрых запусков и понятного сервиса.",
  },
  en: {
    tagline: "Bonuses, levels, partners and company tools in one tidy system.",
    careers: "Careers",
    userTerms: "User terms",
    companyTerms: "Company terms",
    copyright: "Loyalty infrastructure.",
    note: "Built for fast launches and clear service.",
  },
} as const;

export function MarketingFooter() {
  const { locale } = useI18n("ru");
  const copy = footerCopy[locale] ?? footerCopy.ru;
  const legalLinks = [
    { href: "/help/terms/users", label: copy.userTerms },
    { href: "/help/terms/companies", label: copy.companyTerms },
  ];

  return (
    <footer className="relative z-10 border-t border-white/10 bg-[#02050a]/92 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-6 rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 shadow-[0_0_60px_rgba(34,211,238,0.05)] sm:p-6 lg:grid-cols-[1.1fr_auto] lg:items-center">
        <div className="flex items-start gap-3">
          <NearLoyLogo className="h-11 w-11 shrink-0" />
          <div>
            <p className="text-lg font-semibold leading-none">NearLoy</p>
            <p className="mt-2 max-w-md text-sm leading-6 text-white/55">{copy.tagline}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/42 sm:flex-nowrap lg:justify-end">
          <Link
            href="/careers"
            className="inline-flex items-center gap-1.5 whitespace-nowrap transition hover:text-white/70"
          >
            <BriefcaseBusiness className="h-3.5 w-3.5" />
            {copy.careers}
          </Link>
          {legalLinks.map((link) => (
            <Link key={link.href} href={link.href} className="whitespace-nowrap transition hover:text-white/70">
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-4 flex max-w-7xl flex-col gap-2 text-xs text-white/36 sm:flex-row sm:items-center sm:justify-between">
        <span>
          © {new Date().getFullYear()} NearLoy. {copy.copyright}
        </span>
        <span className="inline-flex flex-wrap items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-cyan-100/60" />
          <span>{copy.note}</span>
          <Gift className="h-3.5 w-3.5 text-violet-100/60" />
          <Scale className="h-3.5 w-3.5 text-white/42" />
        </span>
      </div>
    </footer>
  );
}
