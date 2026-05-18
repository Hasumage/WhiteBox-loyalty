"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentType } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, BarChart3, History, Link2, ShieldCheck, UserCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { adminGetUser, type AdminUserDetail } from "@/lib/api/admin-client";
import { useI18n } from "@/lib/i18n/use-i18n";

export type UserProfilePageKey = "overview" | "relations" | "activity" | "security";

export function useAdminUserProfile() {
  const params = useParams<{ uuid: string }>();
  const userUuid = params?.uuid;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AdminUserDetail | null>(null);

  async function loadProfile() {
    if (!userUuid) return;
    setLoading(true);
    setError(null);
    const result = await adminGetUser(userUuid);
    if (!result.ok) {
      setUser(null);
      setError(`Cannot load user (${result.status}): ${result.message}`);
      setLoading(false);
      return;
    }
    setUser(result.data);
    setLoading(false);
  }

  useEffect(() => {
    let ignore = false;
    if (!userUuid) return;
    void (async () => {
      setLoading(true);
      setError(null);
      const result = await adminGetUser(userUuid);
      if (ignore) return;
      if (!result.ok) {
        setUser(null);
        setError(`Cannot load user (${result.status}): ${result.message}`);
        setLoading(false);
        return;
      }
      setUser(result.data);
      setLoading(false);
    })();
    return () => {
      ignore = true;
    };
  }, [userUuid]);

  return { userUuid, user, loading, error, setError, setUser, loadProfile };
}

export function toDateTimeLocal(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toIsoOrNull(localValue: string): string | null {
  if (!localValue) return null;
  const date = new Date(localValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function formatDateTime(value?: string | null, locale = "en") {
  if (!value) return "-";
  return new Date(value).toLocaleString(locale === "ru" ? "ru-RU" : "en-US");
}

export function statusVariant(status: AdminUserDetail["accountStatus"]) {
  return status === "ACTIVE" ? "default" : "destructive";
}

export function UserPageHeader({
  user,
  active,
  actions,
}: {
  user: AdminUserDetail;
  active: UserProfilePageKey;
  actions?: React.ReactNode;
}) {
  const { t } = useI18n("ru");
  const nav: Array<{ key: UserProfilePageKey; href: string; label: string; icon: ComponentType<{ className?: string }> }> = [
    { key: "overview", href: `/admin/users/${user.uuid}`, label: t("admin.userDetail.overview"), icon: UserCircle2 },
    { key: "relations", href: `/admin/users/${user.uuid}/relations`, label: t("admin.userDetail.relations"), icon: Link2 },
    { key: "activity", href: `/admin/users/${user.uuid}/activity`, label: t("admin.userDetail.activity"), icon: History },
    { key: "security", href: `/admin/users/${user.uuid}/security`, label: t("admin.userDetail.security"), icon: ShieldCheck },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="secondary" size="sm" className="w-fit">
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4" />
            {t("admin.userDetail.back")}
          </Link>
        </Button>
        {actions && <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">{actions}</div>}
      </div>

      <Card className="glass overflow-hidden border-white/10">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-100">
                <BarChart3 className="h-3.5 w-3.5" /> {t("admin.userDetail.badge")}
              </p>
              <h1 className="mt-3 truncate text-3xl font-semibold tracking-tight sm:text-4xl">{user.name}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">{user.role}</Badge>
                <Badge variant={statusVariant(user.accountStatus)}>{user.accountStatus}</Badge>
                <span className="font-mono text-xs">{user.uuid}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
              {nav.map((item) => {
                const Icon = item.icon;
                return (
                  <Button key={item.key} asChild variant={active === item.key ? "default" : "secondary"} size="sm">
                    <Link href={item.href}>
                      <Icon className="h-4 w-4" /> {item.label}
                    </Link>
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function UserPageShellHeader({
  user,
  active,
}: {
  user: AdminUserDetail;
  active: UserProfilePageKey;
}) {
  const { t } = useI18n("ru");
  const nav: Array<{ key: UserProfilePageKey; href: string; label: string; icon: ComponentType<{ className?: string }> }> = [
    { key: "overview", href: `/admin/users/${user.uuid}`, label: t("admin.userDetail.overview"), icon: UserCircle2 },
    { key: "relations", href: `/admin/users/${user.uuid}/relations`, label: t("admin.userDetail.relations"), icon: Link2 },
    { key: "activity", href: `/admin/users/${user.uuid}/activity`, label: t("admin.userDetail.activity"), icon: History },
    { key: "security", href: `/admin/users/${user.uuid}/security`, label: t("admin.userDetail.security"), icon: ShieldCheck },
  ];

  return (
    <div className="space-y-4">
      <Button asChild variant="secondary" size="sm">
        <Link href="/admin/users">
          <ArrowLeft className="h-4 w-4" />
          {t("admin.userDetail.back")}
        </Link>
      </Button>

      <Card className="glass overflow-hidden border-white/10">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-100">
                <BarChart3 className="h-3.5 w-3.5" /> {t("admin.userDetail.badge")}
              </p>
              <h1 className="mt-3 truncate text-3xl font-semibold tracking-tight sm:text-4xl">{user.name}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">{user.role}</Badge>
                <Badge variant={statusVariant(user.accountStatus)}>{user.accountStatus}</Badge>
                <span className="font-mono text-xs">{user.uuid}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 xl:items-end">
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                {nav.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Button key={item.key} asChild variant={active === item.key ? "default" : "secondary"} size="sm">
                      <Link href={item.href}>
                        <Icon className="h-4 w-4" /> {item.label}
                      </Link>
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function UserPageState({ loading, error }: { loading: boolean; error: string | null }) {
  const { t } = useI18n("ru");
  if (loading) return <p className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-muted-foreground">{t("admin.userDetail.loading")}</p>;
  if (error) {
    return (
      <div className="space-y-4">
        <Button asChild variant="secondary" size="sm">
          <Link href="/admin/users">
            <ArrowLeft className="h-4 w-4" /> {t("admin.userDetail.back")}
          </Link>
        </Button>
        <p className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-destructive">{error}</p>
      </div>
    );
  }
  return null;
}
