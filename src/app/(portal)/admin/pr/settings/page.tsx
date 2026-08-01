"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCcw, Save, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AccountConnectionsPanel } from "@/components/settings/AccountConnectionsPanel";
import { fetchWithAuthRecovery } from "@/lib/api/authenticated-fetch";
import { cn } from "@/lib/utils";

type AccountSettings = {
  user: {
    uuid: string;
    name: string;
    email: string;
    role: string;
    accountStatus: string;
    referralCode: string | null;
    telegramId: string | null;
    phoneNumber: string | null;
    phoneVerifiedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  stats: {
    totalCompanies: number;
    activeCompanies: number;
    funnelCompanies: number;
    pendingPayouts: number;
  };
  permissions: Array<{
    scope: string;
    canView: boolean;
    canEdit: boolean;
    canApprove: boolean;
  }>;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function readError(response: Response, fallback: string) {
  const data = await response.json().catch(() => ({}));
  return typeof data?.message === "string" ? data.message : fallback;
}

export default function AdminPrSettingsPage() {
  const [settings, setSettings] = useState<AccountSettings | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetchWithAuthRecovery("/api/admin/pr/settings", { cache: "no-store" });
      if (!response.ok) {
        setSettings(null);
        setError(await readError(response, "Не удалось загрузить настройки аккаунта."));
        return;
      }
      const nextSettings = (await response.json()) as AccountSettings;
      setSettings(nextSettings);
      setName(nextSettings.user.name);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить настройки аккаунта.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("vkid") === "linked") {
      setNotice("VK ID связан с аккаунтом.");
      window.history.replaceState(null, "", window.location.pathname);
    }
    void load();
  }, [load]);

  async function saveName() {
    if (!settings || !name.trim()) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetchWithAuthRecovery("/api/admin/pr/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        setError(await readError(response, "Не удалось сохранить имя."));
        return;
      }
      const nextSettings = (await response.json()) as AccountSettings;
      setSettings(nextSettings);
      setName(nextSettings.user.name);
      setNotice("Имя обновлено.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Не удалось сохранить имя.");
    } finally {
      setSaving(false);
    }
  }

  const statCards = useMemo(() => {
    if (!settings) return [];
    return [
      { label: "Компаний", value: settings.stats.totalCompanies },
      { label: "Активных", value: settings.stats.activeCompanies },
      { label: "В воронке", value: settings.stats.funnelCompanies },
      { label: "Выплат ждёт", value: settings.stats.pendingPayouts },
    ];
  }, [settings]);

  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] border border-cyan-200/15 bg-[radial-gradient(circle_at_12%_0%,rgba(103,232,249,0.12),transparent_34%),rgba(255,255,255,0.035)] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-100">
              <UserCog className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Настройки аккаунта</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                Профиль, безопасность и подключения аккаунта в одном месте.
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

      {loading && !settings ? (
        <Card className="border-white/10 bg-white/[0.035] p-6 text-muted-foreground">
          Загружаю настройки...
        </Card>
      ) : settings ? (
        <>
          <Card className="overflow-hidden border-white/10 bg-card/70">
            <CardContent className="space-y-5 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-lg font-semibold">Профиль</p>
                  <p className="text-sm text-muted-foreground">{settings.user.email}</p>
                </div>
                <Badge variant="outline" className="w-fit border-cyan-300/25 bg-cyan-300/10 text-cyan-100">
                  {settings.user.uuid.slice(0, 8)}
                </Badge>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-muted-foreground">Отображаемое имя</span>
                  <Input value={name} onChange={(event) => setName(event.target.value.slice(0, 80))} maxLength={80} />
                </label>
                <Button onClick={() => void saveName()} disabled={saving || !name.trim() || name.trim() === settings.user.name}>
                  <Save className="h-4 w-4" />
                  {saving ? "Сохраняю..." : "Сохранить имя"}
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Роль</p>
                  <p className="mt-2 font-semibold">{settings.user.role}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Статус</p>
                  <p className="mt-2 font-semibold">{settings.user.accountStatus}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Обновлено</p>
                  <p className="mt-2 text-sm font-semibold">{formatDate(settings.user.updatedAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            {statCards.map((item) => (
              <Card key={item.label} className="border-white/10 bg-white/[0.035]">
                <CardContent className="p-3 sm:p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:text-xs sm:tracking-[0.18em]">{item.label}</p>
                  <p className="mt-1.5 text-xl font-semibold sm:mt-2 sm:text-2xl">{item.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <AccountConnectionsPanel next="/admin/pr/settings" telegramLinkEndpoint="/api/admin/telegram-link-token" />
        </>
      ) : null}
    </div>
  );
}
