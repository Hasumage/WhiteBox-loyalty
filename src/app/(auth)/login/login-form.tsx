"use client";

import { ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { NearLoyLogo } from "@/components/brand/NearLoyLogo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FrozenAccountDialog } from "@/components/auth/FrozenAccountDialog";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
import {
  authenticatedDestination,
  login,
  loginWithTelegramMiniApp,
  refreshStoredSession,
  setStoredSession,
  type AuthTokensResponse,
  vkIdLoginUrl,
} from "@/lib/api/auth-client";
import { SESSION_RESTORE_TIMEOUT_MS } from "@/lib/api/fetch-timeout";
import { useIsCapacitorApp } from "@/lib/capacitor/use-is-capacitor-app";
import { useI18n } from "@/lib/i18n/use-i18n";

type TelegramWindow = Window & {
  Telegram?: {
    WebApp?: {
      initData?: string;
      ready?: () => void;
      expand?: () => void;
    };
  };
};

const loginCopy = {
  ru: {
    forgotPassword: "Забыли пароль?",
    restoringSession: "Восстанавливаем сессию NearLoy...",
  },
  en: {
    forgotPassword: "Forgot password?",
    restoringSession: "Restoring NearLoy session...",
  },
} as const;

type LoginFormProps = {
  deleted?: boolean;
  frozen?: boolean;
  requestedNext?: string | null;
};

export function LoginForm({ deleted = false, frozen = false, requestedNext = null }: LoginFormProps) {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n("ru");
  const isCapacitorApp = useIsCapacitorApp();
  const text = loginCopy[locale] ?? loginCopy.ru;
  const restoreAttemptedRef = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoringSession, setRestoringSession] = useState(false);
  const [frozenOpen, setFrozenOpen] = useState(false);
  const [pendingNext, setPendingNext] = useState("/");
  const [frozenMeta, setFrozenMeta] = useState<{ name: string; at: string | null } | null>(null);

  function enterSession(data: AuthTokensResponse) {
    const destination = authenticatedDestination(data.user, requestedNext);
    setStoredSession(data);
    window.dispatchEvent(new Event("nearloy:auth-updated"));

    if (data.user.accountStatus === "FROZEN_PENDING_DELETION") {
      setPendingNext(destination);
      setFrozenMeta({
        name: data.user.name,
        at: data.user.deletionScheduledAt ?? null,
      });
      setFrozenOpen(true);
      return;
    }

    router.replace(destination);
  }

  useEffect(() => {
    if (isCapacitorApp === null || restoreAttemptedRef.current) return;

    restoreAttemptedRef.current = true;
    let cancelled = false;
    const restoreGuardId = window.setTimeout(() => {
      if (!cancelled) setRestoringSession(false);
    }, SESSION_RESTORE_TIMEOUT_MS + 2_000);

    setRestoringSession(true);

    void (async () => {
      const webApp = (window as TelegramWindow).Telegram?.WebApp;
      webApp?.ready?.();
      webApp?.expand?.();
      const initData = webApp?.initData?.trim();
      let telegramError: string | null = null;

      if (initData && !isCapacitorApp) {
        const result = await loginWithTelegramMiniApp(initData);
        if (cancelled) return;
        if ("accessToken" in result && result.accessToken) {
          enterSession(result);
          return;
        }
        telegramError = "message" in result ? result.message : "automatic sign-in failed";
      }

      const restored = await refreshStoredSession();
      if (cancelled) return;
      if (restored) {
        enterSession(restored);
        return;
      }
      if (telegramError) {
        setError(`Telegram: ${telegramError}`);
      }
      setRestoringSession(false);
    })().catch((err: unknown) => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : t("client.auth.loginFailed"));
      setRestoringSession(false);
    }).finally(() => {
      window.clearTimeout(restoreGuardId);
    });

    return () => {
      cancelled = true;
      window.clearTimeout(restoreGuardId);
    };
    // Session restoration navigates away; rerun only if the destination changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCapacitorApp, requestedNext, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await login({ email, password });
      if (!("accessToken" in data) || !data.accessToken) {
        setError("message" in data ? data.message : t("client.auth.loginFailed"));
        return;
      }
      const safe = authenticatedDestination(data.user, requestedNext);

      if (data.user.accountStatus === "FROZEN_PENDING_DELETION") {
        setStoredSession(data);
        setPendingNext(safe);
        setFrozenMeta({
          name: data.user.name,
          at: data.user.deletionScheduledAt ?? null,
        });
        setFrozenOpen(true);
        return;
      }

      setStoredSession(data);
      router.replace(safe);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("client.auth.loginFailed"));
    } finally {
      setLoading(false);
    }
  }

  function startVkIdLogin() {
    window.location.assign(vkIdLoginUrl(requestedNext));
  }

  return (
    <Card className="glass border-white/10">
      <CardHeader>
        <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <NearLoyLogo className="h-9 w-9 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">NearLoy</span>
              <span className="block truncate text-xs text-muted-foreground">{t("client.auth.brandSubtitle")}</span>
            </span>
          </Link>
          {isCapacitorApp === false && (
            <Link
              href="/"
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-white/20 hover:bg-white/[0.06] hover:text-foreground"
            >
              {t("client.auth.landing")} <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{t("client.auth.loginTitle")}</CardTitle>
          <LanguageSwitcher locale={locale} onChange={(nextLocale) => void setLocale(nextLocale)} compact />
        </div>
        <CardDescription>{t("client.auth.loginSubtitle")}</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          {deleted && (
            <p
              className="rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-primary"
              role="status"
            >
              {t("client.auth.deletedNotice")}
            </p>
          )}
          {frozen && (
            <p
              className="rounded-lg border border-sky-500/35 bg-sky-950/50 px-3 py-2 text-sm text-sky-200"
              role="status"
            >
              {t("client.auth.frozenNotice")}
            </p>
          )}
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          {restoringSession && (
            <p
              className="rounded-lg border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-2 text-sm text-cyan-100"
              role="status"
            >
              {text.restoringSession}
            </p>
          )}
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground" htmlFor="email">
              {t("client.auth.email")}
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
              className="glass border-white/10"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground" htmlFor="password">
              {t("client.auth.password")}
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
              minLength={8}
              className="glass border-white/10"
            />
            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                {text.forgotPassword}
              </Link>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pt-6">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("client.auth.signingIn") : t("client.auth.signIn")}
          </Button>
          <Button
            type="button"
            className="w-full bg-[#0077ff] text-white shadow-[0_12px_30px_rgba(0,119,255,0.28)] hover:bg-[#0b83ff]"
            onClick={startVkIdLogin}
            disabled={loading}
          >
            Войти через VK ID
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("client.auth.noAccount")}{" "}
            <Link href="/register" className="text-primary underline-offset-4 hover:underline">
              {t("client.auth.registerLink")}
            </Link>
          </p>
        </CardFooter>
      </form>

      <FrozenAccountDialog
        open={frozenOpen}
        onOpenChange={setFrozenOpen}
        userName={frozenMeta?.name ?? ""}
        deletionScheduledAt={frozenMeta?.at ?? null}
        onClosed={() => router.replace(pendingNext)}
      />
    </Card>
  );
}
