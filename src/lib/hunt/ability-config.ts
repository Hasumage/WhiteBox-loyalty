import type { Ability, AbilityEffect } from "./tactics";

export const ABILITY_SCHEMA_VERSION = 1;
export const EFFECT_TYPES = [
  "damage",
  "lifesteal",
  "heal",
  "shield",
  "burn",
  "poison",
  "buff",
  "push",
  "pull",
] as const;
export const ABILITY_ICONS = [
  "sparkles",
  "flame",
  "shield",
  "droplets",
  "waves",
  "leaf",
  "skull",
  "sprout",
  "swords",
  "wind",
  "sun",
  "moon",
  "music",
  "heart",
] as const;
export type AbilityConfig = Pick<
  Ability,
  | "cost"
  | "cooldown"
  | "target"
  | "radius"
  | "rangeBonus"
  | "range"
  | "lineOfSight"
  | "maxTargets"
  | "delayed"
  | "effects"
>;
export type EditableAbility = {
  id: string;
  slug: string;
  slot: number;
  revision: number;
  schemaVersion: number;
  nameRu: string;
  nameEn: string;
  descriptionRu: string;
  descriptionEn: string;
  icon: string;
  isActive: boolean;
  config: AbilityConfig;
};
export class AbilityValidationError extends Error {}
const fail = (path: string): never => {
  throw new AbilityValidationError(`Некорректное поле: ${path}`);
};
function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail(path);
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[], path: string) {
  for (const key of Object.keys(value))
    if (!allowed.includes(key)) fail(`${path}.${key}`);
}
function numeric(
  value: unknown,
  min: number,
  max: number,
  path: string,
  integer = false,
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  )
    return fail(path);
  return value;
}
function choice<T extends string>(
  value: unknown,
  options: readonly T[],
  path: string,
): T {
  return typeof value === "string" && options.includes(value as T)
    ? (value as T)
    : fail(path);
}
function boolean(value: unknown, fallback: boolean, path: string) {
  if (value === undefined) return fallback;
  return typeof value === "boolean" ? value : fail(path);
}
export function parseAbilityConfig(input: unknown): AbilityConfig {
  const c = object(input, "config");
  keys(
    c,
    [
      "cost",
      "cooldown",
      "target",
      "radius",
      "rangeBonus",
      "range",
      "lineOfSight",
      "maxTargets",
      "delayed",
      "effects",
    ],
    "config",
  );
  if (!Array.isArray(c.effects) || c.effects.length < 1 || c.effects.length > 8)
    fail("effects (1–8)");
  const effects = (c.effects as unknown[]).map((value, i): AbilityEffect => {
    const path = `effects[${i}]`,
      e = object(value, path);
    const type = choice(e.type, EFFECT_TYPES, `${path}.type`);
    const extra =
      type === "damage"
        ? ["canCrit", "ignoreCover"]
        : type === "lifesteal"
          ? ["ratio", "canCrit", "ignoreCover"]
          : type === "shield"
            ? ["duration"]
            : type === "push" || type === "pull"
              ? ["maxDistance"]
              : type === "buff"
                ? ["duration", "delay", "stacking", "stat"]
                : type === "burn" || type === "poison"
                  ? ["duration", "delay", "stacking", "healingReduction"]
                  : [];
    keys(e, ["type", "enabled", "power", ...extra], path);
    const p = object(e.power, `${path}.power`);
    keys(p, ["stat", "factor", "flat"], `${path}.power`);
    const power = {
      stat: choice(
        p.stat,
        ["hp", "attack", "speed", "luck"],
        `${path}.power.stat`,
      ),
      factor: numeric(p.factor, 0, 10, `${path}.power.factor`),
      flat: numeric(p.flat ?? 0, 0, 100, `${path}.power.flat`),
    };
    if (!power.factor && !power.flat)
      fail(`${path}.power (сила должна быть больше нуля)`);
    const base = {
      type,
      enabled: boolean(e.enabled, true, `${path}.enabled`),
      power,
    };
    if (type === "damage" || type === "lifesteal")
      return {
        ...base,
        type,
        canCrit: boolean(e.canCrit, true, `${path}.canCrit`),
        ignoreCover: boolean(e.ignoreCover, false, `${path}.ignoreCover`),
        ...(type === "lifesteal"
          ? { ratio: numeric(e.ratio, 0.01, 1, `${path}.ratio`) }
          : {}),
      } as AbilityEffect;
    if (type === "shield")
      return {
        ...base,
        type,
        duration: numeric(e.duration ?? 0, 0, 10, `${path}.duration`, true),
      };
    if (type === "push" || type === "pull")
      return {
        ...base,
        type,
        maxDistance: numeric(
          e.maxDistance ?? 2,
          1,
          4,
          `${path}.maxDistance`,
          true,
        ),
      };
    if (type === "heal") return { ...base, type };
    const duration = numeric(e.duration, 1, 10, `${path}.duration`, true);
    const delay = numeric(e.delay ?? 1, 1, 3, `${path}.delay`, true);
    const stacking = choice(
      e.stacking ?? "refresh",
      ["refresh", "replace"],
      `${path}.stacking`,
    );
    if (type === "buff")
      return {
        ...base,
        type,
        duration,
        delay,
        stacking,
        stat: choice(e.stat, ["attack", "speed", "luck"], `${path}.stat`),
      };
    return {
      ...base,
      type,
      duration,
      delay,
      stacking,
      healingReduction: numeric(
        e.healingReduction ?? (type === "poison" ? 0.3 : 0),
        0,
        type === "poison" ? 1 : 0,
        `${path}.healingReduction`,
      ),
    };
  });
  if (!effects.some((e) => e.enabled))
    fail("effects (включите хотя бы один эффект)");
  return {
    cost: numeric(c.cost, 0, 20, "cost", true),
    cooldown: numeric(c.cooldown, 0, 10, "cooldown", true),
    target: choice(c.target, ["enemy", "ally", "self"], "target"),
    radius: numeric(c.radius, 0, 4, "radius", true),
    rangeBonus: numeric(c.rangeBonus ?? 0, -8, 8, "rangeBonus", true),
    ...(c.range == null
      ? {}
      : { range: numeric(c.range, 0, 16, "range", true) }),
    lineOfSight: boolean(c.lineOfSight, true, "lineOfSight"),
    maxTargets: numeric(c.maxTargets ?? 6, 1, 6, "maxTargets", true),
    delayed: boolean(c.delayed, false, "delayed"),
    effects,
  };
}
export function parseAbilityEdit(input: unknown): EditableAbility {
  const a = object(input, "ability");
  const text = (key: string, max: number, required = true) => {
    if (
      typeof a[key] !== "string" ||
      (required && !(a[key] as string).trim()) ||
      (a[key] as string).length > max
    )
      return fail(key);
    return (a[key] as string).trim();
  };
  if (a.schemaVersion !== ABILITY_SCHEMA_VERSION) fail("schemaVersion");
  return {
    id: text("id", 120),
    slug: text("slug", 150),
    slot: numeric(a.slot, 0, 2, "slot", true),
    revision: numeric(a.revision, 1, 2147483646, "revision", true),
    schemaVersion: ABILITY_SCHEMA_VERSION,
    nameRu: text("nameRu", 80),
    nameEn: text("nameEn", 80),
    descriptionRu: text("descriptionRu", 1000, false),
    descriptionEn: text("descriptionEn", 1000, false),
    icon: choice(a.icon, ABILITY_ICONS, "icon"),
    isActive: boolean(a.isActive, true, "isActive"),
    config: parseAbilityConfig(a.config),
  };
}
