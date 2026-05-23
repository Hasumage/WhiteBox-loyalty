import type { TranslationKey } from "./dictionary";
import type { Locale } from "./shared";

export type TranslateFn = (key: TranslationKey) => string;

export function interpolate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (current, [key, value]) => current.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export function unitLabel(unit: string | null | undefined, value: number, t: TranslateFn) {
  const normalized = (unit || "month").toLowerCase();
  const plural = value > 1;
  const key = `client.common.${normalized}${plural ? "s" : ""}` as TranslationKey;
  return t(key);
}

export function formatPlanPrice(
  price: number | string,
  unit: string | null | undefined,
  t: TranslateFn,
  currency = "$",
) {
  return `${currency}${price}/${unitLabel(unit, 1, t)}`;
}

export function formatRenewal(value: number | string | null | undefined, unit: string | null | undefined, t: TranslateFn) {
  const numeric = Math.max(1, Number(value) || 1);
  return `${numeric} ${unitLabel(unit, numeric, t)}`;
}

export function relativeDate(iso: string, locale: Locale, t: TranslateFn) {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return t("client.common.today");
  if (diffDays === 1) return t("client.common.yesterday");
  if (diffDays < 7) return interpolate(t("client.common.daysAgo"), { count: diffDays });
  return date.toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US");
}
