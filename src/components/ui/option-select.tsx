"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType, type SVGProps } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type OptionIcon = ComponentType<SVGProps<SVGSVGElement>>;

export type OptionSelectOption = {
  value: string;
  label: string;
  description?: string;
  icon?: OptionIcon;
};

type OptionSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: OptionSelectOption[];
  placeholder?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
  triggerClassName?: string;
  dropdownClassName?: string;
};

export function OptionSelect({
  value,
  onChange,
  options,
  placeholder = "Select an option",
  name,
  required,
  disabled,
  id,
  className,
  triggerClassName,
  dropdownClassName,
}: OptionSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = useMemo(() => options.find((option) => option.value === value) ?? null, [options, value]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const SelectedIcon = selected?.icon;

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      {name && <input type="hidden" name={name} value={value} />}
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        data-required={required || undefined}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-12 w-full items-center justify-between gap-3 rounded-xl border border-white/12 bg-black/25 px-4 text-left text-sm text-white shadow-sm transition",
          "hover:border-white/22 hover:bg-white/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100/30",
          "disabled:cursor-not-allowed disabled:opacity-50",
          triggerClassName,
        )}
      >
        <span className={cn("flex min-w-0 items-center gap-3", !selected && "text-white/55")}>
          {SelectedIcon && <SelectedIcon className="h-4 w-4 shrink-0 text-cyan-100" />}
          <span className="truncate">{selected?.label ?? placeholder}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-white/55 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="listbox"
          className={cn(
            "absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-white/12 bg-[#090d14]/98 p-1.5 shadow-2xl shadow-black/45 backdrop-blur-xl",
            dropdownClassName,
          )}
        >
          {options.map((option) => {
            const Icon = option.icon;
            const active = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition",
                  active ? "bg-cyan-100/10 text-white" : "text-white/76 hover:bg-white/[0.07] hover:text-white",
                )}
              >
                <span className="flex min-w-0 items-center gap-3">
                  {Icon && (
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", active ? "border-cyan-100/20 bg-cyan-100/10 text-cyan-100" : "border-white/10 bg-white/[0.04] text-white/68")}>
                      <Icon className="h-4 w-4" />
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{option.label}</span>
                    {option.description && <span className="mt-0.5 block truncate text-xs text-white/48">{option.description}</span>}
                  </span>
                </span>
                {active && <Check className="h-4 w-4 shrink-0 text-cyan-100" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
