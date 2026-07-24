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
  gaming: "client.categoryName.gaming",
  health: "client.categoryName.health",
  "healthy-food": "client.categoryName.healthyFood",
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

function normalizeCategoryIdentifier(value: string | undefined) {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, "-");
}

function isBrokenPlaceholderName(value: string) {
  return /^[?\s]+$/.test(value.trim());
}

function humanizeCategorySlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function categoryName(category: CategoryLike | null | undefined, t: TranslateFn) {
  if (!category) return "";
  const slugIdentifier = normalizeCategoryIdentifier(category.slug);
  const slugKey = CATEGORY_NAME_KEYS[slugIdentifier];
  if (slugKey) return t(slugKey);

  const nameIdentifier = normalizeCategoryIdentifier(category.name);
  const nameKey = CATEGORY_NAME_KEYS[nameIdentifier];
  if (nameKey) return t(nameKey);

  if (isBrokenPlaceholderName(category.name) && slugIdentifier) {
    return humanizeCategorySlug(slugIdentifier);
  }

  return category.name;
}
