"use client";

import Link from "next/link";
import { ArrowLeft, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CompanyReferralsPage() {
  return (
    <main className="min-h-screen bg-[#05070d] px-4 pb-24 pt-5 text-white">
      <section className="mx-auto max-w-lg space-y-4">
        <Button asChild variant="ghost" className="rounded-2xl px-0 text-white/70 hover:text-white">
          <Link href="/settings">
            <ArrowLeft className="h-4 w-4" />
            Назад в настройки
          </Link>
        </Button>

        <article className="relative overflow-hidden rounded-[2rem] border border-cyan-200/15 bg-slate-950/80 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(103,232,249,0.18),transparent_34%),radial-gradient(circle_at_100%_10%,rgba(255,255,255,0.12),transparent_30%)]" />
          <div className="relative space-y-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-3xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-100">
              <Handshake className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Реферальная программа скоро появится</h1>
              <p className="mt-3 text-sm leading-6 text-white/58">
                Мы готовим аккуратный запуск партнёрских приглашений. Сейчас этот раздел скрыт, чтобы не отвлекать от базовых сценариев NearLoy.
              </p>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
