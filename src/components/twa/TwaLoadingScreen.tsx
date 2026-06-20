"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n/use-i18n";

export function TwaLoadingScreen({
  title,
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}) {
  const { t } = useI18n("ru");
  const displayTitle = title ?? t("client.common.loadingWallet");
  const displaySubtitle = subtitle ?? t("client.common.loadingWalletSubtitle");

  return (
    <div className="flex min-h-full items-center justify-center px-6 pb-24 pt-8">
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative flex w-full max-w-sm flex-col items-center overflow-hidden rounded-[2.25rem] border border-white/10 bg-slate-950/80 px-7 py-9 text-center shadow-[0_28px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_8%,rgba(255,255,255,0.16),transparent_34%),radial-gradient(circle_at_50%_100%,rgba(34,211,238,0.11),transparent_38%)]" />
        <div className="pointer-events-none absolute inset-x-10 top-6 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        <div className="relative mb-7 flex h-36 w-36 items-center justify-center">
          <motion.div
            className="absolute inset-0 rounded-full border border-white/10"
            animate={{ rotate: 360 }}
            transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute h-[7.5rem] w-[7.5rem] rounded-full border border-dashed border-white/20"
            animate={{ rotate: -360 }}
            transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute h-3 w-3 rounded-full bg-white shadow-[0_0_22px_rgba(255,255,255,0.95)]"
            style={{ top: 12, left: "50%", marginLeft: -6 }}
            animate={{ rotate: 360 }}
            transition={{ duration: 2.6, repeat: Infinity, ease: "linear" }}
          />
          <motion.div
            className="absolute h-2.5 w-2.5 rounded-full bg-cyan-200 shadow-[0_0_20px_rgba(165,243,252,0.8)]"
            style={{ bottom: 23, right: 20 }}
            animate={{ rotate: -360 }}
            transition={{ duration: 3.4, repeat: Infinity, ease: "linear" }}
          />

          <motion.div
            className="absolute h-28 w-28 rounded-[2rem] bg-white/[0.08] blur-xl"
            animate={{ scale: [0.92, 1.15, 0.92], opacity: [0.45, 0.8, 0.45] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="relative flex h-24 w-24 items-center justify-center rounded-[2rem] border border-white/20 bg-[linear-gradient(145deg,rgba(255,255,255,0.22),rgba(255,255,255,0.04))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_20px_48px_rgba(0,0,0,0.45)]"
            animate={{ rotate: [0, 7, -7, 0], y: [0, -4, 0] }}
            transition={{ duration: 2.15, repeat: Infinity, ease: "easeInOut" }}
          >
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 5.6, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="h-11 w-11 drop-shadow-[0_0_14px_rgba(255,255,255,0.75)]" />
            </motion.div>
          </motion.div>
        </div>

        <div className="relative z-10">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.32em] text-white/45">NearLoy</p>
          <h1 className="text-2xl font-semibold tracking-tight text-white">{displayTitle}</h1>
          <p className="mx-auto mt-2 max-w-[17rem] text-sm leading-relaxed text-white/58">{displaySubtitle}</p>
        </div>

        <div className="relative mt-7 flex items-center gap-2" aria-hidden>
          {[0, 1, 2].map((dot) => (
            <motion.span
              key={dot}
              className="h-2 w-2 rounded-full bg-white/55"
              animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1.15, 0.85] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: dot * 0.16, ease: "easeInOut" }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
