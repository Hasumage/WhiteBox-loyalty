"use client";

import { useEffect, useMemo, useState } from "react";
import { Crown, Gem, Plus, RefreshCcw, Search, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import {
  ProfileStatusBadge,
  PROFILE_STATUS_ICON_GROUPS,
  PROFILE_STATUS_ICON_OPTIONS,
  ProfileStatusIcon,
  PROFILE_STATUS_RARITY_META,
  profileStatusRarityClass,
  type ProfileStatusRarityView,
} from "@/components/profile-status/profile-status-view";
import { adminCreateProfileStatus, adminListProfileStatuses, type AdminProfileStatus } from "@/lib/api/admin-client";
import { cn } from "@/lib/utils";

type FormState = {
  title: string;
  description: string;
  rarity: ProfileStatusRarityView;
  icon: string;
};

type StatusFilter = "ALL" | ProfileStatusRarityView;

const rarityOptions: Array<{ value: ProfileStatusRarityView; label: string; hint: string; icon: typeof Gem }> = [
  { value: "RARE", label: "Редкий", hint: "Синий статус для ранних достижений", icon: ShieldCheck },
  { value: "EPIC", label: "Эпический", hint: "Фиолетовый статус для заметных событий", icon: Sparkles },
  { value: "LEGENDARY", label: "Легендарный", hint: "Оранжевый статус для особых наград", icon: Crown },
];

const iconGroups = Object.entries(PROFILE_STATUS_ICON_GROUPS).map(([group, label]) => ({
  group: group as keyof typeof PROFILE_STATUS_ICON_GROUPS,
  label,
  icons: PROFILE_STATUS_ICON_OPTIONS.filter((icon) => icon.group === group),
}));

const initialForm: FormState = {
  title: "",
  description: "",
  rarity: "RARE",
  icon: "Sparkles",
};

function StatusCard({ status }: { status: AdminProfileStatus }) {
  const meta = profileStatusRarityClass(status.rarity);
  return (
    <div className={cn("grid gap-3 rounded-2xl border p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center", meta.ring, meta.surface)}>
      <div className="flex min-w-0 items-start gap-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border", meta.ring, meta.surface, meta.text)}>
          <ProfileStatusIcon icon={status.icon} className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{status.title}</h3>
            {status.isSystem && <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">system</span>}
          </div>
          <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{status.slug}</p>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{status.description}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <ProfileStatusBadge rarity={status.rarity} icon={status.icon} title={PROFILE_STATUS_RARITY_META[status.rarity].label} />
        <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-muted-foreground">{status.unlockCount} unlocks</span>
      </div>
    </div>
  );
}

export default function AdminProfileStatusesPage() {
  const [statuses, setStatuses] = useState<AdminProfileStatus[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [statusQuery, setStatusQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  async function load() {
    setLoading(true);
    const response = await adminListProfileStatuses();
    setLoading(false);
    if (!response.ok) {
      setMessage(response.message);
      return;
    }
    setStatuses(response.data.statuses);
  }

  useEffect(() => {
    void load();
  }, []);

  const catalogStats = useMemo(() => {
    return rarityOptions.map((option) => ({
      ...option,
      count: statuses.filter((status) => status.rarity === option.value).length,
    }));
  }, [statuses]);

  const filteredStatuses = useMemo(() => {
    const query = statusQuery.trim().toLowerCase();
    return statuses
      .filter((status) => statusFilter === "ALL" || status.rarity === statusFilter)
      .filter((status) => {
        if (!query) return true;
        return [status.title, status.slug, status.description, status.icon].some((value) => value.toLowerCase().includes(query));
      })
      .sort((left, right) => {
        const rarityDelta = rarityOptions.findIndex((option) => option.value === left.rarity) - rarityOptions.findIndex((option) => option.value === right.rarity);
        if (rarityDelta !== 0) return rarityDelta;
        return left.title.localeCompare(right.title, "ru");
      });
  }, [statusFilter, statusQuery, statuses]);

  async function createStatus() {
    if (!form.title.trim() || !form.description.trim()) {
      setMessage("Заполните название и описание статуса.");
      return;
    }
    setSaving(true);
    setMessage(null);
    const response = await adminCreateProfileStatus(form);
    setSaving(false);
    if (!response.ok) {
      setMessage(response.message);
      return;
    }
    setForm(initialForm);
    setStatuses((current) => [response.data, ...current]);
    setMessage(`Статус «${response.data.title}» создан.`);
  }

  const selectedMeta = profileStatusRarityClass(form.rarity);
  const selectedIcon = PROFILE_STATUS_ICON_OPTIONS.find((icon) => icon.value === form.icon);

  return (
    <div className="space-y-8 pb-10">
      <section className="relative overflow-hidden rounded-[2rem] border border-cyan-200/20 bg-gradient-to-br from-cyan-300/10 via-white/[0.035] to-orange-300/10 p-6">
        <div className="pointer-events-none absolute right-8 top-6 h-32 w-32 rounded-full bg-cyan-300/10 blur-3xl" />
        <p className="inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-cyan-300/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-cyan-100">
          <Trophy className="h-3.5 w-3.5" /> Profile status lab
        </p>
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">Статусы пользователей</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Создавайте коллекционные статусы, выдавайте их вручную в профиле пользователя и подсвечивайте редкость красивым цветом.
            </p>
          </div>
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCcw className="h-4 w-4" /> Обновить
          </Button>
        </div>
      </section>

      {message && <p className="rounded-2xl border border-cyan-200/20 bg-cyan-300/10 p-4 text-sm text-cyan-50">{message}</p>}

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="glass border-white/10">
          <CardHeader className="space-y-3 p-6">
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-cyan-100" /> Новый статус
            </CardTitle>
            <CardDescription>Короткое название, понятное описание и редкость. Иконку можно выбрать из готового набора.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 p-6 pt-0">
            <div className="grid gap-3 sm:grid-cols-[1fr_0.7fr]">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Название</p>
                <Input value={form.title} maxLength={48} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Например, Топ 100" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Редкость</p>
                <SelectField value={form.rarity} onChange={(event) => setForm((current) => ({ ...current, rarity: event.target.value as ProfileStatusRarityView }))}>
                  {rarityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </SelectField>
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Описание</p>
              <Textarea value={form.description} maxLength={220} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="За что пользователь получает этот статус и какой у него вайб." className="min-h-28" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Иконка</p>
                <span className="truncate text-xs text-muted-foreground">{selectedIcon?.label ?? form.icon}</span>
              </div>
              <div className="max-h-[21rem] space-y-4 overflow-y-auto rounded-[1.5rem] border border-white/10 bg-black/15 p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {iconGroups.map((group) => (
                  <div key={group.group} className="space-y-2">
                    <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{group.label}</p>
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                      {group.icons.map((icon) => (
                        <button
                          key={icon.value}
                          type="button"
                          onClick={() => setForm((current) => ({ ...current, icon: icon.value }))}
                          className={cn(
                            "relative flex h-12 items-center justify-center rounded-2xl border transition",
                            form.icon === icon.value
                              ? "border-cyan-200/60 bg-cyan-300/18 text-cyan-50 shadow-[0_0_22px_rgba(103,232,249,0.16)]"
                              : "border-white/10 bg-white/[0.035] text-muted-foreground hover:border-white/20 hover:bg-white/[0.07] hover:text-white",
                          )}
                          title={icon.label}
                          aria-label={icon.label}
                        >
                          <ProfileStatusIcon icon={icon.value} className="h-5 w-5" />
                          {form.icon === icon.value && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-cyan-100" />}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className={cn("rounded-[1.5rem] border p-4", selectedMeta.ring, selectedMeta.surface)}>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Превью</p>
              <ProfileStatusBadge rarity={form.rarity} icon={form.icon} title={form.title || "Новый статус"} />
              <p className="mt-3 text-sm text-muted-foreground">{form.description || "Описание появится здесь."}</p>
            </div>
            <Button className="w-full" onClick={createStatus} disabled={saving}>
              <Plus className="h-4 w-4" /> {saving ? "Создаю..." : "Создать статус"}
            </Button>
          </CardContent>
        </Card>

        <Card className="glass border-white/10">
          <CardHeader className="space-y-5 p-7">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div className="min-w-0 space-y-2">
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-cyan-100" /> Каталог статусов
                </CardTitle>
                <CardDescription className="max-w-2xl leading-6">Плотный список для большой коллекции: поиск, фильтр и быстрый просмотр без карточной стены.</CardDescription>
              </div>
              <div className="w-fit rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3 text-right">
                <p className="text-lg font-semibold leading-none text-white">{filteredStatuses.length}</p>
                <p className="mt-1 whitespace-nowrap text-xs text-muted-foreground">из {statuses.length}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 p-7 pt-0">
            <div className="grid gap-4">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={statusQuery}
                  onChange={(event) => setStatusQuery(event.target.value)}
                  placeholder="Поиск по названию, slug, описанию или иконке"
                  className="pl-9"
                />
              </label>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => setStatusFilter("ALL")}
                  className={cn(
                    "rounded-full border px-3 py-2 text-sm transition",
                    statusFilter === "ALL" ? "border-cyan-200/45 bg-cyan-300/15 text-cyan-50" : "border-white/10 bg-white/[0.035] text-muted-foreground hover:bg-white/[0.07]",
                  )}
                >
                  Все {statuses.length}
                </button>
                {catalogStats.map((option) => {
                  const Icon = option.icon;
                  const meta = profileStatusRarityClass(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setStatusFilter(option.value)}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition",
                        statusFilter === option.value ? cn(meta.ring, meta.surface, meta.text) : "border-white/10 bg-white/[0.035] text-muted-foreground hover:bg-white/[0.07]",
                      )}
                    >
                      <Icon className="h-4 w-4" /> {option.label} {option.count}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="max-h-[42rem] space-y-3 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {filteredStatuses.length ? filteredStatuses.map((status) => <StatusCard key={status.id} status={status} />) : (
                <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-muted-foreground">Ничего не найдено. Попробуйте другой фильтр или запрос.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
