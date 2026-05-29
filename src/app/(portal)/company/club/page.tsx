"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  Coffee,
  Handshake,
  Infinity,
  Loader2,
  MessagesSquare,
  Sparkles,
  Store,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { Textarea } from "@/components/ui/textarea";
import {
  approveCompanyClubBundle,
  companyClub,
  createCompanyClubBundle,
  rejectCompanyClubBundle,
  type CompanyClubBundle,
  type CompanyClubData,
  type EntitlementWindow,
} from "@/lib/api/company-client";
import { cn } from "@/lib/utils";

const windowOptions: Array<{ value: EntitlementWindow; label: string; hint: string }> = [
  { value: "DAY", label: "Каждый день", hint: "Новый лимит каждый день" },
  { value: "WEEK", label: "Каждую неделю", hint: "Подходит для регулярных услуг" },
  { value: "MONTH", label: "Каждый месяц", hint: "Для месячных пакетов" },
  { value: "TERM", label: "За срок подписки", hint: "Лимит на весь период" },
  { value: "UNLIMITED", label: "Без лимита", hint: "Фитнес, коворкинг, вход в клуб" },
];

const sharePresets = [
  { my: 50, partner: 50, label: "50 / 50" },
  { my: 60, partner: 40, label: "60 / 40" },
  { my: 40, partner: 60, label: "40 / 60" },
  { my: 70, partner: 30, label: "70 / 30" },
];

type ClubForm = {
  name: string;
  description: string;
  price: string;
  partnerCompanyId: string;
  renewalValue: string;
  renewalUnit: "week" | "month" | "year";
  myBenefitTitle: string;
  myBenefitDescription: string;
  myFulfillmentNote: string;
  myRevenueSharePercent: string;
  myAllowance: string;
  myWindowValue: string;
  myWindowUnit: EntitlementWindow;
  partnerBenefitTitle: string;
  partnerBenefitDescription: string;
  partnerFulfillmentNote: string;
  partnerRevenueSharePercent: string;
  partnerAllowance: string;
  partnerWindowValue: string;
  partnerWindowUnit: EntitlementWindow;
};

const defaultForm: ClubForm = {
  name: "Кофе + фитнес после работы",
  description:
    "Совместная подписка для клиентов, которые хотят каждый день получать бодрящий напиток и свободно посещать фитнес-клуб.",
  price: "3490",
  partnerCompanyId: "",
  renewalValue: "1",
  renewalUnit: "month",
  myBenefitTitle: "Тонизирующий напиток каждый день",
  myBenefitDescription: "Один напиток до 350 мл каждый день в точке компании.",
  myFulfillmentNote: "Погашается на кассе компании, которая выдаёт напиток.",
  myRevenueSharePercent: "40",
  myAllowance: "1",
  myWindowValue: "1",
  myWindowUnit: "DAY",
  partnerBenefitTitle: "Безлимитный проход в фитнес-клуб",
  partnerBenefitDescription: "Клиент может заходить в зал без ограничения по количеству проходов.",
  partnerFulfillmentNote: "Погашается на ресепшене фитнес-клуба.",
  partnerRevenueSharePercent: "60",
  partnerAllowance: "1",
  partnerWindowValue: "1",
  partnerWindowUnit: "UNLIMITED",
};

function percent(value: number) {
  return `${Number.isFinite(value) ? value : 0}%`;
}

function normalizeRevenueShare(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(1, Math.min(99, Math.round(parsed)));
}

function windowLabel(unit: EntitlementWindow, allowance: number, value: number) {
  if (unit === "UNLIMITED") return "без лимита использований";
  const option = windowOptions.find((item) => item.value === unit);
  return `${allowance} шт. · ${option?.label.toLowerCase() ?? unit.toLowerCase()}${value > 1 ? ` / ${value}` : ""}`;
}

function statusLabel(bundle: CompanyClubBundle) {
  if (bundle.status === "ACTIVE") return "Активна";
  if (bundle.status === "ARCHIVED") return "Отклонена";
  return "Ожидает подтверждения";
}

function BundleCard({
  bundle,
  currentCompanyId,
  onApprove,
  onReject,
  busy,
}: {
  bundle: CompanyClubBundle;
  currentCompanyId: number;
  onApprove?: (uuid: string) => void;
  onReject?: (uuid: string) => void;
  busy?: boolean;
}) {
  const currentParticipant = bundle.participants.find((participant) => participant.companyId === currentCompanyId);
  const partner = bundle.participants.find((participant) => participant.companyId !== currentCompanyId);
  const canAnswer = currentParticipant?.approvalStatus === "PENDING" && bundle.status === "DRAFT";

  return (
    <Card className="overflow-hidden border-white/10 bg-white/[0.025] py-0">
      <div className="h-1 bg-gradient-to-r from-cyan-300 via-white to-emerald-300" />
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant={bundle.status === "ACTIVE" ? "default" : "outline"}>{statusLabel(bundle)}</Badge>
              <Badge variant="secondary">{bundle.renewalPeriod}</Badge>
              <Badge variant="outline">{bundle.price.toLocaleString("ru-RU")} ₽</Badge>
            </div>
            <h3 className="text-xl font-semibold">{bundle.name}</h3>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{bundle.description}</p>
          </div>
          {bundle.status === "ACTIVE" && (
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] px-4 py-3 text-sm text-emerald-100">
              <BadgeCheck className="mr-2 inline h-4 w-4" />
              Видна клиентам обеих компаний
            </div>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {bundle.participants.map((participant) => (
            <div
              key={participant.uuid}
              className={cn(
                "rounded-2xl border p-4",
                participant.companyId === currentCompanyId
                  ? "border-cyan-300/30 bg-cyan-300/[0.055]"
                  : "border-white/10 bg-white/[0.025]",
              )}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">
                    {participant.companyId === currentCompanyId ? "Ваша компания" : "Партнёр"}
                  </p>
                  <p className="font-semibold">{participant.company.name}</p>
                </div>
                <Badge variant="outline">{percent(participant.revenueSharePercent)} дохода</Badge>
              </div>
              <p className="font-semibold">{participant.benefitTitle}</p>
              <p className="mt-1 text-sm text-muted-foreground">{participant.benefitDescription}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">
                  {participant.windowUnit === "UNLIMITED" ? <Infinity /> : <Sparkles />}
                  {windowLabel(participant.windowUnit, participant.allowance, participant.windowValue)}
                </Badge>
                <Badge variant="outline">{participant.approvalStatus === "APPROVED" ? "Подтверждено" : participant.approvalStatus === "REJECTED" ? "Отклонено" : "Ждёт ответа"}</Badge>
              </div>
            </div>
          ))}
        </div>

        {canAnswer && (
          <div className="flex flex-col gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Партнёр предлагает совместную подписку</p>
              <p className="text-sm text-muted-foreground">
                После подтверждения она станет активной и появится у клиентов обеих компаний.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" disabled={busy} onClick={() => onReject?.(bundle.uuid)} className="rounded-xl">
                <X /> Отклонить
              </Button>
              <Button disabled={busy} onClick={() => onApprove?.(bundle.uuid)} className="rounded-xl">
                <Check /> Подтвердить
              </Button>
            </div>
          </div>
        )}

        {partner && currentParticipant && (
          <p className="text-xs text-muted-foreground">
            Правило безопасности: {currentParticipant.company.name} может гасить только своё преимущество “{currentParticipant.benefitTitle}”,
            а {partner.company.name} — только “{partner.benefitTitle}”.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function CompanyClubPage() {
  const [data, setData] = useState<CompanyClubData | null>(null);
  const [form, setForm] = useState<ClubForm>(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedPartner = useMemo(
    () => data?.companies.find((company) => String(company.id) === form.partnerCompanyId) ?? null,
    [data?.companies, form.partnerCompanyId],
  );
  const shareTotal = Number(form.myRevenueSharePercent) + Number(form.partnerRevenueSharePercent);
  const canSave =
    Boolean(form.partnerCompanyId) &&
    form.name.trim().length >= 2 &&
    form.description.trim().length >= 10 &&
    Number(form.price) > 0 &&
    Math.round(shareTotal * 100) === 10000;

  async function load() {
    setLoading(true);
    const next = await companyClub();
    setData(next);
    if (!form.partnerCompanyId && next.companies[0]) {
      setForm((current) => ({ ...current, partnerCompanyId: String(next.companies[0].id) }));
    }
    setLoading(false);
  }

  useEffect(() => {
    void load().catch((reason) => {
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить клуб партнёров.");
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setField<K extends keyof ClubForm>(key: K, value: ClubForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function benefitValue(prefix: "my" | "partner", field: string) {
    return form[`${prefix}${field}` as keyof ClubForm];
  }

  function setBenefitValue(prefix: "my" | "partner", field: string, value: string) {
    setForm((current) => ({ ...current, [`${prefix}${field}`]: value }));
  }

  function setRevenueShare(prefix: "my" | "partner", value: string) {
    const normalized = normalizeRevenueShare(value);
    if (normalized === null) {
      setForm((current) => ({
        ...current,
        myRevenueSharePercent: "",
        partnerRevenueSharePercent: "",
      }));
      return;
    }

    const pairedShare = 100 - normalized;
    setForm((current) =>
      prefix === "my"
        ? {
            ...current,
            myRevenueSharePercent: String(normalized),
            partnerRevenueSharePercent: String(pairedShare),
          }
        : {
            ...current,
            myRevenueSharePercent: String(pairedShare),
            partnerRevenueSharePercent: String(normalized),
          },
    );
  }

  function applySharePreset(my: number, partner: number) {
    setForm((current) => ({
      ...current,
      myRevenueSharePercent: String(my),
      partnerRevenueSharePercent: String(partner),
    }));
  }

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await createCompanyClubBundle({
        name: form.name,
        description: form.description,
        price: Number(form.price),
        partnerCompanyId: Number(form.partnerCompanyId),
        renewalValue: Number(form.renewalValue) || 1,
        renewalUnit: form.renewalUnit,
        myBenefitTitle: form.myBenefitTitle,
        myBenefitDescription: form.myBenefitDescription,
        myFulfillmentNote: form.myFulfillmentNote,
        myRevenueSharePercent: Number(form.myRevenueSharePercent),
        myAllowance: Number(form.myAllowance) || 1,
        myWindowValue: Number(form.myWindowValue) || 1,
        myWindowUnit: form.myWindowUnit,
        partnerBenefitTitle: form.partnerBenefitTitle,
        partnerBenefitDescription: form.partnerBenefitDescription,
        partnerFulfillmentNote: form.partnerFulfillmentNote,
        partnerRevenueSharePercent: Number(form.partnerRevenueSharePercent),
        partnerAllowance: Number(form.partnerAllowance) || 1,
        partnerWindowValue: Number(form.partnerWindowValue) || 1,
        partnerWindowUnit: form.partnerWindowUnit,
      });
      setNotice("Предложение отправлено партнёру. Подписка станет активной после второго подтверждения.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось создать совместную подписку.");
    } finally {
      setSaving(false);
    }
  }

  async function answer(uuid: string, approve: boolean) {
    setActionBusy(uuid);
    setError(null);
    setNotice(null);
    try {
      if (approve) {
        await approveCompanyClubBundle(uuid);
        setNotice("Коллаборация подтверждена. Если все участники согласились, подписка уже активна.");
      } else {
        await rejectCompanyClubBundle(uuid);
        setNotice("Предложение отклонено и скрыто из продажи.");
      }
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не удалось обработать предложение.");
    } finally {
      setActionBusy(null);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex min-h-[420px] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Загружаю клуб партнёров...
      </div>
    );
  }

  const activeBundles = data?.active ?? [];
  const incomingBundles = data?.incoming ?? [];
  const allBundles = data?.bundles ?? [];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-cyan-300/20 bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.16),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6">
        <div className="absolute right-8 top-8 hidden h-28 w-28 rounded-full border border-cyan-200/20 bg-cyan-300/[0.04] blur-sm md:block" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <Badge variant="outline" className="mb-4 border-cyan-200/30 bg-cyan-300/[0.08] text-cyan-100">
              <Handshake /> ENTREPRENEUR CLUB
            </Badge>
            <h1 className="text-3xl font-semibold md:text-4xl">Клуб предпринимателей WhiteBox</h1>
            <p className="mt-3 text-muted-foreground">
              Место, где компании договариваются о совместных продуктах: кофе + фитнес, барбер + одежда,
              книги + образование. Клиент покупает одну подписку, а каждая компания гасит только своё преимущество.
            </p>
          </div>
          <div className="grid min-w-[260px] gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-2xl font-semibold">{data?.companies.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">партнёров доступно</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-2xl font-semibold">{activeBundles.length}</p>
              <p className="text-xs text-muted-foreground">активных коллабораций</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-2xl font-semibold">{incomingBundles.length}</p>
              <p className="text-xs text-muted-foreground">ждут ответа</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            icon: MessagesSquare,
            title: "Контакты и доверие",
            text: "Партнёры видят проверенные компании и могут запускать совместные предложения без ручной переписки в хаосе.",
          },
          {
            icon: Users,
            title: "Обмен аудиториями",
            text: "Одна подписка аккуратно приводит клиентов в две компании: человек получает больше ценности, бизнес получает новый поток.",
          },
          {
            icon: Store,
            title: "Честное погашение",
            text: "Каждая компания отвечает только за свой блок услуги. Кофейня выдаёт напиток, фитнес гасит проход в клуб.",
          },
        ].map((item) => (
          <Card key={item.title} className="border-white/10 bg-white/[0.025] py-0">
            <CardContent className="p-5">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/[0.08] text-cyan-100">
                <item.icon className="h-5 w-5" />
              </div>
              <h2 className="font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{item.text}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {notice && <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.08] px-5 py-4 text-emerald-100">{notice}</div>}
      {error && <div className="rounded-2xl border border-red-300/25 bg-red-400/[0.08] px-5 py-4 text-red-100">{error}</div>}

      {incomingBundles.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold">Предложения на подтверждение</h2>
            <Badge variant="secondary">{incomingBundles.length}</Badge>
          </div>
          {incomingBundles.map((bundle) => (
            <BundleCard
              key={bundle.uuid}
              bundle={bundle}
              currentCompanyId={data?.company.id ?? 0}
              onApprove={(uuid) => void answer(uuid, true)}
              onReject={(uuid) => void answer(uuid, false)}
              busy={actionBusy === bundle.uuid}
            />
          ))}
        </section>
      )}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
        <Card className="overflow-hidden border-cyan-300/20 bg-cyan-300/[0.035] py-0">
          <div className="h-1 bg-gradient-to-r from-cyan-300 via-white to-emerald-300" />
          <CardContent className="space-y-5 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-2xl font-semibold">
                  <Sparkles className="h-6 w-6 text-cyan-100" />
                  Создать парную подписку
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Вы задаёте свой вклад, партнёр подтверждает свой. Доход делится только после двустороннего согласия.
                </p>
              </div>
              <Badge variant={Math.round(shareTotal * 100) === 10000 ? "default" : "outline"}>
                Распределение: {Number.isFinite(shareTotal) ? shareTotal : 0}%
              </Badge>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <label className="space-y-2">
                <span className="text-sm font-semibold">Название</span>
                <Input value={form.name} onChange={(event) => setField("name", event.target.value)} className="h-12 rounded-xl" maxLength={160} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-semibold">Цена, ₽</span>
                <Input type="number" value={form.price} onChange={(event) => setField("price", event.target.value)} className="h-12 rounded-xl" min={0} />
              </label>
            </div>

            <label className="space-y-2">
              <span className="text-sm font-semibold">Описание для клиента</span>
              <Textarea value={form.description} onChange={(event) => setField("description", event.target.value)} className="min-h-28 rounded-xl" maxLength={1200} />
            </label>

            <div className="grid gap-4 lg:grid-cols-3">
              <label className="space-y-2 lg:col-span-2">
                <span className="text-sm font-semibold">Партнёр</span>
                <SelectField value={form.partnerCompanyId} onChange={(event) => setField("partnerCompanyId", event.target.value)} className="h-12 rounded-xl">
                  <option value="">Выберите компанию</option>
                  {data?.companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </SelectField>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-2">
                  <span className="text-sm font-semibold">Срок</span>
                  <Input type="number" min={1} value={form.renewalValue} onChange={(event) => setField("renewalValue", event.target.value)} className="h-12 rounded-xl" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-semibold">Период</span>
                  <SelectField value={form.renewalUnit} onChange={(event) => setField("renewalUnit", event.target.value as ClubForm["renewalUnit"])} className="h-12 rounded-xl">
                    <option value="week">неделя</option>
                    <option value="month">месяц</option>
                    <option value="year">год</option>
                  </SelectField>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-black/15 p-3">
              {sharePresets.map((preset) => (
                <Button key={preset.label} type="button" variant="outline" size="sm" onClick={() => applySharePreset(preset.my, preset.partner)} className="rounded-xl">
                  {preset.label}
                </Button>
              ))}
              <span className="ml-auto self-center text-xs text-muted-foreground">
                Доли дохода должны суммарно давать 100%. WhiteBox автоматически проверит распределение перед отправкой.
              </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {[
                {
                  title: "Что даёт ваша компания",
                  company: data?.company.name ?? "Ваша компания",
                  prefix: "my" as const,
                  icon: Coffee,
                },
                {
                  title: "Что даёт партнёр",
                  company: selectedPartner?.name ?? "Партнёр",
                  prefix: "partner" as const,
                  icon: Building2,
                },
              ].map((block) => {
                const Icon = block.icon;
                const prefix = block.prefix;
                const windowUnit = benefitValue(prefix, "WindowUnit") as EntitlementWindow;
                return (
                  <div key={block.title} className="rounded-3xl border border-white/10 bg-white/[0.025] p-4">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="flex items-center gap-2 font-semibold">
                          <Icon className="h-5 w-5 text-cyan-100" />
                          {block.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">{block.company}</p>
                      </div>
                      <Badge variant="outline">{benefitValue(prefix, "RevenueSharePercent")}%</Badge>
                    </div>
                    <div className="space-y-3">
                      <Input
                        value={benefitValue(prefix, "BenefitTitle") as string}
                        onChange={(event) => setBenefitValue(prefix, "BenefitTitle", event.target.value)}
                        placeholder="Название преимущества"
                        className="h-11 rounded-xl"
                        maxLength={120}
                      />
                      <Textarea
                        value={benefitValue(prefix, "BenefitDescription") as string}
                        onChange={(event) => setBenefitValue(prefix, "BenefitDescription", event.target.value)}
                        placeholder="Что именно получает клиент"
                        className="min-h-24 rounded-xl"
                        maxLength={800}
                      />
                      <Input
                        value={benefitValue(prefix, "FulfillmentNote") as string}
                        onChange={(event) => setBenefitValue(prefix, "FulfillmentNote", event.target.value)}
                        placeholder="Операционная заметка: где и как гасить"
                        className="h-11 rounded-xl"
                        maxLength={240}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <label className="space-y-1.5">
                          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Доля дохода, %</span>
                          <Input
                            type="number"
                            value={benefitValue(prefix, "RevenueSharePercent") as string}
                            onChange={(event) => setRevenueShare(prefix, event.target.value)}
                            placeholder="Доля дохода, %"
                            className="h-11 rounded-xl"
                            min={1}
                            max={99}
                          />
                        </label>
                        <label className="space-y-1.5">
                          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Период лимита</span>
                          <SelectField
                            value={windowUnit}
                            onChange={(event) => setBenefitValue(prefix, "WindowUnit", event.target.value)}
                            className="h-11 rounded-xl"
                          >
                            {windowOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </SelectField>
                        </label>
                      </div>
                      {windowUnit !== "UNLIMITED" && (
                        <div className="grid grid-cols-2 gap-3">
                          <label className="space-y-1.5">
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Сколько выдаём</span>
                            <Input
                              type="number"
                              value={benefitValue(prefix, "Allowance") as string}
                              onChange={(event) => setBenefitValue(prefix, "Allowance", event.target.value)}
                              placeholder="Количество"
                              className="h-11 rounded-xl"
                              min={1}
                            />
                          </label>
                          <label className="space-y-1.5">
                            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Размер окна</span>
                            <Input
                              type="number"
                              value={benefitValue(prefix, "WindowValue") as string}
                              onChange={(event) => setBenefitValue(prefix, "WindowValue", event.target.value)}
                              placeholder="Период"
                              className="h-11 rounded-xl"
                              min={1}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <Button disabled={!canSave || saving} onClick={() => void submit()} size="lg" className="w-full rounded-2xl">
              {saving ? <Loader2 className="animate-spin" /> : <Handshake />}
              Отправить партнёру на подтверждение
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <aside className="space-y-4">
          <Card className="border-white/10 bg-white/[0.025] py-0">
            <CardContent className="p-5">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold">
                <Users className="h-5 w-5 text-cyan-100" />
                Проверенные партнёры
              </h2>
              <div className="space-y-3">
                {data?.companies.slice(0, 8).map((company) => (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => setField("partnerCompanyId", String(company.id))}
                    className={cn(
                      "w-full rounded-2xl border p-4 text-left transition",
                      form.partnerCompanyId === String(company.id)
                        ? "border-cyan-300/35 bg-cyan-300/[0.08]"
                        : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{company.name}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{company.description || "Описание пока не заполнено"}</p>
                      </div>
                      {company.operatesOnline && <Badge variant="outline">online</Badge>}
                    </div>
                  </button>
                ))}
                {data?.companies.length === 0 && (
                  <p className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-muted-foreground">
                    Пока нет других верифицированных компаний для коллаборации.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </aside>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-semibold">Коллаборации компании</h2>
          <Badge variant="secondary">{allBundles.length}</Badge>
        </div>
        <div className="space-y-3">
          {allBundles.length > 0 ? (
            allBundles.map((bundle) => (
              <BundleCard key={bundle.uuid} bundle={bundle} currentCompanyId={data?.company.id ?? 0} />
            ))
          ) : (
            <Card className="border-dashed border-white/10 bg-white/[0.02] py-0">
              <CardContent className="p-8 text-center text-muted-foreground">
                Совместных подписок пока нет. Создайте первое предложение и проверьте, как партнёр подтвердит его со своей стороны.
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
