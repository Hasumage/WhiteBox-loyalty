import type { Locale } from "./shared";

const LEVEL_NAME_TRANSLATIONS: Record<string, Record<Locale, string>> = {
  bronze: { en: "Standart", ru: "Стандартный" },
  standard: { en: "Standart", ru: "Стандартный" },
  standart: { en: "Standart", ru: "Стандартный" },
};

export function companyLevelName(levelName: string | null | undefined, locale: Locale, fallback = "") {
  const rawName = levelName?.trim();

  if (!rawName) {
    return fallback;
  }

  return LEVEL_NAME_TRANSLATIONS[rawName.toLowerCase()]?.[locale] ?? rawName;
}
