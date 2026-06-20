"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Crown, LockKeyhole, SlidersHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ProfileStatusBadge,
  ProfileStatusIcon,
  PROFILE_STATUS_RARITY_META,
  profileStatusRarityClass,
  type ProfileStatusRarityView,
} from "@/components/profile-status/profile-status-view";
import {
  getUserProfileStatuses,
  markUserProfileStatusesSeen,
  selectUserProfileStatus,
  type UserProfileStatus,
  type UserProfileStatusState,
} from "@/lib/api/twa-client";
import { cn } from "@/lib/utils";

type Filter = "ALL" | "UNLOCKED" | "LOCKED" | ProfileStatusRarityView;
type Sort = "rarity" | "title" | "newest";

const filters: Array<{ key: Filter; label: string }> = [
  { key: "ALL", label: "Все" },
  { key: "UNLOCKED", label: "Открытые" },
  { key: "LOCKED", label: "Закрытые" },
  { key: "RARE", label: "Редкие" },
  { key: "EPIC", label: "Эпические" },
  { key: "LEGENDARY", label: "Легендарные" },
];

const rarityOrder: Record<ProfileStatusRarityView, number> = { RARE: 0, EPIC: 1, LEGENDARY: 2 };

function StatusCard({ status, active, onSelect }: { status: UserProfileStatus; active: boolean; onSelect: () => void }) {
  const meta = profileStatusRarityClass(status.rarity);
  return (
    <button
      type="button"
      disabled={!status.unlocked}
      onClick={onSelect}
      className={cn(
        "group relative overflow-hidden rounded-[1.75rem] border p-4 text-left transition duration-200",
        status.unlocked ? "hover:-translate-y-0.5 hover:bg-white/[0.055]" : "cursor-not-allowed opacity-55",
        active ? `${meta.ring} ${meta.surface} ${meta.glow}` : "border-white/10 bg-white/[0.035]",
      )}
    >
      <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent to-transparent", {
        "via-sky-300/80": status.rarity === "RARE",
        "via-violet-300/80": status.rarity === "EPIC",
        "via-orange-300/90": status.rarity === "LEGENDARY",
      })} />
      <div className="flex items-start gap-3">
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border", meta.ring, meta.surface, meta.text)}>
          {status.unlocked ? <ProfileStatusIcon icon={status.icon} className="h-6 w-6" /> : <LockKeyhole className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{status.title}</p>
              <p className={cn("mt-1 text-xs font-semibold uppercase tracking-[0.18em]", meta.text)}>
                {PROFILE_STATUS_RARITY_META[status.rarity].label}
              </p>
            </div>
            {active && <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-black">Выбран</span>}
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{status.description}</p>
          {status.unlockedAt && (
            <p className="mt-4 text-xs text-muted-foreground">
              Открыт: {new Date(status.unlockedAt).toLocaleString("ru-RU")}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

export default function TwaProfileStatusesPage() {
  const [state, setState] = useState<UserProfileStatusState | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [sort, setSort] = useState<Sort>("rarity");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(markSeen = false) {
    setLoading(true);
    const result = await getUserProfileStatuses();
    setLoading(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setState(result.data);
    if (markSeen && result.data.newlyUnlocked.length > 0) await markUserProfileStatusesSeen();
  }

  useEffect(() => {
    void load(true);
  }, []);

  const visible = useMemo(() => {
    const items = [...(state?.statuses ?? [])];
    const filtered = items.filter((status) => {
      if (filter === "UNLOCKED") return status.unlocked;
      if (filter === "LOCKED") return !status.unlocked;
      if (filter === "RARE" || filter === "EPIC" || filter === "LEGENDARY") return status.rarity === filter;
      return true;
    });
    return filtered.sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title, "ru");
      if (sort === "newest") return (Date.parse(b.unlockedAt ?? "") || 0) - (Date.parse(a.unlockedAt ?? "") || 0);
      const rarityDelta = rarityOrder[b.rarity] - rarityOrder[a.rarity];
      if (rarityDelta !== 0) return rarityDelta;
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      return a.title.localeCompare(b.title, "ru");
    });
  }, [filter, sort, state?.statuses]);

  async function select(status: UserProfileStatus) {
    if (!status.unlocked) return;
    setMessage(null);
    const result = await selectUserProfileStatus(status.id);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setState(result.data);
    setMessage(`Статус «${status.title}» выбран.`);
  }

  return (
    <div className="mx-auto max-w-[42rem] space-y-5 px-4 py-5">
      <Button asChild variant="ghost" className="px-0">
        <Link href="/settings">
          <ArrowLeft className="h-4 w-4" /> Назад
        </Link>
      </Button>

      <section className="relative overflow-hidden rounded-[2rem] border border-cyan-200/20 bg-gradient-to-br from-cyan-300/12 via-white/[0.035] to-orange-300/10 p-5 shadow-[0_0_50px_rgba(103,232,249,0.10)]">
        <div className="absolute right-4 top-4 rounded-full border border-white/10 bg-white/[0.04] p-3 text-cyan-100">
          <Crown className="h-6 w-6" />
        </div>
        <p className="inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-cyan-300/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-100">
          <Sparkles className="h-3.5 w-3.5" /> Статусы профиля
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Выберите настроение аккаунта</h1>
        <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Статус показывается в профиле и помогает подчеркнуть вашу историю в NearLoy. Новые статусы открываются событиями, акциями и вручную админом.
        </p>
        {state?.selectedStatus && (
          <div className="mt-4">
            <ProfileStatusBadge
              rarity={state.selectedStatus.rarity}
              icon={state.selectedStatus.icon}
              title={state.selectedStatus.title}
              className="max-w-full"
            />
          </div>
        )}
      </section>

      <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <SlidersHorizontal className="h-4 w-4 text-cyan-100" /> Сортировка и фильтры
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filters.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition",
                filter === item.key ? "border-white bg-white text-black" : "border-white/10 bg-white/[0.04] text-muted-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            ["rarity", "Редкость"],
            ["newest", "Новые"],
            ["title", "Название"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSort(key as Sort)}
              className={cn(
                "rounded-2xl border px-3 py-2 text-xs font-semibold transition",
                sort === key ? "border-cyan-200/40 bg-cyan-300/10 text-cyan-50" : "border-white/10 bg-white/[0.03] text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {message && <p className="rounded-2xl border border-cyan-200/20 bg-cyan-300/10 p-3 text-sm text-cyan-50">{message}</p>}
      {loading && <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-muted-foreground">Загружаю статусы...</p>}

      <section className="grid gap-3">
        {visible.map((status) => (
          <StatusCard
            key={status.id}
            status={status}
            active={state?.selectedStatusId === status.id}
            onSelect={() => void select(status)}
          />
        ))}
      </section>
    </div>
  );
}
