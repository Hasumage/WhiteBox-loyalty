"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MapPin, History, User, QrCode } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const navItems = [
  { href: "/", labelKey: "client.nav.home", icon: Home },
  { href: "/map", labelKey: "client.nav.map", icon: MapPin },
  { href: "/scan", labelKey: "client.nav.scan", icon: QrCode, isFab: true },
  { href: "/history", labelKey: "client.nav.history", icon: History },
  { href: "/settings", labelKey: "client.nav.profile", icon: User },
] satisfies Array<{ href: string; labelKey: TranslationKey; icon: LucideIcon; isFab?: boolean }>;

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n("ru");
  const isWallet = pathname.startsWith("/wallet/");
  const isSubscriptionDetail = pathname.startsWith("/marketplace/") && pathname !== "/marketplace";
  const hideNav = isWallet || isSubscriptionDetail;
  const hideFab = pathname === "/onboarding" || pathname === "/settings" || pathname.startsWith("/settings/");

  if (hideNav) return null;

  return (
    <>
      {!hideFab && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", bounce: 0.4, duration: 0.5 }}
          className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 md:bottom-24"
          style={{ maxWidth: 430, marginLeft: "auto", marginRight: "auto" }}
        >
          <Link
            href="/scan"
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 transition-transform active:scale-95 hover:bg-primary/90"
            aria-label={t("client.nav.scanQr")}
          >
            <QrCode className="h-7 w-7" strokeWidth={2.5} />
          </Link>
        </motion.div>
      )}

      {/* Bottom nav bar - 4 tabs (no Scan in bar) */}
      <nav
        className={cn(
          "glass fixed bottom-0 left-0 right-0 z-50 mx-auto flex max-w-[430px] items-center justify-around border-t border-white/10 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-3"
        )}
      >
        {navItems
          .filter((item) => !item.isFab)
          .map(({ href, labelKey, icon: Icon }) => {
            const isActive =
              href === "/"
                ? pathname === "/"
                : href === "/settings"
                  ? pathname === "/settings" || pathname.startsWith("/settings/")
                  : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "relative flex min-w-[64px] flex-col items-center gap-1 rounded-lg px-3 py-2 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <AnimatePresence mode="wait">
                  {isActive && (
                    <motion.span
                      layoutId="bottom-nav-pill"
                      className="absolute inset-0 rounded-lg bg-white/10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                      initial={false}
                    />
                  )}
                </AnimatePresence>
                <span className="relative">
                  <Icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 2} />
                </span>
                <span className="relative text-[10px] font-medium">{t(labelKey)}</span>
              </Link>
            );
          })}
      </nav>
    </>
  );
}
