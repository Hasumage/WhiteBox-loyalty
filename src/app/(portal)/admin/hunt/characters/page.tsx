"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, ChevronDown, Edit3, RefreshCw, Save, Search, SlidersHorizontal, Sparkles, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { adminListHuntCharacters, adminUpdateHuntCharacter, type AdminHuntCharacter } from "@/lib/api/admin-client";
import type { HuntCardStatKey, HuntElement, HuntRarity } from "@/lib/api/twa-client";
import { cn } from "@/lib/utils";
import { ElementBadge, elementMeta, huntInteractiveClass, huntStatEntries, rarityBadgeClass, rarityClass, StatAffinityBar } from "@/app/(twa)/hunt/_components/hunt-ui";

const elements: HuntElement[] = ["FLAME", "WATER", "NATURE", "WIND", "MUSIC", "LIGHT", "SHADOW"];
const rarities: HuntRarity[] = ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"];
const statKeys: HuntCardStatKey[] = ["health", "attack", "luck", "evasion"];

const rarityScore: Record<HuntRarity, number> = {
  LEGENDARY: 5,
  EPIC: 4,
  RARE: 3,
  UNCOMMON: 2,
  COMMON: 1,
};

const sortOptions = [
  { value: "sortOrder", label: "Порядок" },
  { value: "rarity", label: "Редкость" },
  { value: "name", label: "Имя" },
  { value: "cards", label: "Карт больше" },
] as const;

type SortMode = (typeof sortOptions)[number]["value"];
type ElementFilter = HuntElement | "all";
type EditableCharacter = AdminHuntCharacter & { element: HuntElement; baseRarity: HuntRarity; baseStats: Record<HuntCardStatKey, number> };
const elementOptions: ElementFilter[] = ["all", ...elements];

function mediaSrc(url?: string | null) {
  if (!url) return "/hunt-assets/cards/compass-light.webp";
  if (url.startsWith("/hunt/cards/")) return url.replace("/hunt/cards/", "/hunt-assets/cards/");
  return url;
}

function normalizeCharacter(character: AdminHuntCharacter): EditableCharacter {
  return {
    ...character,
    element: elements.includes(character.element as HuntElement) ? (character.element as HuntElement) : "LIGHT",
    baseRarity: rarities.includes(character.baseRarity as HuntRarity) ? (character.baseRarity as HuntRarity) : "COMMON",
    baseStats: {
      health: Number(character.baseStats.health ?? character.baseStats.charm ?? 1),
      attack: Number(character.baseStats.attack ?? character.baseStats.spark ?? 1),
      luck: Number(character.baseStats.luck ?? 1),
      evasion: Number(character.baseStats.evasion ?? character.baseStats.focus ?? 1),
    },
  };
}

function statSum(character: EditableCharacter) {
  return statKeys.reduce((sum, key) => sum + (Number(character.baseStats[key]) || 0), 0);
}

function cardImageScale(slug: string) {
  if (slug === "map-tide") return "scale-[1.42] group-hover:scale-[1.48]";
  if (slug === "metro-breeze") return "scale-[1.5] group-hover:scale-[1.56]";
  return "scale-[1.24] group-hover:scale-[1.3]";
}

function revealImageScale(slug: string) {
  if (slug === "map-tide") return "scale-[1.12]";
  if (slug === "metro-breeze") return "scale-[1.18]";
  return "scale-[0.96]";
}

export default function AdminHuntCharactersPage() {
  const [characters, setCharacters] = useState<EditableCharacter[]>([]);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("sortOrder");
  const [sortOpen, setSortOpen] = useState(false);
  const [elementFilter, setElementFilter] = useState<ElementFilter>("all");
  const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, EditableCharacter>>({});
  const [editing, setEditing] = useState(false);
  const [savingUuid, setSavingUuid] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const rows = (await adminListHuntCharacters()).map(normalizeCharacter);
    setCharacters(rows);
    setDrafts(Object.fromEntries(rows.map((row) => [row.uuid, row])));
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const elementRows = elementFilter === "all" ? characters : characters.filter((item) => item.element === elementFilter);
    const rows = needle
      ? elementRows.filter((item) => [item.name, item.slug, item.element, elementMeta[item.element].label, item.baseRarity, item.description].join(" ").toLowerCase().includes(needle))
      : [...elementRows];

    return rows.sort((a, b) => {
      if (sortMode === "name") return a.name.localeCompare(b.name, "ru");
      if (sortMode === "rarity") return rarityScore[b.baseRarity] - rarityScore[a.baseRarity] || a.name.localeCompare(b.name, "ru");
      if (sortMode === "cards") return b.cardsCount - a.cardsCount || a.name.localeCompare(b.name, "ru");
      return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ru");
    });
  }, [characters, elementFilter, query, sortMode]);

  const selected = selectedUuid ? characters.find((item) => item.uuid === selectedUuid) ?? null : null;
  const draft = selected ? drafts[selected.uuid] ?? selected : null;
  const currentSort = sortOptions.find((option) => option.value === sortMode) ?? sortOptions[0];

  function patchDraft(uuid: string, patch: Partial<EditableCharacter>) {
    setDrafts((current) => ({ ...current, [uuid]: { ...current[uuid], ...patch } }));
  }

  function patchStat(uuid: string, key: HuntCardStatKey, value: string) {
    const numberValue = Math.max(1, Math.min(10, Number(value) || 1));
    const current = drafts[uuid];
    if (!current) return;
    patchDraft(uuid, { baseStats: { ...current.baseStats, [key]: numberValue } });
  }

  function closeDialog() {
    setSelectedUuid(null);
    setEditing(false);
  }

  async function save(uuid: string) {
    const current = drafts[uuid];
    if (!current) return;
    setSavingUuid(uuid);
    setMessage("");
    const result = await adminUpdateHuntCharacter(uuid, {
      name: current.name,
      description: current.description,
      element: current.element,
      baseRarity: current.baseRarity,
      baseStats: current.baseStats,
      visualPrompt: current.visualPrompt,
      imageUrl: current.imageUrl,
      isActive: current.isActive,
      sortOrder: current.sortOrder,
    });

    if (result.ok) {
      const normalized = normalizeCharacter(result.data);
      setCharacters((items) => items.map((item) => (item.uuid === uuid ? normalized : item)));
      setDrafts((items) => ({ ...items, [uuid]: normalized }));
      setEditing(false);
      setMessage("Персонаж сохранён.");
    } else {
      setMessage(result.message);
    }
    setSavingUuid(null);
  }

  return (
    <div className="min-h-full space-y-4 pb-24 text-white">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm text-white/78">
            <WalletCards className="h-4 w-4 text-cyan-100" />
            <span>Каталог персонажей</span>
            <span className="font-semibold text-white">{characters.length}</span>
          </div>
          <div className="mt-2 h-1 max-w-56 overflow-hidden rounded-full bg-white/10">
            <span className="block h-full rounded-full bg-[linear-gradient(90deg,#67e8f9,#a855f7)]" style={{ width: characters.length ? "100%" : "0%" }} />
          </div>
        </div>
        <Button variant="secondary" disabled={loading} onClick={() => void load()} className={cn("glass rounded-2xl border-white/10", huntInteractiveClass)}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Обновить
        </Button>
      </header>

      <section className="grid gap-2">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
          <Search className="h-4 w-4 text-cyan-100" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по имени, slug, стихии или редкости"
            className="h-9 border-0 bg-transparent px-0 text-white placeholder:text-white/38 focus-visible:ring-0"
          />
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setSortOpen((open) => !open)}
            className={cn("flex h-full min-h-[52px] w-full items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-sm text-white", huntInteractiveClass)}
            aria-expanded={sortOpen}
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0 text-cyan-100" />
            <span className="min-w-0 flex-1 truncate">Сортировка: {currentSort.label}</span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-white/48 transition", sortOpen && "rotate-180")} />
          </button>
          {sortOpen && (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-2xl border border-cyan-200/18 bg-slate-950/96 p-1 shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur">
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setSortMode(option.value);
                    setSortOpen(false);
                  }}
                  className={cn("flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm", huntInteractiveClass, option.value === sortMode ? "bg-cyan-200/14 text-cyan-50" : "text-white/68")}
                >
                  <span>Сортировка: {option.label}</span>
                  {option.value === sortMode && <CheckCircle2 className="h-4 w-4 text-cyan-100" />}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {elementOptions.map((option) => {
            const meta = option === "all" ? null : elementMeta[option];
            const Icon = meta?.icon ?? Sparkles;
            const active = option === elementFilter;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setElementFilter(option)}
                className={cn(
                  "flex h-11 shrink-0 items-center gap-2 rounded-2xl border px-3 text-sm font-semibold transition",
                  huntInteractiveClass,
                  active
                    ? meta?.className ?? "border-cyan-200/35 bg-cyan-200/18 text-cyan-50"
                    : "border-white/10 bg-white/[0.04] text-white/66 hover:border-cyan-200/24 hover:bg-cyan-200/10 hover:text-cyan-50",
                )}
                aria-pressed={active}
                title={meta?.label ?? "Все стихии"}
              >
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border", active ? "border-current/35 bg-black/18" : meta?.className ?? "border-cyan-200/20 bg-cyan-200/10 text-cyan-50")}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span>{meta?.label ?? "Все"}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2 md:gap-3 xl:grid-cols-5 2xl:grid-cols-6">
        {loading && <div className="col-span-3 rounded-3xl border border-dashed border-white/15 p-5 text-center text-sm text-white/54 xl:col-span-5 2xl:col-span-6">Загружаем персонажей.</div>}
        {!loading && filtered.length === 0 && <div className="col-span-3 rounded-3xl border border-dashed border-white/15 p-5 text-center text-sm text-white/54 xl:col-span-5 2xl:col-span-6">Персонажи не найдены.</div>}
        {filtered.map((item, index) => (
          <button
            key={item.uuid}
            type="button"
            onClick={() => {
              setSelectedUuid(item.uuid);
              setEditing(false);
            }}
            className={cn("group relative aspect-[3/4] overflow-hidden rounded-2xl border bg-slate-950 p-0 text-left shadow-[0_18px_42px_rgba(0,0,0,0.22)]", huntInteractiveClass, rarityClass[item.baseRarity])}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,rgba(103,232,249,0.12),rgba(2,6,12,0.25)_52%,rgba(2,6,12,0.62))]">
              <img src={mediaSrc(item.imageUrl)} alt="" className={cn("absolute inset-0 h-full w-full object-contain object-center transition", cardImageScale(item.slug))} />
              <span className="absolute left-2 top-2 rounded-full border border-black/30 bg-black/44 px-2 py-1 text-[11px] font-semibold text-white/74 backdrop-blur">
                #{String(index + 1).padStart(3, "0")}
              </span>
              <span className={cn("absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur", elementMeta[item.element].className)} title={elementMeta[item.element].label} aria-label={elementMeta[item.element].label}>
                {(() => {
                  const Icon = elementMeta[item.element].icon;
                  return <Icon className="h-4 w-4" />;
                })()}
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 min-w-0 bg-gradient-to-t from-black/88 via-black/62 to-transparent p-2.5 pt-10">
              <h2 className="truncate text-[13px] font-semibold leading-4 text-white md:text-sm">{item.name}</h2>
              <div className="mt-1 flex items-center gap-1">
                <Badge className={cn("max-w-full truncate px-1.5 py-0.5 text-[9px]", rarityBadgeClass[item.baseRarity])}>{item.baseRarity}</Badge>
              </div>
            </div>
          </button>
        ))}
      </section>

      {message && (
        <div className="fixed bottom-6 left-1/2 z-50 w-[min(720px,calc(100vw-2rem))] -translate-x-1/2">
          <Card className="border-cyan-200/25 bg-card/95 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
            <CardContent className="flex items-center gap-3 py-4 text-sm text-cyan-50">
              <Check className="h-4 w-4 shrink-0 text-cyan-200" />
              {message}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto border-white/10 bg-slate-950 p-4 text-white">
          {selected && draft && (
            <>
              <DialogHeader>
                <DialogTitle className="min-w-0 truncate text-2xl">{draft.name}</DialogTitle>
              </DialogHeader>

              <div className="grid gap-4 lg:grid-cols-[minmax(260px,360px)_minmax(0,1fr)]">
                <div className={cn("overflow-hidden rounded-[28px] border bg-[radial-gradient(circle_at_50%_46%,rgba(103,232,249,0.18),rgba(2,6,12,0.72)_58%,rgba(2,6,12,0.95))]", rarityClass[draft.baseRarity])}>
                  <div className="relative h-[min(48vh,380px)] min-h-[280px]">
                    <img src={mediaSrc(draft.imageUrl)} alt="" className={cn("absolute inset-0 h-full w-full object-contain object-center", revealImageScale(draft.slug))} />
                    <div className="absolute left-3 top-3">
                      <ElementBadge element={draft.element} />
                    </div>
                    <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2">
                      <Badge className={rarityBadgeClass[draft.baseRarity]}>{draft.baseRarity}</Badge>
                      <Badge className="border-cyan-200/20 bg-cyan-200/10 text-cyan-100">x{draft.cardsCount}</Badge>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={draft.isActive ? "border-emerald-200/25 bg-emerald-300/10 text-emerald-100" : "border-amber-200/25 bg-amber-300/10 text-amber-100"}>
                      {draft.isActive ? "Выпадает" : "Не выпадает"}
                    </Badge>
                    <Badge variant="outline" className="border-white/10 text-white/60">{draft.slug}</Badge>
                    <Badge variant="outline" className={statSum(draft) > 35 ? "border-red-300/30 bg-red-300/10 text-red-100" : "border-white/10 text-white/60"}>
                      {statSum(draft)}/35
                    </Badge>
                  </div>

                  {editing ? (
                    <div className="space-y-3">
                      <Input value={draft.name} onChange={(event) => patchDraft(draft.uuid, { name: event.target.value })} className="border-white/10 bg-white/[0.035] text-lg font-semibold" />
                      <Textarea value={draft.description} onChange={(event) => patchDraft(draft.uuid, { description: event.target.value })} className="min-h-24 border-white/10 bg-white/[0.035]" />
                      <Input value={draft.imageUrl ?? ""} onChange={(event) => patchDraft(draft.uuid, { imageUrl: event.target.value })} placeholder="imageUrl" className="border-white/10 bg-white/[0.035]" />
                      <div className="grid grid-cols-2 gap-2">
                        <select value={draft.element} onChange={(event) => patchDraft(draft.uuid, { element: event.target.value as HuntElement })} className="h-10 cursor-pointer rounded-xl border border-white/10 bg-background px-3 text-sm">
                          {elements.map((element) => (
                            <option key={element} value={element} className="bg-background text-foreground">
                              {elementMeta[element].label}
                            </option>
                          ))}
                        </select>
                        <select value={draft.baseRarity} onChange={(event) => patchDraft(draft.uuid, { baseRarity: event.target.value as HuntRarity })} className="h-10 cursor-pointer rounded-xl border border-white/10 bg-background px-3 text-sm">
                          {rarities.map((rarity) => (
                            <option key={rarity} value={rarity} className="bg-background text-foreground">
                              {rarity}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {statKeys.map((key) => (
                          <label key={key} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-xs text-muted-foreground">
                            {key}
                            <Input type="number" min={1} max={10} value={Number(draft.baseStats[key]) || 1} onChange={(event) => patchStat(draft.uuid, key, event.target.value)} className="mt-2 h-9 border-white/10 bg-black/20 px-2" />
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm leading-6 text-white/62">{draft.description}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {huntStatEntries(draft.baseStats).map(([key, value]) => <StatAffinityBar key={key} label={key} value={value} />)}
                      </div>
                    </>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <Button variant={editing ? "default" : "secondary"} onClick={() => (editing ? void save(draft.uuid) : setEditing(true))} disabled={savingUuid === draft.uuid || statSum(draft) > 35} className={cn("rounded-2xl", huntInteractiveClass)}>
                      {editing ? <Save className="mr-2 h-4 w-4" /> : <Edit3 className="mr-2 h-4 w-4" />}
                      {editing ? "Сохранить" : "Редактировать"}
                    </Button>
                    <Button variant="secondary" className={cn("glass rounded-2xl border-white/10", huntInteractiveClass)} onClick={() => patchDraft(draft.uuid, { isActive: !draft.isActive })}>
                      <Check className="mr-2 h-4 w-4" />
                      {draft.isActive ? "Убрать из выпадения" : "Вернуть в выпадение"}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
