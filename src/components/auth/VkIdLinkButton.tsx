"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Link2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createVkIdLinkUrl, getVkIdStatus, unlinkVkId } from "@/lib/api/auth-client";

type VkIdLinkButtonProps = {
  next: string;
  className?: string;
  variant?: "default" | "secondary" | "outline";
  size?: "default" | "sm" | "lg";
};

export function VkIdLinkButton({ next, className, variant = "secondary", size = "default" }: VkIdLinkButtonProps) {
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [linked, setLinked] = useState(false);
  const [canUnlink, setCanUnlink] = useState(false);
  const [unlinkBlockedReason, setUnlinkBlockedReason] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    void getVkIdStatus().then((result) => {
      if (cancelled) return;
      if ("linked" in result) {
        setLinked(result.linked);
        setCanUnlink(result.canUnlink);
        setUnlinkBlockedReason(result.unlinkBlockedReason);
      }
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function connect() {
    if (linked) return;
    setBusy(true);
    setMessage("");
    const result = await createVkIdLinkUrl(next);
    setBusy(false);
    if ("url" in result) {
      window.location.assign(result.url);
      return;
    }
    setMessage(result.message);
  }

  async function disconnect() {
    if (!linked || !canUnlink) return;
    setBusy(true);
    setMessage("");
    const result = await unlinkVkId();
    setBusy(false);
    if ("linked" in result) {
      setLinked(result.linked);
      setCanUnlink(result.canUnlink);
      setUnlinkBlockedReason(result.unlinkBlockedReason);
      setMessage("VK ID отвязан от аккаунта.");
      return;
    }
    setMessage(result.message);
  }

  return (
    <div className="space-y-2">
      {linked ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-50">
            <CheckCircle2 className="h-4 w-4" />
            VK ID уже связан
          </div>
          <Button
            type="button"
            variant="outline"
            size={size}
            className={className}
            disabled={checking || busy || !canUnlink}
            onClick={() => void disconnect()}
          >
            <Unlink className="mr-2 h-4 w-4" />
            {busy ? "Отвязываем..." : "Отвязать VK ID"}
          </Button>
          {!canUnlink && unlinkBlockedReason && <p className="text-xs leading-relaxed text-muted-foreground">{unlinkBlockedReason}</p>}
        </div>
      ) : (
        <Button
          type="button"
          variant={variant}
          size={size}
          className={className}
          disabled={checking || busy}
          onClick={() => void connect()}
        >
          <Link2 className="mr-2 h-4 w-4" />
          {busy ? "Открываем VK ID..." : "Связать VK ID"}
        </Button>
      )}
      {message && <p className="text-xs text-destructive">{message}</p>}
    </div>
  );
}
