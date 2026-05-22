"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearStoredSession, freezeAccount } from "@/lib/api/auth-client";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/use-i18n";
import { interpolate } from "@/lib/i18n/format";

const BALLOON_COUNT = 5;

export function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { t } = useI18n("ru");
  const [popped, setPopped] = useState<Set<number>>(() => new Set());
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gameDone = popped.size >= BALLOON_COUNT;
  const canSubmit = gameDone && confirmText.trim().toUpperCase() === "DELETE";

  const popBalloon = useCallback((id: number) => {
    setPopped((prev) => new Set(prev).add(id));
  }, []);

  const reset = useCallback(() => {
    setPopped(new Set());
    setConfirmText("");
    setError(null);
  }, []);

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFreeze = async () => {
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      const result = await freezeAccount();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      clearStoredSession();
      handleOpenChange(false);
      router.push("/login?frozen=1");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="glass max-h-[90dvh] overflow-y-auto border-destructive/30">
        <DialogHeader>
          <DialogTitle className="text-destructive">{t("client.account.deleteTitle")}</DialogTitle>
          <DialogDescription>{t("client.account.deleteDescription")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <p className="mb-3 text-sm font-medium text-muted-foreground">
              {interpolate(t("client.account.deleteGame"), {
                done: popped.size,
                total: BALLOON_COUNT,
              })}
            </p>
            <div className="flex min-h-[120px] flex-wrap items-center justify-center gap-3 rounded-xl border border-white/10 bg-muted/20 p-4">
              {Array.from({ length: BALLOON_COUNT }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={popped.has(i)}
                  onClick={() => popBalloon(i)}
                  className={cn(
                    "flex h-16 w-14 items-center justify-center rounded-full text-4xl transition-all",
                    popped.has(i) ? "scale-0 opacity-0" : "bg-primary/20 hover:scale-105 active:scale-95",
                  )}
                  aria-label={interpolate(t("client.account.popBalloon"), { number: i + 1 })}
                >
                  🎈
                </button>
              ))}
            </div>
          </div>

          <div
            className={cn(
              "space-y-2 transition-opacity",
              gameDone ? "opacity-100" : "pointer-events-none opacity-40",
            )}
          >
            <label htmlFor="delete-confirm" className="text-sm font-medium">
              {t("client.account.typeDelete")} <span className="font-mono text-destructive">DELETE</span>
            </label>
            <Input
              id="delete-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
              className="glass border-white/10 font-mono"
              disabled={!gameDone}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="glass border-white/10"
            onClick={() => handleOpenChange(false)}
          >
            {t("client.common.cancel")}
          </Button>
          <Button type="button" variant="destructive" disabled={!canSubmit || loading} onClick={handleFreeze}>
            {loading ? t("client.account.scheduling") : t("client.account.freezeAccount")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
