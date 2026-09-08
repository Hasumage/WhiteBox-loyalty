import { prisma } from "@/lib/prisma";
import { parseAbilityConfig, ABILITY_SCHEMA_VERSION } from "./ability-config";
import {
  createBattle,
  ROSTER,
  type FighterProfile,
  type Battle,
  type Ability,
  type Element,
} from "./tactics";

export const TRAINING_SPECIES = ["coffee-ember", "map-tide", "bloom-sprout"];
export async function loadBattleContent(
  options: {
    teamUuids?: string[];
    userId?: number;
    speciesIds?: string[];
  } = {},
): Promise<Battle> {
  let ids = options.speciesIds;
  if (options.teamUuids) {
    if (
      !options.userId ||
      options.teamUuids.length !== 3 ||
      new Set(options.teamUuids).size !== 3
    )
      throw new Error("INVALID_TEAM");
    const cards = await prisma.huntCard.findMany({
      where: { ownerId: options.userId, uuid: { in: options.teamUuids } },
      select: { uuid: true, speciesId: true },
    });
    if (cards.length !== 3) throw new Error("INVALID_TEAM");
    ids = options.teamUuids.map(
      (id) => cards.find((c) => c.uuid === id)!.speciesId,
    );
  }
  const species = await prisma.huntCreatureSpecies.findMany({
    where: ids ? { id: { in: ids } } : { slug: { in: TRAINING_SPECIES } },
    include: {
      abilities: { orderBy: { slot: "asc" }, include: { ability: true } },
    },
  });
  const ordered = ids
    ? ids.map((id) => species.find((s) => s.id === id))
    : TRAINING_SPECIES.map((slug) => species.find((s) => s.slug === slug));
  if (
    ordered.length !== 3 ||
    ordered.some((s) => !s || s.abilities.length !== 3)
  )
    throw new Error("CONTENT_NOT_READY");
  const battle = createBattle();
  ordered.forEach((s, kind) => {
    const character = s!;
    const affinity = character.baseStats as Record<string, number>;
    const classic = TRAINING_SPECIES.indexOf(character.slug);
    const profile: FighterProfile = {
      ...(classic >= 0
        ? ROSTER[classic]
        : {
            key: character.slug,
            hp: 22 + Number(affinity.health ?? 4) * 2,
            attack: 5 + Math.round(Number(affinity.attack ?? 4) * 0.7),
            speed: Math.max(
              1,
              Math.min(4, Math.round(Number(affinity.evasion ?? 4) / 2)),
            ),
            movement: Number(affinity.evasion ?? 4) >= 6 ? 3 : 2,
            range: Number(affinity.health ?? 4) < 5 ? 3 : 1,
          }),
      speciesId: character.id,
      nameRu: character.nameRu || character.name,
      nameEn: character.nameEn || character.name,
      element: character.element as Element,
      luck: classic >= 0 ? 10 : 6 + Number(affinity.luck ?? 4),
      image: (character.imageUrl || "/hunt-assets/cards/compass-light.webp")
        .split("?")[0]
        .replace("/hunt/cards/", "/hunt-assets/cards/"),
    };
    const abilities: Ability[] = character.abilities.map(({ ability: a }) => {
      if (a.schemaVersion !== ABILITY_SCHEMA_VERSION)
        throw new Error("CONTENT_NOT_READY");
      return {
        ...parseAbilityConfig(a.config),
        key: a.slug,
        nameRu: a.nameRu,
        nameEn: a.nameEn,
        descriptionRu: a.descriptionRu,
        descriptionEn: a.descriptionEn,
        icon: a.icon,
        enabled: a.isActive,
        revision: a.revision,
      };
    });
    for (const side of ["player", "bot"] as const) {
      const unit = battle.units.find((u) => u.id === `${side}-${kind}`)!;
      Object.assign(unit, { profile, abilities, hp: profile.hp });
    }
  });
  return battle;
}
