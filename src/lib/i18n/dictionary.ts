import { adminDictionary } from "./dictionaries/admin";
import { adminPagesDictionary } from "./dictionaries/admin-pages";
import { clientDictionary } from "./dictionaries/client";
import type { Locale } from "./shared";

export const dictionary = {
  en: {
    ...adminDictionary.en,
    ...adminPagesDictionary.en,
    ...clientDictionary.en,
  },
  ru: {
    ...adminDictionary.ru,
    ...adminPagesDictionary.ru,
    ...clientDictionary.ru,
  },
} as const satisfies Record<Locale, Record<string, string>>;

export type TranslationKey = keyof typeof dictionary.en;

export function translate(locale: Locale, key: TranslationKey) {
  return dictionary[locale][key] ?? dictionary.en[key] ?? key;
}
