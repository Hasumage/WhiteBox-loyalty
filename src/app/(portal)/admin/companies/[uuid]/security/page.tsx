"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, ExternalLink, LockKeyhole, RotateCcw, ShieldAlert, ShieldCheck, UserCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { adminGetCompanySecurity, type AdminCompanySecurity } from "@/lib/api/admin-client";

const roleLabels: Record<AdminCompanySecurity["members"][number]["role"], string> = {
  OWNER: "Владелец",
  MANAGER: "Менеджер",
  CASHIER: "Кассир",
};

function shortUuid(uuid: string) {
  return uuid.slice(0, 8);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export default function AdminCompanySecurityPage() {
  const params = useParams<{ uuid: string }>();
  const companyUserUuid = params.uuid;
  const [data, setData] = useState<AdminCompanySecurity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await adminGetCompanySecurity(companyUserUuid);
    if (!res.ok) {
      setError(res.message);
      setLoading(false);
      return;
    }
    setData(res.data);
    setLoading(false);
  }, [companyUserUuid]);

  useEffect(() => {
    void load();
  }, [load]);

  const signals = useMemo(() => {
    if (!data) return [];
    return [
      {
        title: "Email владельца",
        value: data.company.owner.emailVerifiedAt ? "Подтверждён" : "Не подтверждён",
        ok: Boolean(data.company.owner.emailVerifiedAt),
      },
      {
        title: "Заблокированные",
        value: `${data.summary.blockedMembers}`,
        ok: data.summary.blockedMembers === 0,
      },
      {
        title: "Неактивные доступы",
        value: `${data.summary.inactiveMembers}`,
        ok: data.summary.inactiveMembers === 0,
      },
    ];
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Button asChild variant="ghost" className="px-0">
            <Link href={`/admin/companies/${companyUserUuid}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Назад к компании
            </Link>
          </Button>
          <div>
            <Badge variant="outline" className="mb-3 border-cyan-300/40 bg-cyan-400/10 text-cyan-100">
              <ShieldCheck className="mr-2 h-3.5 w-3.5" />
              Безопасность
            </Badge>
            <h1 className="text-3xl font-bold">Сотрудники и доступы</h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              Краткий срез по команде компании, статусам аккаунтов, подтверждению email и потенциальным рискам доступа.
            </p>
          </div>
        </div>
        <Button onClick={load} disabled={loading} variant="secondary">
          <RotateCcw className="mr-2 h-4 w-4" />
          Обновить
        </Button>
      </div>

      {error ? <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="glass border-white/10">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Всего</p>
              <p className="mt-3 text-3xl font-bold">{data?.summary.totalMembers ?? 0}</p>
              <p className="text-sm text-muted-foreground">сотрудников и владельцев</p>
            </div>
            <Users className="h-6 w-6 text-primary" />
          </CardContent>
        </Card>
        <Card className="glass border-white/10">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Активные</p>
              <p className="mt-3 text-3xl font-bold">{data?.summary.activeMembers ?? 0}</p>
              <p className="text-sm text-muted-foreground">могут работать</p>
            </div>
            <UserCheck className="h-6 w-6 text-emerald-300" />
          </CardContent>
        </Card>
        <Card className="glass border-white/10">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Команда</p>
              <p className="mt-3 text-3xl font-bold">{data?.summary.managers ?? 0}</p>
              <p className="text-sm text-muted-foreground">менеджеров · {data?.summary.cashiers ?? 0} кассиров</p>
            </div>
            <LockKeyhole className="h-6 w-6 text-primary" />
          </CardContent>
        </Card>
        <Card className="glass border-white/10">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Риски</p>
              <p className="mt-3 text-3xl font-bold">{(data?.summary.blockedMembers ?? 0) + (data?.summary.inactiveMembers ?? 0)}</p>
              <p className="text-sm text-muted-foreground">блокировки и неактивные доступы</p>
            </div>
            <ShieldAlert className="h-6 w-6 text-amber-300" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="glass border-white/10">
          <CardHeader>
            <CardTitle>Сотрудники компании</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-white/10">
              {(data?.members ?? []).map((member) => (
                <div key={member.uuid} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1.4fr)_140px_120px_120px_120px] md:items-center">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/users/${member.user.uuid}`}
                      className="block truncate font-semibold transition-colors hover:text-primary"
                    >
                      {member.user.name}
                    </Link>
                    <p className="truncate text-sm text-muted-foreground">{member.user.email}</p>
                    <p className="text-xs text-muted-foreground">{shortUuid(member.user.uuid)}</p>
                  </div>
                  <Badge variant={member.role === "OWNER" ? "default" : "secondary"} className="w-fit">
                    {roleLabels[member.role]}
                  </Badge>
                  <Badge variant={member.isActive && member.user.accountStatus === "ACTIVE" ? "outline" : "destructive"} className="w-fit">
                    {member.isActive && member.user.accountStatus === "ACTIVE" ? "Активен" : member.user.accountStatus}
                  </Badge>
                  <div className="text-sm text-muted-foreground">{formatDate(member.createdAt)}</div>
                  <Button asChild size="sm" variant="secondary" className="w-fit">
                    <Link href={`/admin/users/${member.user.uuid}`}>
                      Открыть
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              ))}
              {!loading && !data?.members.length ? (
                <div className="p-5 text-sm text-muted-foreground">Сотрудников пока нет.</div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-white/10">
          <CardHeader>
            <CardTitle>Сигналы безопасности</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {signals.map((signal) => (
              <div key={signal.title} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                <div>
                  <p className="font-medium">{signal.title}</p>
                  <p className="text-sm text-muted-foreground">{signal.value}</p>
                </div>
                {signal.ok ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <ShieldAlert className="h-5 w-5 text-amber-300" />}
              </div>
            ))}
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-400/10 p-3 text-sm text-cyan-50/80">
              Рекомендация: периодически сверяйте активных сотрудников с реальной командой компании и отключайте устаревшие доступы.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
