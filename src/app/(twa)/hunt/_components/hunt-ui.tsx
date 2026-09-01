"use client";

import { Clover, Flame, HeartPulse, Leaf, Moon, Music, ShieldCheck, Star, Sun, Swords, Waves, Wind } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HuntCard, HuntCardStatKey, HuntElement, HuntRarity } from "@/lib/api/twa-client";

export const rarityClass: Record<HuntRarity, string> = {
  COMMON: "border-slate-300/30 text-slate-100",
  UNCOMMON: "border-emerald-300/45 text-emerald-100 shadow-[0_0_22px_rgba(52,211,153,0.12)]",
  RARE: "border-cyan-300/55 text-cyan-100 shadow-[0_0_24px_rgba(103,232,249,0.16)]",
  EPIC: "border-fuchsia-300/55 text-fuchsia-100 shadow-[0_0_24px_rgba(217,70,239,0.16)]",
  LEGENDARY: "border-amber-300/70 text-amber-100 shadow-[0_0_28px_rgba(251,191,36,0.22)]",
};

export const rarityBadgeClass: Record<HuntRarity, string> = {
  COMMON: "border-slate-300/25 bg-slate-300/10 text-slate-100",
  UNCOMMON: "border-emerald-300/35 bg-emerald-400/12 text-emerald-100 shadow-[0_0_22px_rgba(52,211,153,0.14)]",
  RARE: "border-sky-300/35 bg-sky-400/10 text-sky-100 shadow-[0_0_28px_rgba(56,189,248,0.18)]",
  EPIC: "border-violet-300/40 bg-violet-400/12 text-violet-100 shadow-[0_0_30px_rgba(168,85,247,0.20)]",
  LEGENDARY: "border-orange-300/45 bg-orange-400/12 text-orange-100 shadow-[0_0_34px_rgba(251,146,60,0.22)]",
};

export const huntInteractiveClass =
  "cursor-pointer transition hover:border-cyan-200/35 hover:bg-cyan-200/10 hover:text-cyan-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

const elementFallbackImages: Record<HuntElement, string> = {
  FLAME: "/hunt-assets/cards/coffee-ember.webp",
  WATER: "/hunt-assets/cards/water-route.webp",
  NATURE: "/hunt-assets/cards/nature-sprout.webp",
  WIND: "/hunt-assets/cards/receipt-munch.webp",
  MUSIC: "/hunt-assets/cards/neon-sound.webp",
  LIGHT: "/hunt-assets/cards/compass-light.webp",
  SHADOW: "/hunt-assets/cards/neon-sound.webp",
};

export const elementMeta: Record<HuntElement, { label: string; className: string; icon: typeof Flame }> = {
  FLAME: { label: "Огонь", className: "border-orange-200/45 bg-orange-300/14 text-orange-100", icon: Flame },
  WATER: { label: "Вода", className: "border-cyan-200/45 bg-cyan-300/14 text-cyan-100", icon: Waves },
  NATURE: { label: "Природа", className: "border-emerald-200/45 bg-emerald-300/14 text-emerald-100", icon: Leaf },
  WIND: { label: "Ветер", className: "border-teal-100/45 bg-teal-200/14 text-teal-50", icon: Wind },
  MUSIC: { label: "Музыка", className: "border-fuchsia-200/45 bg-fuchsia-300/14 text-fuchsia-100", icon: Music },
  LIGHT: { label: "Свет", className: "border-yellow-100/55 bg-yellow-100/14 text-yellow-50", icon: Sun },
  SHADOW: { label: "Тьма", className: "border-indigo-200/45 bg-indigo-300/14 text-indigo-100", icon: Moon },
};

export function mediaSrc(url?: string | null) {
  if (!url) return null;
  if (url.startsWith("/api/")) return `/backend-api/${url.slice(5)}`;
  if (url.startsWith("/hunt/posts/")) return url.replace("/hunt/posts/", "/hunt-assets/posts/");
  if (url.startsWith("/hunt/cards/")) return url.replace("/hunt/cards/", "/hunt-assets/cards/");
  if (url.startsWith("/hunt/shop/")) return url.replace("/hunt/shop/", "/hunt-assets/shop/");
  return url;
}

export function CreatureGlyph({ card, size = "md" }: { card: Pick<HuntCard, "element" | "rarity"> & { imageUrl?: string | null; species?: { imageUrl?: string | null } }; size?: "sm" | "md" | "lg" }) {
  const bg = {
    FLAME: "from-orange-300 via-red-400 to-stone-900",
    WATER: "from-cyan-200 via-sky-400 to-blue-950",
    NATURE: "from-emerald-200 via-green-400 to-slate-950",
    WIND: "from-teal-100 via-cyan-300 to-slate-950",
    MUSIC: "from-cyan-200 via-fuchsia-400 to-slate-950",
    LIGHT: "from-white via-cyan-200 to-blue-950",
    SHADOW: "from-slate-400 via-indigo-700 to-black",
  }[card.element];
  const shell = size === "lg" ? "h-28 w-28 rounded-[34px]" : size === "sm" ? "h-14 w-14 rounded-2xl" : "h-20 w-20 rounded-[28px]";
  const inner = size === "lg" ? "rounded-[32px]" : size === "sm" ? "rounded-[15px]" : "rounded-[26px]";
  const imageClass = size === "lg" ? "h-28 w-28 scale-[1.08] rounded-[30px]" : size === "sm" ? "h-14 w-14 scale-[1.08] rounded-[14px]" : "h-20 w-20 scale-[1.08] rounded-[22px]";
  const elementIconClass = size === "lg" ? "h-7 w-7 rounded-xl" : size === "sm" ? "h-4 w-4 rounded-md" : "h-6 w-6 rounded-lg";
  const elementIconSize = size === "sm" ? "h-2.5 w-2.5" : "h-3.5 w-3.5";
  const ElementIcon = elementMeta[card.element].icon;
  const image = card.imageUrl ?? card.species?.imageUrl ?? elementFallbackImages[card.element];

  return (
    <div className={cn("relative shrink-0 overflow-hidden bg-gradient-to-br p-[2px]", shell, bg)}>
      <div className={cn("relative flex h-full w-full items-center justify-center overflow-hidden bg-black/55", inner)}>
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_82%,rgba(103,232,249,0.2),transparent_42%)]" />
        <img src={image} alt="" className={cn("relative object-contain drop-shadow-[0_0_18px_rgba(103,232,249,0.28)]", imageClass)} />
        <span className={cn("absolute bottom-1 left-1 flex items-center justify-center border backdrop-blur", elementIconClass, elementMeta[card.element].className)} title={elementMeta[card.element].label}>
          <ElementIcon className={elementIconSize} />
        </span>
        {card.rarity === "LEGENDARY" && <Star className="absolute right-1 top-1 h-5 w-5 fill-amber-200 text-amber-200" />}
      </div>
    </div>
  );
}

export function ElementBadge({ element }: { element: HuntElement }) {
  const meta = elementMeta[element];
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold", meta.className)}>
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

export const huntStatMeta: Record<HuntCardStatKey, { label: string; icon: typeof HeartPulse; className: string; barClassName: string }> = {
  health: { label: "Здоровье", icon: HeartPulse, className: "text-rose-100 bg-rose-300/12", barClassName: "from-rose-300 to-red-300" },
  attack: { label: "Атака", icon: Swords, className: "text-orange-100 bg-orange-300/12", barClassName: "from-orange-300 to-amber-200" },
  luck: { label: "Удача", icon: Clover, className: "text-emerald-100 bg-emerald-300/12", barClassName: "from-emerald-300 to-lime-200" },
  evasion: { label: "Уклонение", icon: ShieldCheck, className: "text-cyan-100 bg-cyan-300/12", barClassName: "from-cyan-300 to-sky-200" },
};

export function huntStatEntries(stats: Record<string, number>) {
  return [
    ["health", Number(stats.health ?? stats.charm ?? 0)],
    ["attack", Number(stats.attack ?? stats.spark ?? 0)],
    ["luck", Number(stats.luck ?? 0)],
    ["evasion", Number(stats.evasion ?? stats.focus ?? 0)],
  ] as const;
}

export function StatAffinityBar({ label, value }: { label: HuntCardStatKey; value: number }) {
  const meta = huntStatMeta[label];
  const Icon = meta.icon;
  const clamped = Math.max(1, Math.min(10, Math.round(Number(value) || 1)));
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
      <Icon className={cn("absolute -right-1 -top-1 h-10 w-10 rounded-2xl p-2 opacity-25", meta.className)} />
      <div className="relative flex items-center justify-between gap-2">
        <span className="text-xs text-white/58">{meta.label}</span>
        <span className="text-xs font-semibold text-white/70">{clamped}/10</span>
      </div>
      <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <span className={cn("block h-full rounded-full bg-gradient-to-r", meta.barClassName)} style={{ width: `${clamped * 10}%` }} />
      </div>
    </div>
  );
}

export function StatValueBar({ label, value }: { label: HuntCardStatKey; value: number }) {
  const meta = huntStatMeta[label];
  const Icon = meta.icon;
  const statValue = Math.max(0, Math.round(Number(value) || 0));
  const width = Math.max(8, Math.min(100, Math.round((statValue / 45) * 100)));
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
      <Icon className={cn("absolute -right-1 -top-1 h-10 w-10 rounded-2xl p-2 opacity-20", meta.className)} />
      <div className="relative flex items-center justify-between gap-2">
        <span className="text-xs text-white/58">{meta.label}</span>
        <span className="text-sm font-semibold text-white">{statValue}</span>
      </div>
      <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <span className={cn("block h-full rounded-full bg-gradient-to-r", meta.barClassName)} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function StatTile({ label, value }: { label: string; value: string | number }) {
  const meta = huntStatMeta[label as HuntCardStatKey];
  const Icon = meta?.icon ?? Star;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
      <Icon className={cn("absolute -right-1 -top-1 h-10 w-10 rounded-2xl p-2 opacity-25", meta?.className ?? "bg-cyan-300/12 text-cyan-100")} />
      <p className="relative text-xs text-white/52">{meta?.label ?? label}</p>
      <p className="relative mt-0.5 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

export function NearloyStars({ value, onChange, ariaLabel = "Nearloy rating", size = "md" }: { value: number; onChange?: (value: number) => void; ariaLabel?: string; size?: "sm" | "md" }) {
  const rating = Math.max(0, Math.min(5, Math.round(value || 0)));
  const interactive = Boolean(onChange);
  const boxClass = size === "sm" ? "h-6 w-6 rounded-xl" : "h-9 w-9 rounded-2xl";
  const iconClass = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  const glowClass = size === "sm" ? "h-2 w-2 blur-[5px]" : "h-3 w-3 blur-[6px]";

  return (
    <div className={cn("flex items-center", size === "sm" ? "gap-1" : "gap-1.5")} role={interactive ? "radiogroup" : "img"} aria-label={ariaLabel}>
      {Array.from({ length: 5 }, (_, index) => {
        const starValue = index + 1;
        const active = starValue <= rating;
        const className = cn(
          "relative flex items-center justify-center border transition",
          boxClass,
          active
            ? "border-cyan-200/45 bg-cyan-200/12 text-cyan-100 shadow-[0_0_18px_rgba(103,232,249,0.2)]"
            : "border-white/10 bg-white/[0.035] text-white/20",
          interactive && huntInteractiveClass,
        );
        const star = (
          <>
            {active && <span className={cn("absolute rounded-full bg-cyan-200/45", glowClass)} />}
            <Star className={cn("relative", iconClass, active && "fill-amber-200 text-amber-100 drop-shadow-[0_0_7px_rgba(103,232,249,0.55)]")} />
          </>
        );

        if (!interactive) {
          return <span key={starValue} className={className}>{star}</span>;
        }

        return (
          <button key={starValue} type="button" className={className} onClick={() => onChange?.(starValue)} role="radio" aria-checked={active} aria-label={`${ariaLabel} ${starValue}`}>
            {star}
          </button>
        );
      })}
    </div>
  );
}
