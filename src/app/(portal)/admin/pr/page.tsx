"use client";

import { useEffect, useState } from "react";
import { CalendarCheck2, Megaphone, RefreshCcw } from "lucide-react";
import { AdminPrDashboardSection } from "@/components/admin/AdminPrDashboardSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { adminClosePrMonth, adminGetDashboard, type AdminDashboardResponse } from "@/lib/api/admin-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import { cn } from "@/lib/utils";

function rub(value: number, locale: "ru" | "en") {
  return new Intl.NumberFormat(locale === "ru" ? "ru-RU" : "en-US", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function AdminPrPage() {
  const { locale } = useI18n("ru");
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const result = await adminGetDashboard();
    if (result.ok) setDashboard(result.data);
    else setError(result.message);
    setLoading(false);
  }

  async function closeMonth() {
    setClosing(true);
    setError("");
    setNotice("");
    const result = await adminClosePrMonth();
    if (result.ok) {
      setNotice(
        locale === "ru"
          ? `Месяц ${result.data.period.key} закрыт: создано операций ${result.data.generated}, сумма ${rub(result.data.totalAmount, locale)}.`
          : `Month ${result.data.period.key} closed: ${result.data.generated} operations generated, ${rub(result.data.totalAmount, locale)}.`,
      );
      await load();
    } else {
      setError(result.message);
    }
    setClosing(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const monthlyClose = dashboard?.pr?.monthlyClose ?? null;
  const closeAgents = monthlyClose?.agents?.filter((agent) => agent.availableToClose > 0) ?? [];

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-cyan-200/15 bg-[radial-gradient(circle_at_12%_10%,rgba(103,232,249,0.18),transparent_34%),linear-gradient(135deg,rgba(8,47,73,0.34),rgba(255,255,255,0.035))] p-6 lg:p-8">
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge variant="outline" className="border-cyan-200/25 bg-cyan-300/10 px-3 py-1 text-cyan-100">
              <Megaphone className="h-3.5 w-3.5" /> PR
            </Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              {locale === "ru" ? "PR-кабинет" : "PR workspace"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              {locale === "ru"
                ? "Месячный обзор PR-агентов, компаний и начислений."
                : "Monthly view of PR agents, companies and earnings."}
            </p>
          </div>
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            {locale === "ru" ? "Обновить" : "Refresh"}
          </Button>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-300/25 bg-red-300/10 p-4 text-sm text-red-100">{error}</div>}
      {notice && <div className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm text-emerald-100">{notice}</div>}

      {monthlyClose && (
        <section className="rounded-[2rem] border border-amber-200/20 bg-[radial-gradient(circle_at_8%_10%,rgba(251,191,36,0.16),transparent_32%),rgba(255,255,255,0.035)] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-100">
                <CalendarCheck2 className="h-5 w-5" />
                {locale === "ru" ? `Закрытие месяца ${monthlyClose.period.key}` : `Close month ${monthlyClose.period.key}`}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {locale === "ru"
                  ? `${monthlyClose.agentsToClose} PR-агентов · ${rub(monthlyClose.totalAmount, locale)} к созданию финансовых операций.`
                  : `${monthlyClose.agentsToClose} PR agents · ${rub(monthlyClose.totalAmount, locale)} to generate.`}
              </p>
              {closeAgents.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {closeAgents.map((agent) => (
                    <span
                      key={agent.userId}
                      className="rounded-2xl border border-amber-200/20 bg-black/25 px-3 py-2 text-sm text-amber-50"
                    >
                      {agent.name} · {rub(agent.availableToClose, locale)}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <Button
              size="lg"
              className="min-h-14 rounded-2xl px-6 text-base"
              disabled={!monthlyClose.canClose || monthlyClose.totalAmount <= 0 || closing}
              onClick={() => void closeMonth()}
            >
              <CalendarCheck2 className="h-5 w-5" />
              {closing
                ? locale === "ru" ? "Закрываю..." : "Closing..."
                : locale === "ru" ? "Закрыть месяц" : "Close month"}
            </Button>
          </div>
        </section>
      )}

      {loading && !dashboard ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 text-muted-foreground">
          {locale === "ru" ? "Загружаю PR-кабинет..." : "Loading PR workspace..."}
        </div>
      ) : dashboard?.pr ? (
        <AdminPrDashboardSection dashboard={dashboard.pr} locale={locale} />
      ) : (
        <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.025] p-6 text-sm text-muted-foreground">
          {locale === "ru"
            ? "PR-данные недоступны для текущего аккаунта. Проверьте права доступа к PR-направлению."
            : "PR data is not available for this account. Check PR permissions."}
        </div>
      )}
    </div>
  );
}
