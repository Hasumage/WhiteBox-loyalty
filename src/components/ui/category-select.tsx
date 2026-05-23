"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, CircleOff, Search } from "lucide-react";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { cn } from "@/lib/utils";

type CategoryOption = {
  id: number;
  name: string;
  icon: string;
};

type CategorySelectProps = {
  value: number | "";
  onChange: (value: number | "") => void;
  options: CategoryOption[];
  emptyLabel?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  triggerClassName?: string;
  dropdownClassName?: string;
  searchPlaceholder?: string;
  emptySearchLabel?: string;
};

export function CategorySelect({
  value,
  onChange,
  options,
  emptyLabel = "No category",
  disabled,
  id,
  className,
  triggerClassName,
  dropdownClassName,
  searchPlaceholder = "Search category...",
  emptySearchLabel = "No categories found",
}: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => (value === "" ? null : options.find((item) => item.id === value) ?? null),
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((item) => item.name.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, []);

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() =>
          setOpen((prev) => {
            const next = !prev;
            if (!next) setQuery("");
            return next;
          })
        }
        className={cn(
          "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          "flex items-center justify-between gap-2",
          triggerClassName,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected ? (
            <>
              <CategoryIcon iconName={selected.icon} className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">{selected.name}</span>
            </>
          ) : (
            <>
              <CircleOff className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-muted-foreground">{emptyLabel}</span>
            </>
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className={cn("absolute z-50 mt-2 w-full rounded-lg border border-white/15 bg-background/95 p-2 shadow-xl backdrop-blur", dropdownClassName)}>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="max-h-56 space-y-1 overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setQuery("");
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60"
            >
              <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                <CircleOff className="h-4 w-4 shrink-0" />
                <span className="truncate">{emptyLabel}</span>
              </span>
              {value === "" && <Check className="h-4 w-4 text-primary" />}
            </button>

            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onChange(item.id);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <CategoryIcon iconName={item.icon} className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">{item.name}</span>
                </span>
                {value === item.id && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}

            {filtered.length === 0 && (
              <p className="px-2 py-2 text-xs text-muted-foreground">{emptySearchLabel}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
