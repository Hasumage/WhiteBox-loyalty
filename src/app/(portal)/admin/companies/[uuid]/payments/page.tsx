"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Copy,
  CreditCard,
  ExternalLink,
  Landmark,
  RefreshCcw,
  Search,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  adminGetCompanyPayments,
  type AdminCompanyPaymentsResponse,
  type AdminFinanceOperation,
  type AdminPaymentRow,
} from "@/lib/api/admin-client";
import { cn } from "@/lib/utils";

type DirectionFilter = "ALL" | "INCOMING" | "OUTGOING";

const directionFilters: Array<{ value: DirectionFilter; label: string; icon: typeof WalletCards }> = [
  { value: "ALL", label: "Все движения", icon: WalletCards },
  { value: "INCOMING", label: "Компания нам", icon: ArrowDownLeft },
  { value: "OUTGOING", label: "Мы компании", icon: ArrowUpRight },
];

const paymentPurposeLabels: Record<AdminPaymentRow["purpose"], string> = {
  USER_SUBSCRIPTION: "Подписка пользователя",
  USER_SUBSCRIPTION_BUNDLE: "Пакет подписок",
  COMPANY_NEARLOY_SUBSCRIPTION: "Подписка NearLoy",
};

const operationTypeLabels: Record<AdminFinanceOperation["type"], string> = {
  PAYOUT_REQUEST: "Запрос выплаты",
  PAYOUT_APPROVAL: "Согласование выплаты",
  MANUAL_ADJUSTMENT: "Ручная корректировка",
  REFUND: "Возврат",
};

function formatMoney(amount: string | number, currency = "RUB") {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusTone(status: AdminPaymentRow["status"] | AdminFinanceOperation["status"]) {
  if (status === "SUCCEEDED" || status === "PAID" || status === "APPROVED") {
    return "border-emerald-200/40 bg-emerald-200/10 text-emerald-100";
  }
  if (status === "FAILED" || status === "CANCELED" || status === "REJECTED" || status === "EXPIRED") {
    return "border-red-200/40 bg-red-200/10 text-red-100";
  }
  if (status === "REFUNDED") {
    return "border-amber-200/40 bg-amber-200/10 text-amber-100";
  }
  return "border-cyan-200/40 bg-cyan-200/10 text-cyan-100";
}

function copyText(value: string) {
  return navigator.clipboard?.writeText(value).catch(() => undefined);
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "cyan",
}: {
  icon: typeof WalletCards;
  label: string;
  value: string;
  hint: string;
  tone?: "cyan" | "emerald" | "amber";
}) {
  const glow = tone === "emerald" ? "bg-emerald-300/10" : tone === "amber" ? "bg-amber-300/10" : "bg-cyan-300/10";
  return (
    <Card className="glass relative overflow-hidden border-white/10">
      <div className={cn("absolute -right-10 -top-10 h-28 w-28 rounded-full blur-2xl", glow)} />
      <CardContent className="relative flex items-start justify-between gap-4 p-5">
        <div className="min-w-0 space-y-2">
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
          <p className="truncate text-2xl font-semibold">{value}</p>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-cyan-100">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-center">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

function IncomingPaymentRow({ payment }: { payment: AdminPaymentRow }) {
  const date = payment.paidAt ?? payment.createdAt;
  return (
    <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition hover:bg-white/[0.055] lg:grid-cols-[1.4fr_1fr_0.8fr_0.9fr_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-cyan-200/30 bg-cyan-200/10 text-cyan-100">
            <CreditCard className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold" title={payment.description}>
              {payment.description || paymentPurposeLabels[payment.purpose]}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {payment.plan?.name ?? paymentPurposeLabels[payment.purpose]} · {payment.uuid.slice(0, 8)}
            </p>
          </div>
        </div>
      </div>
      <div className="min-w-0 text-sm">
        <p className="truncate font-medium">{payment.user.name}</p>
        <p className="truncate text-xs text-muted-foreground">{payment.user.email}</p>
      </div>
      <Badge variant="outline" className={cn("w-fit text-xs", statusTone(payment.status))}>
        {payment.status}
      </Badge>
      <div>
        <p className="font-semibold">{formatMoney(payment.amount, payment.currency)}</p>
        <p className="text-xs text-muted-foreground">{formatDate(date)}</p>
      </div>
      <div className="flex items-center gap-2 lg:justify-end">
        {payment.confirmationUrl && (
          <Button asChild variant="secondary" size="sm">
            <a href={payment.confirmationUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => copyText(payment.providerPaymentId ?? payment.uuid)}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function OutgoingOperationRow({ operation }: { operation: AdminFinanceOperation }) {
  const date = operation.processedAt ?? operation.approvedAt ?? operation.requestedAt ?? operation.createdAt;
  return (
    <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition hover:bg-white/[0.055] lg:grid-cols-[1.4fr_1fr_0.8fr_0.9fr_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-emerald-200/30 bg-emerald-200/10 text-emerald-100">
            <Landmark className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold" title={operation.title}>
              {operation.title}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {operationTypeLabels[operation.type]} · {operation.uuid.slice(0, 8)}
            </p>
          </div>
        </div>
      </div>
      <div className="min-w-0 text-sm">
        <p className="truncate font-medium">{operation.requestedBy?.name ?? "Система"}</p>
        <p className="truncate text-xs text-muted-foreground">{operation.approvedBy?.name ? `Одобрил: ${operation.approvedBy.name}` : "Ожидает обработки"}</p>
      </div>
      <Badge variant="outline" className={cn("w-fit text-xs", statusTone(operation.status))}>
        {operation.status}
      </Badge>
      <div>
        <p className="font-semibold">{formatMoney(operation.amount, operation.currency)}</p>
        <p className="text-xs text-muted-foreground">{formatDate(date)}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={() => copyText(operation.uuid)}>
        <Copy className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function AdminCompanyPaymentsPage() {
  const params = useParams<{ uuid: string }>();
  const companyUuid = params.uuid;
  const [data, setData] = useState<AdminCompanyPaymentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState<DirectionFilter>("ALL");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const response = await adminGetCompanyPayments(companyUuid);
    if (response.ok) {
      setData(response.data);
    } else {
      setError(response.message);
    }
    setLoading(false);
  }, [companyUuid]);

  useEffect(() => {
    void load();
  }, [load]);

  const normalizedQuery = query.trim().toLowerCase();
  const incomingPayments = useMemo(() => {
    if (!data) return [];
    if (!normalizedQuery) return data.incomingPayments;
    return data.incomingPayments.filter((payment) =>
      [
        payment.uuid,
        payment.providerPaymentId,
        payment.description,
        payment.status,
        payment.user.name,
        payment.user.email,
        payment.plan?.name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    );
  }, [data, normalizedQuery]);
  const outgoingOperations = useMemo(() => {
    if (!data) return [];
    if (!normalizedQuery) return data.outgoingOperations;
    return data.outgoingOperations.filter((operation) =>
      [
        operation.uuid,
        operation.title,
        operation.details,
        operation.status,
        operation.type,
        operation.requestedBy?.name,
        operation.requestedBy?.email,
        operation.approvedBy?.name,
        operation.approvedBy?.email,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery)),
    );
  }, [data, normalizedQuery]);

  const showIncoming = direction === "ALL" || direction === "INCOMING";
  const showOutgoing = direction === "ALL" || direction === "OUTGOING";

  if (loading && !data) {
    return <p className="text-sm text-muted-foreground">Загружаю платежи компании...</p>;
  }

  if (error && !data) {
    return (
      <Card className="glass border-destructive/30">
        <CardContent className="space-y-4 py-6">
          <p className="font-semibold text-destructive">Не удалось загрузить платежи</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void load()}>
              <RefreshCcw className="h-4 w-4" />
              Повторить
            </Button>
            <Button asChild variant="ghost">
              <Link href={`/admin/companies/${companyUuid}`}>
                <ArrowLeft className="h-4 w-4" />
                Назад к компании
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
            <Link href={`/admin/companies/${companyUuid}`}>
              <ArrowLeft className="h-4 w-4" />
              Назад к компании
            </Link>
          </Button>
          <div className="space-y-2">
            <Badge variant="outline" className="gap-2 border-cyan-200/40 bg-cyan-200/10 px-3 py-1 text-cyan-100">
              <WalletCards className="h-3.5 w-3.5" />
              Платежи компании
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">{data.company.profile.name}</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Все деньги по компании в одном месте: что компания и её клиенты оплатили нам, и какие выплаты или корректировки ушли обратно компании.
            </p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => void load()} disabled={loading}>
          <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
          Обновить
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={ArrowDownLeft} label="Нам оплатили" value={formatMoney(data.summary.incomingSucceededAmount)} hint={`${data.summary.incomingCount} входящих платежей`} tone="cyan" />
        <StatCard icon={ArrowUpRight} label="Мы выплатили" value={formatMoney(data.summary.outgoingPaidAmount)} hint={`${data.summary.outgoingCount} исходящих операций`} tone="emerald" />
        <StatCard icon={Landmark} label="Ожидает выплаты" value={formatMoney(data.summary.outgoingPendingAmount)} hint="Черновики, запросы и одобрено" tone="amber" />
        <StatCard icon={Building2} label="Чистый поток" value={formatMoney(data.summary.netAmount)} hint={data.company.owner.email} tone="cyan" />
      </div>

      <Card className="glass border-white/10">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Search className="h-5 w-5 text-cyan-100" />
                Финансовый журнал
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Поиск работает по uuid, email, статусам, описанию, провайдеру и названию операции.</p>
            </div>
            <Badge variant="outline" className="border-white/10 text-xs">
              {incomingPayments.length + outgoingOperations.length} найдено
            </Badge>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по uuid, email, описанию, статусу"
              className="h-11 flex-1"
            />
            <div className="flex flex-wrap gap-2">
              {directionFilters.map((item) => {
                const Icon = item.icon;
                const active = direction === item.value;
                return (
                  <Button
                    key={item.value}
                    type="button"
                    variant={active ? "default" : "secondary"}
                    className={cn("gap-2 rounded-2xl", active && "border border-cyan-200/40 bg-cyan-200/15 text-cyan-50")}
                    onClick={() => setDirection(item.value)}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {showIncoming && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">Компания заплатила нам</h2>
                  <p className="text-sm text-muted-foreground">ЮKassa, подписки, пакеты и billing-платежи NearLoy.</p>
                </div>
                <Badge variant="outline">{incomingPayments.length}</Badge>
              </div>
              {incomingPayments.length > 0 ? (
                <div className="space-y-3">
                  {incomingPayments.map((payment) => (
                    <IncomingPaymentRow key={payment.uuid} payment={payment} />
                  ))}
                </div>
              ) : (
                <EmptyState title="Входящих платежей нет" hint="Попробуйте очистить поиск или проверить платежи позже." />
              )}
            </section>
          )}

          {showOutgoing && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">Мы платим компании</h2>
                  <p className="text-sm text-muted-foreground">Запросы выплат, возвраты и ручные финансовые корректировки.</p>
                </div>
                <Badge variant="outline">{outgoingOperations.length}</Badge>
              </div>
              {outgoingOperations.length > 0 ? (
                <div className="space-y-3">
                  {outgoingOperations.map((operation) => (
                    <OutgoingOperationRow key={operation.uuid} operation={operation} />
                  ))}
                </div>
              ) : (
                <EmptyState title="Исходящих операций нет" hint="Для этой компании пока нет выплат или корректировок." />
              )}
            </section>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
