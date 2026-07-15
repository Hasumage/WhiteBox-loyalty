"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Banknote, CircleDollarSign, RefreshCcw, Send, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchWithAuthRecovery } from "@/lib/api/authenticated-fetch";
import { cn } from "@/lib/utils";

type PrPayoutDashboard = {
  code: string;
  minPayoutRub: number;
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

export default function AdminPrPayoutsPage() {
  const [dashboard, setDashboard] = useState<PrPayoutDashboard | null>(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
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

    setDashboard((await response.json()) as PrPayoutDashboard);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const amountNumber = Number(amount);
  const canCreate = useMemo(() => {
    if (!dashboard) return false;
    return Number.isFinite(amountNumber) && amountNumber >= dashboard.minPayoutRub && amountNumber <= dashboard.totals.available;
  }, [amountNumber, dashboard]);

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
    setNotice("Заявка на выплату создана. Теперь её должен подтвердить админ.");
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
                Заявка создаётся только в пределах доступного PR-баланса. Финальное закрытие делает админ.
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
            <Card className="border-cyan-300/15 bg-cyan-300/[0.06]">
              <CardContent className="p-5">
                <CircleDollarSign className="mb-4 h-5 w-5 text-cyan-100" />
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Доступно</p>
                <p className="mt-2 text-3xl font-semibold">{money(dashboard.totals.available)}</p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-white/[0.035]">
              <CardContent className="p-5">
                <Banknote className="mb-4 h-5 w-5 text-cyan-100" />
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Заработано</p>
                <p className="mt-2 text-3xl font-semibold">{money(dashboard.totals.referralCommission)}</p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-white/[0.035]">
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">В резерве</p>
                <p className="mt-2 text-3xl font-semibold">{money(dashboard.totals.reserved)}</p>
                <p className="mt-2 text-xs text-muted-foreground">Ожидает решения админа</p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-white/[0.035]">
              <CardContent className="p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Компании</p>
                <p className="mt-2 text-3xl font-semibold">{dashboard.totals.activeCompanies}</p>
                <p className="mt-2 text-xs text-muted-foreground">из {dashboard.totals.companies} закреплённых</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-cyan-300/15 bg-[radial-gradient(circle_at_12%_0%,rgba(103,232,249,0.12),transparent_30%),rgba(255,255,255,0.035)]">
            <CardContent className="grid gap-4 p-5 lg:grid-cols-[1fr_220px_auto] lg:items-end">
              <div>
                <p className="font-semibold">Создать заявку на выплату</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Минимум {money(dashboard.minPayoutRub)}. Максимум сейчас: {money(dashboard.totals.available)}.
                </p>
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
                      <Badge variant="outline" className={statusTone(payout.status)}>{payout.status}</Badge>
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
