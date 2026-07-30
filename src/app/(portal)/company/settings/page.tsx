"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Building2, Check, Copy, ExternalLink, Globe2, Link2, Loader2, MapPinned, Power, RotateCcw, Save, Settings2, Share2, Sparkles, Tags } from "lucide-react";
import { CategoryMultiSelect } from "@/components/ui/category-multi-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { companyBilling, companyCategories, companyProfile, updateCompanyProfile, type CompanyBillingData, type CompanyProfile } from "@/lib/api/company-client";
import { cn } from "@/lib/utils";

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

function hasSubscriptionAccess(billing: CompanyBillingData | null) {
  if (!billing) return false;
  const now = Date.now();
  const trialActive = billing.account.status === "TRIAL" && (!billing.account.trialEndsAt || new Date(billing.account.trialEndsAt).getTime() > now);
  return (
    billing.access?.status === "ACTIVE" ||
    billing.access?.status === "TRIAL" ||
    billing.access?.status === "GRACE" ||
    billing.account.status === "ACTIVE" ||
    trialActive ||
    billing.invoice?.status === "PAID" ||
    billing.invoice?.status === "WAIVED"
  );
}

function billingEndDate(billing: CompanyBillingData | null) {
  const value = billing?.account.trialEndsAt ?? billing?.invoice?.periodEndsAt ?? billing?.account.currentPeriodEndsAt ?? null;
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

function areCategoryIdsEqual(left: number[], right: number[]) {
  if (left.length !== right.length) return false;
  const leftSorted = [...left].sort((a, b) => a - b);
  const rightSorted = [...right].sort((a, b) => a - b);
  return leftSorted.every((id, index) => id === rightSorted[index]);
}

export default function CompanySettingsPage() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [billing, setBilling] = useState<CompanyBillingData | null>(null);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [operatesOnline, setOperatesOnline] = useState(false);
  const [companyActive, setCompanyActive] = useState(false);
  const [activationSaving, setActivationSaving] = useState(false);
  const [activationDone, setActivationDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const [current, options, currentBilling] = await Promise.all([companyProfile(), companyCategories(), companyBilling().catch(() => null)]);
      setProfile(current);
      setBilling(currentBilling);
      setCategories(options);
      setName(current.company.name);
      setSlug(current.company.slug);
      setDescription(current.company.description ?? "");
      setCategoryIds(current.company.categories.map((category) => category.id));
      setOperatesOnline(current.company.operatesOnline);
      setCompanyActive(current.company.isActive);
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
  const savedCategoryIds = useMemo(() => profile?.company.categories.map((category) => category.id) ?? [], [profile]);
  const hasDirty = useMemo(() => {
    if (!profile || !canManage) return false;
    return (
      name !== profile.company.name ||
      normalizedSlug !== profile.company.slug ||
      description !== (profile.company.description ?? "") ||
      operatesOnline !== profile.company.operatesOnline ||
      companyActive !== profile.company.isActive ||
      !areCategoryIdsEqual(categoryIds, savedCategoryIds)
    );
  }, [canManage, categoryIds, companyActive, description, name, normalizedSlug, operatesOnline, profile, savedCategoryIds]);

  function discardChanges() {
    if (!profile) return;
    setName(profile.company.name);
    setSlug(profile.company.slug);
    setDescription(profile.company.description ?? "");
    setCategoryIds(profile.company.categories.map((category) => category.id));
    setOperatesOnline(profile.company.operatesOnline);
    setCompanyActive(profile.company.isActive);
    setError("");
    setMessage("");
  }

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
      const updated = await updateCompanyProfile({ name, slug: normalizedSlug, description, categoryIds, operatesOnline, isActive: companyActive });
      setProfile(updated);
      setCompanyActive(updated.company.isActive);
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

  const canActivateCompany = hasSubscriptionAccess(billing);

  async function toggleCompanyActivation(nextActive: boolean) {
    if (!profile || !canManage || activationSaving) return;
    if (nextActive && !canActivateCompany) {
      setError("Сначала оплатите подписку NearLoy или примените тестовый период.");
      return;
    }
    try {
      setActivationSaving(true);
      setError("");
      const updated = await updateCompanyProfile({
        name,
        slug: normalizedSlug,
        description,
        categoryIds,
        operatesOnline,
        isActive: nextActive,
      });
      setProfile(updated);
      setCompanyActive(updated.company.isActive);
      setActivationDone(nextActive);
      setMessage(nextActive ? "Компания активирована и готова к показу клиентам." : "Компания скрыта из публичной выдачи.");
      window.setTimeout(() => setActivationDone(false), 2400);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось изменить активность компании.");
    } finally {
      setActivationSaving(false);
    }
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
          <div className="rounded-3xl border border-cyan-200/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_36%),rgba(255,255,255,0.035)] p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/25 bg-cyan-200/10 text-cyan-50">
                  <Power className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-lg font-semibold">Публикация компании</p>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    Включите, когда карточка, адреса и подписка готовы. Активная компания может отображаться в выдаче и на карте.
                  </p>
                  {canActivateCompany ? (
                    <p className="mt-2 text-sm text-emerald-100">Подписка активна до {billingEndDate(billing)}.</p>
                  ) : (
                    <p className="mt-2 text-sm text-amber-100">Для публикации нужна активная подписка или тестовый период.</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={companyActive}
                disabled={!canManage || activationSaving || (!companyActive && !canActivateCompany)}
                onClick={() => void toggleCompanyActivation(!companyActive)}
                className={cn(
                  "group flex min-w-[220px] items-center justify-between rounded-2xl border px-4 py-3 text-left transition",
                  companyActive
                    ? "border-emerald-200/35 bg-emerald-200/12 text-emerald-50"
                    : "border-white/10 bg-black/28 text-white/72",
                  (!canManage || activationSaving || (!companyActive && !canActivateCompany)) && "cursor-not-allowed opacity-55",
                )}
              >
                <span>
                  <span className="block text-sm font-semibold">{companyActive ? "Компания активна" : "Компания скрыта"}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{companyActive ? "Клиенты видят карточку" : "Не показывается публично"}</span>
                </span>
                <span
                  className={cn(
                    "relative h-8 w-14 rounded-full border transition",
                    companyActive ? "border-emerald-200/40 bg-emerald-300/25" : "border-white/12 bg-white/8",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white text-black transition",
                      companyActive ? "left-7" : "left-1",
                    )}
                  >
                    {activationSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : companyActive ? <Check className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                  </span>
                </span>
              </button>
            </div>
            {activationDone && (
              <div className="mt-4 rounded-2xl border border-emerald-200/25 bg-emerald-300/10 p-3 text-sm text-emerald-50">
                Ваша компания успешно активирована. Спасибо — теперь клиенты смогут найти её в NearLoy.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      {hasDirty && (
        <div className="sticky bottom-3 z-30">
          <Card className="border-primary/30 bg-card/95 shadow-2xl backdrop-blur">
            <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <p className="font-semibold">Есть несохранённые изменения</p>
                <p className="text-xs text-muted-foreground">Профиль компании</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button type="button" variant="secondary" className="rounded-xl" onClick={discardChanges}>
                  <RotateCcw className="h-4 w-4" />
                  Сбросить
                </Button>
                <Button type="button" className="rounded-xl" onClick={() => void save()}>
                  <Save className="h-4 w-4" />
                  Сохранить всё
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
