"use client";

import { ArrowUpRight } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { FrozenAccountDialog } from "@/components/auth/FrozenAccountDialog";
import { login, setStoredSession } from "@/lib/api/auth-client";
import { useI18n } from "@/lib/i18n/use-i18n";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n("ru");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [frozenOpen, setFrozenOpen] = useState(false);
  const [pendingNext, setPendingNext] = useState("/");
  const [frozenMeta, setFrozenMeta] = useState<{ name: string; at: string | null } | null>(null);

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
      const next = searchParams.get("next");
      const safe =
        data.user.role === "ADMIN"
          ? "/admin"
          : data.user.role === "COMPANY"
            ? "/company"
            : next && next.startsWith("/") && !next.startsWith("//")
              ? next
              : "/";

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
        <CardTitle>{t("client.auth.loginTitle")}</CardTitle>
        <CardDescription>{t("client.auth.loginSubtitle")}</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-4">
          {searchParams.get("deleted") === "1" && (
            <p
              className="rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-sm text-primary"
              role="status"
            >
              {t("client.auth.deletedNotice")}
            </p>
          )}
          {searchParams.get("frozen") === "1" && (
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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="glass border-white/10"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pt-6">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("client.auth.signingIn") : t("client.auth.signIn")}
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
