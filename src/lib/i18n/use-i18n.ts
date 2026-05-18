"use client";

import { useCallback, useEffect, useState } from "react";
import { LOCALE_CHANGE_EVENT, persistLocale, readClientLocale } from "./client";
import { translate, type TranslationKey } from "./dictionary";
import { isLocale, type Locale } from "./shared";

export function useI18n(fallback: Locale = "en") {
  const [locale, setLocaleState] = useState<Locale>(fallback);

  useEffect(() => {
    setLocaleState(readClientLocale(fallback));

    let active = true;
    fetch("/api/i18n/locale", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { locale?: unknown }) => {
        if (active && isLocale(data.locale)) setLocaleState(data.locale);
      })
      .catch(() => null);

    return () => {
      active = false;
    };
  }, [fallback]);

  useEffect(() => {
    function handleLocaleChange(event: Event) {
      const nextLocale = (event as CustomEvent<unknown>).detail;
      if (isLocale(nextLocale)) setLocaleState(nextLocale);
    }

    function handleStorageChange(event: StorageEvent) {
      if (event.key === "wb_locale" && isLocale(event.newValue)) {
        setLocaleState(event.newValue);
      }
    }

    window.addEventListener(LOCALE_CHANGE_EVENT, handleLocaleChange);
    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener(LOCALE_CHANGE_EVENT, handleLocaleChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const setLocale = useCallback(async (nextLocale: Locale) => {
    setLocaleState(nextLocale);
    await persistLocale(nextLocale);
  }, []);

  const t = useCallback((key: TranslationKey) => translate(locale, key), [locale]);

  return { locale, setLocale, t };
}
