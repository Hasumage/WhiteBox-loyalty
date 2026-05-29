"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileStatusBadge } from "@/components/profile-status/profile-status-view";
import {
  getUserProfileStatuses,
  markUserProfileStatusesSeen,
  type UserProfileStatusState,
} from "@/lib/api/twa-client";

const SESSION_KEY = "whitebox.profile-status-unlock-toast";

export function ProfileStatusUnlockToast() {
  const [state, setState] = useState<UserProfileStatusState | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await getUserProfileStatuses();
      if (!active || !result.ok) return;
      const next = result.data;
      const ids = next.newlyUnlocked.map((status) => status.id).sort().join(":");
      if (!ids) return;
      if (window.sessionStorage.getItem(SESSION_KEY) === ids) return;
      setState(next);
      setVisible(true);
      window.sessionStorage.setItem(SESSION_KEY, ids);
    })();
    return () => {
      active = false;
    };
  }, []);

  const statuses = state?.newlyUnlocked ?? [];
  const title = useMemo(() => {
    if (statuses.length <= 1) return "Вам доступен новый статус!";
    return `Вы разблокировали ${statuses.length} статуса`;
  }, [statuses.length]);

  async function dismiss(markSeen: boolean) {
    setVisible(false);
    if (markSeen) await markUserProfileStatusesSeen();
  }

  return (
    <AnimatePresence>
      {visible && statuses.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          className="pointer-events-none fixed inset-x-3 bottom-24 z-50 mx-auto max-w-[34rem]"
        >
          <div className="pointer-events-auto overflow-hidden rounded-[2rem] border border-cyan-200/25 bg-[#071113]/95 shadow-[0_24px_80px_rgba(0,0,0,0.55),0_0_45px_rgba(103,232,249,0.16)] backdrop-blur-2xl">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/80 to-transparent" />
            <div className="flex items-start gap-3 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-200/30 bg-cyan-300/10 text-cyan-100 shadow-[0_0_24px_rgba(103,232,249,0.18)]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {statuses.length === 1
                    ? "Загляните в профиль и выберите настроение для аккаунта."
                    : "Посмотрите, какой из них подойдёт под ваше настроение сегодня."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {statuses.slice(0, 4).map((status) => (
                    <ProfileStatusBadge
                      key={status.id}
                      title={status.title}
                      rarity={status.rarity}
                      icon={status.icon}
                    />
                  ))}
                  {statuses.length > 4 && (
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-muted-foreground">
                      +{statuses.length - 4}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                aria-label="Скрыть"
                onClick={() => void dismiss(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-2 border-t border-white/10 p-3">
              <Button asChild className="flex-1" onClick={() => void dismiss(true)}>
                <Link href="/settings/statuses">
                  Посмотреть статусы <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="secondary" onClick={() => void dismiss(true)}>
                Позже
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
