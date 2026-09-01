"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Building2, Download, Menu, Sparkles, X } from "lucide-react";
import { NearLoyLogo } from "@/components/brand/NearLoyLogo";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import { MarketingAccountButton } from "@/components/landing/MarketingAccountButton";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getAccessToken, vkIdLoginUrl } from "@/lib/api/auth-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import { cn } from "@/lib/utils";

type MarketingHeaderProps = {
  active?: "users" | "business" | "hunt" | "contact";
};

export function MarketingHeader({ active }: MarketingHeaderProps) {
  const isBusiness = active === "business";
  const { locale, setLocale, t } = useI18n("ru");
  const [menuOpen, setMenuOpen] = useState(false);
  const [vkSheetOpen, setVkSheetOpen] = useState(false);

  const navItems = [
    { label: t("marketing.header.users"), href: "/", active: active === "users" },
    { label: t("marketing.header.business"), href: "/business", active: active === "business" },
    { label: t("marketing.header.game"), href: "/hunt/public", active: active === "hunt" },
    { label: t("marketing.header.contacts"), href: "/contact", sectionId: "contact", active: active === "contact" },
  ];

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    const seenKey = "nearloy.vkid-auth-sheet.seen.v1";
    if (getAccessToken() || localStorage.getItem(seenKey)) return;
    localStorage.setItem(seenKey, "1");
    const timeoutId = window.setTimeout(() => setVkSheetOpen(true), 850);
    return () => window.clearTimeout(timeoutId);
  }, []);

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

  function startVkIdLogin() {
    const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.assign(vkIdLoginUrl(next));
  }

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#02050a]/88 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center">
            <Link href="/" className="flex min-w-0 items-center gap-3">
                <NearLoyLogo className="h-11 w-11 shrink-0" />
              <span className="min-w-0">
                <span className="block truncate text-xl font-semibold leading-none text-white">NearLoy</span>
                <span className="mt-1 block truncate text-xs text-white/46">{t("marketing.header.subtitle")}</span>
              </span>
            </Link>
          </div>

          <nav className="hidden items-center gap-2 lg:flex">
            {navItems.map((item) => (
              <Link
                key={`${item.label}-${item.href}`}
                href={item.href}
                onClick={(event) => handleMenuClick(event, item.sectionId)}
                className={cn(
                  "relative isolate overflow-hidden rounded-full px-5 py-3 text-sm font-semibold transition duration-300",
                  item.active ? "text-[#07101e]" : "text-white/58 hover:bg-white/8 hover:text-white",
                )}
              >
                {item.active ? (
                  <motion.span
                    layoutId="marketing-header-active-pill"
                    className="absolute inset-0 -z-10 rounded-full bg-white shadow-[0_16px_45px_rgba(255,255,255,0.18)]"
                    transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.8 }}
                  />
                ) : null}
                <span className="relative z-10">{item.label}</span>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden lg:block">
              <LanguageSwitcher locale={locale} onChange={(nextLocale) => void setLocale(nextLocale)} />
            </div>
            <MarketingAccountButton locale={locale} className="hidden h-11 px-4 lg:inline-flex" />
            <Link
              href={isBusiness ? "/company/register" : "/business"}
              className="hidden h-11 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-[#07101e] shadow-[0_0_30px_rgba(255,255,255,0.16)] transition hover:bg-white/90 lg:inline-flex"
            >
              {isBusiness ? <Building2 className="h-4 w-4" /> : null}
              {isBusiness ? t("marketing.header.apply") : t("marketing.header.becomePartner")}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/12 bg-white/7 text-white transition hover:bg-white/12 lg:hidden"
              aria-expanded={menuOpen}
              aria-controls="marketing-navigation-drawer"
              aria-label={t("marketing.header.menu")}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-[90] bg-[#02050a] lg:hidden" role="presentation" onClick={() => setMenuOpen(false)}>
          <aside
            id="marketing-navigation-drawer"
            className="flex h-dvh w-screen flex-col bg-[#03070d]"
            role="dialog"
            aria-modal="true"
            aria-label={t("marketing.header.menu")}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
              <Link href="/" onClick={() => setMenuOpen(false)} className="flex min-w-0 items-center gap-3">
                  <NearLoyLogo className="h-12 w-12 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate text-xl font-semibold leading-none text-white">NearLoy</span>
                  <span className="mt-1 block truncate text-xs text-white/46">{t("marketing.header.subtitle")}</span>
                </span>
              </Link>
              <div className="flex shrink-0 items-center gap-2">
                <LanguageSwitcher locale={locale} onChange={(nextLocale) => void setLocale(nextLocale)} compact />
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-white/7 text-white transition hover:bg-white/12"
                  aria-label={t("marketing.header.close")}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="mb-5 rounded-[1.75rem] border border-cyan-200/15 bg-cyan-300/[0.04] p-4">
                <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("marketing.header.menuHint")}
                </p>
                <nav className="grid gap-2">
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
            </div>

            <div className="grid gap-2 border-t border-white/10 p-5">
              <a
                href="/downloads/nearloy-android.apk"
                download="NearLoy-Android-v0.1.2.apk"
                onClick={() => setMenuOpen(false)}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-cyan-100/20 bg-cyan-200/10 px-4 text-sm font-semibold text-cyan-50 transition hover:border-cyan-100/35 hover:bg-cyan-200/15"
              >
                <Download className="h-4 w-4" />
                {t("marketing.header.downloadApp")}
              </a>
              <MarketingAccountButton locale={locale} className="h-12 px-4" onClick={() => setMenuOpen(false)} />
              <Link
                href={isBusiness ? "/company/register" : "/business"}
                onClick={() => setMenuOpen(false)}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-[#07101e] transition hover:bg-white/90"
              >
                {isBusiness ? <Building2 className="h-4 w-4" /> : null}
                {isBusiness ? t("marketing.header.apply") : t("marketing.header.becomePartner")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </aside>
        </div>
      ) : null}

      <Sheet open={vkSheetOpen} onOpenChange={setVkSheetOpen}>
        <SheetContent side="bottom" className="mx-auto max-w-xl rounded-t-[2rem] border-cyan-100/18 bg-[#050914] p-0 text-white">
          <SheetHeader className="px-6 pb-2 pt-7 text-left">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0077ff] text-sm font-black text-white shadow-[0_16px_40px_rgba(0,119,255,0.32)]">
              VK
            </div>
            <SheetTitle className="text-2xl text-white">{t("marketing.header.vk.title")}</SheetTitle>
            <SheetDescription className="text-base leading-7 text-white/62">{t("marketing.header.vk.text")}</SheetDescription>
          </SheetHeader>
          <SheetFooter className="grid gap-2 px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-4 sm:grid-cols-2 sm:space-x-0">
            <Button
              type="button"
              className="h-12 rounded-2xl bg-[#0077ff] text-base font-semibold text-white hover:bg-[#0b83ff]"
              onClick={startVkIdLogin}
            >
              {t("marketing.header.vk.primary")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-2xl border-white/12 bg-white/7 text-base font-semibold text-white hover:bg-white/12 hover:text-white"
              onClick={() => setVkSheetOpen(false)}
            >
              {t("marketing.header.vk.later")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
