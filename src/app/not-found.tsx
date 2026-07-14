import { ArrowRight, Home, LogIn, MapPinned, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { NearLoyLogo } from "@/components/brand/NearLoyLogo";
import { NotFoundBackButton } from "@/components/not-found/NotFoundBackButton";
import { Button } from "@/components/ui/button";

const quickLinks = [
  { href: "/login", label: "Войти в аккаунт", icon: LogIn },
  { href: "/companies", label: "Компании", icon: MapPinned },
  { href: "/business", label: "Для бизнеса", icon: Sparkles },
];

export default function NotFoundPage() {
  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#04070d] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(103,232,249,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(103,232,249,0.05)_1px,transparent_1px)] bg-[size:96px_96px]" />
      <div className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-cyan-300/12 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-[28rem] w-[28rem] rounded-full bg-violet-500/12 blur-3xl" />

      <section className="relative mx-auto flex min-h-[100dvh] w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex min-w-0 items-center gap-3 rounded-3xl border border-white/10 bg-white/[0.035] px-3 py-2 backdrop-blur-xl transition hover:border-cyan-200/30 hover:bg-white/[0.06]">
            <NearLoyLogo className="h-10 w-10" />
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold">NearLoy</span>
              <span className="block truncate text-xs text-white/55">система лояльности</span>
            </span>
          </Link>
          <span className="rounded-full border border-cyan-200/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100">
            404
          </span>
        </header>

        <div className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,0.75fr)] lg:py-14">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-cyan-200/20 bg-cyan-300/10 px-4 py-2 text-sm font-semibold text-cyan-100 shadow-[0_0_35px_rgba(34,211,238,0.12)]">
              <Sparkles className="h-4 w-4" />
              Кажется, эта точка потерялась
            </p>
            <h1 className="mt-7 text-5xl font-semibold tracking-tight sm:text-7xl lg:text-8xl">
              Страница не найдена
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/62 sm:text-xl">
              Ссылка могла устареть, адрес мог быть введён с ошибкой, или мы уже перенесли этот раздел в другое место.
              Персонаж NearLoy тоже задумался, но выход есть.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button asChild size="lg" className="rounded-full bg-white text-black hover:bg-white/90">
                <Link href="/">
                  <Home className="h-4 w-4" />
                  На главную
                </Link>
              </Button>
              <NotFoundBackButton />
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {quickLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="group rounded-3xl border border-white/10 bg-white/[0.035] p-4 transition hover:border-cyan-200/30 hover:bg-white/[0.06]"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-200/20 bg-cyan-300/10 text-cyan-100">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="mt-4 flex items-center justify-between gap-3 text-sm font-semibold">
                      {item.label}
                      <ArrowRight className="h-4 w-4 text-white/45 transition group-hover:translate-x-1 group-hover:text-cyan-100" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[30rem]">
            <div className="absolute inset-x-8 bottom-8 h-32 rounded-full bg-cyan-300/20 blur-3xl" />
            <div className="relative rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-white/[0.08] via-white/[0.025] to-cyan-300/[0.08] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
              <Image
                src="/mascot/nearloy-404.png"
                alt="Персонаж NearLoy рядом с табличкой 404"
                width={1113}
                height={1059}
                priority
                className="mx-auto h-auto w-full drop-shadow-[0_24px_50px_rgba(34,211,238,0.14)]"
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
