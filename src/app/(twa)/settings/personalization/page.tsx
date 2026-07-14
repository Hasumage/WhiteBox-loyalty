"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Heart, Sparkles, Store, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { ProfileStatusBadge } from "@/components/profile-status/profile-status-view";
import {
  getCachedFavoriteCategorySlugs,
  getCachedRegisteredCategories,
  getFavoriteCategorySlugs,
  getRegisteredCategories,
  type ApiCategory,
} from "@/lib/api/categories-client";
import { getCachedTwaCompanies, getTwaCompanies, getUserProfileStatuses, type TwaCompany, type UserProfileStatusState } from "@/lib/api/twa-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import { categoryName } from "@/lib/i18n/categories";
import { cn } from "@/lib/utils";

type PersonalizationCard = {
  href: string;
  title: string;
  subtitle: string;
  meta: string;
  image: string;
  icon: typeof Sparkles;
  accent: string;
  iconTone: string;
  children?: ReactNode;
};

function MiniCard({ card }: { card: PersonalizationCard }) {
  const Icon = card.icon;

  return (
    <Link
      href={card.href}
      className={cn(
        "group relative overflow-hidden rounded-[1.8rem] border border-white/20 bg-white/[0.06] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_18px_46px_rgba(0,0,0,0.26)] backdrop-blur-xl transition duration-500 hover:-translate-y-0.5 hover:border-white/35 hover:bg-white/[0.09]",
        "bg-gradient-to-br",
        card.accent,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(255,255,255,0.30),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.16),transparent_42%,rgba(255,255,255,0.06))] opacity-80" />
      <div className="absolute -left-16 top-10 h-28 w-36 rounded-full bg-black/[0.20] blur-3xl transition-transform duration-700 ease-out group-hover:translate-x-20 group-hover:-translate-y-4" />
      <div className="absolute -inset-y-10 -left-24 w-16 rotate-12 bg-white/[0.18] blur-xl transition-transform duration-700 ease-out group-hover:translate-x-80" />
      <div className="absolute inset-[1px] rounded-[1.7rem] border border-white/[0.08]" />
      <img
        src={card.image}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 top-1/2 h-[172%] w-[122%] -translate-y-1/2 object-contain object-right opacity-[0.27] mix-blend-screen saturate-125 [mask-image:linear-gradient(to_left,black_0%,black_62%,transparent_100%)] transition duration-500 ease-out group-hover:-translate-x-2 group-hover:scale-[1.03] group-hover:opacity-[0.37]"
      />

      <div className="relative flex min-h-[11.5rem] flex-col justify-between gap-4">
        <div className="flex items-start justify-between gap-3">
          <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]", card.iconTone)}>
            <Icon className="h-5 w-5" />
          </span>
          <Badge variant="secondary" className="border-white/15 bg-black/20 text-white/75">
            {card.meta}
          </Badge>
        </div>

        <div>
          <h2 className="text-lg font-semibold leading-tight">{card.title}</h2>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-white/66">{card.subtitle}</p>
        </div>

        {card.children ? <div className="min-h-7">{card.children}</div> : null}

        <div className="flex items-center justify-between text-sm font-semibold text-cyan-50/95">
          <span>Открыть</span>
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

export default function PersonalizationPage() {
  const { locale, t } = useI18n("ru");
  const isRu = locale === "ru";
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [favoriteSlugs, setFavoriteSlugs] = useState<string[]>([]);
  const [companies, setCompanies] = useState<TwaCompany[]>([]);
  const [profileStatuses, setProfileStatuses] = useState<UserProfileStatusState | null>(null);

  useEffect(() => {
    let ignore = false;
    const cachedFavoriteSlugs = getCachedFavoriteCategorySlugs();
    const cachedCategories = getCachedRegisteredCategories();
    const cachedCompanies = getCachedTwaCompanies();
    if (cachedFavoriteSlugs.length) setFavoriteSlugs(cachedFavoriteSlugs);
    if (cachedCategories.length) setCategories(cachedCategories);
    if (cachedCompanies.length) setCompanies(cachedCompanies);

    void Promise.all([
      getFavoriteCategorySlugs(),
      getRegisteredCategories(),
      getTwaCompanies(true),
      getUserProfileStatuses(),
    ]).then(([nextFavoriteSlugs, nextCategories, nextCompanies, nextStatuses]) => {
      if (ignore) return;
      setFavoriteSlugs(nextFavoriteSlugs);
      setCategories(nextCategories);
      setCompanies(nextCompanies);
      if (nextStatuses.ok) setProfileStatuses(nextStatuses.data);
    });

    return () => {
      ignore = true;
    };
  }, []);

  const favoriteCategories = useMemo(() => {
    const set = new Set(favoriteSlugs);
    return categories.filter((category) => set.has(category.slug));
  }, [categories, favoriteSlugs]);

  const favoriteCompanies = useMemo(
    () =>
      companies
        .filter((company) => company.isFavorite)
        .sort((a, b) => (Date.parse(b.favoritedAt ?? "") || 0) - (Date.parse(a.favoritedAt ?? "") || 0)),
    [companies],
  );

  const selectedStatus = profileStatuses?.selectedStatus;
  const unlockedStatuses = profileStatuses?.statuses.filter((status) => status.unlocked).length ?? 0;
  const totalStatuses = profileStatuses?.statuses.length ?? 0;

  const cards: PersonalizationCard[] = [
    {
      href: "/settings/statuses",
      title: t("client.profile.profileStatus"),
      subtitle: selectedStatus ? (isRu ? "Текущий статус уже выбран." : "Your current status is selected.") : t("client.profile.noStatusSelected"),
      meta: totalStatuses ? `${unlockedStatuses}/${totalStatuses}` : "—",
      image: "/personalization-card-bg/status-trophy.webp",
      icon: Trophy,
      accent: "from-violet-300/[0.24] via-fuchsia-400/[0.10] to-white/[0.03]",
      iconTone: "border-violet-200/30 bg-violet-300/[0.14] text-violet-50",
      children: selectedStatus ? <ProfileStatusBadge rarity={selectedStatus.rarity} icon={selectedStatus.icon} title={selectedStatus.title} className="max-w-full" /> : null,
    },
    {
      href: "/settings/favorites",
      title: t("client.profile.favoriteCategories"),
      subtitle: favoriteCategories.length ? (isRu ? "Эти категории первыми влияют на рекомендации." : "These categories guide your recommendations first.") : t("client.profile.chooseCategories"),
      meta: String(favoriteCategories.length),
      image: "/personalization-card-bg/favorite-categories.webp",
      icon: Heart,
      accent: "from-rose-300/[0.22] via-pink-400/[0.10] to-white/[0.03]",
      iconTone: "border-rose-200/30 bg-rose-300/[0.13] text-rose-50",
      children: (
        <div className="flex flex-wrap gap-1.5">
          {favoriteCategories.slice(0, 3).map((category) => (
            <span key={category.slug} className="inline-flex max-w-[7.5rem] items-center gap-1 rounded-full border border-white/25 bg-white/[0.12] px-2 py-1 text-[11px] font-semibold text-white/90">
              <CategoryIcon iconName={category.icon} className="h-3 w-3 shrink-0" />
              <span className="truncate">{categoryName(category, t)}</span>
            </span>
          ))}
          {favoriteCategories.length > 3 ? <span className="rounded-full border border-white/20 bg-white/[0.08] px-2 py-1 text-[11px] font-semibold text-white/70">+{favoriteCategories.length - 3}</span> : null}
        </div>
      ),
    },
    {
      href: "/companies?favorite=1",
      title: isRu ? "Любимые компании" : "Favorite companies",
      subtitle: favoriteCompanies.length ? (isRu ? "Быстрый доступ к сохранённым партнёрам." : "Fast access to saved partners.") : (isRu ? "Сохраняйте компании из карточек партнёров." : "Save companies from partner cards."),
      meta: String(favoriteCompanies.length),
      image: "/personalization-card-bg/favorite-companies.webp",
      icon: Store,
      accent: "from-cyan-300/[0.22] via-sky-400/[0.10] to-white/[0.03]",
      iconTone: "border-cyan-200/30 bg-cyan-300/[0.13] text-cyan-50",
      children: favoriteCompanies.length ? (
        <div className="flex flex-wrap gap-1.5">
          {favoriteCompanies.slice(0, 3).map((company) => (
            <span key={company.id} className="max-w-[8rem] truncate rounded-full border border-white/20 bg-white/[0.10] px-2 py-1 text-[11px] font-semibold text-white/85">
              {company.name}
            </span>
          ))}
          {favoriteCompanies.length > 3 ? <span className="rounded-full border border-white/20 bg-white/[0.08] px-2 py-1 text-[11px] font-semibold text-white/70">+{favoriteCompanies.length - 3}</span> : null}
        </div>
      ) : null,
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }} className="mx-auto max-w-lg px-4 pb-24 pt-6">
      <Link href="/settings" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        {t("client.common.back")}
      </Link>

      <section className="relative mb-4 overflow-hidden rounded-[2rem] border border-white/12 bg-slate-950/80 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(216,180,254,0.18),transparent_34%),radial-gradient(circle_at_100%_8%,rgba(103,232,249,0.14),transparent_28%)]" />
        <div className="relative">
          <Badge variant="secondary" className="mb-3 gap-1.5 border-violet-200/20 bg-violet-300/10 text-violet-100">
            <Sparkles className="h-3 w-3" />
            {t("client.profile.personalization")}
          </Badge>
          <h1 className="text-3xl font-semibold tracking-tight">{t("client.profile.personalization")}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {isRu ? "Здесь собраны настройки, которые делают NearLoy вашим: статус, интересы и сохранённые компании." : "Tune how NearLoy feels: status, interests and saved companies."}
          </p>
        </div>
      </section>

      <div className="grid gap-3">
        {cards.map((card) => (
          <MiniCard key={card.href} card={card} />
        ))}
      </div>
    </motion.div>
  );
}
