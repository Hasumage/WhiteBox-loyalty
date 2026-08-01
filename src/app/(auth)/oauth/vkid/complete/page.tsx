"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NearLoyLogo } from "@/components/brand/NearLoyLogo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authenticatedDestination, completeVkIdLogin, setStoredSession } from "@/lib/api/auth-client";

function withCapacitorFlag(href: string) {
  const [pathWithSearch, hash = ""] = href.split("#", 2);
  const [path, search = ""] = pathWithSearch.split("?", 2);
  const params = new URLSearchParams(search);
  params.set("app", "capacitor");
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}

function resolveDestination(result: Awaited<ReturnType<typeof completeVkIdLogin>>) {
  if (!("accessToken" in result) || !result.accessToken) return "/login";
  const redirectAfter = result.redirectAfter ?? null;
  const isMobileApp = redirectAfter?.includes("app=capacitor");
  const destination =
    result.user.role === "REGISTERED" && result.needsCategoryOnboarding
      ? "/onboarding"
      : authenticatedDestination(result.user, redirectAfter);
  return isMobileApp ? withCapacitorFlag(destination) : destination;
}

export default function VkIdCompletePage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const ticket = searchParams.get("ticket")?.trim();
    if (!ticket) {
      setError("VK ID не вернул код входа. Попробуйте ещё раз.");
      return;
    }

    let cancelled = false;
    void (async () => {
      const result = await completeVkIdLogin(ticket);
      if (cancelled) return;
      if (!("accessToken" in result) || !result.accessToken) {
        setError("message" in result ? result.message : "Не удалось войти через VK ID.");
        return;
      }
      setStoredSession(result);
      window.dispatchEvent(new Event("nearloy:auth-updated"));
      router.replace(resolveDestination(result));
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <Card className="glass border-white/10">
      <CardHeader>
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
          <NearLoyLogo className="h-9 w-9 shrink-0" />
          <span>
            <span className="block text-sm font-semibold text-foreground">NearLoy</span>
            <span className="block text-xs text-muted-foreground">VK ID</span>
          </span>
        </div>
        <CardTitle>{error ? "Не удалось войти" : "Входим через VK ID"}</CardTitle>
        <CardDescription>
          {error || "Проверяем ответ VK ID и открываем ваш кабинет NearLoy."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!error && (
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-cyan-200" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
