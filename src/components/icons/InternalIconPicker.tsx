"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  getInternalIconOption,
  InternalIcon,
  INTERNAL_ICON_GROUP_ORDER,
  INTERNAL_ICON_GROUPS,
  INTERNAL_ICON_OPTIONS,
} from "@/components/icons/internal-icon-collection";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
};

export function InternalIconPicker({ value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = getInternalIconOption(value) ?? getInternalIconOption("Circle");

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const groupedOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = INTERNAL_ICON_OPTIONS.filter((option) => {
      if (!normalized) return true;
      return [option.label, option.value, INTERNAL_ICON_GROUPS[option.group], ...(option.keywords ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });

    return Object.entries(INTERNAL_ICON_GROUPS)
      .sort(([left], [right]) => INTERNAL_ICON_GROUP_ORDER[left as keyof typeof INTERNAL_ICON_GROUPS] - INTERNAL_ICON_GROUP_ORDER[right as keyof typeof INTERNAL_ICON_GROUPS])
      .map(([group, label]) => ({
        group,
        label,
        icons: filtered.filter((option) => option.group === group),
      }))
      .filter((group) => group.icons.length > 0);
  }, [query]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-md border border-input bg-background px-3 py-2 text-left text-sm ring-offset-background transition hover:border-cyan-200/30 hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-cyan-100">
            <InternalIcon icon={selected?.value ?? value} className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{selected?.label ?? "Иконка"}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{selected ? INTERNAL_ICON_GROUPS[selected.group] : "Внутренняя коллекция"}</span>
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(30rem,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-[#0b0d12] p-3 shadow-2xl shadow-black/60">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по названию и группе"
              className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.035] pl-9 pr-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-cyan-200/40"
            />
          </label>

          <div className="mt-3 max-h-80 space-y-4 overflow-y-auto pr-1 [scrollbar-color:rgba(103,232,249,0.5)_transparent] [scrollbar-width:thin]">
            {groupedOptions.map((group) => (
              <section key={group.group} className="space-y-2">
                <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{group.label}</p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {group.icons.map((icon) => {
                    const active = icon.value === value;
                    return (
                      <button
                        key={icon.value}
                        type="button"
                        onClick={() => {
                          onChange(icon.value);
                          setOpen(false);
                          setQuery("");
                        }}
                        className={cn(
                          "group relative flex h-14 flex-col items-center justify-center gap-1 rounded-2xl border text-xs transition",
                          active
                            ? "border-cyan-200/60 bg-cyan-300/18 text-cyan-50 shadow-[0_0_22px_rgba(103,232,249,0.16)]"
                            : "border-white/10 bg-white/[0.035] text-muted-foreground hover:border-white/20 hover:bg-white/[0.07] hover:text-white",
                        )}
                        title={icon.label}
                        aria-label={icon.label}
                      >
                        <InternalIcon icon={icon.value} className="h-5 w-5" />
                        <span className="max-w-full truncate px-1">{icon.label}</span>
                        {active && <Check className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-cyan-100" />}
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}

            {groupedOptions.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4 text-center text-sm text-muted-foreground">
                Иконки не найдены.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
