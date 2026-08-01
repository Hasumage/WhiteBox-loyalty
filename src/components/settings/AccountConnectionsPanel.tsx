"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Link2, MessageCircle, RefreshCw, Send, ShieldCheck, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createVkIdLinkUrl } from "@/lib/api/auth-client";
import { fetchWithAuthRecovery } from "@/lib/api/authenticated-fetch";
import { cn } from "@/lib/utils";

type ProviderKey = "telegram" | "vkid" | "max";

type ProviderStatus = {
  connected: boolean;
  accountId: string | null;
  canUnlink: boolean;
  unlinkBlockedReason: string | null;
};

type ConnectionsResponse = {
  providers: Record<ProviderKey, ProviderStatus>;
};

type LinkResponse = {
  token: string;
  expiresAt: string;
  deepLink: string;
};

type ActiveLink = LinkResponse & {
  provider: "telegram" | "max";
  title: string;
  openLabel: string;
};

type AccountConnectionsPanelProps = {
  next: string;
  telegramLinkEndpoint?: string;
  className?: string;
};

const providers: Array<{
  key: ProviderKey;
  title: string;
  icon: typeof Send;
}> = [
  { key: "telegram", title: "Telegram", icon: Send },
  { key: "vkid", title: "VK ID", icon: ShieldCheck },
  { key: "max", title: "MAX", icon: MessageCircle },
];

async function readMessage(response: Response, fallback: string) {
  const data = await response.json().catch(() => ({}));
  return Array.isArray(data.message) ? data.message.join(", ") : data.message ?? fallback;
}

export function AccountConnectionsPanel({
  next,
  telegramLinkEndpoint = "/api/telegram/link-token",
  className,
}: AccountConnectionsPanelProps) {
  const [connections, setConnections] = useState<ConnectionsResponse | null>(null);
  const [activeLink, setActiveLink] = useState<ActiveLink | null>(null);
  const [busy, setBusy] = useState<ProviderKey | "refresh" | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setBusy((current) => current ?? "refresh");
    setMessage("");
    try {
      const response = await fetchWithAuthRecovery("/api/account/connections", { cache: "no-store" });
      if (!response.ok) {
        setMessage(await readMessage(response, "Не удалось загрузить подключения."));
        return;
      }
      setConnections((await response.json()) as ConnectionsResponse);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить подключения.");
    } finally {
      setBusy((current) => (current === "refresh" ? null : current));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function disconnect(provider: ProviderKey) {
    setBusy(provider);
    setMessage("");
    try {
      const response = await fetchWithAuthRecovery(`/api/account/connections?provider=${provider}`, {
        method: "DELETE",
        cache: "no-store",
      });
      if (!response.ok) {
        setMessage(await readMessage(response, "Не удалось отвязать аккаунт."));
        return;
      }
      setConnections((await response.json()) as ConnectionsResponse);
      setMessage("Подключение обновлено.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось отвязать аккаунт.");
    } finally {
      setBusy(null);
    }
  }

  async function createMessengerLink(
    provider: "telegram" | "max",
    endpoint: string,
    title: string,
    openLabel: string,
  ) {
    setBusy(provider);
    setMessage("");
    try {
      const response = await fetchWithAuthRecovery(endpoint, { method: "POST", cache: "no-store" });
      if (!response.ok) {
        setMessage(await readMessage(response, `Не удалось создать ссылку ${title}.`));
        return;
      }
      const data = (await response.json()) as LinkResponse;
      setActiveLink({ ...data, provider, title, openLabel });
      setMessage(`Ссылка ${title} готова на 15 минут.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Не удалось создать ссылку ${title}.`);
    } finally {
      setBusy(null);
    }
  }

  async function connectVk() {
    setBusy("vkid");
    setMessage("");
    const result = await createVkIdLinkUrl(next);
    setBusy(null);
    if ("url" in result) {
      window.location.assign(result.url);
      return;
    }
    setMessage(result.message);
  }

  function connect(provider: ProviderKey) {
    if (provider === "telegram") {
      return void createMessengerLink("telegram", telegramLinkEndpoint, "Telegram", "Открыть Telegram");
    }
    if (provider === "max") {
      return void createMessengerLink("max", "/api/max/link-token", "MAX", "Открыть MAX");
    }
    return void connectVk();
  }

  return (
    <Card className={cn("glass overflow-hidden border-white/10", className)}>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-lg font-semibold">Подключения аккаунта</p>
            <p className="text-sm leading-6 text-muted-foreground">Telegram, VK ID и MAX управляются в одном месте.</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void load()}
            disabled={busy === "refresh"}
            className="w-full shrink-0 rounded-xl sm:w-auto"
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", busy === "refresh" && "animate-spin")} />
            Обновить
          </Button>
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          {providers.map((provider) => {
            const status = connections?.providers[provider.key];
            const connected = Boolean(status?.connected);
            const Icon = provider.icon;
            return (
              <div
                key={provider.key}
                className="grid min-w-0 grid-cols-[44px_minmax(0,1fr)] gap-3 rounded-3xl border border-white/10 bg-white/[0.035] p-4 xl:grid-cols-1 xl:content-start xl:gap-4"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-100">
                  <Icon className="h-5 w-5" />
                </span>

                <div className="min-w-0">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <p className="font-semibold">{provider.title}</p>
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                        connected ? "bg-emerald-300/10 text-emerald-100" : "bg-white/10 text-muted-foreground",
                      )}
                    >
                      {connected ? "подключено" : "не подключено"}
                    </span>
                  </div>
                </div>

                <div
                  className={cn(
                    "col-span-2 grid min-w-0 gap-2 pt-1 sm:max-w-md xl:col-span-1 xl:max-w-none xl:pt-0",
                    connected ? "grid-cols-2" : "grid-cols-1",
                  )}
                >
                  <Button
                    type="button"
                    variant={connected ? "secondary" : "default"}
                    disabled={busy === provider.key}
                    onClick={() => connect(provider.key)}
                    className="min-w-0 rounded-xl px-3"
                  >
                    <Link2 className="mr-2 h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {busy === provider.key ? "Готовим..." : connected ? "Сменить" : "Связать"}
                    </span>
                  </Button>
                  {connected && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy === provider.key || !status?.canUnlink}
                      onClick={() => void disconnect(provider.key)}
                      className="glass min-w-0 rounded-xl border-white/10 px-3"
                    >
                      <Unlink className="mr-2 h-4 w-4 shrink-0" />
                      <span className="truncate">Отвязать</span>
                    </Button>
                  )}
                  {connected && !status?.canUnlink && status?.unlinkBlockedReason && (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {status.unlinkBlockedReason}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {activeLink && (
          <div className="rounded-2xl border border-cyan-200/20 bg-cyan-300/10 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-cyan-50">
              <CheckCircle2 className="h-4 w-4" />
              Ссылка {activeLink.title} готова
            </p>
            <p className="mt-2 break-all font-mono text-xs text-cyan-50/80">{activeLink.deepLink}</p>
            <div className="mt-3 grid gap-2 sm:flex sm:flex-wrap">
              <Button asChild size="sm" className="rounded-xl">
                <a href={activeLink.deepLink} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {activeLink.openLabel}
                </a>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="rounded-xl"
                onClick={() => void navigator.clipboard?.writeText(activeLink.deepLink)}
              >
                Скопировать
              </Button>
            </div>
          </div>
        )}

        {message && <div className="rounded-2xl border border-white/10 bg-muted/10 px-3 py-2 text-sm">{message}</div>}
      </CardContent>
    </Card>
  );
}
