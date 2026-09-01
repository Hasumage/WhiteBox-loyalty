import Link from "next/link";
import { Clover, HeartPulse, ShieldCheck, Sparkles, Star, Swords } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPublicHuntShareCard, type HuntCard, type HuntRarity } from "@/lib/api/twa-client";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ uuid: string }>;
};

const interactiveClass = "cursor-pointer transition hover:border-cyan-200/35 hover:bg-cyan-200/10 hover:text-cyan-50 active:scale-[0.98]";

const rarityClass: Record<HuntRarity, string> = {
  COMMON: "border-slate-300/30 text-slate-100",
  UNCOMMON: "border-emerald-300/45 text-emerald-100 shadow-[0_0_22px_rgba(52,211,153,0.12)]",
  RARE: "border-cyan-300/55 text-cyan-100 shadow-[0_0_24px_rgba(103,232,249,0.16)]",
  EPIC: "border-fuchsia-300/55 text-fuchsia-100 shadow-[0_0_24px_rgba(217,70,239,0.16)]",
  LEGENDARY: "border-amber-300/70 text-amber-100 shadow-[0_0_28px_rgba(251,191,36,0.22)]",
};

const rarityBadgeClass: Record<HuntRarity, string> = {
  COMMON: "border-slate-300/25 bg-slate-300/10 text-slate-100",
  UNCOMMON: "border-emerald-300/35 bg-emerald-400/12 text-emerald-100 shadow-[0_0_22px_rgba(52,211,153,0.14)]",
  RARE: "border-sky-300/35 bg-sky-400/10 text-sky-100 shadow-[0_0_28px_rgba(56,189,248,0.18)]",
  EPIC: "border-violet-300/40 bg-violet-400/12 text-violet-100 shadow-[0_0_30px_rgba(168,85,247,0.20)]",
  LEGENDARY: "border-orange-300/45 bg-orange-400/12 text-orange-100 shadow-[0_0_34px_rgba(251,146,60,0.22)]",
};

const elementFallbackImages: Record<HuntCard["element"], string> = {
  FLAME: "/hunt-assets/cards/coffee-ember.webp",
  WATER: "/hunt-assets/cards/water-route.webp",
  NATURE: "/hunt-assets/cards/nature-sprout.webp",
  WIND: "/hunt-assets/cards/receipt-munch.webp",
  MUSIC: "/hunt-assets/cards/neon-sound.webp",
  LIGHT: "/hunt-assets/cards/compass-light.webp",
  SHADOW: "/hunt-assets/cards/neon-sound.webp",
};

function CreatureGlyph({ card }: { card: HuntCard }) {
  const bg = {
    FLAME: "from-orange-300 via-red-400 to-stone-900",
    WATER: "from-cyan-200 via-sky-400 to-blue-950",
    NATURE: "from-emerald-200 via-green-400 to-slate-950",
    WIND: "from-teal-100 via-cyan-300 to-slate-950",
    MUSIC: "from-cyan-200 via-fuchsia-400 to-slate-950",
    LIGHT: "from-white via-cyan-200 to-blue-950",
    SHADOW: "from-slate-400 via-indigo-700 to-black",
  }[card.element];
  const image = card.species.imageUrl ?? elementFallbackImages[card.element];

  return (
    <div className={cn("relative mx-auto h-28 w-28 overflow-hidden rounded-[34px] bg-gradient-to-br p-[2px]", bg)}>
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[32px] bg-black/55">
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_82%,rgba(103,232,249,0.2),transparent_42%)]" />
        <img src={image} alt="" className="relative h-24 w-24 rounded-[30px] object-contain drop-shadow-[0_0_18px_rgba(103,232,249,0.28)]" />
        {card.rarity === "LEGENDARY" && <Star className="absolute right-1 top-1 h-6 w-6 fill-amber-200 text-amber-200" />}
      </div>
    </div>
  );
}

const shareStatMeta = {
  health: { label: "Здоровье", icon: HeartPulse, bar: "from-rose-300 to-red-300" },
  attack: { label: "Атака", icon: Swords, bar: "from-orange-300 to-amber-200" },
  luck: { label: "Удача", icon: Clover, bar: "from-emerald-300 to-lime-200" },
  evasion: { label: "Уклонение", icon: ShieldCheck, bar: "from-cyan-300 to-sky-200" },
};

function statEntries(stats: Record<string, number>) {
  return [
    ["health", Number(stats.health ?? stats.charm ?? 0)],
    ["attack", Number(stats.attack ?? stats.spark ?? 0)],
    ["luck", Number(stats.luck ?? 0)],
    ["evasion", Number(stats.evasion ?? stats.focus ?? 0)],
  ] as const;
}

function ShareStatBar({ label, value }: { label: keyof typeof shareStatMeta; value: number }) {
  const meta = shareStatMeta[label];
  const Icon = meta.icon;
  const statValue = Math.max(0, Math.round(value || 0));
  const width = Math.max(8, Math.min(100, Math.round((statValue / 45) * 100)));
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
      <Icon className="absolute -right-1 -top-1 h-10 w-10 rounded-2xl bg-white/[0.05] p-2 text-cyan-100 opacity-25" />
      <div className="relative flex items-center justify-between gap-2">
        <span className="text-xs text-white/58">{meta.label}</span>
        <span className="text-sm font-semibold text-white">{statValue}</span>
      </div>
      <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <span className={cn("block h-full rounded-full bg-gradient-to-r", meta.bar)} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default async function HuntCardSharePage({ params }: PageProps) {
  const { uuid } = await params;
  const payload = await getPublicHuntShareCard(uuid);
  const card = payload?.card;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-white">
      <section className="mx-auto max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/hunt" className={`text-sm font-semibold text-cyan-100 ${interactiveClass}`}>Nearloy Hunt</Link>
          <Badge className="border-cyan-200/20 bg-cyan-200/10 text-cyan-100">NH Card</Badge>
        </div>
        {!card ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-cyan-100" />
            <h1 className="mt-4 text-2xl font-semibold">Card is unavailable</h1>
            <p className="mt-2 text-sm text-white/58">This Hunt card could not be found.</p>
          </div>
        ) : (
          <article className={cn("rounded-[28px] border bg-[linear-gradient(135deg,rgba(8,13,22,0.96),rgba(15,23,42,0.78))] p-5 text-center", rarityClass[card.rarity])}>
            <Badge className={cn("mb-5", rarityBadgeClass[card.rarity])}>{card.rarity}</Badge>
            <CreatureGlyph card={card} />
            <h1 className="mt-5 text-3xl font-semibold">{card.species.name}</h1>
            <p className="mt-1 text-sm text-white/58">Lv. {card.level} · {card.trait}</p>
            <div className="mt-5 grid grid-cols-2 gap-2 text-left text-xs">
              {statEntries(card.stats).map(([key, value]) => (
                <ShareStatBar key={key} label={key} value={value} />
              ))}
            </div>
            <p className="mt-4 text-xs text-white/44">owned by {payload.owner.name}</p>
          </article>
        )}
        <Button asChild className={`mt-4 w-full rounded-2xl bg-cyan-200 text-slate-950 hover:bg-cyan-100 ${interactiveClass}`}>
          <Link href="/hunt">Open Nearloy Hunt</Link>
        </Button>
      </section>
    </main>
  );
}
