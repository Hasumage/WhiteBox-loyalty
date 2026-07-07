"use client";

import { ArrowLeft, ArrowUpRight, KeyRound, MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
import { confirmPasswordReset, requestPasswordResetCode } from "@/lib/api/auth-client";
import { useI18n } from "@/lib/i18n/use-i18n";

const copy = {
  ru: {
    title: "Восстановление пароля",
    subtitle: "Введите email аккаунта — мы отправим код для смены пароля.",
    verifyTitle: "Введите код",
    verifySubtitle: "Если аккаунт найден, код уже отправлен. Задайте новый пароль ниже.",
    email: "Email",
    code: "Код из письма",
    password: "Новый пароль",
    confirmPassword: "Повторите пароль",
    sendCode: "Отправить код",
    sendingCode: "Отправляем код...",
    savePassword: "Сменить пароль",
    savingPassword: "Сохраняем пароль...",
    backToLogin: "Назад ко входу",
    editEmail: "Изменить email",
    sent: "Если аккаунт существует, мы отправили код. Проверьте входящие и папку спам.",
    done: "Пароль обновлён. Теперь можно войти.",
    mismatch: "Пароли не совпадают",
    minPassword: "Минимум 8 символов.",
    codeHint: "Код действует ограниченное время. Повторная отправка доступна не сразу.",
  },
  en: {
    title: "Reset password",
    subtitle: "Enter your account email and we will send a password reset code.",
    verifyTitle: "Enter the code",
    verifySubtitle: "If the account exists, the code has been sent. Set a new password below.",
    email: "Email",
    code: "Email code",
    password: "New password",
    confirmPassword: "Repeat password",
    sendCode: "Send code",
    sendingCode: "Sending code...",
    savePassword: "Change password",
    savingPassword: "Saving password...",
    backToLogin: "Back to login",
    editEmail: "Edit email",
    sent: "If the account exists, we sent a code. Check your inbox and spam folder.",
    done: "Password updated. You can sign in now.",
    mismatch: "Passwords do not match",
    minPassword: "At least 8 characters.",
    codeHint: "The code expires soon. Resending is not available immediately.",
  },
} as const;

function responseMessage(response: unknown, fallback: string) {
  if (!response || typeof response !== "object" || !("message" in response)) return fallback;
  const message = (response as { message?: unknown }).message;
  if (Array.isArray(message)) return message.join(", ");
  return typeof message === "string" ? message : fallback;
}

export default function ForgotPasswordPage() {
  const { locale, setLocale, t } = useI18n("ru");
  const text = copy[locale] ?? copy.ru;
  const [step, setStep] = useState<"email" | "code" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (step === "email") {
      setLoading(true);
      try {
        const response = await requestPasswordResetCode({ email, locale });
        if (!("success" in response)) {
          setError(responseMessage(response, t("client.auth.loginFailed")));
          return;
        }
        setStep("code");
        setNotice(text.sent);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("client.auth.loginFailed"));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (password !== confirmPassword) {
      setError(text.mismatch);
      return;
    }

    setLoading(true);
    try {
      const response = await confirmPasswordReset({ email, code, password, confirmPassword });
      if (!("success" in response)) {
        setError(responseMessage(response, t("client.auth.loginFailed")));
        return;
      }
      setStep("done");
      setNotice(text.done);
      setCode("");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("client.auth.loginFailed"));
    } finally {
      setLoading(false);
    }
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
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-white/20 hover:bg-white/[0.06] hover:text-foreground"
          >
            {t("client.auth.landing")} <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{step === "email" ? text.title : text.verifyTitle}</CardTitle>
          <LanguageSwitcher locale={locale} onChange={(nextLocale) => void setLocale(nextLocale)} compact />
        </div>
        <CardDescription>{step === "email" ? text.subtitle : text.verifySubtitle}</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          {notice && (
            <div className="flex gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4 text-sm text-cyan-50">
              <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{notice}</p>
            </div>
          )}
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          {step === "email" && (
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground" htmlFor="email">
                {text.email}
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="glass border-white/10"
              />
            </div>
          )}

          {step === "code" && (
            <>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-sm text-muted-foreground">
                {email}
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground" htmlFor="code">
                  {text.code}
                </label>
                <Input
                  id="code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  minLength={6}
                  maxLength={6}
                  className="glass border-white/10 text-center text-2xl tracking-[0.45em]"
                />
                <p className="text-xs text-muted-foreground">{text.codeHint}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground" htmlFor="password">
                  {text.password}
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="glass border-white/10"
                />
                <p className="text-xs text-muted-foreground">{text.minPassword}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground" htmlFor="confirmPassword">
                  {text.confirmPassword}
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="glass border-white/10"
                />
              </div>
            </>
          )}

          {step === "done" && (
            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-5 text-center text-cyan-50">
              <KeyRound className="mx-auto mb-3 h-6 w-6" />
              <p className="font-semibold">{text.done}</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pt-8">
          {step !== "done" ? (
            <Button type="submit" className="w-full" disabled={loading}>
              {step === "email"
                ? loading
                  ? text.sendingCode
                  : text.sendCode
                : loading
                  ? text.savingPassword
                  : text.savePassword}
            </Button>
          ) : (
            <Button asChild className="w-full">
              <Link href="/login">{t("client.auth.signIn")}</Link>
            </Button>
          )}
          {step === "code" && (
            <Button
              type="button"
              variant="ghost"
              className="w-full gap-2"
              onClick={() => {
                setStep("email");
                setCode("");
                setPassword("");
                setConfirmPassword("");
                setError(null);
                setNotice(null);
              }}
            >
              <ArrowLeft className="h-4 w-4" /> {text.editEmail}
            </Button>
          )}
          <Link href="/login" className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline">
            {text.backToLogin}
          </Link>
        </CardFooter>
      </form>
    </Card>
  );
}
