"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Building2, LogIn, Menu, Sparkles, X } from "lucide-react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const labels =
    locale === "ru"
      ? {
          subtitle: "система лояльности",
          menu: "Меню",
          close: "Закрыть меню",
          users: "Для клиентов",
          business: "Для бизнеса",
          features: "Возможности",
          subscriptions: "Подписки",
          contacts: "Контакты",
          signIn: "Войти",
          becomePartner: "Стать партнёром",
          apply: "Подать заявку",
          menuHint: "Навигация по NearLoy",
        }
      : {
          subtitle: "loyalty system",
          menu: "Menu",
          close: "Close menu",
          users: "For customers",
          business: "For business",
          features: "Features",
          subscriptions: "Subscriptions",
          contacts: "Contacts",
          signIn: "Sign in",
          becomePartner: "Become a partner",
          apply: "Apply",
          menuHint: "NearLoy navigation",
        };

  const navItems = [
    { label: labels.users, href: "/", active: active === "users" },
    { label: labels.business, href: "/business", active: active === "business" },
    {
      label: isBusiness ? labels.features : labels.subscriptions,
      href: isBusiness ? "#features" : "#subscriptions",
      sectionId: isBusiness ? "features" : "subscriptions",
    },
    { label: labels.contacts, href: "#contact", sectionId: "contact" },
  ];

  function handleSectionClick(event: React.MouseEvent<HTMLAnchorElement>, sectionId: string) {
    const target = document.getElementById(sectionId);
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${sectionId}`);
  }

  function handleMenuClick(event: React.MouseEvent<HTMLAnchorElement>, sectionId?: string) {
    if (sectionId) handleSectionClick(event, sectionId);
    setMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#02050a]/88 backdrop-blur-2xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/40 bg-cyan-200/10 text-cyan-100 shadow-[0_0_24px_rgba(103,232,249,0.18)]">
                <NearLoyLogo className="h-7 w-7" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xl font-semibold leading-none text-white">NearLoy</span>
                <span className="mt-1 block truncate text-xs text-white/46">{labels.subtitle}</span>
              </span>
            </Link>

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="hidden h-11 items-center gap-2 rounded-2xl border border-white/12 bg-white/7 px-4 text-sm font-semibold text-white transition hover:bg-white/12 md:inline-flex"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              {labels.menu}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher locale={locale} onChange={(nextLocale) => void setLocale(nextLocale)} className="hidden lg:inline-flex" />
            <Link
              href={isBusiness ? "/company/register" : "/business"}
              className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-[#07101e] shadow-[0_0_30px_rgba(255,255,255,0.16)] transition hover:bg-white/90"
            >
              {isBusiness ? <Building2 className="h-4 w-4" /> : null}
              <span className="hidden sm:inline">{isBusiness ? labels.apply : labels.becomePartner}</span>
              <span className="sm:hidden">{labels.becomePartner}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="hidden h-11 items-center gap-2 rounded-2xl border border-white/12 bg-white/7 px-4 text-sm font-semibold text-white transition hover:bg-white/12 sm:inline-flex"
            >
              <LogIn className="h-4 w-4" />
              {labels.signIn}
            </Link>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 lg:hidden">
          <LanguageSwitcher locale={locale} onChange={(nextLocale) => void setLocale(nextLocale)} />
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/12 bg-white/7 px-4 text-sm font-semibold text-white transition hover:bg-white/12"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? labels.close : labels.menu}
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            <span className="hidden xs:inline">{labels.menu}</span>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-white/10 bg-[#02050a]/96">
          <div className="mx-auto grid max-w-7xl gap-3 px-4 py-4 sm:px-6 md:grid-cols-[1fr_auto] lg:px-8">
            <div className="rounded-[1.75rem] border border-cyan-200/15 bg-cyan-300/[0.035] p-3">
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                <Sparkles className="h-3.5 w-3.5" />
                {labels.menuHint}
              </p>
              <nav className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {navItems.map((item) => (
                  <Link
                    key={`${item.label}-${item.href}`}
                    href={item.href}
                    onClick={(event) => handleMenuClick(event, item.sectionId)}
                    className={cn(
                      "rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-semibold text-white/70 transition hover:border-cyan-100/30 hover:bg-cyan-200/10 hover:text-white",
                      item.active && "border-cyan-100/35 bg-cyan-200/12 text-cyan-50",
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="grid grid-cols-2 gap-2 md:w-80 md:grid-cols-1">
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/7 px-4 text-sm font-semibold text-white transition hover:bg-white/12"
              >
                <LogIn className="h-4 w-4" />
                {labels.signIn}
              </Link>
              <Link
                href={isBusiness ? "/company/register" : "/business"}
                onClick={() => setMenuOpen(false)}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-[#07101e] transition hover:bg-white/90"
              >
                {isBusiness ? labels.apply : labels.becomePartner}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
