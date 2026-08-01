"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NearLoyLogo } from "@/components/brand/NearLoyLogo";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
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
import {
  AuthTokensResponse,
  authenticatedDestination,
  getRefreshToken,
  login,
  refreshStoredSession,
  setStoredSession,
  vkIdLoginUrl,
} from "@/lib/api/auth-client";
import { useI18n } from "@/lib/i18n/use-i18n";

const mobileCopy = {
  ru: {
    checking: "Проверяем сохранённый вход. Форму можно использовать сразу.",
    ready: "Сессия найдена — открываем кабинет.",
    submit: "Войти",
    submitting: "Входим...",
    failed: "Не удалось войти",
    noAccount: "Нет аккаунта?",
    register: "Зарегистрироваться",
    forgotPassword: "Забыли пароль?",
  },
  en: {
    checking: "Checking saved sign in. You can use the form right away.",
    ready: "Session found — opening your workspace.",
    submit: "Sign in",
    submitting: "Signing in...",
    failed: "Sign in failed",
    noAccount: "No account?",
    register: "Register",
    forgotPassword: "Forgot password?",
  },
} as const;

function readSafeNext() {
  if (typeof window === "undefined") return null;
  const requestedNext = new URLSearchParams(window.location.search).get("next");
  return requestedNext && requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : null;
}
function responseMessage(response: unknown, fallback: string) {
  if (!response || typeof response !== "object" || !("message" in response)) return fallback;
  const message = (response as { message?: unknown }).message;
  if (Array.isArray(message)) return message.join(", ");
  return typeof message === "string" ? message : fallback;
}

function withCapacitorFlag(href: string) {
  const [pathWithSearch, hash = ""] = href.split("#", 2);
  const [path, search = ""] = pathWithSearch.split("?", 2);
  const params = new URLSearchParams(search);
  params.set("app", "capacitor");
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}

export default function MobileLoginPage() {
  const { locale, setLocale, t } = useI18n("ru");
  const text = mobileCopy[locale] ?? mobileCopy.ru;
  const [safeNext, setSafeNext] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checkingSession, setCheckingSession] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const manualLoginStartedRef = useRef(false);

  const registerHref = useMemo(() => {
    const params = new URLSearchParams({ app: "capacitor" });
    if (safeNext) params.set("next", safeNext);
    return `/mobile-register?${params.toString()}`;
  }, [safeNext]);

  const forgotPasswordHref = useMemo(() => "/mobile-forgot-password?app=capacitor", []);

  const enterSession = useCallback(
    (data: AuthTokensResponse) => {
      setStoredSession(data);
      window.dispatchEvent(new Event("nearloy:auth-updated"));
      window.location.replace(withCapacitorFlag(authenticatedDestination(data.user, readSafeNext() ?? "/app?app=capacitor")));
    },
    [],
  );

  useEffect(() => {
    setSafeNext(readSafeNext());
  }, []);

  useEffect(() => {
    if (!getRefreshToken()) return;

    let cancelled = false;
    setCheckingSession(true);

    refreshStoredSession()
      .then((data) => {
        if (cancelled || manualLoginStartedRef.current || !data?.accessToken) return;
        setSessionReady(true);
        enterSession(data);
      })
      .finally(() => {
        if (!cancelled) setCheckingSession(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enterSession]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    manualLoginStartedRef.current = true;
    setError(null);
    setLoading(true);

    try {
      const data = await login({ email, password });
      if (!("accessToken" in data) || !data.accessToken) {
        setError(responseMessage(data, text.failed));
        return;
      }
      enterSession(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : text.failed);
    } finally {
      setLoading(false);
    }
  }

  function startVkIdLogin() {
    window.location.assign(vkIdLoginUrl(readSafeNext() ?? "/app?app=capacitor"));
  }

  return (
    <Card className="glass border-white/10">
      <CardHeader>
        <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
          <div className="flex min-w-0 items-center gap-3">
            <NearLoyLogo className="h-9 w-9 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">NearLoy</span>
              <span className="block truncate text-xs text-muted-foreground">{t("client.auth.brandSubtitle")}</span>
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{t("client.auth.loginTitle")}</CardTitle>
          <LanguageSwitcher locale={locale} onChange={(nextLocale) => void setLocale(nextLocale)} compact />
        </div>
        <CardDescription>{t("client.auth.loginSubtitle")}</CardDescription>
      </CardHeader>

      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          {(checkingSession || sessionReady) && (
            <div className="flex gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm text-cyan-50">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{sessionReady ? text.ready : text.checking}</p>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="space-y-2">
            <label className="text-sm text-muted-foreground" htmlFor="mobile-email">
              {t("client.auth.email")}
            </label>
            <Input
              id="mobile-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="glass border-white/10"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm text-muted-foreground" htmlFor="mobile-password">
                {t("client.auth.password")}
              </label>
              <Link
                href={forgotPasswordHref}
                className="text-xs font-semibold text-foreground underline-offset-4 hover:underline"
              >
                {text.forgotPassword}
              </Link>
            </div>
            <Input
              id="mobile-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="glass border-white/10"
            />
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pt-8">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? text.submitting : text.submit}
          </Button>
          <Button
            type="button"
            className="w-full bg-[#0077ff] text-white shadow-[0_12px_30px_rgba(0,119,255,0.28)] hover:bg-[#0b83ff]"
            disabled={loading}
            onClick={startVkIdLogin}
          >
            Войти через VK ID
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {text.noAccount}{" "}
            <Link href={registerHref} className="text-primary underline-offset-4 hover:underline">
              {text.register}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
