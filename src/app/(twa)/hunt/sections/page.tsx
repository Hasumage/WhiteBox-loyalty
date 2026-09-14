"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Boxes,
  ChevronRight,
  Crown,
  GalleryVerticalEnd,
  Map,
  ScrollText,
  ShoppingBag,
  Sparkles,
  Swords,
  Trophy,
  WalletCards,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { huntInteractiveClass } from "../_components/hunt-ui";

const sections = [
  {
    href: "/hunt/districts",
    title: "Битва районов",
    subtitle: "Крупные зоны Москвы соревнуются по сумме лайков за посты.",
    metric: "Новый режим",
    image: "/hunt-assets/posts/demo-river-walk.webp",
    icon: Map,
    accent: "from-cyan-300/28 via-emerald-300/12 to-transparent",
  },
  {
    href: "/hunt/shop",
    title: "Магазин",
    subtitle: "Коробки, районные находки и новые персонажи для отряда.",
    metric: "Коробки",
    image: "/hunt-assets/shop/weekly-gold-chest.webp",
    icon: ShoppingBag,
    accent: "from-amber-300/26 via-cyan-300/10 to-transparent",
  },
  {
    href: "/hunt/all-cards",
    title: "Все карточки",
    subtitle: "Каталог существ, стихий, редкостей и будущих целей коллекции.",
    metric: "Каталог",
    image: "/hunt-assets/cards/creature-sheet.png",
    icon: Sparkles,
    accent: "from-violet-300/24 via-cyan-300/12 to-transparent",
  },
  {
    href: "/hunt/cards",
    title: "Коллекция",
    subtitle: "Твои карты, уровни, продажа дублей и пробуждение персонажей.",
    metric: "Мои карты",
    image: "/hunt-assets/cards/compass-light.webp",
    icon: WalletCards,
    accent: "from-sky-300/24 via-cyan-300/10 to-transparent",
  },
  {
    href: "/hunt/leaderboard",
    title: "Лидерборд",
    subtitle: "Кубки игроков, сезонный рейтинг и гонка за верхние места.",
    metric: "Кубки",
    image: "/hunt-assets/ui/nearloy-cup.png",
    icon: Trophy,
    accent: "from-blue-300/26 via-fuchsia-300/10 to-transparent",
  },
  {
    href: "/hunt/battle",
    title: "Бой",
    subtitle: "Тактическая арена, резонанс, стихии и проверка отряда.",
    metric: "Арена",
    image: "/hunt-assets/battle/resonance-park.png",
    icon: Swords,
    accent: "from-rose-300/22 via-cyan-300/10 to-transparent",
  },
  {
    href: "/hunt/create",
    title: "Создать пост",
    subtitle: "Старый полный экран создания, если нужен расширенный режим.",
    metric: "Пост",
    image: "/hunt-assets/posts/demo-coffee-corner.webp",
    icon: ScrollText,
    accent: "from-lime-300/22 via-cyan-300/10 to-transparent",
  },
];

export default function HuntSectionsPage() {
  return (
    <main className="min-h-full px-4 pb-24 pt-5 text-white">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <Link
            href="/hunt"
            className={cn(
              "mb-4 inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-white/78",
              huntInteractiveClass,
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            Hunt
          </Link>
          <h1 className="text-[34px] font-semibold leading-none tracking-tight">
            Все разделы
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-5 text-white/52">
            Быстрый переход ко всем режимам Nearloy Hunt.
          </p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[22px] border border-cyan-200/18 bg-cyan-200/10 text-cyan-100">
          <GalleryVerticalEnd className="h-5 w-5" />
        </div>
      </header>

      <section className="grid gap-3">
        {sections.map(({ href, title, subtitle, metric, image, icon: Icon, accent }, index) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "group relative min-h-[132px] overflow-hidden rounded-[28px] border border-cyan-200/14 bg-slate-950/86 p-4 shadow-[0_22px_70px_rgba(0,0,0,0.3)]",
              huntInteractiveClass,
            )}
          >
            <img
              src={image}
              alt=""
              className="absolute inset-y-0 right-0 h-full w-[46%] object-cover opacity-46 transition duration-300 group-hover:scale-105 group-hover:opacity-62"
            />
            <span className={`absolute inset-0 bg-gradient-to-r ${accent}`} />
            <span className="absolute inset-0 bg-gradient-to-r from-black via-black/72 to-black/18" />
            <div className="relative flex h-full items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-cyan-200/18 bg-cyan-200/12 text-cyan-50">
                    <Icon className="h-4 w-4" />
                  </span>
                  {index === 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/25 bg-amber-200/10 px-2 py-1 text-[11px] font-semibold text-amber-100">
                      <Crown className="h-3 w-3" />
                      Новое
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-semibold leading-tight text-white">
                  {title}
                </h2>
                <p className="mt-1 max-w-[260px] text-sm leading-5 text-white/58">
                  {subtitle}
                </p>
                <span className="mt-3 inline-flex rounded-full border border-cyan-200/15 bg-cyan-200/10 px-2.5 py-1 text-xs font-semibold text-cyan-50/86">
                  {metric}
                </span>
              </div>
              <span className="mt-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/72 transition group-hover:border-cyan-200/24 group-hover:text-cyan-100">
                <ChevronRight className="h-5 w-5" />
              </span>
            </div>
          </Link>
        ))}
      </section>

      <section className="mt-5 rounded-[26px] border border-cyan-200/14 bg-cyan-200/[0.045] p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-200/18 bg-slate-950/70 text-cyan-100">
            <Boxes className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-semibold">Разделы будут расти</h2>
            <p className="mt-1 text-sm leading-5 text-white/50">
              Сюда удобно добавлять новые режимы, события и сезонные активности без перегруза главной.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
