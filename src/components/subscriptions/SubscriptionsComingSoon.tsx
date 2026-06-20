"use client";

import Link from "next/link";
import { ArrowRight, Gift, LockKeyhole, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { subscriptionsReleaseMessage } from "@/lib/features/subscriptions";

type SubscriptionsComingSoonProps = {
  mode?: "client" | "company";
  backHref?: string;
  primaryHref?: string;
  primaryLabel?: string;
};

const comingSoonCards = [
  {
    heading: "Бонусы",
    text: "Начисление и списание баллов остаются в фокусе первой версии.",
    Icon: Gift,
  },
  {
    heading: "QR и клиенты",
    text: "Быстрый поиск клиента и работа с кассой доступны без модуля подписок.",
    Icon: LockKeyhole,
  },
  {
    heading: "Следующий релиз",
    text: "Подписки вернутся отдельным стабильным продуктовым блоком.",
    Icon: Sparkles,
  },
];

export function SubscriptionsComingSoon({
  mode = "client",
  backHref,
  primaryHref = mode === "company" ? "/company/clients" : "/map",
  primaryLabel = mode === "company" ? "Перейти к кассе и клиентам" : "Смотреть партнёров",
}: SubscriptionsComingSoonProps) {
  const title = mode === "company" ? subscriptionsReleaseMessage.companyTitle : subscriptionsReleaseMessage.title;
  const description =
    mode === "company" ? subscriptionsReleaseMessage.companyDescription : subscriptionsReleaseMessage.description;

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-4xl flex-col justify-center px-4 py-8">
      <Card className="overflow-hidden border-cyan-200/15 bg-[radial-gradient(circle_at_top_left,rgba(103,232,249,0.14),transparent_34%),rgba(8,12,18,0.92)] shadow-[0_0_70px_rgba(34,211,238,0.08)]">
        <CardContent className="space-y-7 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-200/25 bg-cyan-300/10 text-cyan-100">
              <Sparkles className="h-6 w-6" />
            </span>
            <span className="rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-100">
              Скоро
            </span>
          </div>
          <div className="space-y-3">
            <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-5xl">{title}</h1>
            <p className="max-w-2xl text-base leading-7 text-white/70 sm:text-lg">{description}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {comingSoonCards.map(({ heading, text, Icon }) => (
              <div key={heading} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <Icon className="mb-3 h-5 w-5 text-cyan-100" />
                <p className="font-semibold text-white">{heading}</p>
                <p className="mt-1 text-sm leading-6 text-white/60">{text}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="rounded-2xl">
              <Link href={primaryHref}>
                {primaryLabel}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            {backHref ? (
              <Button asChild variant="secondary" className="rounded-2xl">
                <Link href={backHref}>Назад</Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
