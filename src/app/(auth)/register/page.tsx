"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { WhiteBoxLogo } from "@/components/brand/WhiteBoxLogo";
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
import { register as registerApi, setStoredSession } from "@/lib/api/auth-client";
import { useI18n } from "@/lib/i18n/use-i18n";

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useI18n("ru");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await registerApi({ name, email, password });
      if (!("accessToken" in data) || !data.accessToken) {
        const msg =
          "message" in data
            ? Array.isArray(data.message)
              ? data.message.join(", ")
              : String(data.message)
            : t("client.auth.registrationFailed");
        setError(msg);
        return;
      }
      setStoredSession(data);
      router.replace(data.needsCategoryOnboarding ? "/onboarding" : "/");
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
          <Link href="/landing" className="flex min-w-0 items-center gap-3">
            <WhiteBoxLogo className="h-9 w-9 shrink-0" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">WhiteBox</span>
              <span className="block truncate text-xs text-muted-foreground">{t("client.auth.brandSubtitle")}</span>
            </span>
          </Link>
          <Link
            href="/landing"
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:border-white/20 hover:bg-white/[0.06] hover:text-foreground"
          >
            {t("client.auth.landing")} <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <CardTitle>{t("client.auth.registerTitle")}</CardTitle>
        <CardDescription>{t("client.auth.registerSubtitle")}</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
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
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pt-8">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("client.auth.creating") : t("client.auth.createAccount")}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            {t("client.auth.haveAccount")}{" "}
            <Link href="/login" className="text-primary underline-offset-4 hover:underline">
              {t("client.auth.signIn")}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
