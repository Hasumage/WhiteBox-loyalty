"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Banknote, CircleAlert, QrCode, ReceiptText, Sparkles, Users, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { companyDashboard, type CompanyDashboard } from "@/lib/api/company-client";

function money(value: number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(value);
}

const roleNames = { OWNER: "Владелец", MANAGER: "Руководитель", CASHIER: "Кассир" } as const;

export default function CompanyPortalPage() {
  const [dashboard, setDashboard] = useState<CompanyDashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    companyDashboard().then(setDashboard).catch((reason: Error) => setError(reason.message));
  }, []);

  const metrics = dashboard?.metrics;
  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-[1.75rem] border border-cyan-300/15 bg-[radial-gradient(circle_at_86%_8%,rgba(103,232,249,0.15),transparent_34%),linear-gradient(120deg,rgba(17,24,39,0.98),rgba(8,9,12,0.98))] p-6 sm:p-8">
        <div className="relative z-10 max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
            <Sparkles className="h-3.5 w-3.5" /> Partner workspace
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{dashboard?.company.name ?? "Кабинет компании"}</h1>
            {dashboard && <Badge className="bg-white text-black">{roleNames[dashboard.memberRole]}</Badge>}
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
            Обслуживайте клиентов по QR, отслеживайте подписки и управляйте деньгами в одном рабочем пространстве.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg" className="rounded-xl">
              <Link href="/company/clients"><QrCode /> Сканировать QR клиента</Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="rounded-xl">
              <Link href="/company/subscriptions"><WalletCards /> Правила подписок</Link>
            </Button>
          </div>
        </div>
      </header>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-300/20 bg-red-400/10 p-4 text-sm text-red-100">
          <CircleAlert className="h-5 w-5 shrink-0" /> {error}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Клиенты", value: metrics?.customers ?? "-", detail: "в программе лояльности", icon: Users },
          { label: "Активные подписки", value: metrics?.activeSubscribers ?? "-", detail: "платящих клиентов", icon: WalletCards },
          { label: "Прогноз подписок", value: metrics ? money(metrics.monthlyRecurringRevenue) : "-", detail: "в среднем за месяц", icon: Banknote },
          { label: "Начислено баллов", value: metrics?.pointsAwarded ?? "-", detail: "через покупки", icon: ReceiptText },
        ].map(({ label, value, detail, icon: Icon }) => (
          <Card key={label} className="glass overflow-hidden border-white/10 py-0">
            <CardContent className="flex items-start justify-between gap-3 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                <p className="mt-3 text-3xl font-semibold">{value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
              </div>
              <span className="rounded-2xl border border-cyan-200/15 bg-cyan-200/[0.06] p-3 text-cyan-100">
                <Icon className="h-5 w-5" />
              </span>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.8fr]">
        <Card className="glass border-white/10 py-0">
          <CardContent className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Последние покупки</h2>
                <p className="text-sm text-muted-foreground">Начисления по системе уровней</p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link href="/company/clients">Открыть кассу <ArrowRight /></Link>
              </Button>
            </div>
            <div className="space-y-2">
              {dashboard?.recentPurchases.map((purchase) => (
                <div key={purchase.uuid} className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold">{purchase.customer}</p>
                    <p className="text-xs text-muted-foreground">{new Date(purchase.createdAt).toLocaleString("ru-RU")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{money(purchase.amount)}</p>
                    <p className="text-xs text-cyan-100">+{purchase.pointsAwarded} баллов</p>
                  </div>
                </div>
              ))}
              {dashboard && dashboard.recentPurchases.length === 0 && (
                <div className="rounded-2xl border border-dashed border-white/12 p-8 text-center text-sm text-muted-foreground">
                  Первая покупка появится здесь после сканирования QR.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-white/10 py-0">
          <CardContent className="space-y-4 p-6">
            <h2 className="text-lg font-semibold">Контроль сегодня</h2>
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Заявки на вывод</p>
              <p className="mt-2 text-3xl font-semibold">{metrics?.pendingPayouts ?? "-"}</p>
              <Button asChild variant="outline" className="mt-4 w-full rounded-xl">
                <Link href="/company/payments">Финансы</Link>
              </Button>
            </div>
            <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] p-4">
              <p className="text-sm font-semibold">Контрольных услуг: {metrics?.activeEntitlements ?? "-"}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Правила погашения не позволят выдать ежедневный бонус дважды в один период.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
