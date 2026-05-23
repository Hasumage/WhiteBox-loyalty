"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { reactivateAccount, setStoredSession, type AuthTokensResponse } from "@/lib/api/auth-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import { interpolate } from "@/lib/i18n/format";

function formatDeadline(iso: string | null | undefined, locale: string) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function FrozenAccountDialog({
  open,
  onOpenChange,
  userName,
  deletionScheduledAt,
  onClosed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  deletionScheduledAt: string | null;
  /** Fired whenever the dialog closes (reactivate, dismiss, or backdrop). */
  onClosed: () => void;
}) {
  const { locale, t } = useI18n("ru");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) onClosed();
  }

  async function handleReactivate() {
    setError(null);
    setBusy(true);
    try {
      const result = await reactivateAccount();
      if (!("accessToken" in result) || !result.accessToken) {
        setError("message" in result ? String(result.message) : t("client.auth.couldNotReactivate"));
        return;
      }
      setStoredSession(result as AuthTokensResponse);
      handleOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showClose={false} className="glass max-w-md border-sky-500/40 bg-sky-950/30">
        <DialogHeader>
          <DialogTitle className="text-sky-200">{t("client.auth.frozenTitle")}</DialogTitle>
          <DialogDescription className="text-sky-100/90">
            {interpolate(t("client.auth.frozenDescription"), {
              name: userName,
              date: formatDeadline(deletionScheduledAt, locale),
            })}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            className="w-full bg-sky-600 text-white hover:bg-sky-500"
            disabled={busy}
            onClick={handleReactivate}
          >
            {busy ? t("client.auth.reactivating") : t("client.auth.reactivate")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="glass w-full border-sky-400/30 text-sky-100 hover:bg-sky-950/50"
            disabled={busy}
            onClick={() => handleOpenChange(false)}
          >
            {t("client.auth.frozenContinue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
