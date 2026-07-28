"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Landmark,
  Phone,
  RefreshCcw,
  Save,
  Send,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchWithAuthRecovery } from "@/lib/api/authenticated-fetch";
import { cn } from "@/lib/utils";

const PR_PAYOUT_BANKS = [
  { code: "sber", name: "Сбербанк" },
  { code: "tbank", name: "Т-Банк" },
  { code: "vtb", name: "ВТБ" },
  { code: "alfabank", name: "Альфа-Банк" },
  { code: "gazprombank", name: "Газпромбанк" },
] as const;

type PrPayoutDashboard = {
  code: string;
  minPayoutRub: number;
  requisites: {
    bankCode: string | null;
    bankName: string | null;
    phone: string | null;
    cardLast4: string | null;
    cardMasked: string | null;
    updatedAt: string | null;
    configured: boolean;
  };
  totals: {
    companies: number;
    activeCompanies: number;
    recognizedGross: number;
    referralCommission: number;
    reserved: number;
    paid: number;
    available: number;
  };
  payouts: Array<{
    uuid: string;
    amount: number;
    status: string;
    createdAt: string;
  }>;
};

type RequisitesDraft = {
  bankCode: string;
  phone: string;
  cardNumber: string;
};

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

function date(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusTone(status: string) {
  if (status === "PAID") return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
  if (status === "PENDING_APPROVAL" || status === "APPROVED") return "border-amber-300/25 bg-amber-300/10 text-amber-100";
  if (status === "REJECTED" || status === "CANCELED") return "border-red-300/25 bg-red-300/10 text-red-100";
  return "border-white/10 bg-white/[0.04] text-muted-foreground";
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function formatPrPayoutPhone(value: string) {
  let digits = digitsOnly(value);
  if (!digits) return "";
  if (digits.startsWith("8")) {
    digits = `7${digits.slice(1)}`;
  } else if (!digits.startsWith("7")) {
    digits = `7${digits}`;
  }

  const local = digits.slice(1, 11);
  let result = "+7";
  if (local.length > 0) result += ` ${local.slice(0, 3)}`;
  if (local.length > 3) result += ` ${local.slice(3, 6)}`;
  if (local.length > 6) result += `-${local.slice(6, 8)}`;
  if (local.length > 8) result += `-${local.slice(8, 10)}`;
  return result;
}

function formatPrPayoutCard(value: string) {
  return digitsOnly(value)
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, "$1 ");
}

function requisitesDraftFromDashboard(dashboard: PrPayoutDashboard): RequisitesDraft {
  return {
    bankCode: dashboard.requisites.bankCode ?? PR_PAYOUT_BANKS[0].code,
    phone: dashboard.requisites.phone?.includes("*") ? "" : formatPrPayoutPhone(dashboard.requisites.phone ?? ""),
    cardNumber: "",
  };
}

export default function AdminPrPayoutsPage() {
  const [dashboard, setDashboard] = useState<PrPayoutDashboard | null>(null);
  const [amount, setAmount] = useState("");
  const [requisitesDraft, setRequisitesDraft] = useState<RequisitesDraft>({
    bankCode: PR_PAYOUT_BANKS[0].code,
    phone: "",
    cardNumber: "",
  });
  const [loading, setLoading] = useState(true);
  const [savingRequisites, setSavingRequisites] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const response = await fetchWithAuthRecovery("/api/admin/pr/payouts", { cache: "no-store" });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.message ?? "Не удалось загрузить PR-выплаты.");
      setDashboard(null);
      setLoading(false);
      return;
    }

    const data = (await response.json()) as PrPayoutDashboard;
    setDashboard(data);
    setRequisitesDraft(requisitesDraftFromDashboard(data));
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const amountNumber = Number(amount);
  const canCreate = useMemo(() => {
    if (!dashboard?.requisites.configured) return false;
    return Number.isFinite(amountNumber) && amountNumber >= dashboard.minPayoutRub && amountNumber <= dashboard.totals.available;
  }, [amountNumber, dashboard]);

  async function saveRequisites() {
    setSavingRequisites(true);
    setError("");
    setNotice("");
    const response = await fetchWithAuthRecovery("/api/admin/pr/payouts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...requisitesDraft,
        phone: digitsOnly(requisitesDraft.phone),
        cardNumber: digitsOnly(requisitesDraft.cardNumber),
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.message ?? "Не удалось сохранить реквизиты.");
      setSavingRequisites(false);
      return;
    }

    const data = (await response.json()) as PrPayoutDashboard;
    setDashboard(data);
    setRequisitesDraft(requisitesDraftFromDashboard(data));
    setNotice("Реквизиты для выплат сохранены.");
    setSavingRequisites(false);
  }

  async function createPayout() {
    if (!canCreate) return;
    setCreating(true);
    setError("");
    setNotice("");
    const response = await fetchWithAuthRecovery("/api/admin/pr/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amountNumber }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.message ?? "Не удалось создать заявку.");
      setCreating(false);
      return;
    }

    const data = (await response.json()) as { dashboard: PrPayoutDashboard };
    setDashboard(data.dashboard);
    setAmount("");
    setNotice("Заявка на выплату создана. Супер-админы получат уведомление в Telegram.");
    setCreating(false);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] border border-cyan-200/15 bg-[radial-gradient(circle_at_12%_0%,rgba(103,232,249,0.12),transparent_34%),rgba(255,255,255,0.035)] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-100">
              <WalletCards className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">PR-выплаты</h1>
              <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                Создавайте заявки только в пределах доступного PR-баланса. Финальное закрытие делает админ.
              </p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            Обновить
          </Button>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-300/25 bg-red-300/10 p-4 text-sm text-red-100">{error}</div>}
      {notice && <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-100">{notice}</div>}

      {loading && !dashboard ? (
        <Card className="border-white/10 bg-white/[0.035] p-6 text-muted-foreground">Загружаю выплаты...</Card>
      ) : dashboard ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={<CircleDollarSign className="h-5 w-5" />} label="Доступно" value={money(dashboard.totals.available)} />
            <MetricCard icon={<Banknote className="h-5 w-5" />} label="Заработано" value={money(dashboard.totals.referralCommission)} />
            <MetricCard label="В резерве" value={money(dashboard.totals.reserved)} hint="Ожидает решения админа" />
            <MetricCard label="Компании" value={String(dashboard.totals.activeCompanies)} hint={`из ${dashboard.totals.companies} закреплённых`} />
          </div>

          <Card className="border-cyan-300/15 bg-cyan-300/[0.045]">
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 font-semibold">
                    <Landmark className="h-4 w-4 text-cyan-100" />
                    Реквизиты для выплат
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">Укажите банк и хотя бы один способ перевода: телефон или карту.</p>
                </div>
                {dashboard.requisites.configured && (
                  <Badge className="w-fit border-emerald-300/25 bg-emerald-300/10 text-emerald-100">
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    Заполнено
                  </Badge>
                )}
              </div>

              <div className="grid gap-3 lg:grid-cols-[220px_1fr_1fr_auto] lg:items-end">
                <label className="block space-y-1.5 text-sm">
                  <span className="text-muted-foreground">Банк</span>
                  <select
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/25 px-3 outline-none focus:border-cyan-200/40"
                    value={requisitesDraft.bankCode}
                    onChange={(event) => setRequisitesDraft((current) => ({ ...current, bankCode: event.target.value }))}
                  >
                    {PR_PAYOUT_BANKS.map((bank) => (
                      <option key={bank.code} value={bank.code}>
                        {bank.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1.5 text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    Телефон
                  </span>
                  <Input
                    value={requisitesDraft.phone}
                    inputMode="tel"
                    maxLength={16}
                    placeholder={dashboard.requisites.phone ?? "+7 999 000-00-00"}
                    onChange={(event) => setRequisitesDraft((current) => ({ ...current, phone: formatPrPayoutPhone(event.target.value) }))}
                  />
                </label>

                <label className="block space-y-1.5 text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <CreditCard className="h-3.5 w-3.5" />
                    Карта
                  </span>
                  <Input
                    value={requisitesDraft.cardNumber}
                    inputMode="numeric"
                    maxLength={19}
                    placeholder={dashboard.requisites.cardMasked ?? "0000 0000 0000 0000"}
                    onChange={(event) => setRequisitesDraft((current) => ({ ...current, cardNumber: formatPrPayoutCard(event.target.value) }))}
                  />
                </label>

                <Button onClick={() => void saveRequisites()} disabled={savingRequisites}>
                  <Save className="h-4 w-4" />
                  {savingRequisites ? "Сохраняю..." : "Сохранить"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-cyan-300/15 bg-[radial-gradient(circle_at_12%_0%,rgba(103,232,249,0.12),transparent_30%),rgba(255,255,255,0.035)]">
            <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_220px_auto] lg:items-end">
              <div>
                <p className="font-semibold">Создать заявку на выплату</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Минимум {money(dashboard.minPayoutRub)}. Максимум сейчас: {money(dashboard.totals.available)}.
                </p>
                {!dashboard.requisites.configured && (
                  <p className="mt-2 text-sm text-amber-100">Сначала сохраните реквизиты — без них заявку создать нельзя.</p>
                )}
              </div>
              <Input
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ""))}
                placeholder="Сумма"
                inputMode="decimal"
              />
              <Button onClick={() => void createPayout()} disabled={!canCreate || creating}>
                <Send className="h-4 w-4" />
                {creating ? "Создаю..." : "Создать"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-white/[0.035]">
            <CardContent className="space-y-3 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg font-semibold">История заявок</p>
                  <p className="text-sm text-muted-foreground">Код PR: {dashboard.code}</p>
                </div>
                <Button asChild variant="outline">
                  <Link href="/admin/pr/companies">
                    Мои компании <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              {dashboard.payouts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-muted-foreground">Заявок пока нет.</div>
              ) : (
                <div className="grid gap-2">
                  {dashboard.payouts.map((payout) => (
                    <div key={payout.uuid} className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{payout.uuid}</p>
                        <p className="text-sm text-muted-foreground">{date(payout.createdAt)}</p>
                      </div>
                      <Badge variant="outline" className={statusTone(payout.status)}>
                        {payout.status}
                      </Badge>
                      <p className="text-lg font-semibold">{money(payout.amount)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function MetricCard({ icon, label, value, hint }: { icon?: ReactNode; label: string; value: string; hint?: string }) {
  return (
    <Card className="border-white/10 bg-white/[0.035]">
      <CardContent className="p-5">
        {icon ? <div className="mb-4 text-cyan-100">{icon}</div> : null}
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
        <p className="mt-2 text-3xl font-semibold">{value}</p>
        {hint ? <p className="mt-2 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
