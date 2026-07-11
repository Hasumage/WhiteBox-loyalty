import type { Prisma } from "@prisma/client";

export function hasAny(message: string, words: string[]) {
  const lower = message.toLowerCase();
  return words.some((word) => lower.includes(word.toLowerCase()));
}

export function compactText(value: string | null | undefined, fallback = "—", max = 180) {
  const text = value?.trim() || fallback;
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function formatRub(value: Prisma.Decimal | number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function lines(items: Array<string | null | false | undefined>) {
  return items.filter(Boolean).join("\n");
}
