"use client";

import Link from "next/link";
import { ArrowLeft, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ReviewsPage() {
  return (
    <main className="mx-auto max-w-lg space-y-4 px-4 pb-24 pt-5">
      <Button asChild variant="ghost" className="rounded-2xl px-0 text-white/70 hover:text-white">
        <Link href="/settings">
          <ArrowLeft className="h-4 w-4" />
          Назад в настройки
        </Link>
      </Button>

      <article className="rounded-[2rem] border border-white/10 bg-card p-6">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-100">
          <MessageSquareText className="h-6 w-6" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Отзывы появятся позже</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          На старте NearLoy запускается без публичной зоны отзывов. Мы вернём этот раздел, когда подготовим модерацию и безопасный сценарий публикации.
        </p>
      </article>
    </main>
  );
}
