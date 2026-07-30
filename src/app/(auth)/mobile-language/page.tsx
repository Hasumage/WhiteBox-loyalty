"use client";

import { useState } from "react";
import { Check, Languages, Loader2 } from "lucide-react";
import { persistLocale } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/shared";
import { cn } from "@/lib/utils";

const LANGUAGE_SELECTED_KEY = "nearloy:mobile-language-selected";
const DEFAULT_MOBILE_ENTRY = "/mobile-entry?app=capacitor";

const languages: Array<{
  locale: Locale;
  code: string;
  title: string;
  subtitle: string;
}> = [
  { locale: "ru", code: "RU", title: "Русский", subtitle: "Продолжить на русском" },
  { locale: "en", code: "EN", title: "English", subtitle: "Continue in English" },
];

function safeNext() {
  if (typeof window === "undefined") return "/";
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function afterSelectHref() {
  if (typeof window === "undefined") return DEFAULT_MOBILE_ENTRY;
  const params = new URLSearchParams(window.location.search);
  const isCapacitor = params.get("app") === "capacitor";
  if (!isCapacitor) return safeNext();

  const entryParams = new URLSearchParams({ app: "capacitor", next: safeNext() });
  return `/mobile-entry?${entryParams.toString()}`;
}

export default function MobileLanguagePage() {
  const [selected, setSelected] = useState<Locale | null>(null);

  async function chooseLanguage(locale: Locale) {
    if (selected) return;
    setSelected(locale);
    try {
      window.localStorage.setItem(LANGUAGE_SELECTED_KEY, locale);
      window.localStorage.setItem("nearloy:capacitor-app", "1");
    } catch {
      // The cookie still stores locale even if localStorage is unavailable.
    }
    await persistLocale(locale);
    window.location.replace(afterSelectHref());
  }

  return (
    <main className="relative flex min-h-dvh overflow-hidden bg-[#03060a] px-5 py-8 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(34,211,238,0.18),transparent_34%),radial-gradient(circle_at_86%_16%,rgba(168,85,247,0.20),transparent_32%),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:auto,auto,72px_72px,72px_72px]" />
      <section className="relative z-10 mx-auto flex w-full max-w-[430px] flex-col justify-center">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.35rem] border border-cyan-200/20 bg-cyan-300/10 text-cyan-50 shadow-[0_18px_48px_rgba(34,211,238,0.12)]">
            <Languages className="h-7 w-7" />
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-100">NearLoy</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Выберите язык</h1>
          <p className="mt-2 text-sm leading-6 text-white/56">Choose your language</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {languages.map((item) => {
            const isLoading = selected === item.locale;
            return (
              <button
                key={item.locale}
                type="button"
                disabled={Boolean(selected)}
                onClick={() => void chooseLanguage(item.locale)}
                className={cn(
                  "group aspect-square rounded-[2rem] border border-white/10 bg-white/[0.055] p-4 text-left shadow-[0_22px_60px_rgba(0,0,0,0.30)] transition duration-200 hover:-translate-y-0.5 hover:border-cyan-200/35 hover:bg-cyan-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70",
                  selected && !isLoading && "opacity-55",
                  isLoading && "border-cyan-200/50 bg-cyan-300/14",
                )}
              >
                <div className="flex h-full flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-4xl font-black tracking-[-0.08em] text-white">{item.code}</span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-black/24 text-cyan-100">
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />}
                    </span>
                  </div>
                  <div>
                    <p className="text-base font-semibold">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-white/52">{item.subtitle}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}
