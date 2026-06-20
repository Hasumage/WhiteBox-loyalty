"use client";

import Link from "next/link";
import { ArrowRight, Building2, LogIn, UserRound } from "lucide-react";
import { NearLoyLogo } from "@/components/brand/NearLoyLogo";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { useI18n } from "@/lib/i18n/use-i18n";
import { cn } from "@/lib/utils";

type MarketingHeaderProps = {
  active: "users" | "business";
};

export function MarketingHeader({ active }: MarketingHeaderProps) {
  const isBusiness = active === "business";
  const { locale, setLocale } = useI18n("ru");
  const labels =
    locale === "ru"
      ? {
          subtitle: "система лояльности",
          users: "Для клиентов",
          business: "Для бизнеса",
          features: "Возможности",
          subscriptions: "Подписки",
          contacts: "Контакты",
          signIn: "Войти",
          createAccount: "Создать аккаунт",
          apply: "Подать заявку",
          becomePartner: "Стать партнёром",
        }
      : {
          subtitle: "loyalty system",
          users: "For customers",
          business: "For business",
          features: "Features",
          subscriptions: "Subscriptions",
          contacts: "Contacts",
          signIn: "Sign in",
          createAccount: "Create account",
          apply: "Apply",
          becomePartner: "Become a partner",
        };

  function handleSectionClick(event: React.MouseEvent<HTMLAnchorElement>, sectionId: string) {
    const target = document.getElementById(sectionId);
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${sectionId}`);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#02050a]/82 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-200/40 bg-cyan-200/10 text-cyan-100 shadow-[0_0_24px_rgba(103,232,249,0.18)]">
            <NearLoyLogo className="h-7 w-7" />
          </span>
          <span>
            <span className="block text-xl font-semibold leading-none text-white">NearLoy</span>
            <span className="mt-1 block text-xs text-white/46">{labels.subtitle}</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-2 text-sm font-semibold text-white/58 md:flex">
          <Link
            href="/"
            className={cn(
              "rounded-2xl px-4 py-2 transition hover:bg-white/8 hover:text-white",
              active === "users" && "bg-white text-[#07101e] hover:bg-white/90 hover:text-[#07101e]",
            )}
          >
            {labels.users}
          </Link>
          <Link
            href="/business"
            className={cn(
              "rounded-2xl px-4 py-2 transition hover:bg-white/8 hover:text-white",
              active === "business" && "bg-white text-[#07101e] hover:bg-white/90 hover:text-[#07101e]",
            )}
          >
            {labels.business}
          </Link>
          <a
            href={isBusiness ? "#features" : "#subscriptions"}
            onClick={(event) => handleSectionClick(event, isBusiness ? "features" : "subscriptions")}
            className="rounded-2xl px-4 py-2 transition hover:bg-white/8 hover:text-white"
          >
            {isBusiness ? labels.features : labels.subscriptions}
          </a>
          <a
            href="#contact"
            onClick={(event) => handleSectionClick(event, "contact")}
            className="rounded-2xl px-4 py-2 transition hover:bg-white/8 hover:text-white"
          >
            {labels.contacts}
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher locale={locale} onChange={(nextLocale) => void setLocale(nextLocale)} className="hidden lg:inline-flex" />
          <Link
            href={isBusiness ? "/login" : "/register"}
            className="hidden h-11 items-center gap-2 rounded-2xl border border-white/12 bg-white/7 px-4 text-sm font-semibold text-white transition hover:bg-white/12 sm:inline-flex"
          >
            {isBusiness ? <LogIn className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
            {isBusiness ? labels.signIn : labels.createAccount}
          </Link>
          <Link
            href={isBusiness ? "/company/register" : "/business"}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-[#07101e] shadow-[0_0_30px_rgba(255,255,255,0.16)] transition hover:bg-white/90"
          >
            {isBusiness ? <Building2 className="h-4 w-4" /> : null}
            {isBusiness ? labels.apply : labels.becomePartner}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl px-4 pb-3 sm:px-6 lg:hidden lg:px-8">
        <LanguageSwitcher locale={locale} onChange={(nextLocale) => void setLocale(nextLocale)} />
      </div>
    </header>
  );
}
