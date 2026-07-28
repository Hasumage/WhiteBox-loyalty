"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, CalendarDays, CheckCircle2, Copy, ExternalLink, Lock, LogOut, MapPin, RefreshCw, Send, Shield, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ChangePasswordDialog } from "@/components/settings/ChangePasswordDialog";
import { DeleteAccountDialog } from "@/components/settings/DeleteAccountDialog";
import { clearStoredSession, getStoredUser, type StoredUser } from "@/lib/api/auth-client";
import {
  createUserTelegramLink,
  getTwaProfile,
  getUserTelegramStatus,
  requestTelegramPhone,
  updateTwaProfile,
  updateTwaProfilePreferences,
  type TwaProfile,
  type UserTelegramConnectionStatus,
  type UserTelegramLink,
} from "@/lib/api/twa-client";
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
} from "@/lib/browser-notifications/client-module";
import { getGeolocationPosition } from "@/lib/capacitor/native-permissions";
import { maskEmail } from "@/lib/email-mask";
import { useI18n } from "@/lib/i18n/use-i18n";

type ProfilePreferences = TwaProfile["preferences"];

const fallbackPreferences: ProfilePreferences = {
  onboardingCompletedAt: null,
  onboardingSkippedAt: null,
  geolocationPromptedAt: null,
  profileVisibility: "PRIVATE",
  marketingOptIn: false,
  showActivityStats: true,
  browserNotificationsEnabled: false,
  geoNotificationsEnabled: false,
};

function maskTelegramId(value: string | null | undefined) {
  if (!value) return "-";
  if (value.length <= 5) return value;
  return `${value.slice(0, 2)}•••${value.slice(-3)}`;
}

function toDateInput(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

function todayInputValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export default function SettingsAccountPage() {
  const { t } = useI18n("ru");
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [preferences, setPreferences] = useState<ProfilePreferences>(fallbackPreferences);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");
  const [birthDate, setBirthDate] = useState("");
  const [savedBirthDate, setSavedBirthDate] = useState("");
  const [birthDateSaving, setBirthDateSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [telegramStatus, setTelegramStatus] = useState<UserTelegramConnectionStatus | null>(null);
  const [telegramLink, setTelegramLink] = useState<UserTelegramLink | null>(null);
  const [telegramBusy, setTelegramBusy] = useState(false);
  const [telegramMessage, setTelegramMessage] = useState<string | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
    setNotificationPermission(getBrowserNotificationPermission());
    void (async () => {
      const [profile, telegram] = await Promise.all([getTwaProfile(), getUserTelegramStatus()]);
      setPreferences(profile.preferences);
      const profileBirthDate = toDateInput(profile.user.birthDate);
      setBirthDate(profileBirthDate);
      setSavedBirthDate(profileBirthDate);
      if (telegram.ok) setTelegramStatus(telegram.data);
      if (!telegram.ok) setTelegramMessage(telegram.message);
    })();
  }, []);

  function handleLogout() {
    clearStoredSession();
    router.push("/login");
  }

  async function updatePreference(input: Parameters<typeof updateTwaProfilePreferences>[0]) {
    setMessage(null);
    const res = await updateTwaProfilePreferences(input);
    if (!res.ok) {
      setMessage(res.message);
      return;
    }
    setPreferences(res.data);
  }

  async function ensureBrowserNotificationsAllowed() {
    const permission = await requestBrowserNotificationPermission();
    setNotificationPermission(permission);
    if (permission === "unsupported") {
      setMessage(t("client.account.browserNotificationsUnsupported"));
      return false;
    }
    if (permission !== "granted") {
      setMessage(t("client.account.browserNotificationsDenied"));
      return false;
    }
    return true;
  }

  async function toggleBrowserNotifications(checked: boolean) {
    setMessage(null);
    if (checked && !(await ensureBrowserNotificationsAllowed())) return;
    await updatePreference({ browserNotificationsEnabled: checked });
  }

  async function toggleGeoNotifications(checked: boolean) {
    setMessage(null);
    if (checked && !(await ensureBrowserNotificationsAllowed())) return;
    if (checked) {
      try {
        await getGeolocationPosition({ maximumAge: 5 * 60 * 1000, timeout: 8000, enableHighAccuracy: false });
      } catch (error) {
        setMessage(
          error instanceof Error && error.message === "geolocation-unavailable"
            ? t("client.account.geoNotificationsUnsupported")
            : t("client.account.geoNotificationsNeedAccess"),
        );
        return;
      }
    }
    await updatePreference({ geoNotificationsEnabled: checked });
  }

  async function saveBirthDate() {
    setMessage(null);
    setBirthDateSaving(true);
    const res = await updateTwaProfile({ birthDate: birthDate || null });
    setBirthDateSaving(false);
    if (!res.ok) {
      setMessage(res.message);
      return;
    }
    setPreferences(res.data.preferences);
    const nextBirthDate = toDateInput(res.data.user.birthDate);
    setBirthDate(nextBirthDate);
    setSavedBirthDate(nextBirthDate);
    setMessage(t("client.account.birthDateSaved"));
  }

  async function refreshTelegramStatus() {
    setTelegramMessage(null);
    const res = await getUserTelegramStatus();
    if (!res.ok) {
      setTelegramMessage(res.message);
      return;
    }
    setTelegramStatus(res.data);
    if (res.data.connected) setTelegramLink(null);
  }

  async function createTelegramConnectLink() {
    setTelegramBusy(true);
    setTelegramMessage(null);
    const res = await createUserTelegramLink();
    setTelegramBusy(false);
    if (!res.ok) {
      setTelegramMessage(res.message);
      return;
    }
    setTelegramLink(res.data);
    setTelegramMessage(t("client.account.telegramLinkReady"));
  }

  async function copyTelegramLink() {
    if (!telegramLink?.deepLink) return;
    await navigator.clipboard?.writeText(telegramLink.deepLink).catch(() => undefined);
    setTelegramMessage(t("client.account.telegramLinkCopied"));
  }

  async function copyTelegramCommand() {
    if (!telegramLink?.token) return;
    await navigator.clipboard?.writeText(`/start link_${telegramLink.token}`).catch(() => undefined);
    setTelegramMessage(t("client.account.telegramCommandCopied"));
  }

  async function requestPhoneBinding() {
    setTelegramBusy(true);
    setTelegramMessage(null);
    const res = await requestTelegramPhone();
    setTelegramBusy(false);
    if (!res.ok) {
      setTelegramMessage(res.message);
      return;
    }
    setTelegramMessage(t("client.account.telegramPhoneRequested"));
  }

  const masked = user?.email ? maskEmail(user.email) : "-";
  const canSaveBirthDate = birthDate !== savedBirthDate && !birthDateSaving;
  const telegramConnected = Boolean(telegramStatus?.connected);

  return (
    <div className="mx-auto max-w-lg px-4 pb-4 pt-6">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">{t("client.account.title")}</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        {t("client.account.subtitle")}
      </p>

      {message && <div className="mb-3 rounded-2xl border border-white/10 bg-muted/10 px-4 py-3 text-sm">{message}</div>}

      <Card className="glass border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("client.account.personalData")}</CardTitle>
          <CardDescription>{t("client.account.coreFields")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between rounded-xl bg-muted/20 px-3 py-2">
            <span className="text-xs text-muted-foreground">{t("client.account.name")}</span>
            <span className="text-sm font-medium">{user?.name ?? "-"}</span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-muted/20 px-3 py-2">
            <span className="text-xs text-muted-foreground">{t("client.account.email")}</span>
            <span className="text-sm font-medium">{masked}</span>
          </div>
          <div className="mt-3 rounded-2xl border border-white/10 bg-muted/10 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <CalendarDays className="h-4 w-4 text-primary" />
              {t("client.account.birthDate")}
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input
                type="date"
                max={todayInputValue()}
                value={birthDate}
                onChange={(event) => setBirthDate(event.target.value)}
                className="h-11 rounded-xl border-white/10 bg-black/20 [color-scheme:dark]"
              />
              <Button
                type="button"
                variant="secondary"
                className="rounded-xl"
                disabled={!canSaveBirthDate}
                onClick={() => void saveBirthDate()}
              >
                {birthDateSaving ? t("client.account.savingBirthDate") : t("client.account.saveBirthDate")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass mt-3 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            {t("client.account.privacy")}
          </CardTitle>
          <CardDescription>{t("client.account.privacySubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {(["PRIVATE", "FRIENDS", "PUBLIC"] as const).map((visibility) => (
              <button
                key={visibility}
                type="button"
                onClick={() => void updatePreference({ profileVisibility: visibility })}
                className={`rounded-xl border px-2 py-2 text-xs font-semibold ${
                  preferences.profileVisibility === visibility
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-white/10 bg-muted/10 text-muted-foreground"
                }`}
              >
                {visibility.toLowerCase()}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-muted/10 px-3 py-3">
            <div>
              <p className="text-sm font-medium">{t("client.account.showActivityStats")}</p>
              <p className="text-xs text-muted-foreground">{t("client.account.showActivityStatsSubtitle")}</p>
            </div>
            <Switch
              checked={preferences.showActivityStats}
              onCheckedChange={(checked) => void updatePreference({ showActivityStats: checked })}
            />
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-muted/10 px-3 py-3">
            <div>
              <p className="text-sm font-medium">{t("client.account.marketingUpdates")}</p>
              <p className="text-xs text-muted-foreground">{t("client.account.marketingUpdatesSubtitle")}</p>
            </div>
            <Switch
              checked={preferences.marketingOptIn}
              onCheckedChange={(checked) => void updatePreference({ marketingOptIn: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="glass mt-3 border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("client.account.notifications")}</CardTitle>
          <CardDescription>{t("client.account.notificationsSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-muted/10 px-3 py-3">
            <div className="flex min-w-0 gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-100">
                <Bell className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{t("client.account.browserNotifications")}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{t("client.account.browserNotificationsSubtitle")}</p>
                {telegramConnected && (
                  <p className="mt-1 text-xs text-cyan-100/70">{t("client.account.browserNotificationsTelegramPriority")}</p>
                )}
              </div>
            </div>
            <Switch
              checked={preferences.browserNotificationsEnabled}
              onCheckedChange={(checked) => void toggleBrowserNotifications(checked)}
              disabled={notificationPermission === "unsupported"}
              aria-label="Browser notifications"
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-muted/10 px-3 py-3">
            <div className="flex min-w-0 gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-300/10 text-emerald-100">
                <MapPin className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{t("client.account.geoNotifications")}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{t("client.account.geoNotificationsSubtitle")}</p>
              </div>
            </div>
            <Switch
              checked={preferences.geoNotificationsEnabled}
              onCheckedChange={(checked) => void toggleGeoNotifications(checked)}
              disabled={notificationPermission === "unsupported"}
              aria-label="Nearby partner notifications"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="glass mt-3 overflow-hidden border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4 text-primary" />
            {t("client.account.telegramTitle")}
          </CardTitle>
          <CardDescription>{t("client.account.telegramSubtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {telegramStatus?.connected ? (
            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-300/15 text-emerald-100">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-emerald-50">{t("client.account.telegramConnected")}</p>
                  <p className="mt-1 text-xs leading-relaxed text-emerald-50/70">
                    {t("client.account.telegramConnectedDescription")}
                  </p>
                  <p className="mt-2 text-xs text-emerald-50/65">
                    {t("client.account.telegramConnectedId")}:{" "}
                    <span className="font-semibold text-emerald-50">{maskTelegramId(telegramStatus.telegramId)}</span>
                  </p>
                  <p className="mt-1 text-xs text-emerald-50/65">
                    {t("client.account.telegramPhone")}:{" "}
                    <span className="font-semibold text-emerald-50">
                      {telegramStatus.phoneNumber ?? t("client.account.telegramPhoneMissing")}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-muted/10 p-3">
              <p className="font-semibold">{t("client.account.telegramNotConnected")}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {t("client.account.telegramNotConnectedDescription")}
              </p>
            </div>
          )}

          {telegramLink && (
            <div className="space-y-3 rounded-2xl border border-cyan-200/20 bg-cyan-400/10 p-3">
              <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/45">
                  {t("client.account.telegramDeepLink")}
                </p>
                <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-cyan-50/90">{telegramLink.deepLink}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100/45">
                  {t("client.account.telegramStartCommand")}
                </p>
                <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-white/90">
                  /start link_{telegramLink.token}
                </p>
              </div>
              <p className="text-xs leading-relaxed text-cyan-50/70">{t("client.account.telegramManualHint")}</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <Button asChild size="sm" className="rounded-xl">
                  <a href={telegramLink.deepLink} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">{t("client.account.telegramOpenBot")}</span>
                  </a>
                </Button>
                <Button type="button" size="sm" variant="secondary" className="rounded-xl px-3" onClick={copyTelegramLink}>
                  <Copy className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">{t("client.account.telegramCopyLinkShort")}</span>
                </Button>
                <Button type="button" size="sm" variant="secondary" className="rounded-xl px-3" onClick={copyTelegramCommand}>
                  <Copy className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">{t("client.account.telegramCopyCommandShort")}</span>
                </Button>
              </div>
            </div>
          )}

          {telegramMessage && <div className="rounded-2xl border border-white/10 bg-muted/10 px-3 py-2 text-xs">{telegramMessage}</div>}

          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Button
              type="button"
              variant={telegramStatus?.connected ? "secondary" : "default"}
              className="rounded-xl"
              disabled={telegramBusy || telegramStatus?.canConnect === false}
              onClick={createTelegramConnectLink}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              {telegramBusy
                ? t("client.account.telegramCreating")
                : telegramStatus?.connected
                  ? t("client.account.telegramReconnect")
                  : t("client.account.telegramCreateLink")}
            </Button>
            <Button type="button" variant="outline" className="glass rounded-xl border-white/10" onClick={refreshTelegramStatus}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t("client.account.telegramRefresh")}
            </Button>
          </div>
          {telegramStatus?.connected && (
            <Button
              type="button"
              variant="outline"
              className="glass w-full rounded-xl border-cyan-200/20"
              disabled={telegramBusy}
              onClick={requestPhoneBinding}
            >
              <Send className="mr-2 h-4 w-4" />
              {telegramStatus.phoneNumber
                ? t("client.account.telegramPhoneRefresh")
                : t("client.account.telegramPhoneRequest")}
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button type="button" variant="secondary" className="glass border-white/10" onClick={() => setPasswordOpen(true)}>
          <Lock className="mr-2 h-4 w-4" />
          {t("client.account.changePassword")}
        </Button>
        <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>
          {t("client.account.removeProfile")}
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="glass border-white/10" asChild>
          <Link href="/help/privacy?section=settings-account" scroll={false}>
            <Shield className="mr-2 h-4 w-4" />
            {t("client.account.privacyPolicy")}
          </Link>
        </Button>
        <Button type="button" variant="secondary" size="sm" className="glass border-white/10" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          {t("client.account.logout")}
        </Button>
      </div>

      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
      <DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
    </div>
  );
}
