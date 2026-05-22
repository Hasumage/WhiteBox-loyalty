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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from "@/lib/api/auth-client";
import { useI18n } from "@/lib/i18n/use-i18n";

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n("ru");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function reset() {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < 8) {
      setError(t("client.account.passwordTooShort"));
      return;
    }
    if (next !== confirm) {
      setError(t("client.account.passwordsDoNotMatch"));
      return;
    }
    setLoading(true);
    try {
      const result = await changePassword({ currentPassword: current, newPassword: next });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      handleOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="glass border-white/10">
        <DialogHeader>
          <DialogTitle>{t("client.account.changePasswordTitle")}</DialogTitle>
          <DialogDescription>{t("client.account.changePasswordDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="cp-current">{t("client.account.currentPassword")}</Label>
            <Input
              id="cp-current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
              className="glass border-white/10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-new">{t("client.account.newPassword")}</Label>
            <Input
              id="cp-new"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              required
              minLength={8}
              className="glass border-white/10"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-confirm">{t("client.account.confirmNewPassword")}</Label>
            <Input
              id="cp-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              className="glass border-white/10"
            />
          </div>
          <DialogFooter className="gap-2 pt-2 sm:gap-0">
            <Button type="button" variant="outline" className="glass border-white/10" onClick={() => handleOpenChange(false)}>
              {t("client.common.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t("client.account.savingPassword") : t("client.account.updatePassword")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
