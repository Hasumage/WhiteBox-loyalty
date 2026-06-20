"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, MailCheck } from "lucide-react";
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
  requestRegistrationCode,
  setStoredSession,
  verifyRegistrationCode,
} from "@/lib/api/auth-client";
import { useI18n } from "@/lib/i18n/use-i18n";

const copy = {
  ru: {
    verifyTitle: "Подтвердите email",
    verifySubtitle: "Мы отправили код на почту. Введите его ниже, чтобы создать аккаунт с подтвержденным email.",
    confirmPassword: "Повторите пароль",
    code: "Код из письма",
    sendCode: "Отправить код",
    sendingCode: "Отправляем код...",
    createAccount: "Создать аккаунт",
    creating: "Создаем аккаунт...",
    backToForm: "Изменить данные",
    codeSent: "Код отправлен. Проверьте входящие и папку спам.",
    passwordsMismatch: "Пароли не совпадают",
    codeHint: "Код действует ограниченное время. Если письмо не пришло, вернитесь назад и отправьте код ещё раз.",
  },
  en: {
    verifyTitle: "Verify email",
    verifySubtitle: "We sent a code to your email. Enter it below to create a verified account.",
    confirmPassword: "Repeat password",
    code: "Email code",
    sendCode: "Send code",
    sendingCode: "Sending code...",
    createAccount: "Create account",
    creating: "Creating account...",
    backToForm: "Edit details",
    codeSent: "Code sent. Check your inbox and spam folder.",
    passwordsMismatch: "Passwords do not match",
    codeHint: "The code expires soon. If you did not receive it, go back and send a new one.",
  },
} as const;

export default function RegisterPage() {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n("ru");
  const text = copy[locale] ?? copy.ru;
  const [step, setStep] = useState<"details" | "code">("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function normalizeMessage(message: unknown, fallback: string) {
    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string") return message;
    return fallback;
  }

  function responseMessage(response: unknown, fallback: string) {
    if (response && typeof response === "object" && "message" in response) {
      return normalizeMessage((response as { message?: unknown }).message, fallback);
    }
    return fallback;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (step === "details") {
      if (password !== confirmPassword) {
        setError(text.passwordsMismatch);
        return;
      }

      setLoading(true);
      try {
        const response = await requestRegistrationCode({ name, email, password, confirmPassword });
        if (!("success" in response)) {
          setError(responseMessage(response, t("client.auth.registrationFailed")));
          return;
        }
        setStep("code");
        setNotice(text.codeSent);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("client.auth.registrationFailed"));
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const data = await verifyRegistrationCode({ email, code });
      if (!("accessToken" in data) || !data.accessToken) {
        setError(responseMessage(data, t("client.auth.registrationFailed")));
        return;
      }
      setStoredSession(data);
      router.replace(data.needsCategoryOnboarding ? "/onboarding" : "/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("client.auth.registrationFailed"));
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
          <CardTitle>{step === "code" ? text.verifyTitle : t("client.auth.registerTitle")}</CardTitle>
          <LanguageSwitcher locale={locale} onChange={(nextLocale) => void setLocale(nextLocale)} compact />
        </div>
        <CardDescription>
          {step === "code" ? text.verifySubtitle : t("client.auth.registerSubtitle")}
        </CardDescription>
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

          {step === "details" ? (
            <>
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground" htmlFor="name">
                  {t("client.auth.name")}
                </label>
                <Input
                  id="name"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="glass border-white/10"
                />
              </div>
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
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="glass border-white/10"
                />
                <p className="text-xs text-muted-foreground">{t("client.auth.minPassword")}</p>
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
          ) : (
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
            </>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pt-8">
          <Button type="submit" className="w-full" disabled={loading}>
            {step === "details"
              ? loading
                ? text.sendingCode
                : text.sendCode
              : loading
                ? text.creating
                : text.createAccount}
          </Button>
          {step === "code" && (
            <Button
              type="button"
              variant="ghost"
              className="w-full gap-2"
              onClick={() => {
                setStep("details");
                setCode("");
                setError(null);
                setNotice(null);
              }}
            >
              <ArrowLeft className="h-4 w-4" /> {text.backToForm}
            </Button>
          )}
          <p className="text-center text-sm text-muted-foreground">
            {t("client.auth.haveAccount")} {" "}
            <Link href="/login" className="text-primary underline-offset-4 hover:underline">
              {t("client.auth.signIn")}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
