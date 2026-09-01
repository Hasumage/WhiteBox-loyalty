import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  HuntBoxStatus,
  HuntBoxType,
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
const SHOP_BOXES: Partial<Record<HuntBoxType, { cost: number; rarity: HuntCardRarity }>> = {
  [HuntBoxType.POST]: { cost: 120, rarity: HuntCardRarity.COMMON },
  [HuntBoxType.CATEGORY]: { cost: 300, rarity: HuntCardRarity.UNCOMMON },
  [HuntBoxType.TRENDING]: { cost: 650, rarity: HuntCardRarity.RARE },
  [HuntBoxType.DISTRICT]: { cost: 900, rarity: HuntCardRarity.EPIC },
};
const DAILY_POST_LIMIT = 8;
const DAILY_POST_REWARD_CAP = 175;
const DAILY_LIKE_REWARD_CAP = 800;
const TAG_LIMIT = 8;
const MEDIA_LIMIT = 3;
const MOOD_TAG_LIMIT = 5;
const MAX_CARD_LEVEL = 30;
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

  private randomStat(base: number, rarity: HuntCardRarity) {
    const rarityBonus = RARITY_ORDER.indexOf(rarity) * 3;
    return Math.max(1, base + rarityBonus + randomInt(-2, 5));
  }

  async overview(userId: number) {
    const profile = await this.ensureProfile(userId);
    const [missions, boxes, cards, posts] = await Promise.all([
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
        where: { userId, status: HuntPostStatus.PUBLISHED },
        orderBy: { createdAt: "desc" },
        take: 3,
        include: { place: true },
      }),
    ]);

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
      cards,
      recentPosts: posts,
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
    const profile = await this.prisma.$transaction(async (tx) => {
      const current = await this.ensureProfile(userId, tx);
      if (current.tutorialCompletedAt) return current;
      const updated = await this.addInfluence(tx, userId, 50, HuntCurrencyReason.MISSION_REWARD, "tutorial", "onboarding");
      await tx.huntBox.create({
        data: { userId, type: HuntBoxType.FOUNDER, rarity: HuntCardRarity.UNCOMMON },
      });
      await this.advanceMission(tx, userId, "TUTORIAL_COMPLETED");
      return tx.huntPlayerProfile.update({
        where: { userId },
        data: { tutorialCompletedAt: new Date(), influenceBalance: updated.influenceBalance, xp: updated.xp, level: updated.level },
      });
    });
    return { success: true, profile };
  }

  async feed(userId: number) {
    const posts = await this.prisma.huntPost.findMany({
      where: { status: HuntPostStatus.PUBLISHED, moderationStatus: "CLEAR" },
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
      where: { status: HuntPostStatus.PUBLISHED, moderationStatus: "CLEAR" },
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
      element: item.element,
      baseRarity: item.baseRarity,
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
      element: species.element,
      baseRarity: species.baseRarity,
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
        const likeReward = await this.cappedInfluenceAmount(
          tx,
          post.userId,
          LIKE_AUTHOR_REWARD,
          [HuntCurrencyReason.POST_LIKED],
          DAILY_LIKE_REWARD_CAP,
        );
        await tx.huntPostReaction.create({ data: { postId: post.id, userId } });
        await tx.huntPost.update({
          where: { id: post.id },
          data: { likeCount: { increment: 1 }, score: { increment: LIKE_AUTHOR_REWARD } },
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
        if (likeReward > 0) {
          await this.addInfluence(tx, post.userId, likeReward, HuntCurrencyReason.POST_LIKED, "post", post.id, {
            likedByUserId: userId,
          });
        }
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

  async openBox(userId: number, boxUuid?: string, boxType: HuntBoxType = HuntBoxType.POST) {
    return this.prisma.$transaction(async (tx) => {
      await this.ensureProfile(userId, tx);
      let box = boxUuid
        ? await tx.huntBox.findFirst({ where: { uuid: boxUuid, userId, status: HuntBoxStatus.GRANTED } })
        : null;

      if (!box) {
        const offer = SHOP_BOXES[boxType] ?? SHOP_BOXES[HuntBoxType.POST]!;
        const profile = await this.ensureProfile(userId, tx);
        if (profile.influenceBalance < offer.cost) {
          throw new BadRequestException("Not enough NearCoin to open a Hunt box.");
        }
        await this.addInfluence(tx, userId, -offer.cost, HuntCurrencyReason.BOX_OPENED, "box_purchase");
        box = await tx.huntBox.create({
          data: { userId, type: boxType, rarity: offer.rarity, influenceCost: offer.cost },
        });
      }

      const rarity = this.rollRarity(box.rarity);
      const species = await tx.huntCreatureSpecies.findFirst({
        where: { isActive: true },
        orderBy: [{ baseRarity: "desc" }, { sortOrder: "asc" }],
        skip: randomInt(0, Math.max(1, await tx.huntCreatureSpecies.count({ where: { isActive: true } }))),
      }) ?? await tx.huntCreatureSpecies.findFirst({ where: { isActive: true } });
      if (!species) throw new BadRequestException("No Hunt creature species are seeded.");

      const baseStats = species.baseStats as Record<string, number>;
      const traitPool = Array.isArray(species.traitPool) ? species.traitPool as string[] : ["Fresh find"];
      const card = await tx.huntCard.create({
        data: {
          ownerId: userId,
          speciesId: species.id,
          rarity,
          element: species.element as HuntElement,
          stats: Object.fromEntries(Object.entries(baseStats).map(([key, value]) => [key, this.randomStat(Number(value), rarity)])),
          trait: traitPool[randomInt(0, traitPool.length)] ?? "Fresh find",
          visualSeed: randomUUID(),
        },
        include: { species: true },
      });
      await tx.huntBox.update({
        where: { id: box.id },
        data: { status: HuntBoxStatus.OPENED, openedAt: new Date(), rewardCardId: card.id },
      });
      await tx.huntPlayerProfile.update({
        where: { userId },
        data: { boxesOpenedCount: { increment: 1 }, cardsOwnedCount: { increment: 1 } },
      });
      await this.advanceMission(tx, userId, "BOX_OPENED");
      return { box: { ...box, status: HuntBoxStatus.OPENED }, card };
    });
  }
}
