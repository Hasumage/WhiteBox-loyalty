"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CircleDollarSign,
  Crown,
  Handshake,
  Layers3,
  Plus,
  Search,
  Sparkles,
  SplitSquareHorizontal,
  Store,
  Target,
  Users,
  Wand2,
} from "lucide-react";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CategorySelect } from "@/components/ui/category-select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  adminCreatePairedSubscription,
  adminListCategories,
  adminListCompanyUsers,
  adminListPairedSubscriptions,
  adminSearchSubscriptions,
  adminSubscriptionStats,
  type AdminCategory,
  type AdminCompanyUser,
  type AdminPairedSubscription,
  type AdminSubscriptionSearchItem,
  type AdminSubscriptionStats,
} from "@/lib/api/admin-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import { cn } from "@/lib/utils";

type PeriodUnit = "week" | "month" | "year";

type PairParticipantForm = {
  companyId: string;
  benefitTitle: string;
  benefitDescription: string;
  fulfillmentNote: string;
  revenueSharePercent: string;
};

const selectClass =
  "h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-sm outline-none transition focus:border-cyan-200/50 focus:ring-2 focus:ring-cyan-200/10";

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

function formatMoney(value: number | string, locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function periodLabel(value: number, unit: PeriodUnit, bonusDays: number) {
  const unitLabel = unit === "week" ? "нед." : unit === "month" ? "мес." : "год";
  return `${value} ${unitLabel}${bonusDays > 0 ? ` + ${bonusDays} дней бонусом` : ""}`;
}

function emptyParticipant(share: number): PairParticipantForm {
  return {
    companyId: "",
    benefitTitle: "",
    benefitDescription: "",
    fulfillmentNote: "",
    revenueSharePercent: String(share),
  };
}

export default function AdminSubscriptionsPage() {
  const { locale, t } = useI18n("ru");
  const createRef = useRef<HTMLDivElement | null>(null);
  const [stats, setStats] = useState<AdminSubscriptionStats | null>(null);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [companies, setCompanies] = useState<AdminCompanyUser[]>([]);
  const [bundles, setBundles] = useState<AdminPairedSubscription[]>([]);
  const [subscriptionQuery, setSubscriptionQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AdminSubscriptionSearchItem[]>([]);
  const [searchingSubscriptions, setSearchingSubscriptions] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [pair, setPair] = useState({
    name: "",
    description: "",
    price: "",
    slug: "",
    renewalValue: "1",
    renewalUnit: "month" as PeriodUnit,
    promoBonusDays: "0",
    categoryId: "",
    isActive: false,
  });
  const [participants, setParticipants] = useState<PairParticipantForm[]>([
    emptyParticipant(50),
    emptyParticipant(50),
  ]);

  useEffect(() => {
    void refreshData();
  }, []);

  async function refreshData() {
    const [nextStats, nextCategories, nextCompanies, nextBundles] = await Promise.all([
      adminSubscriptionStats(),
      adminListCategories(),
      adminListCompanyUsers(),
      adminListPairedSubscriptions(),
    ]);
    setStats(nextStats);
    setCategories(nextCategories);
    setCompanies(nextCompanies.filter((row) => row.managedCompany));
    setBundles(nextBundles);
  }

  const companyOptions = useMemo(
    () =>
      companies
        .map((row) => ({
          userUuid: row.uuid,
          email: row.email,
          company: row.managedCompany!,
        }))
        .sort((a, b) => a.company.name.localeCompare(b.company.name)),
    [companies],
  );

  const shareTotal = participants.reduce(
    (sum, participant) => sum + Number(participant.revenueSharePercent || 0),
    0,
  );
  const selectedCompanyIds = participants.map((participant) => participant.companyId).filter(Boolean);
  const hasDuplicateCompanies = new Set(selectedCompanyIds).size !== selectedCompanyIds.length;

  async function onFind() {
    setSearchingSubscriptions(true);
    const items = await adminSearchSubscriptions(subscriptionQuery);
    setSearchResults(items);
    setSearchingSubscriptions(false);
  }

  function patchParticipant(index: number, patch: Partial<PairParticipantForm>) {
    setParticipants((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function applySharePreset(first: number, second: number) {
    setParticipants((current) =>
      current.map((row, index) => ({
        ...row,
        revenueSharePercent: String(index === 0 ? first : index === 1 ? second : 0),
      })),
    );
  }

  async function createPair() {
    setMessage(null);
    const preparedParticipants = participants.map((participant) => ({
      companyId: Number(participant.companyId),
      benefitTitle: participant.benefitTitle.trim(),
      benefitDescription: participant.benefitDescription.trim(),
      fulfillmentNote: participant.fulfillmentNote.trim(),
      revenueSharePercent: Number(participant.revenueSharePercent || 0),
    }));
    if (!pair.name.trim() || !pair.description.trim() || Number(pair.price) < 0) {
      setMessage("Заполните название, описание и цену парной подписки.");
      return;
    }
    if (preparedParticipants.some((participant) => !participant.companyId || !participant.benefitTitle || !participant.benefitDescription)) {
      setMessage("Для каждой компании нужны компания, преимущество и описание вклада.");
      return;
    }
    if (hasDuplicateCompanies) {
      setMessage("В парной подписке компания не может повторяться.");
      return;
    }
    if (Math.round(shareTotal * 100) !== 10000) {
      setMessage("Доли дохода должны давать ровно 100%.");
      return;
    }

    setCreating(true);
    const res = await adminCreatePairedSubscription({
      name: pair.name,
      description: pair.description,
      price: Number(pair.price || 0),
      slug: pair.slug || undefined,
      renewalValue: Number(pair.renewalValue || 1),
      renewalUnit: pair.renewalUnit,
      promoBonusDays: Number(pair.promoBonusDays || 0),
      categoryId: pair.categoryId ? Number(pair.categoryId) : undefined,
      isActive: pair.isActive,
      participants: preparedParticipants,
    });
    setCreating(false);
    if (!res.ok) {
      setMessage(res.message);
      return;
    }
    setMessage("Парная подписка создана. Сначала держим её в админке, потом спокойно подключим клиентский путь покупки.");
    setBundles((current) => [res.data, ...current]);
    setPair({
      name: "",
      description: "",
      price: "",
      slug: "",
      renewalValue: "1",
      renewalUnit: "month",
      promoBonusDays: "0",
      categoryId: "",
      isActive: false,
    });
    setParticipants([emptyParticipant(50), emptyParticipant(50)]);
  }

  const statCards = [
    {
      label: "Активные назначения",
      value: formatNumber(stats?.active ?? 0, locale),
      hint: `${stats?.activeRatePercent ?? 0}% от всех назначений`,
      icon: Users,
    },
    {
      label: "Каталог подписок",
      value: formatNumber(stats?.catalog?.totalPlans ?? 0, locale),
      hint: `${stats?.catalog?.activePlans ?? 0} активных офферов`,
      icon: Layers3,
    },
    {
      label: "Оценка MRR",
      value: formatMoney(stats?.estimatedMonthlyRevenue ?? 0, locale),
      hint: "по активным подпискам",
      icon: CircleDollarSign,
    },
    {
      label: "Парные подписки",
      value: formatNumber(bundles.length, locale),
      hint: "совместные офферы партнёров",
      icon: Handshake,
    },
  ];

  return (
    <div className="space-y-5">
      <Card className="glass overflow-hidden border-white/10">
        <CardContent className="relative p-6">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(34,211,238,0.18),transparent_35%),radial-gradient(circle_at_80%_25%,rgba(255,255,255,0.12),transparent_30%)]" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-200/25 bg-cyan-300/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-cyan-100">
                <Sparkles className="h-3.5 w-3.5" />
                Subscription command center
              </p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight">Управление подписками</h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                Обычные подписки остаются в профиле компании, а здесь собраны аналитика, поиск по названию и новая зона для парных подписок: две компании, два вклада, честное распределение дохода.
              </p>
            </div>
            <Button className="w-fit gap-2 rounded-xl" onClick={() => createRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              <Plus className="h-4 w-4" />
              Создать парную подписку
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((item) => (
          <Card key={item.label} className="glass border-white/10">
            <CardContent className="p-5">
              <div className="mb-4 inline-flex rounded-2xl border border-cyan-200/20 bg-cyan-300/10 p-3 text-cyan-100">
                <item.icon className="h-5 w-5" />
              </div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold">{item.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="glass border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-cyan-100" />
              Текущий пульс системы
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm text-muted-foreground">Автопродление</p>
              <p className="mt-2 text-2xl font-semibold">{stats?.autoRenewRatePercent ?? 0}%</p>
              <p className="mt-1 text-xs text-muted-foreground">{stats?.autoRenewEnabled ?? 0} активных</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm text-muted-foreground">Риск оттока</p>
              <p className="mt-2 text-2xl font-semibold">{stats?.churnRatePercent ?? 0}%</p>
              <p className="mt-1 text-xs text-muted-foreground">за 30 дней</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-sm text-muted-foreground">Истекают скоро</p>
              <p className="mt-2 text-2xl font-semibold">{stats?.expiringIn7Days ?? 0}</p>
              <p className="mt-1 text-xs text-muted-foreground">в ближайшие 7 дней</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Search className="h-5 w-5 text-cyan-100" />
              Поиск подписок
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="Название, slug, компания или категория"
                value={subscriptionQuery}
                onChange={(event) => setSubscriptionQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void onFind();
                }}
              />
              <Button variant="secondary" className="gap-2 rounded-xl" onClick={onFind} disabled={searchingSubscriptions}>
                <Search className={cn("h-4 w-4", searchingSubscriptions && "animate-pulse")} />
                {searchingSubscriptions ? "Ищу..." : "Найти"}
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              {searchResults.map((item) => (
                <div key={`${item.type}-${item.uuid}`} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{item.name}</p>
                        <Badge className={item.type === "bundle" ? "bg-cyan-300 text-black" : "bg-white/10 text-white"}>
                          {item.type === "bundle" ? "Парная" : "Обычная"}
                        </Badge>
                        {item.category && (
                          <Badge variant="outline" className="gap-1.5 border-white/15 bg-white/5">
                            <CategoryIcon iconName={item.category.icon} className="h-3.5 w-3.5 text-cyan-100" />
                            {item.category.name}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1 truncate text-muted-foreground">
                        {item.company?.name ?? (item.participants.map((participant) => participant.companyName).join(" + ") || item.slug)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatMoney(item.price, locale)}</p>
                      <p className="text-xs text-muted-foreground">{item.renewalPeriod}</p>
                    </div>
                  </div>
                  <p className="mt-2 line-clamp-2 text-muted-foreground">{item.description}</p>
                </div>
              ))}
              {!searchingSubscriptions && subscriptionQuery && searchResults.length === 0 && (
                <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground">
                  Ничего не найдено. Попробуйте название подписки, компании, категории или slug.
                </p>
              )}
              {!subscriptionQuery && searchResults.length === 0 && (
                <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground">
                  Введите название подписки, компании, категории или slug. Поиск покажет и обычные, и парные подписки.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div ref={createRef} className="scroll-mt-6 rounded-[1.7rem] bg-gradient-to-r from-cyan-300/70 via-white/35 to-emerald-300/70 p-px">
      <Card className="glass overflow-hidden border-0">
        <CardHeader className="border-b border-white/10 bg-[radial-gradient(circle_at_10%_0%,rgba(34,211,238,0.2),transparent_34%),linear-gradient(90deg,rgba(34,211,238,0.1),rgba(255,255,255,0.035))] pt-7">
          <CardTitle className="flex flex-wrap items-center gap-3 text-xl">
            <span className="inline-flex rounded-2xl border border-cyan-200/20 bg-cyan-300/10 p-2 text-cyan-100">
              <SplitSquareHorizontal className="h-5 w-5" />
            </span>
            Создать парную подписку
            <Badge className="rounded-full bg-white text-black">Admin only</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 p-5">
          <div className="grid gap-3 xl:grid-cols-[1fr_0.7fr]">
            <div className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm font-semibold">
                  Название
                  <Input value={pair.name} maxLength={80} placeholder="Кофе + фитнес на месяц" onChange={(event) => setPair({ ...pair, name: event.target.value })} />
                </label>
                <label className="space-y-1 text-sm font-semibold">
                  Цена
                  <Input value={pair.price} inputMode="decimal" placeholder="1990" onChange={(event) => setPair({ ...pair, price: event.target.value.replace(/[^0-9.]/g, "") })} />
                </label>
                <label className="space-y-1 text-sm font-semibold">
                  Slug
                  <Input value={pair.slug} maxLength={80} placeholder="auto if empty" onChange={(event) => setPair({ ...pair, slug: event.target.value })} />
                </label>
                <label className="space-y-1 text-sm font-semibold">
                  Категория
                  <CategorySelect
                    value={pair.categoryId ? Number(pair.categoryId) : ""}
                    onChange={(nextValue) => setPair({ ...pair, categoryId: nextValue === "" ? "" : String(nextValue) })}
                    options={categories}
                    emptyLabel="Без категории"
                    searchPlaceholder="Найти категорию..."
                    emptySearchLabel="Категории не найдены"
                    triggerClassName="h-11 rounded-xl border-white/10 bg-black/40 shadow-none focus-visible:ring-cyan-200/10"
                    dropdownClassName="rounded-2xl border-cyan-200/20 bg-[#080d12]/95 shadow-2xl shadow-cyan-950/30"
                  />
                </label>
              </div>
              <label className="block space-y-1 text-sm font-semibold">
                Описание совместной ценности
                <Textarea
                  className="min-h-28 resize-y rounded-2xl"
                  value={pair.description}
                  maxLength={1000}
                  placeholder="Почему клиенту выгодно купить именно этот совместный набор?"
                  onChange={(event) => setPair({ ...pair, description: event.target.value })}
                />
              </label>
            </div>

            <div className="space-y-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="grid grid-cols-3 gap-2">
                <label className="space-y-1 text-sm font-semibold">
                  Срок
                  <Input value={pair.renewalValue} inputMode="numeric" onChange={(event) => setPair({ ...pair, renewalValue: event.target.value.replace(/\D/g, "") || "1" })} />
                </label>
                <label className="space-y-1 text-sm font-semibold col-span-2">
                  Период
                  <select className={selectClass} value={pair.renewalUnit} onChange={(event) => setPair({ ...pair, renewalUnit: event.target.value as PeriodUnit })}>
                    <option value="week">Неделя</option>
                    <option value="month">Месяц</option>
                    <option value="year">Год</option>
                  </select>
                </label>
              </div>
              <label className="block space-y-1 text-sm font-semibold">
                Бонусные дни
                <Input value={pair.promoBonusDays} inputMode="numeric" onChange={(event) => setPair({ ...pair, promoBonusDays: event.target.value.replace(/\D/g, "") || "0" })} />
              </label>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition",
                  pair.isActive ? "border-emerald-300/40 bg-emerald-400/10" : "border-white/10 bg-black/20",
                )}
                onClick={() => setPair({ ...pair, isActive: !pair.isActive })}
              >
                <span>
                  <span className="block font-semibold">{pair.isActive ? "Сразу активировать" : "Сохранить черновиком"}</span>
                  <span className="text-xs text-muted-foreground">{periodLabel(Number(pair.renewalValue || 1), pair.renewalUnit, Number(pair.promoBonusDays || 0))}</span>
                </span>
                <Badge className={pair.isActive ? "bg-emerald-300 text-black" : "bg-white/10 text-white"}>{pair.isActive ? "ACTIVE" : "DRAFT"}</Badge>
              </button>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {participants.map((participant, index) => (
              <div key={index} className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300/70 via-white/50 to-emerald-300/70" />
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 text-lg font-semibold">
                    <Store className="h-5 w-5 text-cyan-100" />
                    Компания {index + 1}
                  </h3>
                  <Badge variant="outline" className="border-white/15 bg-white/5">{participant.revenueSharePercent || 0}% дохода</Badge>
                </div>
                <div className="space-y-3">
                  <label className="block space-y-1 text-sm font-semibold">
                    Партнёр
                    <select className={selectClass} value={participant.companyId} onChange={(event) => patchParticipant(index, { companyId: event.target.value })}>
                      <option value="">Выберите компанию</option>
                      {companyOptions.map((option) => (
                        <option key={option.company.id} value={option.company.id}>
                          {option.company.name} · {option.email}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-1 text-sm font-semibold">
                    Что даёт компания
                    <Input value={participant.benefitTitle} maxLength={120} placeholder="Пачка кофе / тренировка / консультация" onChange={(event) => patchParticipant(index, { benefitTitle: event.target.value })} />
                  </label>
                  <label className="block space-y-1 text-sm font-semibold">
                    Описание вклада
                    <Textarea className="min-h-24 rounded-2xl" value={participant.benefitDescription} maxLength={800} placeholder="Расскажите, какую ценность получает клиент от этой компании." onChange={(event) => patchParticipant(index, { benefitDescription: event.target.value })} />
                  </label>
                  <label className="block space-y-1 text-sm font-semibold">
                    Операционная заметка
                    <Input value={participant.fulfillmentNote} maxLength={180} placeholder="Например: доставка до 3 дней" onChange={(event) => patchParticipant(index, { fulfillmentNote: event.target.value })} />
                  </label>
                  <label className="block space-y-1 text-sm font-semibold">
                    Доля дохода, %
                    <Input value={participant.revenueSharePercent} inputMode="decimal" onChange={(event) => patchParticipant(index, { revenueSharePercent: event.target.value.replace(/[^0-9.]/g, "") })} />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold">Распределение дохода: {shareTotal}%</p>
              <p className={cn("text-xs", shareTotal === 100 && !hasDuplicateCompanies ? "text-emerald-200" : "text-amber-200")}>
                {shareTotal === 100 && !hasDuplicateCompanies
                  ? "Можно сохранять: доли сходятся, партнёры уникальны."
                  : "Проверьте, чтобы сумма была 100%, а компании не повторялись."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="glass border-white/10" onClick={() => applySharePreset(50, 50)}>50 / 50</Button>
              <Button type="button" variant="outline" className="glass border-white/10" onClick={() => applySharePreset(60, 40)}>60 / 40</Button>
              <Button type="button" variant="outline" className="glass border-white/10" onClick={() => applySharePreset(70, 30)}>70 / 30</Button>
              <Button type="button" className="gap-2 rounded-xl" disabled={creating} onClick={createPair}>
                <Wand2 className="h-4 w-4" />
                {creating ? "Создаём..." : "Создать парную подписку"}
              </Button>
            </div>
          </div>
          {message && <div className="rounded-2xl border border-cyan-200/20 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-50">{message}</div>}
        </CardContent>
      </Card>
      </div>

      <Card className="glass border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Handshake className="h-5 w-5 text-cyan-100" />
            Парные подписки
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bundles.length ? (
            <div className="grid gap-3">
              {bundles.map((bundle) => (
                <div key={bundle.uuid} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-semibold">{bundle.name}</h3>
                        <Badge className={bundle.isActive ? "bg-emerald-300 text-black" : "bg-white/10 text-white"}>{bundle.status}</Badge>
                        {bundle.category && <Badge variant="outline" className="border-white/15 bg-white/5">{bundle.category.icon} {bundle.category.name}</Badge>}
                      </div>
                      <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{bundle.description}</p>
                    </div>
                    <div className="rounded-2xl border border-cyan-200/20 bg-cyan-300/10 px-4 py-3 text-right">
                      <p className="text-xs uppercase tracking-[0.2em] text-cyan-100/70">Цена</p>
                      <p className="text-2xl font-semibold">{formatMoney(bundle.price, locale)}</p>
                      <p className="text-xs text-muted-foreground">{bundle.renewalPeriod}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    {bundle.participants.map((participant) => (
                      <div key={participant.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <p className="font-semibold">{participant.company.name}</p>
                          <Badge variant="outline" className="border-white/15 bg-white/5">{participant.revenueSharePercent}%</Badge>
                        </div>
                        <p className="font-medium text-cyan-50">{participant.benefitTitle}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{participant.benefitDescription}</p>
                        {participant.fulfillmentNote && (
                          <p className="mt-2 text-xs text-muted-foreground">Операции: {participant.fulfillmentNote}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-8 text-center text-sm text-muted-foreground">
              Парных подписок пока нет. Самое время собрать первый красивый совместный оффер.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Crown className="h-5 w-5 text-cyan-100" />
            Топ обычных подписок
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats?.topSubscriptions?.length ? (
            <div className="grid gap-2">
              {stats.topSubscriptions.map((row) => (
                <div key={row.uuid} className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold">{row.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.companyName ?? "Глобальный каталог"} · {row.slug}</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span>{row.activeSubscribers} активных</span>
                    <span className="font-semibold">{formatMoney(row.estimatedMonthlyRevenue, locale)}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Пока нет активных обычных подписок.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
