"use client";

import { useEffect, useMemo, useState } from "react";
import { Crown, Gem, Plus, RefreshCcw, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import {
  ProfileStatusBadge,
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

const rarityOptions: Array<{ value: ProfileStatusRarityView; label: string; hint: string; icon: typeof Gem }> = [
  { value: "RARE", label: "Редкий", hint: "Синий статус для ранних достижений", icon: ShieldCheck },
  { value: "EPIC", label: "Эпический", hint: "Фиолетовый статус для заметных событий", icon: Sparkles },
  { value: "LEGENDARY", label: "Легендарный", hint: "Оранжевый статус для особых наград", icon: Crown },
];

const iconOptions = ["Sparkles", "Trophy", "Crown", "Gem", "Flame", "Gift", "HeartHandshake", "QrCode", "Coffee", "WalletCards", "BadgeCheck", "Zap"];

const initialForm: FormState = {
  title: "",
  description: "",
  rarity: "RARE",
  icon: "Sparkles",
};

function StatusCard({ status }: { status: AdminProfileStatus }) {
  const meta = profileStatusRarityClass(status.rarity);
  return (
    <div className={cn("relative overflow-hidden rounded-[1.5rem] border p-4", meta.ring, meta.surface)}>
      <div className={cn("absolute inset-x-0 top-0 h-1", {
        "bg-sky-300/80": status.rarity === "RARE",
        "bg-violet-300/80": status.rarity === "EPIC",
        "bg-orange-300/90": status.rarity === "LEGENDARY",
      })} />
      <div className="flex items-start gap-3">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border", meta.ring, meta.surface, meta.text)}>
          <ProfileStatusIcon icon={status.icon} className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold">{status.title}</h3>
            {status.isSystem && <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">system</span>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{status.slug}</p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{status.description}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <ProfileStatusBadge rarity={status.rarity} icon={status.icon} title={PROFILE_STATUS_RARITY_META[status.rarity].label} />
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-muted-foreground">Открыт у пользователей: {status.unlockCount}</span>
          </div>
        </div>
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

  const grouped = useMemo(() => {
    return rarityOptions.map((option) => ({
      ...option,
      statuses: statuses.filter((status) => status.rarity === option.value),
    }));
  }, [statuses]);

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

  return (
    <div className="space-y-6 pb-8">
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

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="glass border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-cyan-100" /> Новый статус
            </CardTitle>
            <CardDescription>Короткое название, понятное описание и редкость. Иконку можно выбрать из готового набора.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Иконка</p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {iconOptions.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, icon }))}
                    className={cn(
                      "flex h-12 items-center justify-center rounded-2xl border transition",
                      form.icon === icon ? "border-cyan-200/50 bg-cyan-300/15 text-cyan-50" : "border-white/10 bg-white/[0.035] text-muted-foreground hover:bg-white/[0.06]",
                    )}
                    title={icon}
                  >
                    <ProfileStatusIcon icon={icon} className="h-5 w-5" />
                  </button>
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

        <div className="grid gap-4">
          {grouped.map((group) => {
            const Icon = group.icon;
            const meta = profileStatusRarityClass(group.value);
            return (
              <Card key={group.value} className={cn("glass border-white/10", meta.surface)}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <Icon className={cn("h-5 w-5", meta.text)} /> {group.label}
                    </span>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-sm text-muted-foreground">{group.statuses.length}</span>
                  </CardTitle>
                  <CardDescription>{group.hint}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 lg:grid-cols-2">
                  {group.statuses.length ? group.statuses.map((status) => <StatusCard key={status.id} status={status} />) : (
                    <p className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-muted-foreground">Пока нет статусов этой редкости.</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
