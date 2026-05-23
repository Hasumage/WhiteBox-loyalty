"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronRight,
  Crown,
  Flame,
  Gift,
  Lock,
  MapPin,
  Medal,
  Route,
  Sparkles,
  Star,
  Ticket,
  Trophy,
  WalletCards,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/use-i18n";

const seasonProgress = 42;
const currentTier = 7;
const maxTier = 20;

const tiers = [
  { level: 1, label: { en: "Launch spark", ru: "Искра старта" }, reward: { en: "Founding badge", ru: "Значок основателя" }, icon: Sparkles, state: "claimed" },
  { level: 2, label: { en: "Coffee pulse", ru: "Кофейный пульс" }, reward: { en: "+150 Aurora pts", ru: "+150 баллов Aurora" }, icon: WalletCards, state: "claimed" },
  { level: 3, label: { en: "Map scout", ru: "Разведчик карты" }, reward: { en: "Route frame", ru: "Рамка маршрута" }, icon: MapPin, state: "claimed" },
  { level: 4, label: { en: "Category glow", ru: "Свечение категории" }, reward: { en: "Profile accent", ru: "Акцент профиля" }, icon: Star, state: "claimed" },
  { level: 5, label: { en: "Weekly chest", ru: "Недельный сундук" }, reward: { en: "Mystery perk", ru: "Секретный бонус" }, icon: Gift, state: "claimed" },
  { level: 6, label: { en: "Partner step", ru: "Шаг партнера" }, reward: { en: "+250 partner pts", ru: "+250 баллов партнера" }, icon: Medal, state: "claimed" },
  { level: 7, label: { en: "Current tier", ru: "Текущий уровень" }, reward: { en: "Pulse upgrade", ru: "Усиление пульса" }, icon: Flame, state: "current" },
  { level: 8, label: { en: "Subscriber", ru: "Подписчик" }, reward: { en: "3 bonus days", ru: "3 бонусных дня" }, icon: Ticket, state: "next" },
  { level: 9, label: { en: "Explorer", ru: "Исследователь" }, reward: { en: "Map badge", ru: "Значок карты" }, icon: Route, state: "locked" },
  { level: 10, label: { en: "Silver drop", ru: "Серебряный дроп" }, reward: { en: "Silver profile aura", ru: "Серебряная аура" }, icon: Trophy, state: "locked" },
];

const missions = [
  { title: { en: "Earn 300 points", ru: "Получить 300 баллов" }, detail: { en: "Any partner this week", ru: "У любого партнера на этой неделе" }, progress: 220, total: 300, icon: Zap, accent: "text-cyan-200" },
  { title: { en: "Build one route", ru: "Построить один маршрут" }, detail: { en: "Open Yandex route to a partner", ru: "Откройте маршрут до партнера" }, progress: 0, total: 1, icon: Route, accent: "text-emerald-200" },
  { title: { en: "Activate a subscription", ru: "Подключить подписку" }, detail: { en: "Any marketplace plan", ru: "Любой план из маркетплейса" }, progress: 0, total: 1, icon: Ticket, accent: "text-amber-200" },
];

const rewards = [
  { title: { en: "Profile aura", ru: "Аура профиля" }, subtitle: { en: "Cosmetic glow", ru: "Косметическое свечение" }, icon: Crown },
  { title: { en: "Bonus points", ru: "Бонусные баллы" }, subtitle: { en: "Company-specific", ru: "Для конкретной компании" }, icon: WalletCards },
  { title: { en: "Mystery perk", ru: "Секретный бонус" }, subtitle: { en: "Weekly reveal", ru: "Открывается каждую неделю" }, icon: Gift },
];

export default function SeasonPassPrototypePage() {
  const { locale, t } = useI18n("ru");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
      className="min-h-full overflow-hidden px-4 pb-24 pt-5"
    >
      <Link href="/settings" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        {t("client.season.backProfile")}
      </Link>

      <section className="relative mb-4 overflow-hidden rounded-[2.25rem] border border-white/10 bg-slate-950 p-5 shadow-[0_26px_80px_rgba(0,0,0,0.45)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.2),transparent_28%),radial-gradient(circle_at_85%_8%,rgba(34,211,238,0.22),transparent_34%),linear-gradient(145deg,rgba(255,255,255,0.08),transparent_45%)]" />
        <div className="pointer-events-none absolute -right-10 top-10 h-36 w-36 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <Badge variant="secondary" className="mb-3 gap-1 border-white/10 bg-white/10 text-white">
                <CalendarDays className="h-3 w-3" />
                {t("client.season.badge")}
              </Badge>
              <h1 className="max-w-[14rem] text-3xl font-semibold leading-none tracking-tight">
                {t("client.season.title")}
              </h1>
              <p className="mt-2 max-w-[18rem] text-sm leading-relaxed text-white/60">
                {t("client.season.subtitle")}
              </p>
            </div>

            <motion.div
              animate={{ rotate: [0, 8, -8, 0], y: [0, -3, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.5rem] border border-white/15 bg-white/[0.09] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_18px_42px_rgba(0,0,0,0.35)]"
            >
              <Crown className="h-8 w-8 drop-shadow-[0_0_14px_rgba(255,255,255,0.65)]" />
            </motion.div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-black/25 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-white/45">{t("client.season.currentTier")}</p>
                <p className="text-lg font-semibold">{currentTier} / {maxTier}</p>
              </div>
              <Badge className="gap-1 bg-white text-black">
                <Flame className="h-3 w-3" />
                {seasonProgress}% {t("client.season.complete")}
              </Badge>
            </div>
            <Progress value={seasonProgress} className="h-2 bg-white/10 [&>div]:bg-white" />
          </div>
        </div>
      </section>

      <section className="mb-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t("client.season.rewardTrack")}</h2>
            <p className="text-xs text-muted-foreground">{t("client.season.weeklySubtitle")}</p>
          </div>
          <Badge variant="outline" className="border-white/10">{t("client.season.demoOnly")}</Badge>
        </div>

        <div className="hide-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 touch-pan-x">
          {tiers.map((tier) => {
            const Icon = tier.icon;
            const isClaimed = tier.state === "claimed";
            const isCurrent = tier.state === "current";
            const isNext = tier.state === "next";
            return (
              <motion.div
                key={tier.level}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "relative min-w-[8.6rem] snap-start overflow-hidden rounded-3xl border p-3",
                  isCurrent
                    ? "border-cyan-200/40 bg-cyan-300/10 shadow-[0_0_38px_rgba(103,232,249,0.14)]"
                    : isClaimed
                      ? "border-emerald-300/25 bg-emerald-500/8"
                      : isNext
                        ? "border-white/18 bg-white/[0.07]"
                        : "border-white/10 bg-white/[0.025] opacity-70",
                )}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t("client.season.currentTier")} {tier.level}</span>
                  {isClaimed ? <Check className="h-4 w-4 text-emerald-200" /> : tier.state === "locked" ? <Lock className="h-4 w-4 text-muted-foreground" /> : <Sparkles className="h-4 w-4 text-cyan-100" />}
                </div>
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/30">
                  <Icon className={cn("h-6 w-6", isClaimed ? "text-emerald-100" : isCurrent ? "text-cyan-100" : "text-white/70")} />
                </div>
                <p className="text-sm font-semibold leading-tight">{tier.label[locale]}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{tier.reward[locale]}</p>
                {isCurrent && <div className="absolute inset-x-3 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-100/70 to-transparent" />}
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="mb-4 grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t("client.season.weeklyMissions")}</h2>
            <p className="text-xs text-muted-foreground">{t("client.season.prototypeNote")}</p>
          </div>
          <Badge variant="secondary" className="gap-1">
            <Zap className="h-3 w-3" />
            {t("client.season.xpLeft").replace("{count}", "920")}
          </Badge>
        </div>

        {missions.map((mission, index) => {
          const Icon = mission.icon;
          const progress = Math.min(100, Math.round((mission.progress / mission.total) * 100));
          return (
            <motion.div
              key={mission.title.en}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              <Card className="glass overflow-hidden border-white/10 bg-slate-950/55">
                <CardContent className="p-3">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]">
                      <Icon className={cn("h-5 w-5", mission.accent)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{mission.title[locale]}</p>
                      <p className="truncate text-xs text-muted-foreground">{mission.detail[locale]}</p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold tabular-nums">{mission.progress}/{mission.total}</span>
                  </div>
                  <Progress value={progress} className="h-1.5 bg-white/10" />
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </section>

      <section className="mb-4 rounded-[2rem] border border-white/10 bg-white/[0.035] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t("client.season.rewardIdeas")}</h2>
            <p className="text-xs text-muted-foreground">{t("client.season.rewardSubtitle")}</p>
          </div>
          <Gift className="h-5 w-5 text-primary" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {rewards.map((reward) => {
            const Icon = reward.icon;
            return (
              <div key={reward.title.en} className="rounded-2xl border border-white/10 bg-black/20 p-3 text-center">
                <Icon className="mx-auto mb-2 h-5 w-5 text-primary" />
                <p className="text-xs font-semibold leading-tight">{reward.title[locale]}</p>
                <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{reward.subtitle[locale]}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-primary text-primary-foreground p-4">
        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-black/10 blur-2xl" />
        <div className="relative flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{t("client.season.premiumIdea")}</p>
            <p className="mt-1 text-xs opacity-70">{t("client.season.premiumCopy")}</p>
          </div>
          <Button variant="secondary" size="sm" className="shrink-0 rounded-full" disabled>
            {t("client.season.preview")}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </section>

      <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
        <BadgeCheck className="mr-1 inline h-3.5 w-3.5" />
        {t("client.season.prototypeNote")}
      </div>
    </motion.div>
  );
}
