import { prisma } from "@/lib/prisma";
import type { HuntCard, HuntCreatureSpecies, Prisma } from "@prisma/client";
import { parseAbilityConfig, ABILITY_SCHEMA_VERSION } from "./ability-config";
import {
  createBattle,
  applyBattleStartResonance,
  ROSTER,
  type FighterProfile,
  type Battle,
  type Ability,
  type Element,
} from "./tactics";

export const TRAINING_SPECIES = ["coffee-ember", "map-tide", "bloom-sprout"];
type SpeciesWithAbilities = HuntCreatureSpecies & {
  abilities: Array<{
    ability: {
      slug: string;
      nameRu: string;
      nameEn: string;
      descriptionRu: string;
      descriptionEn: string;
      icon: string;
      isActive: boolean;
      schemaVersion: number;
      revision: number;
      config: Prisma.JsonValue;
    };
  }>;
};
type BattleCard = Pick<
  HuntCard,
  "uuid" | "speciesId" | "level" | "stats" | "rarity" | "fusionRank"
>;

function fusionRankTwoBonuses(
  battleClass: HuntCreatureSpecies["battleClass"],
  fusionRank: number,
) {
  if (fusionRank < 2) return {};
  return {
    healthMultiplier:
      battleClass === "GUARDIAN" ? 1.08 : battleClass === "PROVOKER" ? 1.07 : 1,
    attackMultiplier:
      battleClass === "DUELIST" ? 1.06 : battleClass === "FINISHER" ? 1.07 : 1,
    evasionMultiplier: battleClass === "SCOUT" ? 1.08 : 1,
    healingBonus: battleClass === "HEALER" ? 0.08 : 0,
    captureBonus: battleClass === "CAPTOR" ? 0.1 : 0,
    rangedDamageBonus: battleClass === "SNIPER" ? 0.07 : 0,
  };
}

function shuffle<T>(items: T[], seed = Date.now().toString()) {
  const result = [...items];
  let state = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) || 1;
  for (let i = result.length - 1; i > 0; i--) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const j = state % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function statValue(source: unknown, key: string, fallback: number) {
  const value =
    source && typeof source === "object"
      ? Number((source as Record<string, unknown>)[key])
      : NaN;
  return Number.isFinite(value) ? value : fallback;
}

function profileFor(
  character: SpeciesWithAbilities,
  kind: number,
  options: { card?: BattleCard; scale?: number } = {},
): FighterProfile {
  const affinity = character.baseStats as Record<string, number>;
  const statsSource = options.card?.stats ?? affinity;
  const classic = TRAINING_SPECIES.indexOf(character.slug);
  const fusionRank = Math.max(1, Math.min(5, options.card?.fusionRank ?? 1));
  const fusionBonuses = fusionRankTwoBonuses(character.battleClass, fusionRank);
  const health = statValue(statsSource, "health", Number(affinity.health ?? 4));
  const attack = statValue(statsSource, "attack", Number(affinity.attack ?? 4));
  const luck = statValue(statsSource, "luck", Number(affinity.luck ?? 4));
  const evasion = statValue(
    statsSource,
    "evasion",
    Number(affinity.evasion ?? 4),
  );
  const effectiveHealth = health * (fusionBonuses.healthMultiplier ?? 1);
  const effectiveAttack = attack * (fusionBonuses.attackMultiplier ?? 1);
  const effectiveEvasion = evasion * (fusionBonuses.evasionMultiplier ?? 1);
  const base =
    classic >= 0 && !options.card
      ? ROSTER[classic]
      : {
          key: character.slug,
          hp: 22 + effectiveHealth * 2,
          attack: 5 + Math.round(effectiveAttack * 0.7),
          speed: Math.max(1, Math.min(4, Math.round(effectiveEvasion / 2))),
          movement: effectiveEvasion >= 6 ? 3 : 2,
          range: effectiveHealth < 5 ? 3 : 1,
        };
  const levelBonus = Math.max(0, (options.card?.level ?? 1) - 1);
  const scale = options.scale ?? 1;
  return {
    ...base,
    speciesId: character.id,
    nameRu: character.nameRu || character.name,
    nameEn: character.nameEn || character.name,
    element: character.element as Element,
    luck: Math.max(1, Math.round((6 + luck + levelBonus * 0.4) * scale)),
    hp: Math.max(8, Math.round((base.hp + levelBonus * 2) * scale)),
    attack: Math.max(2, Math.round((base.attack + levelBonus * 0.7) * scale)),
    speed: Math.max(1, Math.round(base.speed * Math.min(1, scale + 0.05))),
    movement: base.movement,
    range: base.range,
    fusionRank,
    battleClass: character.battleClass,
    healingBonus: fusionBonuses.healingBonus ?? 0,
    captureBonus: fusionBonuses.captureBonus ?? 0,
    rangedDamageBonus: fusionBonuses.rangedDamageBonus ?? 0,
    image: (character.imageUrl || "/hunt-assets/cards/compass-light.webp")
      .split("?")[0]
      .replace("/hunt/cards/", "/hunt-assets/cards/"),
    key: character.slug || ROSTER[kind]?.key || "fighter",
  };
}

function abilitiesFor(character: SpeciesWithAbilities): Ability[] {
  return character.abilities.map(({ ability: a }) => {
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
}

export function battleProfilePower(profile: FighterProfile) {
  return (
    profile.hp * 0.8 +
    profile.attack * 4 +
    profile.speed * 5 +
    profile.movement * 3 +
    profile.range * 2 +
    profile.luck * 1.2
  );
}

export async function estimateOwnedTeamPower(userId: number, teamUuids: string[]) {
  if (
    teamUuids.length !== 3 ||
    new Set(teamUuids).size !== 3 ||
    teamUuids.some((id) => typeof id !== "string" || id.length > 120)
  )
    throw new Error("INVALID_TEAM");
  const cards = await prisma.huntCard.findMany({
    where: { ownerId: userId, uuid: { in: teamUuids } },
    select: {
      uuid: true,
      speciesId: true,
      level: true,
      stats: true,
      rarity: true,
      fusionRank: true,
      species: {
        include: {
          abilities: { orderBy: { slot: "asc" }, include: { ability: true } },
        },
      },
    },
  });
  if (cards.length !== 3) throw new Error("INVALID_TEAM");
  const ordered = teamUuids.map((id) => cards.find((card) => card.uuid === id)!);
  const profiles = ordered.map((card, kind) =>
    profileFor(card.species as SpeciesWithAbilities, kind, { card }),
  );
  return Math.round(
    profiles.reduce((total, profile) => total + battleProfilePower(profile), 0) /
      profiles.length,
  );
}

export async function loadBattleContent(
  options: {
    teamUuids?: string[];
    userId?: number;
    opponentTeamUuids?: string[];
    opponentUserId?: number;
    speciesIds?: string[];
    tutorialCardUuid?: string;
    tutorialTeamUuids?: string[];
    botSpeciesIds?: string[];
    randomTrainingBot?: boolean;
    seed?: string;
    botPowerRatio?: number;
  } = {},
): Promise<Battle> {
  let ids = options.speciesIds;
  let playerCards: BattleCard[] = [];
  let opponentCards: BattleCard[] = [];
  const tutorialTeamSize =
    options.tutorialTeamUuids?.length ??
    (options.tutorialCardUuid ? 1 : undefined);
  const tutorialDuel = tutorialTeamSize === 1;
  const tutorialMatch = Boolean(tutorialTeamSize);
  if (options.tutorialCardUuid) {
    if (!options.userId) throw new Error("INVALID_TEAM");
    const card = await prisma.huntCard.findFirst({
      where: { ownerId: options.userId, uuid: options.tutorialCardUuid },
      select: {
        uuid: true,
        speciesId: true,
        level: true,
        stats: true,
        rarity: true,
        fusionRank: true,
      },
    });
    if (!card) throw new Error("INVALID_TEAM");
    playerCards = [card];
    ids = [card.speciesId];
  }
  if (options.tutorialTeamUuids) {
    if (
      !options.userId ||
      ![1, 2].includes(options.tutorialTeamUuids.length) ||
      new Set(options.tutorialTeamUuids).size !== options.tutorialTeamUuids.length ||
      options.tutorialTeamUuids.some((id) => typeof id !== "string" || id.length > 120)
    )
      throw new Error("INVALID_TEAM");
    const cards = await prisma.huntCard.findMany({
      where: { ownerId: options.userId, uuid: { in: options.tutorialTeamUuids } },
      select: {
        uuid: true,
        speciesId: true,
        level: true,
        stats: true,
        rarity: true,
        fusionRank: true,
      },
    });
    if (cards.length !== options.tutorialTeamUuids.length) throw new Error("INVALID_TEAM");
    playerCards = options.tutorialTeamUuids.map(
      (id) => cards.find((c) => c.uuid === id)!,
    );
    ids = playerCards.map((card) => card.speciesId);
  }
  if (options.teamUuids) {
    if (
      !options.userId ||
      options.teamUuids.length !== 3 ||
      new Set(options.teamUuids).size !== 3
    )
      throw new Error("INVALID_TEAM");
    const cards = await prisma.huntCard.findMany({
      where: { ownerId: options.userId, uuid: { in: options.teamUuids } },
      select: {
        uuid: true,
        speciesId: true,
        level: true,
        stats: true,
        rarity: true,
        fusionRank: true,
      },
    });
    if (cards.length !== 3) throw new Error("INVALID_TEAM");
    playerCards = options.teamUuids.map(
      (id) => cards.find((c) => c.uuid === id)!,
    );
    ids = options.teamUuids.map(
      (id) => cards.find((c) => c.uuid === id)!.speciesId,
    );
  }
  let botIds = options.botSpeciesIds;
  if (options.opponentTeamUuids) {
    if (
      !options.opponentUserId ||
      options.opponentTeamUuids.length !== 3 ||
      new Set(options.opponentTeamUuids).size !== 3
    )
      throw new Error("INVALID_TEAM");
    const cards = await prisma.huntCard.findMany({
      where: {
        ownerId: options.opponentUserId,
        uuid: { in: options.opponentTeamUuids },
      },
      select: {
        uuid: true,
        speciesId: true,
        level: true,
        stats: true,
        rarity: true,
        fusionRank: true,
      },
    });
    if (cards.length !== 3) throw new Error("INVALID_TEAM");
    opponentCards = options.opponentTeamUuids.map(
      (id) => cards.find((c) => c.uuid === id)!,
    );
    botIds = opponentCards.map((card) => card.speciesId);
  }
  if (options.randomTrainingBot) {
    const candidates = await prisma.huntCreatureSpecies.findMany({
      where: { isActive: true },
      include: {
        abilities: { orderBy: { slot: "asc" }, include: { ability: true } },
      },
    });
    const botCount = tutorialTeamSize ?? 3;
    botIds = shuffle(
      candidates
        .filter((s) => s.abilities.length === 3)
        .map((s) => s.id),
      options.seed,
    )
      .filter((id) => !ids?.includes(id))
      .slice(0, botCount);
    if (botIds.length < botCount)
      botIds = shuffle(
        candidates
          .filter((s) => s.abilities.length === 3)
          .map((s) => s.id),
        `${options.seed}:fallback`,
      ).slice(0, botCount);
  }
  const allIds = [...new Set([...(ids ?? []), ...(botIds ?? [])])];
  const species = await prisma.huntCreatureSpecies.findMany({
    where: allIds.length
      ? { id: { in: allIds } }
      : { slug: { in: TRAINING_SPECIES } },
    include: {
      abilities: { orderBy: { slot: "asc" }, include: { ability: true } },
    },
  });
  const playerOrdered = ids
    ? ids.map((id) => species.find((s) => s.id === id))
    : TRAINING_SPECIES.map((slug) => species.find((s) => s.slug === slug));
  const botOrdered = botIds
    ? botIds.map((id) => species.find((s) => s.id === id))
    : playerOrdered;
  const expectedTeamSize = tutorialTeamSize ?? 3;
  if (
    playerOrdered.length !== expectedTeamSize ||
    botOrdered.length !== expectedTeamSize ||
    playerOrdered.some((s) => !s || s.abilities.length !== 3) ||
    botOrdered.some((s) => !s || s.abilities.length !== 3)
  )
    throw new Error("CONTENT_NOT_READY");
  const battle = createBattle();
  const playerProfiles = playerOrdered.map((s, kind) =>
    profileFor(s as SpeciesWithAbilities, kind, { card: playerCards[kind] }),
  );
  const playerPower =
    playerProfiles.reduce((total, profile) => total + battleProfilePower(profile), 0) /
    playerProfiles.length;
  const rawBotProfiles = botOrdered.map((s, kind) =>
    profileFor(s as SpeciesWithAbilities, kind),
  );
  const botPower =
    rawBotProfiles.reduce((total, profile) => total + battleProfilePower(profile), 0) /
    rawBotProfiles.length;
  const botScale =
    options.botPowerRatio && botPower
      ? Math.max(0.72, Math.min(1.08, (playerPower * options.botPowerRatio) / botPower))
      : 1;
  playerOrdered.forEach((s, kind) => {
    const character = s!;
    const profile = playerProfiles[kind];
    const abilities = abilitiesFor(character as SpeciesWithAbilities);
    const unit = battle.units.find((u) => u.id === `player-${kind}`)!;
    Object.assign(unit, { profile, abilities, hp: profile.hp });
  });
  botOrdered.forEach((s, kind) => {
    const character = s!;
    let profile = profileFor(character as SpeciesWithAbilities, kind, {
      card: opponentCards[kind],
      scale: opponentCards[kind] ? 1 : botScale,
    });
    if (tutorialMatch) {
      const referenceProfile = playerProfiles[kind] ?? playerProfiles[0];
      profile = {
        ...profile,
        hp: Math.max(18, Math.min(profile.hp, Math.round(referenceProfile.hp * 0.88))),
        attack: Math.max(2, Math.round(referenceProfile.attack * 0.28)),
        speed: 1,
        movement: 1,
        range: 1,
        luck: 1,
      };
    }
    const abilities = abilitiesFor(character as SpeciesWithAbilities);
    const unit = battle.units.find((u) => u.id === `bot-${kind}`)!;
    Object.assign(unit, { profile, abilities, hp: profile.hp });
  });
  if (tutorialDuel) {
    battle.units = battle.units
      .filter((unit) => unit.id === "player-0" || unit.id === "bot-0")
      .map((unit) =>
        unit.id === "player-0"
          ? { ...unit, x: 4, y: 6 }
          : { ...unit, x: 4, y: 3 },
      );
    battle.statistics = Object.fromEntries(
      Object.entries(battle.statistics).filter(([id]) =>
        ["player-0", "bot-0"].includes(id),
      ),
    );
  }
  if (tutorialTeamSize === 2) {
    battle.units = battle.units
      .filter((unit) => ["player-0", "player-1", "bot-0", "bot-1"].includes(unit.id))
      .map((unit) => {
        if (unit.id === "player-0") return { ...unit, x: 3, y: 6 };
        if (unit.id === "player-1") return { ...unit, x: 5, y: 6 };
        if (unit.id === "bot-0") return { ...unit, x: 3, y: 3 };
        return { ...unit, x: 5, y: 3 };
      });
    battle.statistics = Object.fromEntries(
      Object.entries(battle.statistics).filter(([id]) =>
        ["player-0", "player-1", "bot-0", "bot-1"].includes(id),
      ),
    );
  }
  applyBattleStartResonance(battle);
  return battle;
}
