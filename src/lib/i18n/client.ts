"use client";

import { LOCALE_COOKIE, normalizeLocale, type Locale } from "./shared";

export const LOCALE_CHANGE_EVENT = "whitebox:locale-change";

export function readClientLocale(fallback: Locale = "en"): Locale {
  if (typeof document === "undefined") return fallback;
  const raw = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LOCALE_COOKIE}=`))
    ?.split("=")[1];
  return normalizeLocale(raw ? decodeURIComponent(raw) : null) ?? fallback;
}

export function writeClientLocale(locale: Locale) {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 365;
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent<Locale>(LOCALE_CHANGE_EVENT, { detail: locale }));
}

export async function persistLocale(locale: Locale) {
  writeClientLocale(locale);
  await fetch("/api/i18n/locale", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locale }),
  }).catch(() => null);
}
