import type { TranslationKey } from "./dictionary";
import type { TranslateFn } from "./format";

type CategoryLike = {
  slug?: string;
  name: string;
};

const CATEGORY_NAME_KEYS: Record<string, TranslationKey> = {
  auto: "client.categoryName.auto",
  barber: "client.categoryName.barber",
  beauty: "client.categoryName.beauty",
  books: "client.categoryName.books",
  coffee: "client.categoryName.coffee",
  delivery: "client.categoryName.delivery",
  education: "client.categoryName.education",
  electronics: "client.categoryName.electronics",
  entertainment: "client.categoryName.entertainment",
  fashion: "client.categoryName.fashion",
  fitness: "client.categoryName.fitness",
  food: "client.categoryName.food",
  health: "client.categoryName.health",
  home: "client.categoryName.home",
  kids: "client.categoryName.kids",
  other: "client.categoryName.other",
  "pet-care": "client.categoryName.petCare",
  pharmacy: "client.categoryName.pharmacy",
  retail: "client.categoryName.retail",
  services: "client.categoryName.services",
  sports: "client.categoryName.sports",
  travel: "client.categoryName.travel",
};

export function categoryName(category: CategoryLike | null | undefined, t: TranslateFn) {
  if (!category) return "";
  const identifier = (category.slug ?? category.name).trim().toLowerCase().replace(/\s+/g, "-");
  const key = CATEGORY_NAME_KEYS[identifier];
  return key ? t(key) : category.name;
}
