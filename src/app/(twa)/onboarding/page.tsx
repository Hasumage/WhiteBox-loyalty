"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, BadgePercent, Heart, MapPin, QrCode, Sparkles, WalletCards } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { completeTwaOnboarding, skipTwaOnboarding } from "@/lib/api/twa-client";
import { useI18n } from "@/lib/i18n/use-i18n";
import type { TranslationKey } from "@/lib/i18n/dictionary";

const steps = [
  {
    key: "favorites",
    icon: Heart,
    titleKey: "client.onboarding.stepFavoritesTitle",
    textKey: "client.onboarding.stepFavoritesText",
    accent: "from-white/[0.12] via-zinc-500/[0.08] to-sky-400/[0.06]",
  },
  {
    key: "geo",
    icon: MapPin,
    titleKey: "client.onboarding.stepGeoTitle",
    textKey: "client.onboarding.stepGeoText",
    accent: "from-emerald-400/[0.16] via-zinc-500/[0.07] to-cyan-400/[0.08]",
  },
  {
    key: "qr",
    icon: QrCode,
    titleKey: "client.onboarding.stepQrTitle",
    textKey: "client.onboarding.stepQrText",
    accent: "from-zinc-100/[0.16] via-zinc-500/[0.07] to-zinc-400/[0.08]",
  },
  {
    key: "value",
    icon: BadgePercent,
    titleKey: "client.onboarding.stepValueTitle",
    textKey: "client.onboarding.stepValueText",
    accent: "from-sky-400/[0.16] via-zinc-500/[0.07] to-indigo-500/[0.08]",
  },
] satisfies Array<{
  key: string;
  icon: LucideIcon;
  titleKey: TranslationKey;
  textKey: TranslationKey;
  accent: string;
}>;

export default function OnboardingPage() {
  const { t } = useI18n("ru");
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [geoStatus, setGeoStatus] = useState<"idle" | "granted" | "denied" | "unsupported">("idle");
  const [busy, setBusy] = useState(false);
  const step = steps[index];
  const Icon = step.icon;
  const progress = useMemo(() => Math.round(((index + 1) / steps.length) * 100), [index]);
  const valueItems: Array<{ icon: LucideIcon; label: string }> = [
    { icon: WalletCards, label: t("client.onboarding.valueCards") },
    { icon: BadgePercent, label: t("client.onboarding.valueSubscriptions") },
    { icon: MapPin, label: t("client.onboarding.valueMapRoutes") },
    { icon: Sparkles, label: t("client.onboarding.valueLevels") },
  ];

  async function finish() {
    setBusy(true);
    await completeTwaOnboarding();
    router.replace("/app");
  }

  async function skip() {
    setBusy(true);
    await skipTwaOnboarding();
    router.replace("/app");
  }

  function requestGeo() {
    if (!("geolocation" in navigator)) {
      setGeoStatus("unsupported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setGeoStatus("granted"),
      () => setGeoStatus("denied"),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }

  return (
    <main className="min-h-full overflow-hidden px-4 pb-6 pt-6">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
        className="mx-auto max-w-lg"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> {t("client.onboarding.firstLaunch")}
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">{t("client.onboarding.welcome")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("client.onboarding.subtitle")}</p>
          </div>
          <button
            type="button"
            onClick={skip}
            disabled={busy}
            className="rounded-full border border-white/10 bg-muted/10 px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-muted/20"
          >
            {t("client.onboarding.skip")}
          </button>
        </div>

        <Card className="glass relative overflow-hidden border-white/10 bg-[#111318]">
          <div className={`absolute inset-0 bg-gradient-to-br ${step.accent}`} aria-hidden />
          <CardContent className="relative space-y-5 p-5">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.25 }}
              />
            </div>

            <motion.div
              key={step.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className="min-h-[300px] space-y-5"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-black/25 shadow-2xl">
                <Icon className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold leading-tight">{t(step.titleKey)}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{t(step.textKey)}</p>
              </div>

              {step.key === "favorites" && (
                <Link
                  href="/settings/favorites?onboarding=1&next=/onboarding"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white text-black px-4 py-3 text-sm font-semibold transition hover:bg-white/90"
                >
                  {t("client.onboarding.selectFavorites")} <ArrowRight className="h-4 w-4" />
                </Link>
              )}

              {step.key === "geo" && (
                <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                  <Button type="button" className="w-full" onClick={requestGeo}>
                    <MapPin className="mr-2 h-4 w-4" /> {t("client.onboarding.allowGeo")}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    {geoStatus === "idle" && t("client.onboarding.geoIdle")}
                    {geoStatus === "granted" && t("client.onboarding.geoGranted")}
                    {geoStatus === "denied" && t("client.onboarding.geoDenied")}
                    {geoStatus === "unsupported" && t("client.onboarding.geoUnsupported")}
                  </p>
                </div>
              )}

              {step.key === "qr" && (
                <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-[2rem] bg-white text-black shadow-[0_0_35px_rgba(255,255,255,0.25)]">
                  <QrCode className="h-14 w-14" />
                </div>
              )}

              {step.key === "value" && (
                <div className="grid grid-cols-2 gap-2">
                  {valueItems.map(({ icon: ItemIcon, label }) => (
                    <div key={label} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      <ItemIcon className="mb-2 h-5 w-5 text-primary" />
                      <p className="text-sm font-semibold">{label}</p>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="glass border-white/10"
                disabled={busy || index === 0}
                onClick={() => setIndex((value) => Math.max(0, value - 1))}
              >
                {t("client.common.back")}
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={busy}
                onClick={() => (index === steps.length - 1 ? void finish() : setIndex((value) => value + 1))}
              >
                {index === steps.length - 1 ? t("client.onboarding.start") : t("client.onboarding.next")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.section>
    </main>
  );
}
