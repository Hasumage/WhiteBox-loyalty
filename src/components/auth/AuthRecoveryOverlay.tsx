"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Sparkles } from "lucide-react";
import { AUTH_RECOVERY_EVENT, type AuthRecoveryEventDetail, type AuthRecoveryState } from "@/lib/api/authenticated-fetch";
import { cn } from "@/lib/utils";

type OverlayState = Exclude<AuthRecoveryState, "restored"> | "hidden";

export function AuthRecoveryOverlay() {
  const [state, setState] = useState<OverlayState>("hidden");
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    function clearHideTimer() {
      if (hideTimerRef.current === null) return;
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    function handleRecoveryEvent(event: Event) {
      const detail = (event as CustomEvent<AuthRecoveryEventDetail>).detail;
      if (!detail?.state) return;

      clearHideTimer();

      if (detail.state === "checking") {
        setState("checking");
        return;
      }

      if (detail.state === "failed") {
        setState("failed");
        return;
      }

      setState("checking");
      hideTimerRef.current = window.setTimeout(() => setState("hidden"), 450);
    }

    window.addEventListener(AUTH_RECOVERY_EVENT, handleRecoveryEvent);
    return () => {
      clearHideTimer();
      window.removeEventListener(AUTH_RECOVERY_EVENT, handleRecoveryEvent);
    };
  }, []);

  if (state === "hidden") return null;

  const failed = state === "failed";

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/68 px-4 backdrop-blur-md">
      <div className="relative w-full max-w-sm overflow-hidden rounded-[2rem] border border-cyan-200/20 bg-[#071018]/95 p-6 text-center shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
        <div className="pointer-events-none absolute -left-16 -top-16 h-36 w-36 rounded-full bg-cyan-300/18 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -right-14 h-40 w-40 rounded-full bg-violet-400/12 blur-3xl" />

        <div className="relative mx-auto mb-5 grid h-20 w-20 place-items-center rounded-[1.65rem] border border-cyan-100/20 bg-cyan-200/10">
          <span className={cn("absolute inset-0 rounded-[1.65rem] border border-cyan-200/20", !failed && "animate-ping")} />
          {failed ? <ShieldCheck className="h-9 w-9 text-amber-100" /> : <Sparkles className="h-9 w-9 animate-pulse text-cyan-100" />}
        </div>

        <div className="relative space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            {failed ? "Сессия закончилась" : "Восстанавливаем вход"}
          </h2>
          <p className="text-sm leading-6 text-white/68">
            {failed
              ? "Сейчас откроем вход и вернём вас обратно на эту страницу."
              : "Проверяем безопасный вход. Через мгновение продолжим с того же места."}
          </p>
        </div>

        {!failed && (
          <div className="relative mt-6 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/2 animate-[auth-recovery-slide_1.15s_ease-in-out_infinite] rounded-full bg-cyan-100" />
          </div>
        )}
      </div>
      <style jsx>{`
        @keyframes auth-recovery-slide {
          0% {
            transform: translateX(-110%);
          }
          50% {
            transform: translateX(70%);
          }
          100% {
            transform: translateX(210%);
          }
        }
      `}</style>
    </div>
  );
}
