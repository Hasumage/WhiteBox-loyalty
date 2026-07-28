"use client";

import { NearLoyLogo } from "@/components/brand/NearLoyLogo";
import { useI18n } from "@/lib/i18n/use-i18n";

export function AuthLoadingFallback() {
  const { t } = useI18n("ru");

  return (
    <div className="relative w-full overflow-hidden rounded-[2rem] border border-cyan-200/15 bg-slate-950/88 px-7 py-9 text-center shadow-[0_28px_90px_rgba(0,0,0,0.48)] backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(103,232,249,0.16),transparent_34%),radial-gradient(circle_at_50%_100%,rgba(124,58,237,0.12),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-x-10 top-6 h-px bg-gradient-to-r from-transparent via-cyan-100/35 to-transparent" />

      <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
        <span className="absolute inset-0 rounded-[1.8rem] border border-cyan-100/15 bg-white/[0.04]" />
        <span className="absolute inset-1 rounded-[1.65rem] border-2 border-white/10 border-t-cyan-100/90 animate-spin" />
        <span className="absolute h-20 w-20 rounded-[1.55rem] bg-cyan-200/10 blur-xl" />
        <NearLoyLogo className="relative h-14 w-14" />
      </div>

      <div className="relative space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-cyan-100/60">NearLoy</p>
        <h1 className="text-2xl font-semibold tracking-tight text-white">{t("client.auth.loadingTitle")}</h1>
        <p className="mx-auto max-w-[18rem] text-sm leading-6 text-white/58">{t("client.auth.loadingSubtitle")}</p>
      </div>

      <div className="relative mx-auto mt-7 flex w-16 items-center justify-center gap-2" aria-hidden="true">
        <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-100/80" />
        <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-100/55 [animation-delay:150ms]" />
        <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-100/35 [animation-delay:300ms]" />
      </div>
    </div>
  );
}
