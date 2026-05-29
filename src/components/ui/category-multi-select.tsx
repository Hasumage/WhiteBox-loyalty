"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { CategoryIcon } from "@/components/categories/CategoryIcon";
import { categoryName } from "@/lib/i18n/categories";
import { useI18n } from "@/lib/i18n/use-i18n";
import { cn } from "@/lib/utils";

type CategoryOption = {
  id: number;
  slug?: string;
  name: string;
  icon: string;
};

type CategoryMultiSelectProps = {
  value: number[];
  onChange: (value: number[]) => void;
  options: CategoryOption[];
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
};

export function CategoryMultiSelect({
  value,
  onChange,
  options,
  placeholder = "Select categories",
  disabled,
  id,
  className,
}: CategoryMultiSelectProps) {
  const { t } = useI18n("ru");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((item) => `${item.name} ${categoryName({ slug: item.slug ?? "", name: item.name }, t)}`.toLowerCase().includes(q));
  }, [options, query, t]);

  const selectedItems = useMemo(
    () => options.filter((item) => value.includes(item.id)),
    [options, value],
  );

  function toggleCategory(id: number) {
    if (value.includes(id)) {
      onChange(value.filter((x) => x !== id));
      return;
    }
    onChange([...value, id]);
  }

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
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
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "min-h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          "flex items-center justify-between gap-2",
        )}
      >
        <span className="flex min-w-0 flex-1 flex-wrap gap-1">
          {selectedItems.length > 0 ? (
            selectedItems.map((item) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-muted/70 px-2 py-0.5 text-xs"
              >
                <CategoryIcon iconName={item.icon} className="h-3.5 w-3.5 text-primary" />
                {categoryName({ slug: item.slug ?? "", name: item.name }, t)}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleCategory(item.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleCategory(item.id);
                    }
                  }}
                  className="inline-flex cursor-pointer text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </span>
              </span>
            ))
          ) : (
            <span className="truncate text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-lg border border-white/15 bg-background/95 p-2 shadow-xl backdrop-blur">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search category..."
              className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="max-h-56 space-y-1 overflow-y-auto">
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => toggleCategory(item.id)}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <CategoryIcon iconName={item.icon} className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">{categoryName({ slug: item.slug ?? "", name: item.name }, t)}</span>
                </span>
                {value.includes(item.id) && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-2 py-2 text-xs text-muted-foreground">No categories found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
