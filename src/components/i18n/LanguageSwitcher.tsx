"use client";

import { Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { persistLocale } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/shared";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({
  locale,
  onChange,
  className,
  compact = false,
}: {
  locale: Locale;
  onChange: (locale: Locale) => void;
  className?: string;
  compact?: boolean;
}) {
  async function choose(nextLocale: Locale) {
    onChange(nextLocale);
    await persistLocale(nextLocale);
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06]",
        compact ? "p-0.5" : "p-1",
        className,
      )}
    >
      <span className={cn("flex items-center justify-center rounded-full text-white/58", compact ? "h-7 w-7" : "h-8 w-8")}>
        <Globe2 className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </span>
      {(["ru", "en"] as const).map((item) => (
        <Button
          key={item}
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => choose(item)}
          className={cn(
            "rounded-full text-xs font-semibold",
            compact ? "h-7 px-2.5" : "h-8 px-3",
            locale === item ? "bg-white text-black hover:bg-white/90" : "text-white/58 hover:bg-white/10 hover:text-white",
          )}
        >
          {item.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}
