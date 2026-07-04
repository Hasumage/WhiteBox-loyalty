"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, Check, Copy, ExternalLink, Globe2, Images, Link2, MapPinned, Save, Settings2, Share2, Tags } from "lucide-react";
import { CategoryMultiSelect } from "@/components/ui/category-multi-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { companyCategories, companyProfile, updateCompanyProfile, type CompanyProfile } from "@/lib/api/company-client";

type CategoryOption = { id: number; slug: string; name: string; icon: string };

function normalizeCompanySlugInput(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 60);
}

export default function CompanySettingsPage() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [operatesOnline, setOperatesOnline] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const [current, options] = await Promise.all([companyProfile(), companyCategories()]);
      setProfile(current);
      setCategories(options);
      setName(current.company.name);
      setSlug(current.company.slug);
      setDescription(current.company.description ?? "");
      setCategoryIds(current.company.categories.map((category) => category.id));
      setOperatesOnline(current.company.operatesOnline);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить настройки компании.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const canManage = Boolean(profile && profile.member.role !== "CASHIER");
  const normalizedSlug = normalizeCompanySlugInput(slug);
  const publicPath = `/wallet/${normalizedSlug || profile?.company.slug || ""}`;
  const publicUrl = typeof window === "undefined" ? publicPath : new URL(publicPath, window.location.origin).toString();

  async function save() {
    if (!name.trim() || !categoryIds.length) {
      setError("Укажите название и хотя бы одну категорию компании.");
      return;
    }
    if (normalizedSlug.length < 3 || /^\d+$/.test(normalizedSlug)) {
      setError("Slug должен быть от 3 символов, латиницей, и не может состоять только из цифр.");
      return;
    }
    try {
      setError("");
      const updated = await updateCompanyProfile({ name, slug: normalizedSlug, description, categoryIds, operatesOnline });
      setProfile(updated);
      setSlug(updated.company.slug);
      setMessage("Профиль компании сохранён.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось сохранить профиль.");
    }
  }

  async function copyPublicLink() {
    await navigator.clipboard?.writeText(publicUrl).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function sharePublicLink() {
    if (navigator.share && profile) {
      await navigator.share({
        title: profile.company.name,
        text: `${profile.company.name} в NearLoy — бонусы, уровни и награды в одной карточке.`,
        url: publicUrl,
      }).catch(() => undefined);
      return;
    }
    await copyPublicLink();
  }

  return (
    <div className="space-y-5">
      <header>
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100"><Settings2 className="h-4 w-4" /> Настройки</p>
        <h1 className="text-3xl font-semibold">Профиль компании</h1>
        <p className="mt-2 text-sm text-muted-foreground">Публичное название, описание, категории и формат обслуживания клиентов.</p>
      </header>
      {(error || message) && <div className={`rounded-2xl border p-4 text-sm ${error ? "border-red-300/20 bg-red-400/10 text-red-100" : "border-cyan-300/20 bg-cyan-300/[0.06] text-cyan-50"}`}>{error || message}</div>}
      <Card className="glass border-white/10 py-0">
        <CardContent className="space-y-6 p-5 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2">
              <span className="flex items-center gap-2 text-sm font-semibold"><Building2 className="h-4 w-4 text-cyan-100" /> Название компании</span>
              <Input disabled={!canManage} value={name} onChange={(event) => setName(event.target.value)} maxLength={160} className="h-12 rounded-xl" />
            </label>
            <label className="space-y-2">
              <span className="flex items-center gap-2 text-sm font-semibold"><Link2 className="h-4 w-4 text-cyan-100" /> Публичный slug</span>
              <Input
                disabled={!canManage}
                value={slug}
                onChange={(event) => setSlug(normalizeCompanySlugInput(event.target.value))}
                minLength={3}
                maxLength={60}
                placeholder="aurora-coffee"
                className="h-12 rounded-xl font-mono text-sm"
              />
              <span className="block text-xs text-muted-foreground">Латиница, цифры и дефис. Адрес: <span className="font-mono text-cyan-100">/wallet/{normalizedSlug || "slug"}</span></span>
            </label>
            <label className="space-y-2">
              <span className="flex items-center gap-2 text-sm font-semibold"><Tags className="h-4 w-4 text-cyan-100" /> Категории</span>
              <CategoryMultiSelect disabled={!canManage} value={categoryIds} onChange={setCategoryIds} options={categories} placeholder="Выберите категории" className="min-h-12" />
            </label>
          </div>
          <div className="rounded-3xl border border-violet-200/20 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.16),transparent_34%),rgba(255,255,255,0.03)] p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-lg font-semibold"><Share2 className="h-5 w-5 text-violet-200" /> Публичная ссылка компании</p>
                <p className="mt-1 text-sm text-muted-foreground">Делитесь этой ссылкой с клиентами: она всегда ведёт на карточку компании по slug.</p>
                <div className="mt-3 truncate rounded-2xl border border-white/10 bg-black/24 px-3 py-2 font-mono text-sm text-cyan-100">
                  {publicUrl}
                </div>
              </div>
              <div className="grid shrink-0 gap-2 sm:grid-cols-3 lg:w-[420px]">
                <Button type="button" variant="secondary" className="rounded-xl" onClick={() => void sharePublicLink()}>
                  <Share2 className="h-4 w-4" />
                  Поделиться
                </Button>
                <Button type="button" variant="outline" className="rounded-xl border-white/10" onClick={() => void copyPublicLink()}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Скопировано" : "Копировать"}
                </Button>
                <Button asChild variant="outline" className="rounded-xl border-white/10">
                  <Link href={publicPath} target="_blank">
                    <ExternalLink className="h-4 w-4" />
                    Открыть
                  </Link>
                </Button>
              </div>
            </div>
          </div>
          <div className="rounded-3xl border border-cyan-200/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_34%),rgba(255,255,255,0.03)] p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/25 bg-cyan-200/10 text-cyan-50">
                  <Images className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-lg font-semibold">Фото и акции публичной карточки</p>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    Логотип, шапка, галерея до 10 фото и специальные предложения с промокодами. Перед загрузкой изображения можно подрезать под стандарты NearLoy.
                  </p>
                </div>
              </div>
              {canManage ? (
                <Button asChild variant="secondary" className="shrink-0 rounded-xl">
                  <Link href="/company/settings/media">
                    <Images className="h-4 w-4" />
                    Открыть медиа
                  </Link>
                </Button>
              ) : (
                <Button disabled variant="secondary" className="shrink-0 rounded-xl">
                  <Images className="h-4 w-4" />
                  Доступно владельцу
                </Button>
              )}
            </div>
          </div>
          <label className="block space-y-2">
            <span className="text-sm font-semibold">Описание для клиентов</span>
            <Textarea disabled={!canManage} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} placeholder="Расскажите, чем полезна компания и какие преимущества получат клиенты." className="min-h-32 resize-y rounded-xl" />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <button type="button" disabled={!canManage} onClick={() => setOperatesOnline(false)} className={`rounded-2xl border p-4 text-left ${!operatesOnline ? "border-cyan-200/35 bg-cyan-200/[0.08]" : "border-white/10 bg-white/[0.02]"}`}>
              <MapPinned className="mb-3 h-5 w-5 text-cyan-100" />
              <p className="font-semibold">Физические точки</p>
              <p className="mt-1 text-xs text-muted-foreground">Компания обслуживает клиентов в адресах на карте.</p>
            </button>
            <button type="button" disabled={!canManage} onClick={() => setOperatesOnline(true)} className={`rounded-2xl border p-4 text-left ${operatesOnline ? "border-cyan-200/35 bg-cyan-200/[0.08]" : "border-white/10 bg-white/[0.02]"}`}>
              <Globe2 className="mb-3 h-5 w-5 text-cyan-100" />
              <p className="font-semibold">Работаем онлайн</p>
              <p className="mt-1 text-xs text-muted-foreground">Для доставки, услуг на дому и digital-сервисов без адресов.</p>
            </button>
          </div>
          {!operatesOnline && (
            <div className="rounded-3xl border border-cyan-200/20 bg-[radial-gradient(circle_at_top_left,rgba(159,246,255,0.12),transparent_34%),rgba(159,246,255,0.04)] p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/25 bg-cyan-200/10 text-cyan-50">
                    <MapPinned className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold">Адреса и карта</p>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                      Добавляйте точки так же, как в админке: кликом по Яндекс Карте, подтверждением найденного адреса и сохранением в базу.
                    </p>
                  </div>
                </div>
                {canManage ? (
                  <Button asChild variant="secondary" className="shrink-0 rounded-xl">
                    <Link href="/company/settings/locations">
                      <MapPinned className="h-4 w-4" />
                      Открыть карту точек
                    </Link>
                  </Button>
                ) : (
                  <Button disabled variant="secondary" className="shrink-0 rounded-xl">
                    <MapPinned className="h-4 w-4" />
                    Доступно владельцу
                  </Button>
                )}
              </div>
            </div>
          )}
          {canManage && <Button onClick={() => void save()} className="rounded-xl"><Save /> Сохранить профиль</Button>}
        </CardContent>
      </Card>
    </div>
  );
}
