"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Edit3,
  Gift,
  Infinity as InfinityIcon,
  LineChart,
  ListChecks,
  PackagePlus,
  Percent,
  Plus,
  ReceiptText,
  Save,
  ShieldAlert,
  Sparkles,
  Sun,
  Ticket,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { OptionSelect } from "@/components/ui/option-select";
import { Textarea } from "@/components/ui/textarea";
import {
  companyProfile,
  companySubscriptions,
  createCompanyEntitlement,
  updateCompanyEntitlement,
  updateCompanySubscription,
  type CompanySubscription,
  type EntitlementWindow,
} from "@/lib/api/company-client";
import { cn } from "@/lib/utils";

type RenewalUnit = "week" | "month" | "year";
type MetricMode = "daily" | "future" | "usage";
type PlanEditDraft = { name: string; description: string; price: string; renewalValue: string; renewalUnit: RenewalUnit };
type BenefitEditDraft = {
  title: string;
  description: string;
  allowance: string;
  windowValue: string;
  windowUnit: EntitlementWindow;
  isActive: boolean;
};

const EMPTY_STATS = {
  activeSubscribers: 0,
  dailyRevenue: 0,
  futureRevenue: 0,
  recognizedRevenue: 0,
  totalRedemptions: 0,
  usageCapacity: 0,
  usagePercent: 0,
};

const MIN_SUBSCRIPTION_PRICE_RUB = 299;

const periodOptions = [
  { value: "DAY", label: "Каждый день", description: "Лимит обновляется ежедневно", icon: Sun },
  { value: "WEEK", label: "Каждую неделю", description: "Лимит обновляется раз в неделю", icon: CalendarDays },
  { value: "MONTH", label: "Каждый месяц", description: "Лимит обновляется раз в месяц", icon: CalendarRange },
  { value: "TERM", label: "Один раз за срок", description: "Общий лимит на весь период подписки", icon: Ticket },
  { value: "UNLIMITED", label: "Без лимита использований", description: "Например, проход в клуб без ограничений", icon: InfinityIcon },
];

const renewalOptions = [
  { value: "week", label: "Неделя", description: "Короткий тестовый тариф", icon: CalendarDays },
  { value: "month", label: "Месяц", description: "Самый понятный формат", icon: CalendarRange },
  { value: "year", label: "Год", description: "Долгий доступ с выгодой", icon: BadgeCheck },
];

const metricOptions: Array<{ value: MetricMode; label: string; icon: typeof TrendingUp }> = [
  { value: "daily", label: "Доход / день", icon: TrendingUp },
  { value: "future", label: "Будущий остаток", icon: WalletCards },
  { value: "usage", label: "Использование", icon: Percent },
];

function statsOf(subscription: CompanySubscription) {
  return subscription.stats ?? EMPTY_STATS;
}

function formatMoney(value: string | number) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "0 ₽";
  return `${amount.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ₽`;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value)}%`;
}

function formatRenewal(period: string) {
  const normalized = period.trim().toLowerCase();
  if (normalized === "week" || normalized === "1 week") return "1 неделя";
  if (normalized === "month" || normalized === "1 month") return "1 месяц";
  if (normalized === "year" || normalized === "1 year") return "1 год";
  const match = normalized.match(/^(\d+)\s+(week|month|year)s?/);
  if (!match) return period;
  const value = Number(match[1]);
  const unit = match[2] as RenewalUnit;
  const labels: Record<RenewalUnit, [string, string, string]> = {
    week: ["неделя", "недели", "недель"],
    month: ["месяц", "месяца", "месяцев"],
    year: ["год", "года", "лет"],
  };
  const label =
    value % 10 === 1 && value % 100 !== 11
      ? labels[unit][0]
      : value % 10 >= 2 && value % 10 <= 4 && (value % 100 < 10 || value % 100 >= 20)
        ? labels[unit][1]
        : labels[unit][2];
  return `${value} ${label}`;
}

function normalizeRenewalUnit(value?: string | null): RenewalUnit {
  return value === "week" || value === "month" || value === "year" ? value : "month";
}

function chartValue(subscription: CompanySubscription, mode: MetricMode) {
  const stats = statsOf(subscription);
  if (mode === "daily") return stats.dailyRevenue;
  if (mode === "future") return stats.futureRevenue;
  return stats.usagePercent;
}

function chartLabel(mode: MetricMode, value: number) {
  return mode === "usage" ? formatPercent(value) : formatMoney(value);
}

function RevenueChart({ items, mode }: { items: CompanySubscription[]; mode: MetricMode }) {
  const chartItems = useMemo(() => items.slice(0, 8).reverse(), [items]);
  const values = chartItems.map((item) => chartValue(item, mode));
  const maxValue = Math.max(1, ...values);
  const width = 860;
  const height = 300;
  const padX = 74;
  const padY = 44;
  const innerWidth = width - padX * 2;
  const innerHeight = height - padY * 2;
  const activeMetric = metricOptions.find((option) => option.value === mode) ?? metricOptions[0];
  const ActiveMetricIcon = activeMetric.icon;
  const totalValue = values.reduce((sum, value) => sum + value, 0);
  const peak = peakChartItem(chartItems, mode);
  const yTicks = [1, 0.75, 0.5, 0.25, 0].map((ratio) => ({
    ratio,
    y: padY + innerHeight * (1 - ratio),
    value: maxValue * ratio,
  }));
  const points = chartItems.map((item, index) => {
    const x = padX + (chartItems.length === 1 ? innerWidth / 2 : (innerWidth / (chartItems.length - 1)) * index);
    const y = padY + innerHeight - (chartValue(item, mode) / maxValue) * innerHeight;
    return { x, y, item, value: chartValue(item, mode) };
  });
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const area = points.length
    ? `${line} L ${points[points.length - 1].x} ${height - padY} L ${points[0].x} ${height - padY} Z`
    : "";

  if (!items.length) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center rounded-[2rem] border border-dashed border-cyan-200/15 bg-[radial-gradient(circle_at_center,rgba(103,232,249,0.08),transparent_46%),rgba(255,255,255,0.02)] p-8 text-center text-sm text-muted-foreground">
        <LineChart className="mb-3 h-10 w-10 text-cyan-100" />
        Создайте первую подписку, и здесь появится график выручки и использования.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-[radial-gradient(circle_at_top_right,rgba(103,232,249,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.12),transparent_32%),linear-gradient(135deg,rgba(10,17,24,0.98),rgba(4,8,13,0.99))] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.34)] md:p-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-100/70">Аналитика подписок</p>
          <h2 className="mt-2 flex items-center gap-2 text-2xl font-semibold">
            <ActiveMetricIcon className="h-5 w-5 text-cyan-100" />
            {activeMetric.label}
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Суммарно</p>
            <p className="mt-1 text-lg font-semibold">{chartLabel(mode, totalValue)}</p>
          </div>
          <div className="rounded-2xl border border-cyan-200/15 bg-cyan-200/[0.06] px-4 py-3">
            <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/70">Пик</p>
            <p className="mt-1 max-w-44 truncate text-lg font-semibold">{peak ? peak.item.name : "—"}</p>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))] p-3 md:p-4">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(255,255,255,0.11),transparent_18%),linear-gradient(90deg,rgba(103,232,249,0.04)_1px,transparent_1px),linear-gradient(0deg,rgba(103,232,249,0.04)_1px,transparent_1px)] bg-[length:auto,44px_44px,44px_44px]" />
        <svg viewBox={`0 0 ${width} ${height}`} className="relative h-72 w-full" aria-hidden="true">
          <defs>
            <linearGradient id="subscriptionChartArea" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(125, 249, 255, 0.38)" />
              <stop offset="58%" stopColor="rgba(125, 249, 255, 0.08)" />
              <stop offset="100%" stopColor="rgba(125, 249, 255, 0.01)" />
            </linearGradient>
            <linearGradient id="subscriptionChartLine" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#67e8f9" />
              <stop offset="55%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#86efac" />
            </linearGradient>
            <filter id="subscriptionChartGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feColorMatrix in="blur" type="matrix" values="0 0 0 0 0.36 0 0 0 0 0.91 0 0 0 0 0.98 0 0 0 0.58 0" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {yTicks.map((tick) => (
            <g key={tick.ratio}>
              <line x1={padX} x2={width - padX} y1={tick.y} y2={tick.y} stroke="rgba(255,255,255,0.08)" strokeDasharray="5 9" />
              <text x={padX - 12} y={tick.y + 4} textAnchor="end" className="fill-white/45 text-[11px] font-semibold">
                {chartLabel(mode, tick.value)}
              </text>
            </g>
          ))}
          <line x1={padX} x2={padX} y1={padY} y2={height - padY} stroke="rgba(255,255,255,0.12)" />
          <line x1={padX} x2={width - padX} y1={height - padY} y2={height - padY} stroke="rgba(255,255,255,0.12)" />
          {area && <path d={area} fill="url(#subscriptionChartArea)" />}
          {line && <path d={line} fill="none" stroke="rgba(103,232,249,0.16)" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" filter="url(#subscriptionChartGlow)" />}
          {line && <path d={line} fill="none" stroke="url(#subscriptionChartLine)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />}
          {points.map((point) => (
            <g key={point.item.uuid}>
              <line x1={point.x} x2={point.x} y1={point.y + 14} y2={height - padY} stroke="rgba(125,249,255,0.12)" strokeDasharray="4 8" />
              <circle cx={point.x} cy={point.y} r="10" fill="rgba(125,249,255,0.12)" />
              <circle cx={point.x} cy={point.y} r="6.5" fill="#020617" stroke="#a5f3fc" strokeWidth="2.5" />
              <circle cx={point.x} cy={point.y} r="3" fill="#ffffff" />
            </g>
          ))}
        </svg>
        <div className="relative mt-2 grid gap-2 text-[11px] text-white/60 sm:grid-cols-4 lg:grid-cols-8">
          {chartItems.map((item) => (
            <div key={item.uuid} className="min-w-0 rounded-full border border-white/10 bg-black/35 px-2.5 py-1.5">
              <span className="block truncate">{item.name}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {chartItems.map((item) => {
          const value = chartValue(item, mode);
          const widthPercent = Math.max(5, Math.min(100, (value / maxValue) * 100));
          const stats = statsOf(item);
          return (
            <div key={item.uuid} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 transition hover:border-cyan-200/30 hover:bg-cyan-200/[0.045]">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-semibold">{item.name}</p>
                <span className="text-xs font-semibold text-cyan-100">{chartLabel(mode, value)}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-200 via-white to-emerald-200" style={{ width: `${widthPercent}%` }} />
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{stats.activeSubscribers} активных</span>
                <span>{stats.totalRedemptions} погашений</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function peakChartItem(items: CompanySubscription[], mode: MetricMode) {
  if (!items.length) return null;
  return items.reduce(
    (best, item) => {
      const value = chartValue(item, mode);
      return value > best.value ? { item, value } : best;
    },
    { item: items[0], value: chartValue(items[0], mode) },
  );
}

export default function CompanySubscriptionsPage() {
  const [items, setItems] = useState<CompanySubscription[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [editingUuid, setEditingUuid] = useState("");
  const [metricMode, setMetricMode] = useState<MetricMode>("daily");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    allowance: "1",
    windowValue: "1",
    windowUnit: "DAY" as EntitlementWindow,
  });
  const [planEdit, setPlanEdit] = useState<PlanEditDraft>({
    name: "",
    description: "",
    price: "",
    renewalValue: "1",
    renewalUnit: "month",
  });
  const [benefitDrafts, setBenefitDrafts] = useState<Record<string, BenefitEditDraft>>({});
  const [acknowledgeRefundPolicy, setAcknowledgeRefundPolicy] = useState(false);

  async function load() {
    try {
      const [subscriptions, profile] = await Promise.all([companySubscriptions(), companyProfile()]);
      setItems(subscriptions);
      setCanManage(profile.member.role !== "CASHIER");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Подписки временно недоступны.");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const editingSubscription = useMemo(() => items.find((item) => item.uuid === editingUuid) ?? null, [items, editingUuid]);

  const summary = useMemo(() => {
    const totals = items.reduce(
      (acc, item) => {
        const stats = statsOf(item);
        acc.dailyRevenue += stats.dailyRevenue;
        acc.futureRevenue += stats.futureRevenue;
        acc.recognizedRevenue += stats.recognizedRevenue;
        acc.activeSubscribers += stats.activeSubscribers;
        acc.totalRedemptions += stats.totalRedemptions;
        acc.usageCapacity += stats.usageCapacity;
        return acc;
      },
      { dailyRevenue: 0, futureRevenue: 0, recognizedRevenue: 0, activeSubscribers: 0, totalRedemptions: 0, usageCapacity: 0 },
    );
    return {
      ...totals,
      usagePercent: totals.usageCapacity > 0 ? Math.round((totals.totalRedemptions / totals.usageCapacity) * 100) : 0,
    };
  }, [items]);

  useEffect(() => {
    if (!editingSubscription) return;
    setPlanEdit({
      name: editingSubscription.name,
      description: editingSubscription.description,
      price: String(Number(editingSubscription.price) || ""),
      renewalValue: String(editingSubscription.renewalValue ?? 1),
      renewalUnit: normalizeRenewalUnit(editingSubscription.renewalUnit),
    });
    setBenefitDrafts(
      Object.fromEntries(
        editingSubscription.entitlements.map((benefit) => [
          benefit.uuid,
          {
            title: benefit.title,
            description: benefit.description ?? "",
            allowance: String(benefit.allowance ?? 1),
            windowValue: String(benefit.windowValue ?? 1),
            windowUnit: benefit.windowUnit,
            isActive: benefit.isActive,
          },
        ]),
      ),
    );
    setForm({ title: "", description: "", allowance: "1", windowValue: "1", windowUnit: "DAY" });
    setAcknowledgeRefundPolicy(false);
  }, [editingSubscription]);

  async function createRule() {
    if (!editingSubscription || !form.title.trim()) return;
    try {
      setError("");
      setSuccess("");
      await createCompanyEntitlement(editingSubscription.uuid, {
        title: form.title.trim(),
        description: form.description.trim(),
        allowance: Number(form.allowance) || 1,
        windowValue: Number(form.windowValue) || 1,
        windowUnit: form.windowUnit,
      });
      setSuccess("Услуга добавлена. Касса уже будет соблюдать этот лимит.");
      setForm({ title: "", description: "", allowance: "1", windowValue: "1", windowUnit: "DAY" });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось создать услугу.");
    }
  }

  async function saveSelectedPlan() {
    const priceAmount = Number(planEdit.price);
    if (!editingSubscription || !planEdit.name.trim() || !planEdit.description.trim() || !Number.isFinite(priceAmount) || priceAmount < MIN_SUBSCRIPTION_PRICE_RUB) return;
    try {
      setError("");
      setSuccess("");
      await updateCompanySubscription(editingSubscription.uuid, {
        name: planEdit.name.trim(),
        description: planEdit.description.trim(),
        price: priceAmount,
        renewalValue: Number(planEdit.renewalValue) || 1,
        renewalUnit: planEdit.renewalUnit,
        acknowledgeSubscriberRefundPolicy: acknowledgeRefundPolicy,
      });
      setSuccess("Подписка обновлена. Изменения применятся к новым условиям тарифа.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось обновить подписку.");
    }
  }

  async function saveBenefit(subscriptionUuid: string, benefitUuid: string) {
    const draft = benefitDrafts[benefitUuid];
    if (!draft?.title.trim()) return;
    try {
      setError("");
      setSuccess("");
      await updateCompanyEntitlement(subscriptionUuid, benefitUuid, {
        title: draft.title.trim(),
        description: draft.description.trim(),
        allowance: Number(draft.allowance) || 1,
        windowValue: Number(draft.windowValue) || 1,
        windowUnit: draft.windowUnit,
        isActive: draft.isActive,
        acknowledgeSubscriberRefundPolicy: acknowledgeRefundPolicy,
      });
      setSuccess("Услуга в подписке обновлена.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось обновить услугу.");
    }
  }

  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden rounded-[2rem] border border-cyan-300/15 bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.13),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(8,13,18,0.98))] p-5 shadow-2xl shadow-cyan-950/20 md:p-6">
        <div className="pointer-events-none absolute right-6 top-6 h-24 w-24 rounded-full bg-cyan-200/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-200/[0.08] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
              <Sparkles className="h-3.5 w-3.5" />
              Каталог подписок
            </p>
            <h1 className="text-3xl font-semibold md:text-4xl">Подписки компании</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
              Здесь остаётся только аналитика: сколько тарифы приносят сейчас, сколько денег ещё придёт до окончания активных подписок и насколько клиенты используют услуги.
            </p>
          </div>
          {canManage && (
            <Button asChild className="h-12 rounded-2xl px-5">
              <Link href="/company/subscriptions/new">
                <PackagePlus />
                Создать подписку
                <ArrowRight />
              </Link>
            </Button>
          )}
        </div>
      </header>

      {(error || success) && (
        <div className={cn("rounded-2xl border p-4 text-sm", error ? "border-red-300/20 bg-red-400/10 text-red-100" : "border-cyan-300/20 bg-cyan-300/[0.06] text-cyan-50")}>
          {error || success}
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: LineChart, label: "Доход / день", value: formatMoney(summary.dailyRevenue), hint: "По активным подпискам" },
          { icon: WalletCards, label: "Будущий остаток", value: formatMoney(summary.futureRevenue), hint: "До окончания активных подписок" },
          { icon: Users, label: "Клиенты", value: summary.activeSubscribers, hint: "С активными подписками" },
          { icon: Percent, label: "Использование", value: formatPercent(summary.usagePercent), hint: `Погашено ${summary.totalRedemptions} из ${summary.usageCapacity}` },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="glass border-white/10 py-0">
              <CardContent className="p-5">
                <Icon className="h-5 w-5 text-cyan-100" />
                <p className="mt-5 text-xs uppercase tracking-[0.22em] text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-3xl font-semibold">{item.value}</p>
                <p className="mt-2 text-sm text-muted-foreground">{item.hint}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-4 md:p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <BarChart3 className="h-5 w-5 text-cyan-100" />
              Аналитика тарифов
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Переключайте метрику и быстро сравнивайте тарифы между собой.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {metricOptions.map((option) => {
              const Icon = option.icon;
              const active = metricMode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMetricMode(option.value)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition",
                    active ? "border-cyan-200/30 bg-white text-black" : "border-white/10 bg-white/[0.04] text-white/72 hover:border-white/20 hover:text-white",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
        <RevenueChart items={items} mode={metricMode} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {items.map((subscription) => {
          const stats = statsOf(subscription);
          const hasServices = subscription.entitlements.length > 0;
          return (
            <Card
              key={subscription.uuid}
              className={cn(
                "group overflow-hidden border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))] py-0 transition hover:border-cyan-200/25",
                !hasServices && "border-amber-300/30 bg-[linear-gradient(135deg,rgba(251,191,36,0.11),rgba(255,255,255,0.015))]",
              )}
            >
              <CardContent className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-200/[0.08] text-cyan-100 shadow-lg shadow-cyan-950/20">
                      <Ticket className="h-6 w-6" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-xl font-semibold">{subscription.name}</h3>
                        {!subscription.isActive && <Badge variant="destructive">Выключена</Badge>}
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">{subscription.description}</p>
                    </div>
                  </div>
                  {canManage && (
                    <Button variant="secondary" className="h-10 rounded-xl" onClick={() => setEditingUuid(subscription.uuid)}>
                      <Edit3 />
                      Редактировать
                    </Button>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Badge className="bg-white text-black">{formatMoney(subscription.price)}</Badge>
                  <Badge variant="outline">{formatRenewal(subscription.renewalPeriod)}</Badge>
                  {hasServices ? (
                    <Badge variant="outline">{subscription.entitlements.length} услуг</Badge>
                  ) : (
                    <Badge className="border border-amber-300/25 bg-amber-300/[0.12] text-amber-50">Требуется услуга</Badge>
                  )}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ["Сейчас / день", formatMoney(stats.dailyRevenue)],
                    ["Будущее", formatMoney(stats.futureRevenue)],
                    ["Клиенты", stats.activeSubscribers],
                    ["Использование", formatPercent(stats.usagePercent)],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                      <p className="mt-2 text-xl font-semibold">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <ListChecks className="h-4 w-4 text-cyan-100" />
                      Услуги в подписке
                    </p>
                    <span className="text-xs text-muted-foreground">{stats.totalRedemptions} погашений</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-cyan-200 via-white to-emerald-200" style={{ width: hasServices ? `${Math.max(3, stats.usagePercent)}%` : "0%" }} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {subscription.entitlements.slice(0, 4).map((benefit) => (
                      <span key={benefit.uuid} className="inline-flex items-center gap-2 rounded-full border border-cyan-300/15 bg-cyan-300/[0.06] px-3 py-1.5 text-xs font-medium text-cyan-50">
                        {benefit.windowUnit === "UNLIMITED" ? <InfinityIcon className="h-3.5 w-3.5" /> : <Gift className="h-3.5 w-3.5" />}
                        {benefit.title}
                      </span>
                    ))}
                    {subscription.entitlements.length > 4 && <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-muted-foreground">+{subscription.entitlements.length - 4} ещё</span>}
                    {!hasServices && canManage && (
                      <button
                        type="button"
                        onClick={() => setEditingUuid(subscription.uuid)}
                        className="rounded-full border border-amber-300/25 bg-amber-300/[0.1] px-3 py-1.5 text-left text-xs font-medium text-amber-50 transition hover:border-amber-200/50 hover:bg-amber-300/[0.16]"
                      >
                        Подписка недоступна для продажи: добавьте хотя бы одну услугу
                      </button>
                    )}
                    {!hasServices && !canManage && (
                      <span className="rounded-full border border-amber-300/25 bg-amber-300/[0.1] px-3 py-1.5 text-xs font-medium text-amber-50">
                        Подписка недоступна для продажи: нужна хотя бы одна услуга
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {items.length === 0 && (
        <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
          <ReceiptText className="mx-auto h-10 w-10 text-cyan-100" />
          <h2 className="mt-4 text-2xl font-semibold">Подписок пока нет</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Создайте первый тариф, а потом добавьте услуги: ежедневный кофе, недельный десерт, безлимитный вход или любой другой понятный лимит.</p>
          {canManage && (
            <Button asChild className="mt-5 h-12 rounded-2xl px-5">
              <Link href="/company/subscriptions/new">
                <PackagePlus />
                Создать подписку
              </Link>
            </Button>
          )}
        </div>
      )}

      <Dialog open={Boolean(editingSubscription)} onOpenChange={(open) => !open && setEditingUuid("")}>
        <DialogContent className="whitebox-scrollbar max-h-[92vh] max-w-6xl overflow-y-auto rounded-[2rem] border-cyan-300/15 bg-[#070b10] p-0" showClose>
          {editingSubscription && (
            <div>
              <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.12),transparent_34%),rgba(255,255,255,0.035)] p-5 md:p-6">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3 text-2xl">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-200/[0.08] text-cyan-100">
                      <Edit3 className="h-5 w-5" />
                    </span>
                    Редактирование подписки
                  </DialogTitle>
                  <DialogDescription>Меняйте тариф и услуги осторожно: если у клиентов уже есть активные покупки, им нужно оставить понятное право отказаться и вернуть оставшуюся стоимость.</DialogDescription>
                </DialogHeader>
              </div>

              <div className="space-y-5 p-5 md:p-6">
                <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                  <h3 className="mb-4 flex items-center gap-2 font-semibold">
                    <Ticket className="h-4 w-4 text-cyan-100" />
                    Основные условия
                  </h3>
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_160px_130px_220px]">
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Название</span>
                      <Input value={planEdit.name} onChange={(event) => setPlanEdit((current) => ({ ...current, name: event.target.value }))} className="h-12 rounded-xl" />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Цена, ₽</span>
                      <Input type="number" min={MIN_SUBSCRIPTION_PRICE_RUB} value={planEdit.price} onChange={(event) => setPlanEdit((current) => ({ ...current, price: event.target.value }))} className="h-12 rounded-xl" />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Срок</span>
                      <Input type="number" min={1} value={planEdit.renewalValue} onChange={(event) => setPlanEdit((current) => ({ ...current, renewalValue: event.target.value }))} className="h-12 rounded-xl text-center" />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium">Период</span>
                      <OptionSelect value={planEdit.renewalUnit} onChange={(value) => setPlanEdit((current) => ({ ...current, renewalUnit: value as RenewalUnit }))} options={renewalOptions} placeholder="Период" />
                    </label>
                  </div>
                  <label className="mt-3 block space-y-2">
                    <span className="text-sm font-medium">Описание</span>
                    <Textarea value={planEdit.description} onChange={(event) => setPlanEdit((current) => ({ ...current, description: event.target.value }))} className="min-h-28 rounded-xl" />
                  </label>
                </section>

                <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="flex items-center gap-2 font-semibold">
                        <ListChecks className="h-4 w-4 text-cyan-100" />
                        Услуги и лимиты
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">То, что касса сможет погашать у клиента по этой подписке.</p>
                    </div>
                    <Badge variant="outline">{editingSubscription.entitlements.length} услуг</Badge>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    {editingSubscription.entitlements.map((benefit) => {
                      const draft = benefitDrafts[benefit.uuid];
                      if (!draft) return null;
                      return (
                        <div key={benefit.uuid} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="flex items-center gap-2 font-semibold">
                              {draft.windowUnit === "UNLIMITED" ? <InfinityIcon className="h-4 w-4 text-cyan-100" /> : <Gift className="h-4 w-4 text-cyan-100" />}
                              {benefit.title}
                            </p>
                            <Badge variant={draft.isActive ? "outline" : "destructive"}>{draft.isActive ? "Активна" : "Выключена"}</Badge>
                          </div>
                          <div className="grid gap-3 md:grid-cols-2">
                            <label className="space-y-2">
                              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Услуга</span>
                              <Input value={draft.title} onChange={(event) => setBenefitDrafts((current) => ({ ...current, [benefit.uuid]: { ...draft, title: event.target.value } }))} className="h-11 rounded-xl" />
                            </label>
                            <label className="space-y-2">
                              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Период лимита</span>
                              <OptionSelect value={draft.windowUnit} onChange={(value) => setBenefitDrafts((current) => ({ ...current, [benefit.uuid]: { ...draft, windowUnit: value as EntitlementWindow } }))} options={periodOptions} placeholder="Период" />
                            </label>
                          </div>
                          <Textarea value={draft.description} onChange={(event) => setBenefitDrafts((current) => ({ ...current, [benefit.uuid]: { ...draft, description: event.target.value } }))} placeholder="Описание услуги" className="mt-3 min-h-20 rounded-xl" />
                          {draft.windowUnit !== "UNLIMITED" ? (
                            <div className="mt-3 grid grid-cols-2 gap-3">
                              <label className="space-y-2">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Сколько раз</span>
                                <Input aria-label="Сколько раз можно использовать услугу" type="number" min={1} value={draft.allowance} onChange={(event) => setBenefitDrafts((current) => ({ ...current, [benefit.uuid]: { ...draft, allowance: event.target.value } }))} className="h-11 rounded-xl text-center" />
                              </label>
                              <label className="space-y-2">
                                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">За периодов</span>
                                <Input aria-label="За сколько периодов действует лимит" type="number" min={1} value={draft.windowValue} onChange={(event) => setBenefitDrafts((current) => ({ ...current, [benefit.uuid]: { ...draft, windowValue: event.target.value } }))} className="h-11 rounded-xl text-center" />
                              </label>
                            </div>
                          ) : (
                            <div className="mt-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] p-3 text-sm text-cyan-50">Клиент может пользоваться услугой без ограничения по количеству. Каждое погашение фиксируется в истории.</div>
                          )}
                          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <button
                              type="button"
                              onClick={() => setBenefitDrafts((current) => ({ ...current, [benefit.uuid]: { ...draft, isActive: !draft.isActive } }))}
                              className={cn("rounded-xl border px-4 py-2 text-sm font-semibold transition", draft.isActive ? "border-cyan-200/20 bg-cyan-300/[0.08] text-cyan-50" : "border-white/10 bg-white/[0.03] text-muted-foreground")}
                            >
                              {draft.isActive ? "Услуга активна" : "Услуга выключена"}
                            </button>
                            <Button onClick={() => void saveBenefit(editingSubscription.uuid, benefit.uuid)} disabled={!acknowledgeRefundPolicy || !draft.title.trim()} className="h-10 rounded-xl">
                              <Save />
                              Сохранить услугу
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="rounded-3xl border border-cyan-300/15 bg-[linear-gradient(135deg,rgba(6,182,212,0.07),rgba(255,255,255,0.015))] p-4">
                  <h3 className="flex items-center gap-2 text-lg font-semibold">
                    <Plus className="h-4 w-4 text-cyan-100" />
                    Добавить услугу в подписку
                  </h3>
                  <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="space-y-3">
                      <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Например, Капучино 350 мл" className="h-12 rounded-xl" />
                      <Textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Что получает клиент и где это можно погасить" className="min-h-24 rounded-xl" />
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <OptionSelect value={form.windowUnit} onChange={(value) => setForm((current) => ({ ...current, windowUnit: value as EntitlementWindow }))} options={periodOptions} placeholder="Выберите период" />
                      {form.windowUnit !== "UNLIMITED" ? (
                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <label className="space-y-2">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Сколько раз</span>
                            <Input aria-label="Сколько раз можно использовать услугу" type="number" min={1} value={form.allowance} onChange={(event) => setForm((current) => ({ ...current, allowance: event.target.value }))} className="h-12 rounded-xl text-center" />
                          </label>
                          <label className="space-y-2">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">За периодов</span>
                            <Input aria-label="За сколько периодов действует лимит" type="number" min={1} value={form.windowValue} onChange={(event) => setForm((current) => ({ ...current, windowValue: event.target.value }))} className="h-12 rounded-xl text-center" />
                          </label>
                        </div>
                      ) : (
                        <p className="mt-4 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] p-3 text-sm text-cyan-50">Безлимит: подходит для доступа в зал, клуб, коворкинг или закрытое пространство.</p>
                      )}
                    </div>
                  </div>
                  <Button onClick={() => void createRule()} disabled={!editingSubscription || !form.title.trim()} className="mt-4 h-12 rounded-xl px-6">
                    <CheckCircle2 />
                    Добавить услугу
                  </Button>
                </section>

                <section className="rounded-3xl border border-amber-300/25 bg-amber-300/[0.07] p-4 text-amber-50">
                  <div className="flex gap-3">
                    <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <h3 className="font-semibold">Перед сохранением подтвердите риск</h3>
                      <p className="mt-1 text-sm leading-6 text-amber-50/80">Если условия подписки меняются после покупки, пользователь должен иметь возможность отказаться от тарифа и вернуть оставшуюся стоимость. Это защищает компанию и клиента от спорных ситуаций.</p>
                      <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl border border-amber-200/20 bg-black/20 p-3 text-sm font-semibold">
                        <input type="checkbox" checked={acknowledgeRefundPolicy} onChange={(event) => setAcknowledgeRefundPolicy(event.target.checked)} className="mt-1 h-4 w-4 accent-cyan-200" />
                        Я понимаю риск и подтверждаю, что клиентам будет доступно право отказа и возврата остатка.
                      </label>
                    </div>
                  </div>
                </section>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <Button variant="outline" onClick={() => setEditingUuid("")} className="h-12 rounded-xl">
                    Закрыть
                  </Button>
                  <Button onClick={() => void saveSelectedPlan()} disabled={!acknowledgeRefundPolicy || !planEdit.name.trim() || Number(planEdit.price) < MIN_SUBSCRIPTION_PRICE_RUB} className="h-12 rounded-xl px-6">
                    <Save />
                    Сохранить подписку
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
