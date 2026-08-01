"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Copy,
  ExternalLink,
  Gift,
  Inbox,
  Link2,
  Megaphone,
  RefreshCcw,
  Save,
  Send,
  ShieldCheck,
  UserCog,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VkIdLinkButton } from "@/components/auth/VkIdLinkButton";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchWithAuthRecovery } from "@/lib/api/authenticated-fetch";
import { useI18n } from "@/lib/i18n/use-i18n";
import { cn } from "@/lib/utils";

type PrSettings = {
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

type TelegramStatus = {
  connected: boolean;
  telegramId: string | null;
  email: string;
  name: string | null;
  role: string;
};

type TelegramLinkResponse = {
  token: string;
  expiresAt: string;
  deepLink: string;
};

function maskTelegram(value: string | null, fallback: string) {
  if (!value) return fallback;
  return value.length <= 4 ? value : `••••${value.slice(-4)}`;
}

function formatDate(value: string | null, locale: "ru" | "en") {
  if (!value) return locale === "ru" ? "—" : "—";
  return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function readError(response: Response, fallback: string) {
  const data = await response.json().catch(() => ({}));
  return typeof data?.message === "string" ? data.message : fallback;
}

export default function AdminPrSettingsPage() {
  const { locale } = useI18n("ru");
  const [settings, setSettings] = useState<PrSettings | null>(null);
  const [telegram, setTelegram] = useState<TelegramStatus | null>(null);
  const [name, setName] = useState("");
  const [telegramLink, setTelegramLink] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingLink, setCreatingLink] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const labels = useMemo(
    () => ({
      title: locale === "ru" ? "Настройки PR-аккаунта" : "PR account settings",
      subtitle: locale === "ru" ? "Профиль, Telegram и рабочие данные PR-кабинета в одном месте." : "Profile, Telegram and PR workspace essentials in one place.",
      refresh: locale === "ru" ? "Обновить" : "Refresh",
      profile: locale === "ru" ? "Профиль" : "Profile",
      displayName: locale === "ru" ? "Отображаемое имя" : "Display name",
      email: "Email",
      role: locale === "ru" ? "Роль" : "Role",
      status: locale === "ru" ? "Статус" : "Status",
      save: locale === "ru" ? "Сохранить имя" : "Save name",
      saving: locale === "ru" ? "Сохраняю..." : "Saving...",
      telegram: "Telegram",
      telegramConnected: locale === "ru" ? "Telegram подключён" : "Telegram connected",
      telegramEmpty: locale === "ru" ? "Telegram не подключён" : "Telegram is not connected",
      telegramText:
        locale === "ru"
          ? "Подключение нужно для личных уведомлений по заявкам, выплатам и рабочим событиям PR."
          : "Connect it to receive personal PR notifications for leads, payouts and work events.",
      connect: locale === "ru" ? "Подключить Telegram" : "Connect Telegram",
      reconnect: locale === "ru" ? "Переподключить Telegram" : "Reconnect Telegram",
      creatingLink: locale === "ru" ? "Готовлю ссылку..." : "Preparing link...",
      openBot: locale === "ru" ? "Открыть бота" : "Open bot",
      copyLink: locale === "ru" ? "Скопировать ссылку" : "Copy link",
      linkReady: locale === "ru" ? "Ссылка готова на 15 минут. Откройте её в нужном Telegram." : "The link is ready for 15 minutes. Open it in the right Telegram account.",
      copied: locale === "ru" ? "Ссылка скопирована." : "Link copied.",
      phone: locale === "ru" ? "Телефон" : "Phone",
      phoneEmpty: locale === "ru" ? "не привязан" : "not linked",
      summary: locale === "ru" ? "Рабочая сводка" : "Workspace summary",
      companies: locale === "ru" ? "Закреплено компаний" : "Assigned companies",
      activeCompanies: locale === "ru" ? "Активных партнёров" : "Active partners",
      funnel: locale === "ru" ? "Черновиков в воронке" : "Funnel drafts",
      payouts: locale === "ru" ? "Выплат в ожидании" : "Pending payouts",
      links: locale === "ru" ? "Быстрые переходы" : "Quick links",
      referralCode: locale === "ru" ? "PR-код" : "PR code",
      updatedAt: locale === "ru" ? "Обновлено" : "Updated",
      permissions: locale === "ru" ? "Доступы" : "Permissions",
      enabled: locale === "ru" ? "доступно" : "enabled",
      noCode: locale === "ru" ? "код ещё не назначен" : "code is not assigned yet",
      loadFailed: locale === "ru" ? "Не удалось загрузить настройки PR-аккаунта." : "Failed to load PR account settings.",
      saveFailed: locale === "ru" ? "Не удалось сохранить имя." : "Failed to save name.",
      saved: locale === "ru" ? "Имя обновлено." : "Name updated.",
      telegramFailed: locale === "ru" ? "Не удалось проверить Telegram." : "Failed to check Telegram.",
      linkFailed: locale === "ru" ? "Не удалось создать ссылку Telegram." : "Failed to create Telegram link.",
    }),
    [locale],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const [settingsResponse, telegramResponse] = await Promise.all([
        fetchWithAuthRecovery("/api/admin/pr/settings", { cache: "no-store" }),
        fetchWithAuthRecovery("/api/admin/telegram/status", { cache: "no-store" }, { redirectOnFailure: false }),
      ]);

      if (!settingsResponse.ok) {
        setSettings(null);
        setTelegram(null);
        setError(await readError(settingsResponse, labels.loadFailed));
        return;
      }

      const nextSettings = (await settingsResponse.json()) as PrSettings;
      setSettings(nextSettings);
      setName(nextSettings.user.name);

      if (telegramResponse.ok) {
        setTelegram((await telegramResponse.json()) as TelegramStatus);
      } else {
        setTelegram({
          connected: Boolean(nextSettings.user.telegramId),
          telegramId: nextSettings.user.telegramId,
          email: nextSettings.user.email,
          name: nextSettings.user.name,
          role: nextSettings.user.role,
        });
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : labels.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [labels.loadFailed]);

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
        setError(await readError(response, labels.saveFailed));
        return;
      }
      const nextSettings = (await response.json()) as PrSettings;
      setSettings(nextSettings);
      setName(nextSettings.user.name);
      setNotice(labels.saved);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : labels.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function createTelegramLink() {
    setCreatingLink(true);
    setError("");
    setNotice("");
    try {
      const response = await fetchWithAuthRecovery("/api/admin/telegram-link-token", {
        method: "POST",
      });
      if (!response.ok) {
        setError(await readError(response, labels.linkFailed));
        return;
      }
      const data = (await response.json()) as TelegramLinkResponse;
      setTelegramLink(data.deepLink);
      setNotice(labels.linkReady);
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : labels.linkFailed);
    } finally {
      setCreatingLink(false);
    }
  }

  async function copyTelegramLink() {
    if (!telegramLink || typeof navigator === "undefined") return;
    await navigator.clipboard?.writeText(telegramLink);
    setNotice(labels.copied);
  }

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("vkid") === "linked") {
      setNotice(locale === "ru" ? "VK ID связан с аккаунтом." : "VK ID is linked to your account.");
      window.history.replaceState(null, "", window.location.pathname);
    }
    void load();
  }, [load, locale]);

  const connectedTelegramId = telegram?.telegramId ?? settings?.user.telegramId ?? null;
  const connectedTelegram = Boolean(telegram?.connected ?? settings?.user.telegramId);
  const quickLinks = [
    {
      href: "/admin/pr/companies",
      label: locale === "ru" ? "Мои компании" : "My companies",
      description: locale === "ru" ? "Партнёры, закреплённые за вами" : "Partners assigned to you",
      icon: Building2,
    },
    {
      href: "/admin/pr/funnel",
      label: locale === "ru" ? "Воронка" : "Funnel",
      description: locale === "ru" ? "Лиды и черновые компании" : "Leads and draft companies",
      icon: ClipboardList,
    },
    {
      href: "/admin/pr/payouts",
      label: locale === "ru" ? "Выплаты" : "Payouts",
      description: locale === "ru" ? "Баланс и заявки на вывод" : "Balance and payout requests",
      icon: WalletCards,
    },
    {
      href: "/admin/company-billing-promos",
      label: locale === "ru" ? "Промокоды" : "Promo codes",
      description: locale === "ru" ? "Скидки для компаний" : "Company discounts",
      icon: Gift,
    },
    {
      href: "/admin/leads",
      label: locale === "ru" ? "Заявки" : "Leads",
      description: locale === "ru" ? "Заявки с лендинга" : "Landing requests",
      icon: Inbox,
    },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] border border-cyan-200/15 bg-[radial-gradient(circle_at_12%_0%,rgba(103,232,249,0.12),transparent_34%),rgba(255,255,255,0.035)] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-100">
              <UserCog className="h-5 w-5" />
            </span>
            <div>
              <Badge variant="outline" className="border-cyan-200/25 bg-cyan-300/10 text-cyan-100">
                <Megaphone className="h-3.5 w-3.5" /> PR
              </Badge>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{labels.title}</h1>
              <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{labels.subtitle}</p>
            </div>
          </div>
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            {labels.refresh}
          </Button>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-300/25 bg-red-300/10 p-4 text-sm text-red-100">{error}</div>}
      {notice && <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-100">{notice}</div>}

      {loading && !settings ? (
        <Card className="border-white/10 bg-white/[0.035] p-6 text-muted-foreground">
          {locale === "ru" ? "Загружаю настройки..." : "Loading settings..."}
        </Card>
      ) : settings ? (
        <>
          <Card className="border-white/10 bg-white/[0.035]">
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">VK ID</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {locale === "ru"
                    ? "Свяжите VK ID, чтобы входить в админский аккаунт без пароля."
                    : "Link VK ID to sign in to this admin account without a password."}
                </p>
              </div>
              <VkIdLinkButton next="/admin/pr/settings" className="w-full sm:w-auto" />
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <Card className="overflow-hidden border-white/10 bg-card/70">
              <CardContent className="space-y-5 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">{labels.profile}</p>
                    <p className="text-sm text-muted-foreground">{settings.user.email}</p>
                  </div>
                  <Badge variant="outline" className="border-cyan-300/25 bg-cyan-300/10 text-cyan-100">
                    {settings.user.referralCode ?? labels.noCode}
                  </Badge>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                  <label className="space-y-2">
                    <span className="text-sm font-medium text-muted-foreground">{labels.displayName}</span>
                    <Input value={name} onChange={(event) => setName(event.target.value.slice(0, 80))} maxLength={80} />
                  </label>
                  <Button onClick={() => void saveName()} disabled={saving || !name.trim() || name.trim() === settings.user.name}>
                    <Save className="h-4 w-4" />
                    {saving ? labels.saving : labels.save}
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{labels.role}</p>
                    <p className="mt-2 font-semibold">{settings.user.role}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{labels.status}</p>
                    <p className="mt-2 font-semibold">{settings.user.accountStatus}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{labels.updatedAt}</p>
                    <p className="mt-2 text-sm font-semibold">{formatDate(settings.user.updatedAt, locale)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-cyan-300/15 bg-[radial-gradient(circle_at_85%_0%,rgba(103,232,249,0.14),transparent_36%),rgba(255,255,255,0.035)]">
              <CardContent className="space-y-5 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="flex items-center gap-2 text-lg font-semibold">
                      <Send className="h-5 w-5 text-cyan-100" /> {labels.telegram}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{labels.telegramText}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      connectedTelegram
                        ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
                        : "border-amber-300/25 bg-amber-300/10 text-amber-100",
                    )}
                  >
                    {connectedTelegram ? labels.telegramConnected : labels.telegramEmpty}
                  </Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Telegram ID</p>
                    <p className="mt-2 font-semibold">{maskTelegram(connectedTelegramId, labels.telegramEmpty)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{labels.phone}</p>
                    <p className="mt-2 font-semibold">{settings.user.phoneNumber ?? labels.phoneEmpty}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={() => void createTelegramLink()} disabled={creatingLink}>
                    <ShieldCheck className="h-4 w-4" />
                    {creatingLink ? labels.creatingLink : connectedTelegram ? labels.reconnect : labels.connect}
                  </Button>
                  {telegramLink && (
                    <>
                      <Button asChild className="bg-white text-black hover:bg-white/90">
                        <a href={telegramLink} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" /> {labels.openBot}
                        </a>
                      </Button>
                      <Button variant="outline" onClick={() => void copyTelegramLink()}>
                        <Copy className="h-4 w-4" /> {labels.copyLink}
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: labels.companies, value: settings.stats.totalCompanies, icon: Building2 },
              { label: labels.activeCompanies, value: settings.stats.activeCompanies, icon: CheckCircle2 },
              { label: labels.funnel, value: settings.stats.funnelCompanies, icon: ClipboardList },
              { label: labels.payouts, value: settings.stats.pendingPayouts, icon: WalletCards },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label} className="border-white/10 bg-white/[0.035]">
                <CardContent className="flex items-center justify-between gap-4 p-5">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
                    <p className="mt-2 text-3xl font-semibold">{value}</p>
                  </div>
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-100">
                    <Icon className="h-5 w-5" />
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[1fr_0.72fr]">
            <Card className="border-white/10 bg-white/[0.035]">
              <CardContent className="p-5">
                <p className="mb-4 text-lg font-semibold">{labels.links}</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {quickLinks.map(({ href, label, description, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className="group flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-cyan-200/30 hover:bg-cyan-300/[0.06]"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-cyan-100">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block font-semibold">{label}</span>
                          <span className="block truncate text-sm text-muted-foreground">{description}</span>
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-cyan-100" />
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/[0.035]">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-lg font-semibold">{labels.permissions}</p>
                  <Badge variant="outline" className="border-white/10 bg-white/[0.04] text-muted-foreground">
                    <Link2 className="h-3.5 w-3.5" /> {settings.permissions.filter((item) => item.canView).length}
                  </Badge>
                </div>
                <div className="grid gap-2">
                  {settings.permissions.filter((item) => item.canView).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/15 p-4 text-sm text-muted-foreground">—</div>
                  ) : (
                    settings.permissions
                      .filter((item) => item.canView)
                      .map((permission) => (
                        <div key={permission.scope} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                          <span className="font-medium">{permission.scope}</span>
                          <span className="text-sm text-muted-foreground">{labels.enabled}</span>
                        </div>
                      ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
