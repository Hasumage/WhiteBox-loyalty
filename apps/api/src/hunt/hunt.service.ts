import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  HuntBoxStatus,
  HuntBoxType,
  HuntBoxRewardKind,
  HuntCardUpgradeStatus,
  HuntCardRarity,
  HuntCurrencyReason,
  HuntCreatureSpecies,
  HuntElement,
  HuntMissionKind,
  HuntPlaceSource,
  HuntPostStatus,
  HuntReportStatus,
  NotificationDeliveryStatus,
  Prisma,
} from "@prisma/client";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { PrismaService } from "../prisma/prisma.service";
import { CreateHuntPlaceDto } from "./dto/create-hunt-place.dto";
import { CreateHuntPostDto } from "./dto/create-hunt-post.dto";
import { ModerateHuntPostDto } from "./dto/moderate-hunt-post.dto";
import { ReportHuntPostDto } from "./dto/report-hunt-post.dto";
import { HUNT_CARD_STAT_KEYS, type HuntCardStatKey } from "./dto/upgrade-hunt-card.dto";
import { UploadHuntMediaDto } from "./dto/upload-hunt-media.dto";

const POST_CREATE_REWARD = 35;
const LIKE_AUTHOR_REWARD = 8;
const POST_BOX_COST = 120;
const DEFAULT_BOX_CONFIGS: Record<string, {
  slug: string;
  type: HuntBoxType;
  title: string;
  description: string;
  imageUrl: string;
  cost: number;
  minRarity: HuntCardRarity;
  maxRarity: HuntCardRarity | null;
  itemCountMin: number;
  itemCountMax: number;
  dailyLimit: number | null;
  statusDropChanceBp: number;
  guaranteedRarity?: HuntCardRarity | null;
  guaranteedCount?: number;
  rotationGroup?: string | null;
  rotationIndex?: number | null;
  rotationElement?: HuntElement | null;
  rotationStartsAt?: Date | null;
  isActive: boolean;
  isPurchasable: boolean;
  sortOrder: number;
  rarityWeights: Partial<Record<HuntCardRarity, number>>;
}> = {
  [HuntBoxType.PROMO]: {
    slug: "promo-daily",
    type: HuntBoxType.PROMO,
    title: "Промо-бокс",
    description: "Один бесплатный бокс в сутки. Дроп не выше эпической редкости.",
    imageUrl: "/hunt-assets/shop/promo-box.png",
    cost: 0,
    minRarity: HuntCardRarity.COMMON,
    maxRarity: HuntCardRarity.EPIC,
    itemCountMin: 1,
    itemCountMax: 2,
    dailyLimit: 1,
    statusDropChanceBp: 550,
    isActive: true,
    isPurchasable: true,
    sortOrder: 5,
    rarityWeights: {
      [HuntCardRarity.COMMON]: 5200,
      [HuntCardRarity.UNCOMMON]: 3000,
      [HuntCardRarity.RARE]: 1400,
      [HuntCardRarity.EPIC]: 400,
      [HuntCardRarity.LEGENDARY]: 0,
    },
  },
  [HuntBoxType.POST]: {
    slug: "city-box",
    type: HuntBoxType.POST,
    title: "Районная коробка",
    description: "Базовая коробка Nearloy для обычных постов о местах и районных находок.",
    imageUrl: "/hunt-assets/shop/district-box-v2.png",
    cost: 120,
    minRarity: HuntCardRarity.COMMON,
    maxRarity: null,
    itemCountMin: 1,
    itemCountMax: 1,
    dailyLimit: null,
    statusDropChanceBp: 250,
    isActive: true,
    isPurchasable: true,
    sortOrder: 10,
    rarityWeights: {
      [HuntCardRarity.COMMON]: 5600,
      [HuntCardRarity.UNCOMMON]: 2700,
      [HuntCardRarity.RARE]: 1250,
      [HuntCardRarity.EPIC]: 380,
      [HuntCardRarity.LEGENDARY]: 10,
    },
  },
  [HuntBoxType.CATEGORY]: {
    slug: "rare-box",
    type: HuntBoxType.CATEGORY,
    title: "Редкая коробка",
    description: "Коробка с повышенным шансом редких и эпических персонажей.",
    imageUrl: "/hunt-assets/shop/rare-card-crate.webp",
    cost: 300,
    minRarity: HuntCardRarity.UNCOMMON,
    maxRarity: null,
    itemCountMin: 1,
    itemCountMax: 2,
    dailyLimit: null,
    statusDropChanceBp: 420,
    isActive: true,
    isPurchasable: true,
    sortOrder: 20,
    rarityWeights: {
      [HuntCardRarity.COMMON]: 1800,
      [HuntCardRarity.UNCOMMON]: 4200,
      [HuntCardRarity.RARE]: 2700,
      [HuntCardRarity.EPIC]: 1200,
      [HuntCardRarity.LEGENDARY]: 20,
    },
  },
  [HuntBoxType.TRENDING]: {
    slug: "resource-chest",
    type: HuntBoxType.TRENDING,
    title: "Городская коробка",
    description: "Городская коробка для развития коллекции: обычные, необычные и редкие персонажи с шансом на эпик.",
    imageUrl: "/hunt-assets/shop/city-box-v2.png",
    cost: 650,
    minRarity: HuntCardRarity.COMMON,
    maxRarity: null,
    itemCountMin: 2,
    itemCountMax: 3,
    dailyLimit: null,
    statusDropChanceBp: 650,
    isActive: true,
    isPurchasable: true,
    sortOrder: 30,
    rarityWeights: {
      [HuntCardRarity.COMMON]: 1800,
      [HuntCardRarity.UNCOMMON]: 3200,
      [HuntCardRarity.RARE]: 3300,
      [HuntCardRarity.EPIC]: 1600,
      [HuntCardRarity.LEGENDARY]: 25,
    },
  },
  [HuntBoxType.DISTRICT]: {
    slug: "weekly-gold",
    type: HuntBoxType.DISTRICT,
    title: "Редкий дроп недели",
    description: "Премиальный сундук с высоким шансом эпических и легендарных персонажей.",
    imageUrl: "/hunt-assets/shop/weekly-gold-chest.webp",
    cost: 1000,
    minRarity: HuntCardRarity.COMMON,
    maxRarity: null,
    itemCountMin: 3,
    itemCountMax: 5,
    dailyLimit: null,
    statusDropChanceBp: 900,
    guaranteedRarity: HuntCardRarity.EPIC,
    guaranteedCount: 1,
    isActive: true,
    isPurchasable: true,
    sortOrder: 40,
    rarityWeights: {
      [HuntCardRarity.COMMON]: 2400,
      [HuntCardRarity.UNCOMMON]: 3100,
      [HuntCardRarity.RARE]: 2200,
      [HuntCardRarity.EPIC]: 650,
      [HuntCardRarity.LEGENDARY]: 10,
    },
  },
  [HuntBoxType.ELEMENTAL]: {
    slug: "elemental-weekly",
    type: HuntBoxType.ELEMENTAL,
    title: "Стихийный дроп недели",
    description: "Недельная стихийная коробка. Выпадают только персонажи текущей стихии, не выше эпической редкости.",
    imageUrl: "/hunt-assets/shop/elemental-nature-box-v2.png",
    cost: 420,
    minRarity: HuntCardRarity.COMMON,
    maxRarity: HuntCardRarity.EPIC,
    itemCountMin: 2,
    itemCountMax: 3,
    dailyLimit: null,
    statusDropChanceBp: 400,
    rotationGroup: "elemental-weekly",
    rotationIndex: 0,
    rotationElement: HuntElement.FLAME,
    isActive: true,
    isPurchasable: true,
    sortOrder: 50,
    rarityWeights: {
      [HuntCardRarity.COMMON]: 3600,
      [HuntCardRarity.UNCOMMON]: 3300,
      [HuntCardRarity.RARE]: 2300,
      [HuntCardRarity.EPIC]: 800,
      [HuntCardRarity.LEGENDARY]: 0,
    },
  },
};
const DAILY_POST_LIMIT = 8;
const DAILY_POST_REWARD_CAP = 175;
const DAILY_LIKE_REWARD_CAP = 800;
const DAY_MS = 24 * 60 * 60 * 1000;
const MOSCOW_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAILY_POST_REWARD_HOUR_MSK = 10;
const POST_REWARD_ACTIVE_DAYS = 10;
const SYNTHETIC_LIKE_TOTALS = [0, 50, 60, 70, 80, 100] as const;
const TAG_LIMIT = 8;
const MEDIA_LIMIT = 3;
const MOOD_TAG_LIMIT = 5;
const MAX_CARD_LEVEL = 30;
const MAX_CARD_FUSION_RANK = 5;
const FUSION_DUPLICATES_BY_TARGET_RANK: Record<number, number> = {
  2: 1,
  3: 1,
  4: 2,
  5: 3,
};
const ELEMENTAL_ROTATION_GROUP = "elemental-weekly";
const ELEMENTAL_ROTATION_ANCHOR_UTC = Date.UTC(2026, 8, 7, 8, 0, 0, 0);
const ELEMENTAL_ROTATION_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ELEMENTAL_ROTATION_ELEMENTS: HuntElement[] = [
  HuntElement.FLAME,
  HuntElement.WATER,
  HuntElement.NATURE,
  HuntElement.WIND,
  HuntElement.MUSIC,
];
const HUNT_MEDIA_MAX_BYTES = 6 * 1024 * 1024;
const HUNT_MEDIA_DIR = process.env.HUNT_MEDIA_DIR ?? join(process.cwd(), "storage", "hunt-media");
const ALLOWED_MEDIA_TYPES = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
]);

const RARITY_ORDER: HuntCardRarity[] = [
  HuntCardRarity.COMMON,
  HuntCardRarity.UNCOMMON,
  HuntCardRarity.RARE,
  HuntCardRarity.EPIC,
  HuntCardRarity.LEGENDARY,
];

const RARITY_ROLLS: Array<{ rarity: HuntCardRarity; threshold: number }> = [
  { rarity: HuntCardRarity.LEGENDARY, threshold: 985 },
  { rarity: HuntCardRarity.EPIC, threshold: 930 },
  { rarity: HuntCardRarity.RARE, threshold: 800 },
  { rarity: HuntCardRarity.UNCOMMON, threshold: 520 },
  { rarity: HuntCardRarity.COMMON, threshold: 0 },
];

const HUNT_TUTORIAL_STEPS = [
  "WELCOME",
  "OPEN_FIRST_BOX",
  "FIRST_BATTLE",
  "SECOND_BATTLE",
  "TACTICS",
  "UPGRADE",
  "COMPLETE",
] as const;
type HuntTutorialStep = typeof HUNT_TUTORIAL_STEPS[number];
type HuntTutorialState = {
  started?: boolean;
  firstCoinsGranted?: boolean;
  firstBoxOpened?: boolean;
  firstBattleFinished?: boolean;
  secondCardGranted?: boolean;
  secondBattleFinished?: boolean;
  upgradeCoinsGranted?: boolean;
  upgradeDone?: boolean;
  finalCardGranted?: boolean;
};

@Injectable()
export class HuntService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private slugify(value: string) {
    const base = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/giu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72);
    return base || `place-${randomUUID().slice(0, 8)}`;
  }

  private normalizeTags(tags: string[] | undefined) {
    return [...new Set((tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean))]
      .slice(0, TAG_LIMIT)
      .map((tag) => tag.slice(0, 32));
  }

  private normalizeTextList(values: string[] | undefined, limit: number, maxLength: number) {
    return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))]
      .slice(0, limit)
      .map((value) => value.slice(0, maxLength));
  }

  private normalizeMediaUrls(values: string[] | undefined, fallback?: string) {
    return this.normalizeTextList([...(fallback ? [fallback] : []), ...(values ?? [])], MEDIA_LIMIT, 600);
  }

  async geocodeAddress(address: string) {
    const query = address.trim();
    if (query.length < 4) throw new BadRequestException("Address is too short.");
    const apiKey =
      this.config.get<string>("YANDEX_GEOCODER_API_KEY") ??
      this.config.get<string>("NEXT_PUBLIC_YANDEX_MAPS_API_KEY");
    if (!apiKey) throw new BadRequestException("YANDEX_GEOCODER_API_KEY is not configured.");

    const params = new URLSearchParams({
      apikey: apiKey,
      geocode: query,
      format: "json",
      lang: "ru_RU",
      results: "1",
    });
    const referer = this.config.get<string>("FRONTEND_ORIGIN") ?? "http://localhost:3000";
    const response = await fetch(`https://geocode-maps.yandex.ru/v1/?${params.toString()}`, {
      headers: { Referer: referer },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new BadRequestException(`Yandex geocoder failed (${response.status}): ${body.slice(0, 240)}`);
    }

    const payload = (await response.json()) as {
      response?: {
        GeoObjectCollection?: {
          featureMember?: Array<{
            GeoObject?: {
              name?: string;
              description?: string;
              Point?: { pos?: string };
              metaDataProperty?: {
                GeocoderMetaData?: {
                  precision?: string;
                  text?: string;
                  Address?: { formatted?: string };
                };
              };
            };
          }>;
        };
      };
    };
    const geoObject = payload.response?.GeoObjectCollection?.featureMember?.[0]?.GeoObject;
    const pos = geoObject?.Point?.pos;
    if (!pos) throw new BadRequestException("Yandex geocoder did not find coordinates for this address.");

    const [longitudeRaw, latitudeRaw] = pos.split(" ");
    const longitude = Number(longitudeRaw);
    const latitude = Number(latitudeRaw);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new BadRequestException("Yandex geocoder returned invalid coordinates.");
    }

    const meta = geoObject.metaDataProperty?.GeocoderMetaData;
    return {
      address: meta?.Address?.formatted ?? meta?.text ?? query,
      latitude,
      longitude,
      precision: meta?.precision ?? null,
      name: geoObject.name ?? null,
      description: geoObject.description ?? null,
    };
  }

  private gpsConfidence(latitude?: number, longitude?: number, accuracy?: number) {
    if (latitude == null || longitude == null) return 0;
    if (accuracy == null) return 70;
    if (accuracy <= 50) return 100;
    if (accuracy <= 150) return 85;
    if (accuracy <= 500) return 65;
    if (accuracy <= 1500) return 40;
    return 20;
  }

  private todayStart(now = new Date()) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private moscowDayStart(now = new Date()) {
    const moscow = new Date(now.getTime() + MOSCOW_UTC_OFFSET_MS);
    return new Date(Date.UTC(moscow.getUTCFullYear(), moscow.getUTCMonth(), moscow.getUTCDate()) - MOSCOW_UTC_OFFSET_MS);
  }

  private latestPostRewardDate(now = new Date()) {
    const today = this.moscowDayStart(now);
    const moscowHour = new Date(now.getTime() + MOSCOW_UTC_OFFSET_MS).getUTCHours();
    return new Date(today.getTime() - (moscowHour >= DAILY_POST_REWARD_HOUR_MSK ? DAY_MS : 2 * DAY_MS));
  }

  private activePostCutoff(now = new Date()) {
    return new Date(this.moscowDayStart(now).getTime() - (POST_REWARD_ACTIVE_DAYS - 1) * DAY_MS);
  }

  private syntheticLikeBudget(postCount: number) {
    if (postCount <= 0) return 0;
    const target = SYNTHETIC_LIKE_TOTALS[Math.min(postCount, SYNTHETIC_LIKE_TOTALS.length - 1)];
    const maxJitter = Math.max(0, Math.floor(target * 0.12));
    return Math.max(0, target - (maxJitter > 0 ? randomInt(maxJitter + 1) : 0));
  }

  private distributeSyntheticLikes(postCount: number) {
    const budget = this.syntheticLikeBudget(postCount);
    if (postCount <= 0 || budget <= 0) return [];

    const minimum = postCount * 5 <= budget ? 5 : 0;
    const result = Array.from({ length: postCount }, () => minimum);
    let remaining = budget - minimum * postCount;
    if (remaining <= 0) return result;

    const weights = Array.from({ length: postCount }, () => randomInt(1, 101));
    const weightTotal = weights.reduce((sum, value) => sum + value, 0);
    const fractional: Array<{ index: number; fraction: number }> = [];

    for (let index = 0; index < postCount; index += 1) {
      const exact = (remaining * weights[index]) / weightTotal;
      const whole = Math.floor(exact);
      result[index] += whole;
      fractional.push({ index, fraction: exact - whole });
    }

    remaining = budget - result.reduce((sum, value) => sum + value, 0);
    fractional.sort((a, b) => b.fraction - a.fraction);
    for (let index = 0; index < remaining; index += 1) {
      result[fractional[index % fractional.length].index] += 1;
    }

    return result;
  }

  private levelFromXp(xp: number) {
    return Math.max(1, Math.floor(Math.sqrt(xp / 120)) + 1);
  }

  private async ensureProfile(userId: number, tx: Prisma.TransactionClient = this.prisma) {
    return tx.huntPlayerProfile.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  private async addInfluence(
    tx: Prisma.TransactionClient,
    userId: number,
    amount: number,
    reason: HuntCurrencyReason,
    sourceType?: string,
    sourceId?: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    const current = await this.ensureProfile(userId, tx);
    const nextBalance = current.influenceBalance + amount;
    const nextXp = amount > 0 ? current.xp + amount : current.xp;
    const updated = await tx.huntPlayerProfile.update({
      where: { userId },
      data: {
        influenceBalance: nextBalance,
        lifetimeInfluence: amount > 0 ? { increment: amount } : undefined,
        xp: nextXp,
        level: this.levelFromXp(nextXp),
      },
    });
    await tx.huntCurrencyLedger.create({
      data: {
        userId,
        amount,
        reason,
        sourceType,
        sourceId,
        balanceAfter: nextBalance,
        metadata,
      },
    });
    return updated;
  }

  private async dailyInfluenceAwarded(
    tx: Prisma.TransactionClient,
    userId: number,
    reasons: HuntCurrencyReason[],
  ) {
    const result = await tx.huntCurrencyLedger.aggregate({
      _sum: { amount: true },
      where: {
        userId,
        reason: { in: reasons },
        amount: { gt: 0 },
        createdAt: { gte: this.todayStart() },
      },
    });
    return result._sum.amount ?? 0;
  }

  private async cappedInfluenceAmount(
    tx: Prisma.TransactionClient,
    userId: number,
    desiredAmount: number,
    reasons: HuntCurrencyReason[],
    dailyCap: number,
  ) {
    const awarded = await this.dailyInfluenceAwarded(tx, userId, reasons);
    return Math.max(0, Math.min(desiredAmount, dailyCap - awarded));
  }

  private upgradeCost(card: { level: number; rarity: HuntCardRarity }) {
    return card.level * 45 + RARITY_ORDER.indexOf(card.rarity) * 25;
  }

  private cardSellValue(card: { level: number; rarity: HuntCardRarity }) {
    const rarityIndex = RARITY_ORDER.indexOf(card.rarity);
    const baseValue = 18 + rarityIndex * 22;
    const levelValue = Math.max(0, card.level - 1) * (10 + rarityIndex * 5);
    return Math.max(10, Math.floor(baseValue + levelValue));
  }

  private normalizeCardStats(stats: unknown) {
    const source = stats && typeof stats === "object" && !Array.isArray(stats) ? stats as Record<string, unknown> : {};
    return {
      health: Number(source.health ?? source.charm ?? 0),
      attack: Number(source.attack ?? source.spark ?? 0),
      luck: Number(source.luck ?? 0),
      evasion: Number(source.evasion ?? source.focus ?? 0),
    };
  }

  private affinityStats(stats: unknown) {
    const normalized = this.normalizeCardStats(stats);
    return Object.fromEntries(
      HUNT_CARD_STAT_KEYS.map((key) => [key, Math.max(1, Math.min(10, Math.round(normalized[key] || 1)))]),
    ) as Record<HuntCardStatKey, number>;
  }

  private statGrowthRoll(affinity: number, rarity: HuntCardRarity, bonusChance = 0) {
    const rarityIndex = RARITY_ORDER.indexOf(rarity);
    const chance = Math.min(0.92, 0.08 + affinity * 0.075 + rarityIndex * 0.025 + bonusChance);
    let gain = 0;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (Math.random() < chance) gain += 1;
    }
    return gain;
  }

  private statGrowthBonus(key: HuntCardStatKey) {
    return key === "health" ? 0.08 : 0;
  }

  private upgradeStats(current: unknown, affinitySource: unknown, rarity: HuntCardRarity) {
    const currentStats = this.normalizeCardStats(current);
    const affinity = this.affinityStats(affinitySource);
    const upgraded = { ...currentStats };
    const deltas = Object.fromEntries(HUNT_CARD_STAT_KEYS.map((key) => [key, 0])) as Record<HuntCardStatKey, number>;

    for (const key of HUNT_CARD_STAT_KEYS) {
      const delta = this.statGrowthRoll(affinity[key], rarity, this.statGrowthBonus(key));
      deltas[key] = delta;
      upgraded[key] += delta;
    }

    return { stats: upgraded, deltas };
  }

  private bonusStatGrowthRoll(key: HuntCardStatKey, affinitySource: unknown, rarity: HuntCardRarity) {
    const affinity = this.affinityStats(affinitySource);
    const healthBonus = key === "health" ? 0.1 : 0;
    return Math.max(1, this.statGrowthRoll(affinity[key], rarity, 0.14 + healthBonus));
  }

  async uploadMedia(userId: number, dto: UploadHuntMediaDto) {
    const extension = ALLOWED_MEDIA_TYPES.get(dto.contentType);
    if (!extension) throw new BadRequestException("Unsupported Hunt media type.");

    const buffer = Buffer.from(dto.dataBase64, "base64");
    if (!buffer.length) throw new BadRequestException("Empty Hunt media file.");
    if (buffer.byteLength > HUNT_MEDIA_MAX_BYTES) throw new BadRequestException("Hunt media file is too large.");

    const originalExt = extname(dto.fileName).toLowerCase();
    const safeExt = ALLOWED_MEDIA_TYPES.has(dto.contentType) ? extension : originalExt;
    const fileName = `${userId}-${Date.now()}-${randomUUID()}${safeExt}`;
    await mkdir(HUNT_MEDIA_DIR, { recursive: true });
    await writeFile(join(HUNT_MEDIA_DIR, fileName), buffer);
    return {
      url: `/api/hunt/media/${fileName}`,
      fileName,
      contentType: dto.contentType,
      size: buffer.byteLength,
    };
  }

  async readMedia(fileName: string) {
    const cleanName = fileName.replace(/[^a-zA-Z0-9_.-]/g, "");
    if (!cleanName || cleanName !== fileName) throw new NotFoundException("Hunt media not found.");
    const extension = extname(cleanName).toLowerCase();
    const contentType = [...ALLOWED_MEDIA_TYPES.entries()].find(([, ext]) => ext === extension)?.[0] ?? "application/octet-stream";
    try {
      const buffer = await readFile(join(HUNT_MEDIA_DIR, cleanName));
      return { buffer, contentType };
    } catch {
      throw new NotFoundException("Hunt media not found.");
    }
  }

  private async advanceMission(tx: Prisma.TransactionClient, userId: number, action: string, amount = 1) {
    const missions = await tx.huntMission.findMany({
      where: {
        isActive: true,
        targetAction: action,
        OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }],
      },
    });

    for (const mission of missions) {
      const progress = await tx.huntMissionProgress.upsert({
        where: { userId_missionId: { userId, missionId: mission.id } },
        update: { progress: { increment: amount } },
        create: { userId, missionId: mission.id, progress: amount },
      });
      if (!progress.completedAt && progress.progress >= mission.targetCount) {
        await tx.huntMissionProgress.update({
          where: { id: progress.id },
          data: { completedAt: new Date(), claimedAt: new Date() },
        });
        if (mission.rewardInfluence > 0) {
          await this.addInfluence(tx, userId, mission.rewardInfluence, HuntCurrencyReason.MISSION_REWARD, "mission", mission.id);
        }
        if (mission.rewardBoxType) {
          await tx.huntBox.create({
            data: {
              userId,
              type: mission.rewardBoxType,
              rarity: mission.kind === HuntMissionKind.ONBOARDING ? HuntCardRarity.UNCOMMON : HuntCardRarity.COMMON,
            },
          });
        }
      }
    }
  }

  private async settlePostRewardDate(rewardDate: Date, userId?: number) {
    const rewardDateEnd = new Date(rewardDate.getTime() + DAY_MS);
    const createdAfter = new Date(rewardDate.getTime() - (POST_REWARD_ACTIVE_DAYS - 1) * DAY_MS);
    const posts = await this.prisma.huntPost.findMany({
      where: {
        ...(userId ? { userId } : {}),
        status: HuntPostStatus.PUBLISHED,
        moderationStatus: "CLEAR",
        createdAt: { gte: createdAfter, lt: rewardDateEnd },
        dailyRewards: { none: { rewardDate } },
      },
      orderBy: [{ userId: "asc" }, { createdAt: "asc" }],
      include: {
        dailyRewards: {
          select: { organicLikes: true },
        },
      },
    });
    if (posts.length === 0) return { settledPosts: 0, totalLikes: 0, rewardAmount: 0 };

    const postsByUser = new Map<number, typeof posts>();
    for (const post of posts) {
      const group = postsByUser.get(post.userId) ?? [];
      group.push(post);
      postsByUser.set(post.userId, group);
    }

    let settledPosts = 0;
    let totalLikes = 0;
    let rewardAmount = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const [authorId, authorPosts] of postsByUser) {
        const syntheticLikes = this.distributeSyntheticLikes(authorPosts.length);

        for (let index = 0; index < authorPosts.length; index += 1) {
          const post = authorPosts[index];
          const previousOrganicLikes = post.dailyRewards.reduce((sum, reward) => sum + reward.organicLikes, 0);
          const currentOrganicLikes = Math.max(0, post.likeCount - post.syntheticLikeCount);
          const organicLikes = Math.max(0, currentOrganicLikes - previousOrganicLikes);
          const bonusLikes = syntheticLikes[index] ?? 0;
          const likesForReward = organicLikes + bonusLikes;
          const finalReward = likesForReward * LIKE_AUTHOR_REWARD;

          await tx.huntPostDailyReward.create({
            data: {
              userId: authorId,
              postId: post.id,
              rewardDate,
              organicLikes,
              bonusLikes,
              totalLikes: likesForReward,
              rewardAmount: finalReward,
            },
          });

          if (bonusLikes > 0 || finalReward > 0) {
            await tx.huntPost.update({
              where: { id: post.id },
              data: {
                likeCount: bonusLikes > 0 ? { increment: bonusLikes } : undefined,
                syntheticLikeCount: bonusLikes > 0 ? { increment: bonusLikes } : undefined,
                score: finalReward > 0 ? { increment: finalReward } : undefined,
              },
            });
          }

          if (bonusLikes > 0) {
            await tx.huntPlace.update({
              where: { id: post.placeId },
              data: { likeCount: { increment: bonusLikes }, wantedCount: { increment: bonusLikes } },
            });
            await tx.huntPlayerProfile.upsert({
              where: { userId: authorId },
              update: { likesReceivedCount: { increment: bonusLikes } },
              create: { userId: authorId, likesReceivedCount: bonusLikes },
            });
          }

          if (finalReward > 0) {
            await this.addInfluence(tx, authorId, finalReward, HuntCurrencyReason.POST_DAILY_LIKES, "post", post.id, {
              rewardDate: rewardDate.toISOString(),
              likesForReward,
            });
          }

          settledPosts += 1;
          totalLikes += likesForReward;
          rewardAmount += finalReward;
        }
      }
    });

    return { settledPosts, totalLikes, rewardAmount };
  }

  private async settleDuePostRewards(userId?: number, now = new Date()) {
    const latestRewardDate = this.latestPostRewardDate(now);
    const firstRewardDate = new Date(latestRewardDate.getTime() - (POST_REWARD_ACTIVE_DAYS - 1) * DAY_MS);
    let settledPosts = 0;
    let totalLikes = 0;
    let rewardAmount = 0;

    for (let cursor = firstRewardDate; cursor.getTime() <= latestRewardDate.getTime(); cursor = new Date(cursor.getTime() + DAY_MS)) {
      const result = await this.settlePostRewardDate(cursor, userId);
      settledPosts += result.settledPosts;
      totalLikes += result.totalLikes;
      rewardAmount += result.rewardAmount;
    }

    return { settledPosts, totalLikes, rewardAmount };
  }

  private async dailyLikeRewardSummary(userId: number) {
    const rewards = await this.prisma.huntPostDailyReward.findMany({
      where: { userId, rewardAmount: { gt: 0 }, notifiedAt: null },
      orderBy: [{ rewardDate: "asc" }, { createdAt: "asc" }],
      select: {
        rewardDate: true,
        totalLikes: true,
        rewardAmount: true,
        postId: true,
      },
    });
    if (rewards.length === 0) return null;

    return {
      id: `${rewards[0].rewardDate.toISOString()}-${rewards.length}`,
      postsCount: new Set(rewards.map((reward) => reward.postId)).size,
      likes: rewards.reduce((sum, reward) => sum + reward.totalLikes, 0),
      amount: rewards.reduce((sum, reward) => sum + reward.rewardAmount, 0),
      from: rewards[0].rewardDate.toISOString(),
      to: rewards[rewards.length - 1].rewardDate.toISOString(),
      artUrl: "/hunt-assets/ui/daily-like-reward.png",
    };
  }

  async markDailyLikeRewardsSeen(userId: number) {
    await this.prisma.huntPostDailyReward.updateMany({
      where: { userId, rewardAmount: { gt: 0 }, notifiedAt: null },
      data: { notifiedAt: new Date() },
    });
    return { success: true };
  }

  private toPostPayload(post: Prisma.HuntPostGetPayload<{
    include: {
      user: { select: { uuid: true; name: true } };
      place: { include: { category: true; company: { select: { slug: true; name: true } } } };
      category: true;
      reactions: { select: { userId: true } };
    };
  }>, currentUserId: number) {
    return {
      uuid: post.uuid,
      caption: post.caption,
      photoUrl: post.photoUrl,
      mediaUrls: post.mediaUrls,
      tags: post.tags,
      rating: post.rating,
      visitPriceBand: post.visitPriceBand,
      moodTags: post.moodTags,
      gpsConfidence: post.gpsConfidence,
      latitude: post.latitude == null ? null : Number(post.latitude),
      longitude: post.longitude == null ? null : Number(post.longitude),
      moderationStatus: post.moderationStatus,
      likeCount: post.likeCount,
      score: post.score,
      likedByMe: post.reactions.some((reaction) => reaction.userId === currentUserId),
      createdAt: post.createdAt,
      author: { uuid: post.user.uuid, name: post.user.name },
      place: {
        uuid: post.place.uuid,
        slug: post.place.slug,
        name: post.place.name,
        address: post.place.address,
        city: post.place.city,
        district: post.place.district,
        tags: post.place.tags,
        source: post.place.source,
        category: post.place.category,
        company: post.place.company,
      },
    };
  }

  private rarityAtLeast(left: HuntCardRarity, right: HuntCardRarity) {
    return RARITY_ORDER.indexOf(left) >= RARITY_ORDER.indexOf(right);
  }

  private rollRarity(boxRarity: HuntCardRarity) {
    const roll = randomInt(0, 1000);
    const rolled = RARITY_ROLLS.find((entry) => roll >= entry.threshold)?.rarity ?? HuntCardRarity.COMMON;
    return this.rarityAtLeast(rolled, boxRarity) ? rolled : boxRarity;
  }

  private capRarity(rarity: HuntCardRarity, maxRarity: HuntCardRarity) {
    return RARITY_ORDER.indexOf(rarity) > RARITY_ORDER.indexOf(maxRarity) ? maxRarity : rarity;
  }

  private rarityBounds(rarity: HuntCardRarity, minRarity: HuntCardRarity, maxRarity?: HuntCardRarity | null) {
    let next = this.rarityAtLeast(rarity, minRarity) ? rarity : minRarity;
    if (maxRarity) next = this.capRarity(next, maxRarity);
    return next;
  }

  private weightedPick<T extends { weight: number }>(items: T[]) {
    const enabled = items.filter((item) => item.weight > 0);
    const total = enabled.reduce((sum, item) => sum + item.weight, 0);
    if (total <= 0) return null;
    let roll = randomInt(0, total);
    for (const item of enabled) {
      roll -= item.weight;
      if (roll < 0) return item;
    }
    return enabled[enabled.length - 1] ?? null;
  }

  private defaultBoxConfig(type: HuntBoxType) {
    return DEFAULT_BOX_CONFIGS[type] ?? DEFAULT_BOX_CONFIGS[HuntBoxType.POST];
  }

  private elementalRotation(now = new Date()) {
    const elapsedWeeks = Math.floor((now.getTime() - ELEMENTAL_ROTATION_ANCHOR_UTC) / ELEMENTAL_ROTATION_WEEK_MS);
    const rotationIndex = ((elapsedWeeks % ELEMENTAL_ROTATION_ELEMENTS.length) + ELEMENTAL_ROTATION_ELEMENTS.length) % ELEMENTAL_ROTATION_ELEMENTS.length;
    return {
      group: ELEMENTAL_ROTATION_GROUP,
      index: rotationIndex,
      element: ELEMENTAL_ROTATION_ELEMENTS[rotationIndex],
      startedAt: new Date(ELEMENTAL_ROTATION_ANCHOR_UTC + elapsedWeeks * ELEMENTAL_ROTATION_WEEK_MS),
      nextAt: new Date(ELEMENTAL_ROTATION_ANCHOR_UTC + (elapsedWeeks + 1) * ELEMENTAL_ROTATION_WEEK_MS),
    };
  }

  private isCurrentRotatingBox(config: { rotationGroup?: string | null; rotationIndex?: number | null }) {
    if (!config.rotationGroup) return true;
    if (config.rotationGroup !== ELEMENTAL_ROTATION_GROUP) return true;
    return config.rotationIndex === this.elementalRotation().index;
  }

  private chanceAtLeastOncePerBox(perItemChance: number, itemCountMin: number, itemCountMax: number, guaranteedSlots = 0) {
    const min = Math.max(1, itemCountMin);
    const max = Math.max(min, itemCountMax);
    let totalChance = 0;
    let variants = 0;
    for (let count = min; count <= max; count += 1) {
      const rolledSlots = Math.max(0, count - guaranteedSlots);
      totalChance += rolledSlots > 0 ? 1 - (1 - perItemChance) ** rolledSlots : 0;
      variants += 1;
    }
    return variants > 0 ? totalChance / variants : 0;
  }

  private async getBoxConfig(tx: Prisma.TransactionClient, type: HuntBoxType, configId?: string | null) {
    if (!configId && type === HuntBoxType.ELEMENTAL) {
      const rotation = this.elementalRotation();
      const config = await tx.huntBoxConfig.findFirst({
        where: {
          type,
          rotationGroup: rotation.group,
          rotationIndex: rotation.index,
          isActive: true,
        },
        include: {
          rarityChances: { where: { isEnabled: true } },
          speciesRules: { where: { isEnabled: true }, include: { species: true } },
          statusChances: { where: { isEnabled: true }, include: { status: true } },
        },
      });
      if (config) return config;
    }

    const config = await tx.huntBoxConfig.findFirst({
      where: configId ? { id: configId } : { type, isActive: true },
      include: {
        rarityChances: { where: { isEnabled: true } },
        speciesRules: { where: { isEnabled: true }, include: { species: true } },
        statusChances: { where: { isEnabled: true }, include: { status: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    });
    if (config) return config;
    return null;
  }

  private boxConfigPayload(config: Awaited<ReturnType<HuntService["getBoxConfig"]>> | null, type: HuntBoxType) {
    const fallback = this.defaultBoxConfig(type);
    const source = config ?? fallback;
    const rarityWeights = config
      ? Object.fromEntries(config.rarityChances.map((chance) => [chance.rarity, chance.weight]))
      : fallback.rarityWeights;
    const total = Object.values(rarityWeights).reduce((sum, weight) => sum + Number(weight ?? 0), 0);
    const rotation = source.rotationGroup === ELEMENTAL_ROTATION_GROUP ? this.elementalRotation() : null;
    const guaranteedRarity = source.guaranteedRarity ?? null;
    const guaranteedCount = source.guaranteedCount ?? 0;
    const chances = RARITY_ORDER.map((rarity) => {
      const weight = Number(rarityWeights[rarity] ?? 0);
      const perItemChance = total > 0 ? weight / total : 0;
      const boxChance = guaranteedRarity === rarity && guaranteedCount > 0
        ? 1
        : this.chanceAtLeastOncePerBox(perItemChance, source.itemCountMin, source.itemCountMax, guaranteedCount);
      return {
        rarity,
        weight,
        chance: Math.round(boxChance * 10000) / 100,
        enabled: weight > 0,
      };
    });
    return {
      uuid: "id" in source ? source.id : source.slug,
      slug: source.slug,
      type: source.type,
      title: source.title,
      description: source.description,
      imageUrl: source.imageUrl,
      cost: source.cost,
      minRarity: source.minRarity,
      maxRarity: source.maxRarity,
      itemCountMin: source.itemCountMin,
      itemCountMax: source.itemCountMax,
      dailyLimit: source.dailyLimit,
      statusDropChance: Math.round((source.statusDropChanceBp / 100) * 100) / 100,
      guaranteedRarity,
      guaranteedCount,
      rotationGroup: source.rotationGroup ?? null,
      rotationIndex: source.rotationIndex ?? null,
      rotationElement: source.rotationElement ?? null,
      isCurrentRotation: rotation ? source.rotationIndex === rotation.index : true,
      rotationEndsAt: rotation?.nextAt.toISOString() ?? null,
      isActive: source.isActive,
      isPurchasable: source.isPurchasable,
      sortOrder: source.sortOrder,
      rarityChances: chances,
    };
  }

  private rollRarityFromConfig(
    config: Awaited<ReturnType<HuntService["getBoxConfig"]>> | null,
    type: HuntBoxType,
    fallbackRarity: HuntCardRarity,
  ) {
    const fallback = this.defaultBoxConfig(type);
    const rows = config?.rarityChances.length
      ? config.rarityChances.map((chance) => ({ rarity: chance.rarity, weight: chance.weight }))
      : Object.entries(fallback.rarityWeights).map(([rarity, weight]) => ({ rarity: rarity as HuntCardRarity, weight: Number(weight ?? 0) }));
    const picked = this.weightedPick(rows);
    const raw = picked?.rarity ?? this.rollRarity(fallbackRarity);
    const minRarity = config?.minRarity ?? fallback.minRarity;
    const maxRarity = config?.maxRarity ?? fallback.maxRarity;
    return this.rarityBounds(raw, minRarity, maxRarity);
  }

  private async pickSpeciesForRarity(
    tx: Prisma.TransactionClient,
    targetRarity: HuntCardRarity,
    config?: Awaited<ReturnType<HuntService["getBoxConfig"]>> | null,
    preferredElement?: HuntElement | null,
  ) {
    const rotationElement = preferredElement ?? config?.rotationElement ?? null;
    const maxRarity = config?.maxRarity ?? null;
    const pickFromRules = async (baseRarity: HuntCardRarity) => {
      if (maxRarity && RARITY_ORDER.indexOf(baseRarity) > RARITY_ORDER.indexOf(maxRarity)) return null;
      const rules = (config?.speciesRules ?? []).filter((rule) => rule.species.isActive && rule.species.baseRarity === baseRarity && (!rotationElement || rule.species.element === rotationElement));
      const picked = this.weightedPick(rules);
      return picked?.species ?? null;
    };

    const pickFromRarity = async (baseRarity: HuntCardRarity) => {
      if (maxRarity && RARITY_ORDER.indexOf(baseRarity) > RARITY_ORDER.indexOf(maxRarity)) return null;
      const where = { isActive: true, baseRarity, ...(rotationElement ? { element: rotationElement } : {}) };
      const count = await tx.huntCreatureSpecies.count({ where });
      if (!count) return null;
      return tx.huntCreatureSpecies.findFirst({
        where,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        skip: randomInt(0, count),
      });
    };

    const configuredSpecies = await pickFromRules(targetRarity);
    if (configuredSpecies) return configuredSpecies;

    const exactSpecies = await pickFromRarity(targetRarity);
    if (exactSpecies) return exactSpecies;

    const targetIndex = RARITY_ORDER.indexOf(targetRarity);
    const fallbackRarities = [
      ...RARITY_ORDER.slice(targetIndex + 1),
      ...RARITY_ORDER.slice(0, targetIndex).reverse(),
    ];

    for (const rarity of fallbackRarities) {
      const species = await pickFromRarity(rarity);
      if (species) return species;
    }

    return tx.huntCreatureSpecies.findFirst({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  }

  private async maybeRollProfileStatusReward(tx: Prisma.TransactionClient, userId: number, boxId: string, config: Awaited<ReturnType<HuntService["getBoxConfig"]>> | null, position: number) {
    if (!config || config.statusDropChanceBp <= 0) return null;
    if (randomInt(0, 10000) >= config.statusDropChanceBp) return null;
    const owned = await tx.userProfileStatusUnlock.findMany({ where: { userId }, select: { statusId: true } });
    const ownedIds = new Set(owned.map((unlock) => unlock.statusId));
    const pool = config.statusChances.filter((chance) => chance.status.isActive && !ownedIds.has(chance.statusId));
    const picked = this.weightedPick(pool.map((chance) => ({ ...chance, weight: Math.max(chance.weight, chance.dropChanceBp) })));
    if (!picked) return null;
    const unlock = await tx.userProfileStatusUnlock.upsert({
      where: { userId_statusId: { userId, statusId: picked.statusId } },
      update: {},
      create: { userId, statusId: picked.statusId, source: "HUNT_BOX" },
    });
    const reward = await tx.huntBoxReward.create({
      data: {
        boxId,
        kind: HuntBoxRewardKind.PROFILE_STATUS,
        rarity: picked.status.rarity,
        position,
        profileStatusId: picked.statusId,
        profileStatusUnlockId: unlock.id,
      },
    });
    return {
      uuid: reward.id,
      kind: reward.kind,
      rarity: reward.rarity,
      position,
      status: {
        id: picked.status.id,
        slug: picked.status.slug,
        title: picked.status.title,
        description: picked.status.description,
        rarity: picked.status.rarity,
        icon: picked.status.icon,
      },
    };
  }

  private randomStat(base: number, rarity: HuntCardRarity) {
    const rarityBonus = RARITY_ORDER.indexOf(rarity) * 3;
    return Math.max(1, base + rarityBonus + randomInt(-2, 5));
  }

  private tutorialState(value: unknown): HuntTutorialState {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as HuntTutorialState;
  }

  private isTutorialStep(value: unknown): value is HuntTutorialStep {
    return typeof value === "string" && (HUNT_TUTORIAL_STEPS as readonly string[]).includes(value);
  }

  private async createTutorialCard(tx: Prisma.TransactionClient, userId: number, slug: string) {
    const species = await tx.huntCreatureSpecies.findFirst({
      where: { slug, isActive: true },
    });
    if (!species) throw new BadRequestException("Tutorial Hunt creature species is not seeded.");
    const cardRarity = species.baseRarity as HuntCardRarity;
    const baseStats = species.baseStats as Record<string, number>;
    const traitPool = Array.isArray(species.traitPool) ? species.traitPool as string[] : ["Tutorial ally"];
    const card = await tx.huntCard.create({
      data: {
        ownerId: userId,
        speciesId: species.id,
        rarity: cardRarity,
        element: species.element as HuntElement,
        stats: Object.fromEntries(Object.entries(baseStats).map(([key, value]) => [key, this.randomStat(Number(value), cardRarity)])),
        trait: traitPool[randomInt(0, traitPool.length)] ?? "Tutorial ally",
        visualSeed: randomUUID(),
      },
      include: { species: true },
    });
    await tx.huntPlayerProfile.update({
      where: { userId },
      data: { cardsOwnedCount: { increment: 1 } },
    });
    return card;
  }

  private async grantTutorialInfluenceOnce(
    tx: Prisma.TransactionClient,
    userId: number,
    state: HuntTutorialState,
    key: keyof HuntTutorialState,
    amount: number,
    sourceId: string,
  ) {
    if (state[key]) return state;
    await this.addInfluence(tx, userId, amount, HuntCurrencyReason.TUTORIAL_REWARD, "tutorial", sourceId);
    return { ...state, [key]: true };
  }

  private async grantTutorialCardOnce(
    tx: Prisma.TransactionClient,
    userId: number,
    state: HuntTutorialState,
    key: keyof HuntTutorialState,
    slug: string,
  ) {
    if (state[key]) return { state, card: null };
    const card = await this.createTutorialCard(tx, userId, slug);
    return { state: { ...state, [key]: true }, card };
  }

  async tutorialStatus(userId: number) {
    const profile = await this.ensureProfile(userId);
    const state = this.tutorialState(profile.huntTutorialState);
    const cardCount = await this.prisma.huntCard.count({ where: { ownerId: userId } });
    const step = profile.tutorialCompletedAt
      ? "COMPLETE"
      : this.isTutorialStep(profile.huntTutorialStep)
        ? profile.huntTutorialStep
        : "WELCOME";
    return {
      step,
      state,
      cardCount,
      completedAt: profile.tutorialCompletedAt,
      profile,
    };
  }

  async advanceTutorial(userId: number, action?: string) {
    return this.prisma.$transaction(async (tx) => {
      const profile = await this.ensureProfile(userId, tx);
      let state = this.tutorialState(profile.huntTutorialState);
      let step: HuntTutorialStep = this.isTutorialStep(profile.huntTutorialStep)
        ? profile.huntTutorialStep
        : "WELCOME";
      const grantedCards: Array<Prisma.HuntCardGetPayload<{ include: { species: true } }>> = [];

      if (profile.tutorialCompletedAt) {
        return {
          success: true,
          step: "COMPLETE" as HuntTutorialStep,
          state,
          profile,
          grantedCards,
        };
      }

      if (action === "start" || action === "welcome") {
        state = await this.grantTutorialInfluenceOnce(tx, userId, state, "firstCoinsGranted", 160, "first-box-coins");
        state = { ...state, started: true };
        step = "OPEN_FIRST_BOX";
      } else if (action === "box_opened") {
        const cards = await tx.huntCard.count({ where: { ownerId: userId } });
        if (cards < 1) throw new BadRequestException("Open your first Hunt box before continuing tutorial.");
        state = { ...state, firstBoxOpened: true };
        step = "FIRST_BATTLE";
      } else if (action === "battle_finished") {
        state = { ...state, firstBattleFinished: true };
        const grant = await this.grantTutorialCardOnce(tx, userId, state, "secondCardGranted", "map-tide");
        state = grant.state;
        if (grant.card) grantedCards.push(grant.card);
        step = "SECOND_BATTLE";
      } else if (action === "second_battle_finished") {
        state = { ...state, secondBattleFinished: true };
        const grant = await this.grantTutorialCardOnce(tx, userId, state, "finalCardGranted", "bloom-sprout");
        state = grant.state;
        if (grant.card) grantedCards.push(grant.card);
        step = "TACTICS";
      } else if (action === "tactics_seen") {
        state = await this.grantTutorialInfluenceOnce(tx, userId, state, "upgradeCoinsGranted", 160, "upgrade-coins");
        step = "UPGRADE";
      } else if (action === "upgrade_done") {
        const upgraded = await tx.huntCard.count({ where: { ownerId: userId, level: { gt: 1 } } });
        state = { ...state, upgradeDone: upgraded > 0 || state.upgradeDone };
        await this.advanceMission(tx, userId, "TUTORIAL_COMPLETED");
        step = "COMPLETE";
      } else if (action === "complete") {
        step = "COMPLETE";
      } else {
        throw new BadRequestException("Unknown Hunt tutorial action.");
      }

      const updated = await tx.huntPlayerProfile.update({
        where: { userId },
        data: {
          huntTutorialStep: step,
          huntTutorialState: state as Prisma.InputJsonValue,
          tutorialCompletedAt: step === "COMPLETE" ? new Date() : undefined,
        },
      });

      return {
        success: true,
        step,
        state,
        profile: updated,
        grantedCards,
      };
    });
  }

  async overview(userId: number) {
    await this.settleDuePostRewards(userId).catch(() => undefined);
    const profile = await this.ensureProfile(userId);
    const [missions, boxes, cards, posts, boxConfigs, dailyLikeReward] = await Promise.all([
      this.prisma.huntMission.findMany({
        where: { isActive: true },
        orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
        include: { progress: { where: { userId } } },
        take: 8,
      }),
      this.prisma.huntBox.findMany({
        where: { userId, status: HuntBoxStatus.GRANTED },
        orderBy: { createdAt: "desc" },
        take: 6,
      }),
      this.prisma.huntCard.findMany({
        where: { ownerId: userId },
        include: { species: true },
        orderBy: [{ rarity: "desc" }, { createdAt: "desc" }],
        take: 12,
      }),
      this.prisma.huntPost.findMany({
        where: { userId, status: HuntPostStatus.PUBLISHED, createdAt: { gte: this.activePostCutoff() } },
        orderBy: { createdAt: "desc" },
        take: 3,
        include: { place: true },
      }),
      this.prisma.huntBoxConfig.findMany({
        where: { isActive: true, isPurchasable: true },
        include: {
          rarityChances: { where: { isEnabled: true } },
          speciesRules: { where: { isEnabled: true }, include: { species: true } },
          statusChances: { where: { isEnabled: true }, include: { status: true } },
        },
        orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      }),
      this.dailyLikeRewardSummary(userId),
    ]);
    const visibleBoxConfigs = boxConfigs.filter((config) => this.isCurrentRotatingBox(config));
    const configuredTypes = new Set(visibleBoxConfigs.map((config) => config.type));
    const fallbackOffers = Object.values(DEFAULT_BOX_CONFIGS)
      .filter((config) => config.isActive && config.isPurchasable && !configuredTypes.has(config.type))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((config) => this.boxConfigPayload(null, config.type));

    return {
      profile,
      missions: missions.map((mission) => ({
        uuid: mission.id,
        slug: mission.slug,
        title: mission.title,
        description: mission.description,
        kind: mission.kind,
        targetAction: mission.targetAction,
        targetCount: mission.targetCount,
        rewardInfluence: mission.rewardInfluence,
        rewardXp: mission.rewardXp,
        rewardBoxType: mission.rewardBoxType,
        progress: mission.progress[0]?.progress ?? 0,
        completedAt: mission.progress[0]?.completedAt ?? null,
        claimedAt: mission.progress[0]?.claimedAt ?? null,
      })),
      boxes,
      boxOffers: [
        ...visibleBoxConfigs.map((config) => this.boxConfigPayload(config, config.type)),
        ...fallbackOffers,
      ].sort((a, b) => a.sortOrder - b.sortOrder),
      cards,
      recentPosts: posts,
      dailyLikeReward,
      economy: {
        postCreateReward: POST_CREATE_REWARD,
        likeAuthorReward: LIKE_AUTHOR_REWARD,
        postBoxCost: POST_BOX_COST,
        dailyPostLimit: DAILY_POST_LIMIT,
        dailyPostRewardCap: DAILY_POST_REWARD_CAP,
        dailyLikeRewardCap: DAILY_LIKE_REWARD_CAP,
      },
    };
  }

  async completeTutorial(userId: number) {
    const result = await this.advanceTutorial(userId, "complete");
    return { success: true, profile: result.profile };
  }

  async feed(userId: number) {
    const posts = await this.prisma.huntPost.findMany({
      where: { status: HuntPostStatus.PUBLISHED, moderationStatus: "CLEAR", createdAt: { gte: this.activePostCutoff() } },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 40,
      include: {
        user: { select: { uuid: true, name: true } },
        place: { include: { category: true, company: { select: { slug: true, name: true } } } },
        category: true,
        reactions: { where: { userId }, select: { userId: true } },
      },
    });
    return posts.map((post) => this.toPostPayload(post, userId));
  }

  async publicFeed() {
    const posts = await this.prisma.huntPost.findMany({
      where: { status: HuntPostStatus.PUBLISHED, moderationStatus: "CLEAR", createdAt: { gte: this.activePostCutoff() } },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 60,
      include: {
        user: { select: { uuid: true, name: true } },
        place: { include: { category: true, company: { select: { slug: true, name: true } } } },
        category: true,
        reactions: { where: { userId: -1 }, select: { userId: true } },
      },
    });
    return posts.map((post) => this.toPostPayload(post, -1));
  }

  async sharePost(uuid: string) {
    const post = await this.prisma.huntPost.findFirst({
      where: { uuid, status: HuntPostStatus.PUBLISHED, moderationStatus: "CLEAR" },
      include: {
        user: { select: { uuid: true, name: true } },
        place: { include: { category: true, company: { select: { slug: true, name: true } } } },
        category: true,
        reactions: { select: { userId: true } },
      },
    });
    if (!post) throw new NotFoundException("Hunt post not found.");
    return {
      kind: "post",
      post: this.toPostPayload(post, -1),
      cta: {
        title: "Join Nearloy Hunt",
        subtitle: "Post real places, collect NearCoin and open cute cards.",
      },
    };
  }

  async shareCard(uuid: string) {
    const card = await this.prisma.huntCard.findUnique({
      where: { uuid },
      include: {
        owner: { select: { uuid: true, name: true } },
        species: true,
      },
    });
    if (!card) throw new NotFoundException("Hunt card not found.");
    return {
      kind: "card",
      card,
      owner: card.owner,
      cta: {
        title: "Open your Nearloy Hunt box",
        subtitle: "Create local posts, earn likes and grow your creature collection.",
      },
    };
  }

  async collection(userId: number, query: import("./dto/hunt-collection.dto").HuntCollectionDto) {
    const needle = query.query.trim();
    const elementNames = { FLAME: "огонь", WATER: "вода", NATURE: "природа", WIND: "ветер", MUSIC: "музыка", LIGHT: "свет", SHADOW: "тьма" };
    const rarityNames = { COMMON: "обычная", UNCOMMON: "необычная", RARE: "редкая", EPIC: "эпическая", LEGENDARY: "легендарная" };
    const matching = (names: Record<string, string>) => Object.entries(names).filter(([key, name]) => `${key} ${name}`.toLowerCase().includes(needle.toLowerCase())).map(([key]) => key);
    const where: Prisma.HuntCardWhereInput = {
      ownerId: userId,
      ...(query.element !== "all" ? { element: query.element as HuntElement } : {}),
      ...(needle ? { OR: [
        { species: { nameRu: { contains: needle, mode: "insensitive" } } },
        { species: { nameEn: { contains: needle, mode: "insensitive" } } },
        { trait: { contains: needle, mode: "insensitive" } },
        { element: { in: matching(elementNames) as HuntElement[] } },
        { rarity: { in: matching(rarityNames) as HuntCardRarity[] } },
      ] } : {}),
    };
    const nameOrder: Prisma.HuntCardOrderByWithRelationInput = { species: query.locale === "en" ? { nameEn: "asc" } : { nameRu: "asc" } };
    const orders: Record<string, Prisma.HuntCardOrderByWithRelationInput[]> = {
      rarity: [{ rarity: "desc" }, { level: "desc" }, nameOrder],
      level: [{ level: "desc" }, { rarity: "desc" }, nameOrder],
      name: [nameOrder, { rarity: "desc" }],
      element: [{ element: "asc" }, { rarity: "desc" }, nameOrder],
      newest: [{ createdAt: "desc" }],
    };
    return this.prisma.$transaction(async (tx) => {
      const total = await tx.huntCard.count({ where: { ownerId: userId } });
      const filteredTotal = await tx.huntCard.count({ where });
      const pages = Math.max(1, Math.ceil(filteredTotal / 20));
      const page = Math.min(query.page, pages);
      const cards = await tx.huntCard.findMany({ where, include: { species: true }, orderBy: [...orders[query.sort], { uuid: "asc" }], skip: (page - 1) * 20, take: 20 });
      const counts = await tx.huntCard.groupBy({ by: ["speciesId"], where: { ownerId: userId, speciesId: { in: cards.map(c => c.speciesId) } }, _count: { _all: true } });
      return { cards, total, filteredTotal, page, pages, speciesCounts: Object.fromEntries(cards.map(c => [c.species.slug, counts.find(n => n.speciesId === c.speciesId)?._count._all ?? 1])) };
    });
  }

  async card(userId: number, uuid: string) {
    const card = await this.prisma.huntCard.findFirst({
      where: { ownerId: userId, uuid },
      include: { species: true },
    });
    if (!card) throw new NotFoundException("Hunt card not found.");
    const duplicateCount = await this.prisma.huntCard.count({
      where: { ownerId: userId, speciesId: card.speciesId },
    });
    return { card, duplicateCount, availableDuplicates: Math.max(0, duplicateCount - 1) };
  }

  async cardCatalog(userId: number) {
    const [species, ownedCounts] = await Promise.all([
      this.prisma.huntCreatureSpecies.findMany({
        where: { isActive: true },
        include: { category: true },
        orderBy: [{ sortOrder: "asc" }, { baseRarity: "asc" }, { name: "asc" }],
      }),
      this.prisma.huntCard.groupBy({
        by: ["speciesId"],
        where: { ownerId: userId },
        _count: { _all: true },
      }),
    ]);
    const counts = new Map(ownedCounts.map((entry) => [entry.speciesId, entry._count._all]));
    return species.map((item) => ({
      uuid: item.id,
      slug: item.slug,
      name: item.name,
      description: item.description,
      nameRu: item.nameRu,
      nameEn: item.nameEn,
      descriptionRu: item.descriptionRu,
      descriptionEn: item.descriptionEn,
      element: item.element,
      baseRarity: item.baseRarity,
      battleClass: item.battleClass,
      awakeningPhrase: item.awakeningPhrase,
      category: item.category,
      baseStats: item.baseStats,
      visualPrompt: item.visualPrompt,
      imageUrl: item.imageUrl,
      ownedCount: counts.get(item.id) ?? 0,
    }));
  }

  private makeBattleCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "NH-";
    for (let index = 0; index < 4; index += 1) code += alphabet[randomInt(0, alphabet.length)];
    return code;
  }

  private async getBattleCard(userId: number, cardUuid?: string) {
    const card = await this.prisma.huntCard.findFirst({
      where: cardUuid ? { uuid: cardUuid, ownerId: userId } : { ownerId: userId },
      include: { species: true },
      orderBy: [{ level: "desc" }, { rarity: "desc" }, { createdAt: "desc" }],
    });
    if (!card) throw new BadRequestException("Open a Hunt card before starting a battle.");
    return card;
  }

  private toBattleSpeciesPayload(species: HuntCreatureSpecies) {
    return {
      uuid: species.id,
      slug: species.slug,
      name: species.name,
      description: species.description,
      nameRu: species.nameRu,
      nameEn: species.nameEn,
      descriptionRu: species.descriptionRu,
      descriptionEn: species.descriptionEn,
      element: species.element,
      baseRarity: species.baseRarity,
      battleClass: species.battleClass,
      awakeningPhrase: species.awakeningPhrase,
      category: null,
      baseStats: species.baseStats,
      visualPrompt: species.visualPrompt,
      imageUrl: species.imageUrl,
      ownedCount: 0,
    };
  }

  async randomBattle(userId: number, cardUuid?: string) {
    const playerCard = await this.getBattleCard(userId, cardUuid);
    const species = await this.prisma.huntCreatureSpecies.findMany({
      where: { isActive: true, id: { not: playerCard.speciesId } },
      orderBy: [{ baseRarity: "desc" }, { sortOrder: "asc" }],
      take: 60,
    });
    if (species.length === 0) throw new BadRequestException("No Hunt opponents available.");
    const opponent = species[randomInt(0, species.length)];
    return {
      success: true,
      mode: "RANDOM",
      battleSeed: randomUUID(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      playerCard,
      opponent: this.toBattleSpeciesPayload(opponent),
    };
  }

  async createBattleCode(userId: number, cardUuid?: string) {
    const playerCard = await this.getBattleCard(userId, cardUuid);
    return {
      success: true,
      mode: "PRIVATE_CODE",
      code: this.makeBattleCode(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      playerCard,
    };
  }

  async growthPlaces() {
    const places = await this.prisma.huntPlace.findMany({
      where: { isActive: true, moderationStatus: { not: "ACTIONED" } },
      orderBy: [{ wantedCount: "desc" }, { likeCount: "desc" }, { postCount: "desc" }],
      take: 40,
      include: {
        category: true,
        company: { select: { slug: true, name: true } },
        posts: {
          where: { status: HuntPostStatus.PUBLISHED, moderationStatus: "CLEAR" },
          select: {
            userId: true,
            likeCount: true,
            score: true,
            createdAt: true,
            reactions: { select: { userId: true } },
          },
        },
      },
    });

    return places.map((place) => {
      const authorIds = new Set<number>();
      const reactorIds = new Set<number>();
      let likeCount = 0;
      let lastPostAt: Date | null = null;

      for (const post of place.posts) {
        authorIds.add(post.userId);
        likeCount += post.likeCount;
        if (!lastPostAt || post.createdAt > lastPostAt) lastPostAt = post.createdAt;
        for (const reaction of post.reactions) {
          reactorIds.add(reaction.userId);
        }
      }

      const demandScore = place.wantedCount * 3 + likeCount * 2 + place.posts.length * 10 + authorIds.size * 12;
      return {
        uuid: place.uuid,
        name: place.name,
        address: place.address,
        city: place.city,
        district: place.district,
        category: place.category,
        company: place.company,
        source: place.source,
        tags: place.tags,
        postCount: place.posts.length,
        storedPostCount: place.postCount,
        likeCount,
        storedLikeCount: place.likeCount,
        wantedCount: place.wantedCount,
        uniqueAuthors: authorIds.size,
        uniqueReactors: reactorIds.size,
        demandScore,
        lastPostAt,
        acquisitionHint: place.company
          ? "already_claimed"
          : demandScore >= 120
            ? "priority_outreach"
            : demandScore >= 50
              ? "warm_lead"
              : "watch",
      };
    });
  }

  async places(query?: string) {
    const search = query?.trim();
    return this.prisma.huntPlace.findMany({
      where: {
        isActive: true,
        moderationStatus: { not: "ACTIONED" },
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { address: { contains: search, mode: "insensitive" } },
                { city: { contains: search, mode: "insensitive" } },
                { district: { contains: search, mode: "insensitive" } },
                { tags: { has: search.toLowerCase() } },
              ],
            }
          : {}),
      },
      include: { category: true, company: { select: { slug: true, name: true } } },
      orderBy: [{ postCount: "desc" }, { likeCount: "desc" }, { createdAt: "desc" }],
      take: 30,
    });
  }

  async createPlace(userId: number, dto: CreateHuntPlaceDto) {
    const tags = this.normalizeTags(dto.tags);
    const category = dto.categorySlug
      ? await this.prisma.category.findUnique({ where: { slug: dto.categorySlug } })
      : null;
    const baseSlug = this.slugify(`${dto.city ?? "city"}-${dto.name}`);
    const slugSeed = dto.address ?? `${dto.latitude ?? ""}:${dto.longitude ?? ""}`;
    const slug = `${baseSlug}-${createHash("sha1").update(slugSeed || dto.name).digest("hex").slice(0, 8)}`;

    return this.prisma.huntPlace.upsert({
      where: { slug },
      update: {
        categoryId: category?.id,
        address: dto.address?.trim(),
        city: dto.city?.trim(),
        district: dto.district?.trim(),
        latitude: dto.latitude,
        longitude: dto.longitude,
        tags: [...new Set([...tags, ...(category?.slug ? [category.slug] : [])])],
      },
      create: {
        slug,
        name: dto.name.trim(),
        categoryId: category?.id,
        createdById: userId,
        source: HuntPlaceSource.USER_SUGGESTED,
        address: dto.address?.trim(),
        city: dto.city?.trim(),
        district: dto.district?.trim(),
        latitude: dto.latitude,
        longitude: dto.longitude,
        tags: [...new Set([...tags, ...(category?.slug ? [category.slug] : [])])],
      },
      include: { category: true, company: { select: { slug: true, name: true } } },
    });
  }

  async createPost(userId: number, dto: CreateHuntPostDto) {
    const tags = this.normalizeTags(dto.tags);
    const moodTags = this.normalizeTextList(dto.moodTags, MOOD_TAG_LIMIT, 32);
    const mediaUrls = this.normalizeMediaUrls(dto.mediaUrls, dto.photoUrl);
    if (mediaUrls.length === 0) throw new BadRequestException("Hunt posts require at least one photo.");
    const gpsConfidence = this.gpsConfidence(dto.latitude, dto.longitude, dto.locationAccuracy);
    const placeName = dto.placeName?.trim() || dto.address?.trim() || dto.caption.trim().slice(0, 72);
    const today = this.todayStart();
    const postsToday = await this.prisma.huntPost.count({
      where: { userId, createdAt: { gte: today } },
    });
    if (postsToday >= DAILY_POST_LIMIT) {
      throw new BadRequestException("Daily Hunt post limit reached.");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const category = dto.categorySlug
        ? await tx.category.findUnique({ where: { slug: dto.categorySlug } })
        : null;
      const baseSlug = this.slugify(`${dto.city ?? "city"}-${placeName}`);
      const slugSeed = dto.address ?? `${dto.latitude ?? ""}:${dto.longitude ?? ""}`;
      const slug = `${baseSlug}-${createHash("sha1").update(slugSeed || placeName).digest("hex").slice(0, 8)}`;
      const place = await tx.huntPlace.upsert({
        where: { slug },
        update: {
          categoryId: category?.id,
          address: dto.address,
          city: dto.city,
          district: dto.district,
          latitude: dto.latitude,
          longitude: dto.longitude,
          tags: [...new Set([...tags, ...(category?.slug ? [category.slug] : [])])],
        },
        create: {
          slug,
          name: placeName,
          categoryId: category?.id,
          createdById: userId,
          source: HuntPlaceSource.USER_SUGGESTED,
          address: dto.address?.trim(),
          city: dto.city?.trim(),
          district: dto.district?.trim(),
          latitude: dto.latitude,
          longitude: dto.longitude,
          tags: [...new Set([...tags, ...(category?.slug ? [category.slug] : [])])],
        },
      });
      const post = await tx.huntPost.create({
        data: {
          userId,
          placeId: place.id,
          categoryId: category?.id,
          caption: dto.caption.trim(),
          photoUrl: mediaUrls[0],
          mediaUrls,
          tags,
          rating: dto.rating,
          visitPriceBand: dto.visitPriceBand?.trim(),
          moodTags,
          latitude: dto.latitude,
          longitude: dto.longitude,
          locationAccuracy: dto.locationAccuracy,
          gpsConfidence,
        },
      });
      const postReward = await this.cappedInfluenceAmount(
        tx,
        userId,
        POST_CREATE_REWARD,
        [HuntCurrencyReason.POST_CREATED],
        DAILY_POST_REWARD_CAP,
      );
      if (postReward > 0) {
        await tx.huntPost.update({
          where: { id: post.id },
          data: { score: postReward, influenceAwarded: postReward },
        });
      }
      await tx.huntPlace.update({
        where: { id: place.id },
        data: { postCount: { increment: 1 } },
      });
      await tx.huntPlayerProfile.upsert({
        where: { userId },
        update: { postsCount: { increment: 1 } },
        create: { userId, postsCount: 1 },
      });
      if (postReward > 0) {
        await this.addInfluence(tx, userId, postReward, HuntCurrencyReason.POST_CREATED, "post", post.id, {
          gpsConfidence,
          mediaCount: mediaUrls.length,
          rating: dto.rating ?? null,
        });
        await tx.huntBox.create({
          data: { userId, type: HuntBoxType.POST, rarity: HuntCardRarity.COMMON, sourcePostId: post.id },
        });
      }
      await this.advanceMission(tx, userId, "POST_CREATED");
      return post;
    });

    return this.prisma.huntPost.findUniqueOrThrow({
      where: { id: result.id },
      include: {
        user: { select: { uuid: true, name: true } },
        place: { include: { category: true, company: { select: { slug: true, name: true } } } },
        category: true,
        reactions: { where: { userId }, select: { userId: true } },
      },
    }).then((post) => this.toPostPayload(post, userId));
  }

  async reportPost(userId: number, uuid: string, dto: ReportHuntPostDto) {
    const post = await this.prisma.huntPost.findUnique({
      where: { uuid },
      select: {
        id: true,
        uuid: true,
        caption: true,
        status: true,
        place: { select: { name: true } },
        user: { select: { name: true, email: true } },
      },
    });
    if (!post || post.status === HuntPostStatus.REMOVED) throw new NotFoundException("Hunt post not found.");
    try {
      const report = await this.prisma.$transaction(async (tx) => {
        const created = await tx.huntPostReport.create({
          data: {
            postId: post.id,
            reporterId: userId,
            reason: dto.reason,
            details: dto.details?.trim(),
          },
        });
        const reportCount = await tx.huntPostReport.count({
          where: { postId: post.id, status: { in: [HuntReportStatus.OPEN, HuntReportStatus.REVIEWING] } },
        });
        await tx.huntPost.update({
          where: { id: post.id },
          data: { moderationStatus: reportCount >= 2 ? "REVIEWING" : "FLAGGED" },
        });
        return created;
      });
      await this.notifyAdminsAboutReport(report.id).catch(() => undefined);
      return { success: true, report };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Post already reported.");
      }
      throw error;
    }
  }

  private normalizeTelegramAdminChatId(value = this.config.get<string>("TELEGRAM_ADMIN_CHAT_ID") || "3977200071") {
    const chatId = value.trim();
    if (!chatId) return "";
    if (chatId.startsWith("-")) return chatId;
    if (/^\d{10,}$/.test(chatId)) return `-100${chatId}`;
    return chatId;
  }

  private async notifyAdminsAboutReport(reportId: string) {
    const chatId = this.normalizeTelegramAdminChatId();
    if (!chatId) return;
    const report = await this.prisma.huntPostReport.findUnique({
      where: { id: reportId },
      include: {
        reporter: { select: { name: true, email: true } },
        post: {
          select: {
            uuid: true,
            caption: true,
            place: { select: { name: true } },
            user: { select: { name: true, email: true } },
          },
        },
      },
    });
    if (!report) return;
    const text = [
      "<b>Nearloy Hunt: new report</b>",
      "",
      `<b>Place:</b> ${this.escapeTelegramHtml(report.post.place.name)}`,
      `<b>Post author:</b> ${this.escapeTelegramHtml(report.post.user.name)} (${this.escapeTelegramHtml(report.post.user.email)})`,
      `<b>Reporter:</b> ${this.escapeTelegramHtml(report.reporter.name)} (${this.escapeTelegramHtml(report.reporter.email)})`,
      `<b>Reason:</b> ${this.escapeTelegramHtml(report.reason)}`,
      report.details ? `<b>Details:</b> ${this.escapeTelegramHtml(report.details)}` : null,
      `<b>Post:</b> <code>${this.escapeTelegramHtml(report.post.uuid)}</code>`,
      `<b>Text:</b> ${this.escapeTelegramHtml(report.post.caption.slice(0, 240))}`,
    ].filter(Boolean).join("\n");

    await this.prisma.telegramMessageQueue.create({
      data: {
        recipientChatId: chatId,
        recipientRole: "admin_chat",
        recipientLabel: "NearLoy admin chat",
        text,
        parseMode: "HTML",
        status: NotificationDeliveryStatus.PENDING,
        source: "hunt-post-report",
        sourceId: report.uuid,
        priority: 40,
      },
    });
  }

  private escapeTelegramHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async moderationQueue() {
    return this.prisma.huntPost.findMany({
      where: {
        OR: [
          { moderationStatus: { in: ["FLAGGED", "REVIEWING"] } },
          { reports: { some: { status: { in: [HuntReportStatus.OPEN, HuntReportStatus.REVIEWING] } } } },
        ],
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: 50,
      include: {
        user: { select: { uuid: true, name: true, email: true } },
        place: { include: { category: true, company: { select: { slug: true, name: true } } } },
        category: true,
        reports: {
          orderBy: { createdAt: "desc" },
          include: { reporter: { select: { uuid: true, name: true, email: true } } },
        },
      },
    });
  }

  async moderatePost(moderatorId: number, uuid: string, dto: ModerateHuntPostDto) {
    return this.prisma.$transaction(async (tx) => {
      const post = await tx.huntPost.findUnique({ where: { uuid } });
      if (!post) throw new NotFoundException("Hunt post not found.");

      const nextStatus = dto.status ?? post.status;
      const nextModerationStatus = dto.moderationStatus ?? (nextStatus === HuntPostStatus.PUBLISHED ? "CLEAR" : "ACTIONED");

      let reversedInfluence = 0;
      if ((nextStatus === HuntPostStatus.HIDDEN || nextStatus === HuntPostStatus.REMOVED) && post.influenceAwarded > 0) {
        const profile = await this.ensureProfile(post.userId, tx);
        reversedInfluence = Math.min(post.influenceAwarded, profile.influenceBalance);
        if (reversedInfluence > 0) {
          await this.addInfluence(
            tx,
            post.userId,
            -reversedInfluence,
            HuntCurrencyReason.MODERATION_REVERSAL,
            "post",
            post.id,
            { moderatorId, note: dto.note ?? null },
          );
        }
      }

      const updated = await tx.huntPost.update({
        where: { id: post.id },
        data: {
          status: nextStatus,
          moderationStatus: nextModerationStatus,
          influenceAwarded: reversedInfluence > 0 ? 0 : post.influenceAwarded,
        },
      });

      await tx.huntPostReport.updateMany({
        where: { postId: post.id, status: { in: [HuntReportStatus.OPEN, HuntReportStatus.REVIEWING] } },
        data: {
          status: nextStatus === HuntPostStatus.PUBLISHED ? HuntReportStatus.DISMISSED : HuntReportStatus.RESOLVED,
          moderatorId,
          resolvedAt: new Date(),
        },
      });

      return { success: true, post: updated, reversedInfluence };
    });
  }

  async likePost(userId: number, uuid: string) {
    const post = await this.prisma.huntPost.findUnique({
      where: { uuid },
      select: { id: true, userId: true, placeId: true, status: true },
    });
    if (!post || post.status !== HuntPostStatus.PUBLISHED) throw new NotFoundException("Hunt post not found.");
    if (post.userId === userId) throw new BadRequestException("You cannot like your own Hunt post.");

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.huntPostReaction.create({ data: { postId: post.id, userId } });
        await tx.huntPost.update({
          where: { id: post.id },
          data: { likeCount: { increment: 1 }, score: { increment: 1 } },
        });
        await tx.huntPlace.update({
          where: { id: post.placeId },
          data: { likeCount: { increment: 1 }, wantedCount: { increment: 1 } },
        });
        await tx.huntPlayerProfile.upsert({
          where: { userId: post.userId },
          update: { likesReceivedCount: { increment: 1 } },
          create: { userId: post.userId, likesReceivedCount: 1 },
        });
        await this.advanceMission(tx, post.userId, "LIKE_RECEIVED");
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Post already liked.");
      }
      throw error;
    }
    return { success: true };
  }

  async upgradeCard(userId: number, cardUuid?: string, focusStat?: HuntCardStatKey) {
    return this.prisma.$transaction(async (tx) => {
      const pending = cardUuid
        ? await tx.huntCardUpgrade.findFirst({
            where: { userId, status: HuntCardUpgradeStatus.PENDING_BONUS, card: { uuid: cardUuid } },
            include: { card: { include: { species: true } } },
            orderBy: { createdAt: "desc" },
          })
        : null;
      if (pending) {
        return {
          success: true,
          cost: pending.cost,
          card: pending.card,
          upgrade: {
            uuid: pending.uuid,
            baseDeltas: pending.baseDeltas,
            statsBefore: pending.statsBefore,
            statsAfterBase: pending.statsAfterBase,
            status: pending.status,
          },
        };
      }

      const card = cardUuid
        ? await tx.huntCard.findFirst({ where: { uuid: cardUuid, ownerId: userId }, include: { species: true } })
        : await tx.huntCard.findFirst({ where: { ownerId: userId }, orderBy: [{ rarity: "desc" }, { level: "desc" }], include: { species: true } });
      if (!card) throw new NotFoundException("Hunt card not found.");
      if (card.isLocked) throw new BadRequestException("Locked Hunt cards cannot be upgraded.");
      if (card.level >= MAX_CARD_LEVEL) throw new BadRequestException("Hunt card is already at max level.");

      const cost = this.upgradeCost(card);
      const profile = await this.ensureProfile(userId, tx);
      if (profile.influenceBalance < cost) throw new BadRequestException("Not enough NearCoin to upgrade this card.");

      const statsBefore = this.normalizeCardStats(card.stats);
      await this.addInfluence(tx, userId, -cost, HuntCurrencyReason.CARD_UPGRADE, "card", card.id);
      const upgradedStats = this.upgradeStats(card.stats, card.species.baseStats, card.rarity);
      const updated = await tx.huntCard.update({
        where: { id: card.id },
        data: {
          level: { increment: 1 },
          xp: { increment: cost },
          stats: upgradedStats.stats,
        },
        include: { species: true },
      });
      const upgrade = await tx.huntCardUpgrade.create({
        data: {
          userId,
          cardId: card.id,
          levelFrom: card.level,
          levelTo: card.level + 1,
          cost,
          statsBefore,
          baseDeltas: upgradedStats.deltas,
          statsAfterBase: upgradedStats.stats,
          status: HuntCardUpgradeStatus.PENDING_BONUS,
        },
      });

      if (focusStat) {
        const completed = await this.applyUpgradeBonusInTransaction(tx, userId, upgrade.uuid, focusStat);
        await this.advanceMission(tx, userId, "CARD_UPGRADED");
        return { success: true, cost, card: completed.card, upgrade: completed.upgrade };
      }

      await this.advanceMission(tx, userId, "CARD_UPGRADED");
      return {
        success: true,
        cost,
        card: updated,
        upgrade: {
          uuid: upgrade.uuid,
          baseDeltas: upgradedStats.deltas,
          statsBefore,
          statsAfterBase: upgradedStats.stats,
          status: upgrade.status,
        },
      };
    });
  }

  async sellCard(userId: number, cardUuid: string) {
    return this.prisma.$transaction(async (tx) => {
      const card = await tx.huntCard.findFirst({
        where: { uuid: cardUuid, ownerId: userId },
        include: { species: true },
      });
      if (!card) throw new NotFoundException("Hunt card not found.");
      if (card.isLocked) throw new BadRequestException("Locked Hunt cards cannot be sold.");

      const totalCards = await tx.huntCard.count({ where: { ownerId: userId } });
      if (totalCards <= 1) throw new BadRequestException("You cannot sell your last Hunt card.");

      const reward = this.cardSellValue(card);
      await tx.huntCard.delete({ where: { id: card.id } });
      await this.addInfluence(tx, userId, reward, HuntCurrencyReason.CARD_SOLD, "card", card.id, {
        cardUuid: card.uuid,
        speciesSlug: card.species.slug,
        rarity: card.rarity,
        level: card.level,
      });
      const profile = await tx.huntPlayerProfile.update({
        where: { userId },
        data: { cardsOwnedCount: { decrement: 1 } },
      });

      return { success: true, reward, soldCardUuid: card.uuid, profile };
    });
  }

  async awakenCard(userId: number, cardUuid: string) {
    return this.prisma.$transaction(async (tx) => {
      const card = await tx.huntCard.findFirst({
        where: { uuid: cardUuid, ownerId: userId },
        include: { species: true },
      });
      if (!card) throw new NotFoundException("Hunt card not found.");
      if (card.isLocked) throw new BadRequestException("Locked Hunt cards cannot be awakened.");

      const rank = Math.max(1, Math.min(MAX_CARD_FUSION_RANK, card.fusionRank ?? 1));
      if (rank >= MAX_CARD_FUSION_RANK) throw new BadRequestException("Hunt card is already at max resonance rank.");

      const targetRank = rank + 1;
      const requiredDuplicates = FUSION_DUPLICATES_BY_TARGET_RANK[targetRank] ?? 0;
      const duplicates = await tx.huntCard.findMany({
        where: {
          ownerId: userId,
          speciesId: card.speciesId,
          id: { not: card.id },
          isLocked: false,
        },
        orderBy: [
          { fusionRank: "asc" },
          { level: "asc" },
          { rarity: "asc" },
          { createdAt: "asc" },
          { uuid: "asc" },
        ],
        take: requiredDuplicates,
      });
      if (duplicates.length < requiredDuplicates) {
        throw new BadRequestException("Not enough duplicate Hunt cards for awakening.");
      }

      if (duplicates.length > 0) {
        await tx.huntCard.deleteMany({
          where: { id: { in: duplicates.map((duplicate) => duplicate.id) }, ownerId: userId },
        });
        await tx.huntPlayerProfile.update({
          where: { userId },
          data: { cardsOwnedCount: { decrement: duplicates.length } },
        });
      }

      const updated = await tx.huntCard.update({
        where: { id: card.id },
        data: { fusionRank: targetRank },
        include: { species: true },
      });
      const duplicateCount = await tx.huntCard.count({
        where: { ownerId: userId, speciesId: card.speciesId },
      });

      return {
        success: true,
        card: updated,
        spentDuplicateUuids: duplicates.map((duplicate) => duplicate.uuid),
        duplicateCount,
        availableDuplicates: Math.max(0, duplicateCount - 1),
      };
    });
  }

  private async applyUpgradeBonusInTransaction(tx: Prisma.TransactionClient, userId: number, upgradeUuid: string, focusStat: HuntCardStatKey) {
    const upgrade = await tx.huntCardUpgrade.findFirst({
      where: { uuid: upgradeUuid, userId },
      include: { card: { include: { species: true } } },
    });
    if (!upgrade) throw new NotFoundException("Hunt card upgrade not found.");
    if (upgrade.status !== HuntCardUpgradeStatus.PENDING_BONUS) throw new ConflictException("Upgrade bonus already applied.");

    const currentStats = this.normalizeCardStats(upgrade.card.stats);
    const bonusDelta = this.bonusStatGrowthRoll(focusStat, upgrade.card.species.baseStats, upgrade.card.rarity);
    const statsAfterBonus = { ...currentStats, [focusStat]: currentStats[focusStat] + bonusDelta };
    const card = await tx.huntCard.update({
      where: { id: upgrade.cardId },
      data: { stats: statsAfterBonus },
      include: { species: true },
    });
    const completedUpgrade = await tx.huntCardUpgrade.update({
      where: { id: upgrade.id },
      data: {
        bonusStat: focusStat,
        bonusDelta,
        statsAfterBonus,
        status: HuntCardUpgradeStatus.COMPLETED,
        bonusAppliedAt: new Date(),
      },
    });

    return {
      card,
      upgrade: {
        uuid: completedUpgrade.uuid,
        baseDeltas: completedUpgrade.baseDeltas,
        statsBefore: completedUpgrade.statsBefore,
        statsAfterBase: completedUpgrade.statsAfterBase,
        bonusStat: completedUpgrade.bonusStat,
        bonusDelta: completedUpgrade.bonusDelta,
        statsAfterBonus: completedUpgrade.statsAfterBonus,
        status: completedUpgrade.status,
      },
    };
  }

  async applyUpgradeBonus(userId: number, upgradeUuid: string, focusStat: HuntCardStatKey) {
    return this.prisma.$transaction(async (tx) => {
      const result = await this.applyUpgradeBonusInTransaction(tx, userId, upgradeUuid, focusStat);
      return { success: true, card: result.card, upgrade: result.upgrade };
    });
  }

  async openBox(userId: number, boxUuid?: string, boxType: HuntBoxType = HuntBoxType.POST, boxConfigId?: string) {
    return this.prisma.$transaction(async (tx) => {
      let profile = await this.ensureProfile(userId, tx);
      let box = boxUuid
        ? await tx.huntBox.findFirst({ where: { uuid: boxUuid, userId, status: HuntBoxStatus.GRANTED } })
        : null;
      let config = await this.getBoxConfig(tx, box?.type ?? boxType, box?.configId ?? boxConfigId);

      if (!box) {
        if (boxConfigId && !config) {
          throw new BadRequestException("This Hunt box config is not available.");
        }
        const fallback = this.defaultBoxConfig(boxType);
        const offer = config ?? fallback;
        if (!offer.isActive || !offer.isPurchasable) {
          throw new BadRequestException("This Hunt box is not available.");
        }
        if (!this.isCurrentRotatingBox(offer)) {
          throw new BadRequestException("This weekly Hunt box has already rotated.");
        }
        profile = await this.ensureProfile(userId, tx);
        if (profile.influenceBalance < offer.cost) {
          throw new BadRequestException("Not enough NearCoin to open a Hunt box.");
        }
        if (offer.dailyLimit) {
          const dayStart = new Date();
          dayStart.setHours(0, 0, 0, 0);
          const openedToday = await tx.huntBox.count({
            where: {
              userId,
              type: boxType,
              createdAt: { gte: dayStart },
            },
          });
          if (openedToday >= offer.dailyLimit) {
            throw new BadRequestException("This Hunt box is available once per day.");
          }
        }
        await this.addInfluence(tx, userId, -offer.cost, HuntCurrencyReason.BOX_OPENED, "box_purchase");
        box = await tx.huntBox.create({
          data: {
            userId,
            configId: config?.id,
            type: offer.type,
            rarity: offer.minRarity,
            influenceCost: offer.cost,
          },
        });
        if (!config && box.configId) config = await this.getBoxConfig(tx, box.type, box.configId);
      }

      const activeConfig = config ?? await this.getBoxConfig(tx, box.type, box.configId) ?? null;
      if (activeConfig && !this.isCurrentRotatingBox(activeConfig)) {
        throw new BadRequestException("This weekly Hunt box has already rotated.");
      }
      const fallback = this.defaultBoxConfig(box.type);
      const itemCountMin = Math.max(1, activeConfig?.itemCountMin ?? fallback.itemCountMin);
      const itemCountMax = Math.max(itemCountMin, activeConfig?.itemCountMax ?? fallback.itemCountMax);
      const itemCount = randomInt(itemCountMin, itemCountMax + 1);
      const guaranteedCount = Math.min(itemCount, Math.max(0, activeConfig?.guaranteedCount ?? fallback.guaranteedCount ?? 0));
      const guaranteedRarity = activeConfig?.guaranteedRarity ?? fallback.guaranteedRarity ?? null;
      const cards: Array<Prisma.HuntCardGetPayload<{ include: { species: true } }>> = [];
      const rewards: Array<Record<string, unknown>> = [];
      const ownedCardsBeforeOpen =
        box.type === HuntBoxType.POST &&
        !profile.tutorialCompletedAt &&
        profile.huntTutorialStep === "OPEN_FIRST_BOX"
          ? await tx.huntCard.count({ where: { ownerId: userId } })
          : 1;
      const forceTutorialFlameFirstCard =
        box.type === HuntBoxType.POST &&
        !profile.tutorialCompletedAt &&
        profile.huntTutorialStep === "OPEN_FIRST_BOX" &&
        ownedCardsBeforeOpen === 0;

      for (let index = 0; index < itemCount; index += 1) {
        const targetRarity = guaranteedRarity && index < guaranteedCount
          ? this.rarityBounds(guaranteedRarity, activeConfig?.minRarity ?? fallback.minRarity, activeConfig?.maxRarity ?? fallback.maxRarity)
          : this.rollRarityFromConfig(activeConfig, box.type, box.rarity);
        const species = await this.pickSpeciesForRarity(
          tx,
          targetRarity,
          activeConfig,
          forceTutorialFlameFirstCard && index === 0 ? HuntElement.FLAME : null,
        );
        if (!species) throw new BadRequestException("No Hunt creature species are seeded.");

        const cardRarity = species.baseRarity as HuntCardRarity;
        const baseStats = species.baseStats as Record<string, number>;
        const traitPool = Array.isArray(species.traitPool) ? species.traitPool as string[] : ["Fresh find"];
        const card = await tx.huntCard.create({
          data: {
            ownerId: userId,
            speciesId: species.id,
            rarity: cardRarity,
            element: species.element as HuntElement,
            stats: Object.fromEntries(Object.entries(baseStats).map(([key, value]) => [key, this.randomStat(Number(value), cardRarity)])),
            trait: traitPool[randomInt(0, traitPool.length)] ?? "Fresh find",
            visualSeed: randomUUID(),
          },
          include: { species: true },
        });
        const rewardRow = await tx.huntBoxReward.create({
          data: {
            boxId: box.id,
            kind: HuntBoxRewardKind.CARD,
            rarity: card.rarity,
            position: rewards.length,
            cardId: card.id,
          },
        });
        cards.push(card);
        rewards.push({ uuid: rewardRow.id, kind: rewardRow.kind, rarity: rewardRow.rarity, position: rewardRow.position, card });
      }

      const statusReward = await this.maybeRollProfileStatusReward(tx, userId, box.id, activeConfig, rewards.length);
      if (statusReward) rewards.push(statusReward);

      const firstCard = cards[0];
      await tx.huntBox.update({
        where: { id: box.id },
        data: { status: HuntBoxStatus.OPENED, openedAt: new Date(), rewardCardId: firstCard?.id },
      });
      await tx.huntPlayerProfile.update({
        where: { userId },
        data: { boxesOpenedCount: { increment: 1 }, cardsOwnedCount: { increment: cards.length } },
      });
      await this.advanceMission(tx, userId, "BOX_OPENED");
      return { box: { ...box, status: HuntBoxStatus.OPENED }, card: firstCard, cards, rewards };
    });
  }
}
