"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Megaphone, RefreshCcw, TicketPercent } from "lucide-react";
import { AdminPrDashboardSection } from "@/components/admin/AdminPrDashboardSection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { adminGetDashboard, type AdminDashboardResponse } from "@/lib/api/admin-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import { cn } from "@/lib/utils";

export default function AdminPrPage() {
  const { locale } = useI18n("ru");
  const [dashboard, setDashboard] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    const result = await adminGetDashboard();
    if (result.ok) setDashboard(result.data);
    else setError(result.message);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[2rem] border border-cyan-200/15 bg-[radial-gradient(circle_at_12%_10%,rgba(103,232,249,0.18),transparent_34%),linear-gradient(135deg,rgba(8,47,73,0.34),rgba(255,255,255,0.035))] p-6 lg:p-8">
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Badge variant="outline" className="border-cyan-200/25 bg-cyan-300/10 px-3 py-1 text-cyan-100">
              <Megaphone className="h-3.5 w-3.5" /> PR
            </Badge>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              {locale === "ru" ? "PR-кабинет привлечения компаний" : "Company acquisition PR desk"}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
              {locale === "ru"
                ? "Отдельный рабочий экран для воронки привлечения, закреплённых компаний, оборота и выплат PR-менеджерам."
                : "A dedicated workspace for acquisition funnel, assigned companies, turnover and PR manager payouts."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href="/admin/company-billing-promos">
                <TicketPercent className="h-4 w-4" />
                {locale === "ru" ? "Промокоды оплаты" : "Billing promo codes"}
              </Link>
            </Button>
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            {locale === "ru" ? "Обновить" : "Refresh"}
          </Button>
          </div>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-300/25 bg-red-300/10 p-4 text-sm text-red-100">{error}</div>}

      {loading && !dashboard ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 text-muted-foreground">
          {locale === "ru" ? "Загружаю PR-кабинет..." : "Loading PR desk..."}
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
