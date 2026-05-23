"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Link2,
  LockKeyhole,
  RefreshCw,
  Send,
  ServerCrash,
  ShieldCheck,
  Sparkles,
  UserCog,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { clearStoredSession, getAccessToken, refreshStoredSession } from "@/lib/api/auth-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import { cn } from "@/lib/utils";

type AdminTelegramRow = {
  uuid: string;
  email: string;
  name: string | null;
  role: string;
  accountStatus: string;
  telegramId: string | null;
  connected: boolean;
  receivesNotifications: boolean;
  updatedAt: string;
};

type TelegramStatus = {
  connected: boolean;
  telegramId: string | null;
  email: string;
  name: string | null;
  role: string;
  admins: AdminTelegramRow[];
};

function maskTelegramId(value: string | null, emptyLabel: string) {
  if (!value) return emptyLabel;
  if (value.length <= 4) return value;
  return `...${value.slice(-4)}`;
}

function roleTone(role: string) {
  if (role === "SUPER_ADMIN") return "border-cyan-300/25 bg-cyan-300/10 text-cyan-100";
  if (role === "ADMIN") return "border-white/20 bg-white/10 text-white";
  if (role === "MANAGER") return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
  return "border-amber-300/25 bg-amber-300/10 text-amber-100";
}

function statusTone(row: AdminTelegramRow) {
  if (row.receivesNotifications) return "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
  if (row.connected) return "border-amber-300/25 bg-amber-300/10 text-amber-100";
  return "border-white/10 bg-white/[0.04] text-muted-foreground";
}

function localAdminHeaders(): HeadersInit {
  const token = getAccessToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchAdminRoute(input: RequestInfo | URL, init: RequestInit = {}) {
  const requestInit: RequestInit = {
    ...init,
    credentials: "include",
    headers: {
      ...localAdminHeaders(),
      ...(init.headers ?? {}),
    },
  };
  const first = await fetch(input, requestInit);
  if (first.status !== 401) return first;

  const refreshed = await refreshStoredSession();
  if (!refreshed) {
    clearStoredSession();
    if (typeof window !== "undefined") {
      const next = `${window.location.pathname}${window.location.search}`;
      window.location.assign(`/login?next=${encodeURIComponent(next)}`);
    }
    return first;
  }

  return fetch(input, {
    ...init,
    credentials: "include",
    headers: {
      ...localAdminHeaders(),
      ...(init.headers ?? {}),
    },
  });
}

export default function AdminTelegramPage() {
  const { t } = useI18n("ru");
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [creatingLink, setCreatingLink] = useState(false);

  const stats = useMemo(() => {
    const admins = status?.admins ?? [];
    return {
      total: admins.length,
      linked: admins.filter((admin) => admin.connected).length,
      routing: admins.filter((admin) => admin.receivesNotifications).length,
      attention: admins.filter((admin) => !admin.connected || !admin.receivesNotifications).length,
    };
  }, [status?.admins]);

  const statCards: Array<{ label: string; value: number; icon: LucideIcon }> = [
    { label: t("admin.telegram.statAdmins"), value: stats.total, icon: Users },
    { label: t("admin.telegram.statLinked"), value: stats.linked, icon: Link2 },
    { label: t("admin.telegram.statReceiving"), value: stats.routing, icon: CheckCircle2 },
    { label: t("admin.telegram.statAttention"), value: stats.attention, icon: AlertTriangle },
  ];

  async function loadStatus() {
    setLoadingStatus(true);
    setMessage("");
    try {
      const res = await fetchAdminRoute("/api/admin/telegram/status", {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.message ? `${data.message} (HTTP ${res.status})` : `${t("admin.telegram.checkFailed")} (HTTP ${res.status})`);
        return;
      }
      setStatus(data as TelegramStatus);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("admin.telegram.checkFailed"));
    } finally {
      setLoadingStatus(false);
    }
  }

  async function createLink() {
    setMessage("");
    setCreatingLink(true);
    try {
      const res = await fetchAdminRoute("/api/admin/telegram-link-token", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.message ? `${data.message} (HTTP ${res.status})` : `${t("admin.telegram.createLinkFailed")} (HTTP ${res.status})`);
        return;
      }
      setLink(data.deepLink);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("admin.telegram.createLinkFailed"));
    } finally {
      setCreatingLink(false);
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  const connected = Boolean(status?.connected);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.16),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025))] p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-sm text-cyan-100">
              <Send className="h-4 w-4" /> {t("admin.telegram.routingBadge")}
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">{t("admin.telegram.centerTitle")}</h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              {t("admin.telegram.centerDescription")}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={loadStatus} disabled={loadingStatus}>
              <RefreshCw className={cn("h-4 w-4", loadingStatus && "animate-spin")} /> {t("admin.telegram.refresh")}
            </Button>
            <Button asChild variant="secondary">
              <Link href="/admin/system-health">
                <ServerCrash className="h-4 w-4" /> {t("admin.telegram.systemHealth")}
              </Link>
            </Button>
            <Button onClick={createLink} disabled={creatingLink} className="bg-white text-black hover:bg-white/90">
              <ShieldCheck className="h-4 w-4" /> {connected ? t("admin.telegram.reconnectMy") : t("admin.telegram.connectMy")}
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="border-white/10 bg-card/70">
            <CardContent className="flex items-center justify-between gap-4 p-5">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-2 text-3xl font-semibold">{value}</p>
              </div>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
                <Icon className="h-5 w-5" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden border-white/10 bg-card/70">
        <CardHeader className="border-b border-white/10 bg-white/[0.03] px-6 py-5">
          <CardTitle className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
              {connected ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <Send className="h-5 w-5" />}
            </span>
            {t("admin.telegram.myConnection")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 p-6">
          {loadingStatus ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-muted-foreground">{t("admin.telegram.checking")}</div>
          ) : connected ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/[0.08] p-6">
                <div className="flex items-start gap-4">
                  <Sparkles className="mt-1 h-5 w-5 shrink-0 text-emerald-200" />
                  <div>
                    <p className="text-lg font-semibold text-emerald-50">{t("admin.telegram.connectedReady")}</p>
                    <p className="mt-3 text-sm leading-6 text-emerald-50/70">
                      {t("admin.telegram.connectedRolePrefix")} {status?.role}. {t("admin.telegram.connectedRoleSuffix")}
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{t("admin.telegram.currentChat")}</p>
                <p className="mt-4 text-lg font-semibold">{maskTelegramId(status?.telegramId ?? null, t("admin.telegram.notLinked"))}</p>
                <p className="mt-2 truncate text-sm text-muted-foreground">{status?.email}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5 text-sm leading-6 text-amber-100">
              {t("admin.telegram.notConnectedWarning")}
            </div>
          )}

          {link && (
            <a href={link} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 font-medium text-cyan-100 transition hover:bg-cyan-300/15">
              <span className="truncate">{link}</span>
              <ExternalLink className="h-4 w-4 shrink-0" />
            </a>
          )}
          {message && <div className="rounded-2xl border border-red-300/20 bg-red-300/10 p-4 text-sm text-red-100">{message}</div>}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-white/10 bg-card/70">
        <CardHeader className="border-b border-white/10 bg-white/[0.03] px-6 py-5">
          <CardTitle className="flex items-center gap-3">
            <Users className="h-5 w-5" /> {t("admin.telegram.routingList")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="hidden grid-cols-[1.4fr_140px_150px_150px_120px] gap-4 border-b border-white/10 px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground lg:grid">
            <span>{t("admin.telegram.columnAdmin")}</span>
            <span>{t("admin.telegram.columnRole")}</span>
            <span>{t("admin.telegram.columnTelegram")}</span>
            <span>{t("admin.telegram.columnRouting")}</span>
            <span className="text-right">{t("admin.telegram.columnAccess")}</span>
          </div>

          <div className="divide-y divide-white/10">
            {(status?.admins ?? []).map((admin) => (
              <div key={admin.uuid} className="grid gap-4 px-6 py-5 lg:grid-cols-[1.4fr_140px_150px_150px_120px] lg:items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border", statusTone(admin))}>
                      {admin.receivesNotifications ? <CheckCircle2 className="h-5 w-5" /> : admin.connected ? <AlertTriangle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{admin.name || t("admin.telegram.unnamedAdmin")}</p>
                      <p className="truncate text-sm text-muted-foreground">{admin.email}</p>
                    </div>
                  </div>
                </div>

                <Badge variant="outline" className={cn("w-fit", roleTone(admin.role))}>{admin.role}</Badge>

                <div className="text-sm">
                  <p className="font-medium">{admin.connected ? t("admin.telegram.linked") : t("admin.telegram.notLinked")}</p>
                  <p className="text-muted-foreground">{maskTelegramId(admin.telegramId, t("admin.telegram.notLinked"))}</p>
                </div>

                <Badge variant="outline" className={cn("w-fit", statusTone(admin))}>
                  {admin.receivesNotifications ? t("admin.telegram.receiving") : admin.connected ? t("admin.telegram.linkedOnly") : t("admin.telegram.noRouting")}
                </Badge>

                <div className="flex justify-start lg:justify-end">
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/admin/users/${admin.uuid}/permissions`}>
                      <UserCog className="h-4 w-4" /> {t("admin.telegram.access")}
                    </Link>
                  </Button>
                </div>
              </div>
            ))}

            {!loadingStatus && (status?.admins.length ?? 0) === 0 && (
              <div className="p-8 text-center text-muted-foreground">{t("admin.telegram.noAdmins")}</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-cyan-300/15 bg-cyan-300/[0.06]">
        <CardContent className="flex gap-4 p-5 text-sm leading-6 text-cyan-50/80">
          <LockKeyhole className="mt-1 h-5 w-5 shrink-0 text-cyan-100" />
          <p>
            {t("admin.telegram.routingNote")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
