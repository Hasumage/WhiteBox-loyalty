-- Nearloy Hunt: social city game layer.

CREATE TYPE "HuntPlaceSource" AS ENUM ('USER_SUGGESTED', 'COMPANY', 'SYSTEM_SEEDED');
CREATE TYPE "HuntPostStatus" AS ENUM ('PUBLISHED', 'HIDDEN', 'REMOVED');
CREATE TYPE "HuntModerationStatus" AS ENUM ('CLEAR', 'FLAGGED', 'REVIEWING', 'ACTIONED');
CREATE TYPE "HuntReactionType" AS ENUM ('LIKE');
CREATE TYPE "HuntCurrencyReason" AS ENUM ('POST_CREATED', 'POST_LIKED', 'POST_TRENDING', 'BOX_OPENED', 'MISSION_REWARD', 'CARD_UPGRADE', 'MODERATION_REVERSAL', 'ADMIN_ADJUSTMENT');
CREATE TYPE "HuntBoxStatus" AS ENUM ('GRANTED', 'OPENED', 'EXPIRED');
CREATE TYPE "HuntBoxType" AS ENUM ('DAILY', 'POST', 'TRENDING', 'CATEGORY', 'DISTRICT', 'FOUNDER', 'PARTNER');
CREATE TYPE "HuntCardRarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');
CREATE TYPE "HuntElement" AS ENUM ('COFFEE', 'FLAME', 'WATER', 'NATURE', 'SOUND', 'LIGHT', 'SHADOW', 'STEEL', 'SWEET', 'COSMIC');
CREATE TYPE "HuntMissionKind" AS ENUM ('DAILY', 'WEEKLY', 'SEASONAL', 'ONBOARDING');

CREATE TABLE "HuntPlayerProfile" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "influenceBalance" INTEGER NOT NULL DEFAULT 0,
    "lifetimeInfluence" INTEGER NOT NULL DEFAULT 0,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "postsCount" INTEGER NOT NULL DEFAULT 0,
    "likesReceivedCount" INTEGER NOT NULL DEFAULT 0,
    "boxesOpenedCount" INTEGER NOT NULL DEFAULT 0,
    "cardsOwnedCount" INTEGER NOT NULL DEFAULT 0,
    "tutorialCompletedAt" TIMESTAMP(3),
    "lastDailyBoxAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HuntPlayerProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HuntPlace" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" INTEGER,
    "companyId" INTEGER,
    "createdById" INTEGER,
    "source" "HuntPlaceSource" NOT NULL DEFAULT 'USER_SUGGESTED',
    "address" TEXT,
    "city" TEXT,
    "district" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "geohash" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "postCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "wantedCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isClaimable" BOOLEAN NOT NULL DEFAULT true,
    "moderationStatus" "HuntModerationStatus" NOT NULL DEFAULT 'CLEAR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HuntPlace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HuntPost" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "placeId" TEXT NOT NULL,
    "categoryId" INTEGER,
    "companyId" INTEGER,
    "caption" TEXT NOT NULL,
    "photoUrl" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "locationAccuracy" INTEGER,
    "status" "HuntPostStatus" NOT NULL DEFAULT 'PUBLISHED',
    "moderationStatus" "HuntModerationStatus" NOT NULL DEFAULT 'CLEAR',
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "influenceAwarded" INTEGER NOT NULL DEFAULT 0,
    "firstTrendingAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HuntPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HuntPostReaction" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" "HuntReactionType" NOT NULL DEFAULT 'LIKE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HuntPostReaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HuntCurrencyLedger" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" "HuntCurrencyReason" NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "balanceAfter" INTEGER NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HuntCurrencyLedger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HuntCreatureSpecies" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "element" "HuntElement" NOT NULL,
    "baseRarity" "HuntCardRarity" NOT NULL DEFAULT 'COMMON',
    "categoryId" INTEGER,
    "baseStats" JSONB NOT NULL,
    "traitPool" JSONB NOT NULL,
    "visualPrompt" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HuntCreatureSpecies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HuntBox" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" "HuntBoxType" NOT NULL,
    "rarity" "HuntCardRarity" NOT NULL DEFAULT 'COMMON',
    "status" "HuntBoxStatus" NOT NULL DEFAULT 'GRANTED',
    "influenceCost" INTEGER NOT NULL DEFAULT 0,
    "sourcePostId" TEXT,
    "rewardCardId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HuntBox_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HuntCard" (
    "id" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "speciesId" TEXT NOT NULL,
    "rarity" "HuntCardRarity" NOT NULL,
    "element" "HuntElement" NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "stats" JSONB NOT NULL,
    "trait" TEXT NOT NULL,
    "visualSeed" TEXT NOT NULL,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HuntCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HuntMission" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "kind" "HuntMissionKind" NOT NULL,
    "targetAction" TEXT NOT NULL,
    "targetCount" INTEGER NOT NULL DEFAULT 1,
    "rewardInfluence" INTEGER NOT NULL DEFAULT 0,
    "rewardXp" INTEGER NOT NULL DEFAULT 0,
    "rewardBoxType" "HuntBoxType",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HuntMission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HuntMissionProgress" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "missionId" TEXT NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HuntMissionProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HuntPlayerProfile_userId_key" ON "HuntPlayerProfile"("userId");
CREATE INDEX "HuntPlayerProfile_level_xp_idx" ON "HuntPlayerProfile"("level", "xp");
CREATE INDEX "HuntPlayerProfile_lifetimeInfluence_idx" ON "HuntPlayerProfile"("lifetimeInfluence");

CREATE UNIQUE INDEX "HuntPlace_uuid_key" ON "HuntPlace"("uuid");
CREATE UNIQUE INDEX "HuntPlace_slug_key" ON "HuntPlace"("slug");
CREATE INDEX "HuntPlace_categoryId_isActive_idx" ON "HuntPlace"("categoryId", "isActive");
CREATE INDEX "HuntPlace_companyId_idx" ON "HuntPlace"("companyId");
CREATE INDEX "HuntPlace_createdById_idx" ON "HuntPlace"("createdById");
CREATE INDEX "HuntPlace_city_district_idx" ON "HuntPlace"("city", "district");
CREATE INDEX "HuntPlace_geohash_idx" ON "HuntPlace"("geohash");
CREATE INDEX "HuntPlace_moderationStatus_createdAt_idx" ON "HuntPlace"("moderationStatus", "createdAt");

CREATE UNIQUE INDEX "HuntPost_uuid_key" ON "HuntPost"("uuid");
CREATE INDEX "HuntPost_userId_createdAt_idx" ON "HuntPost"("userId", "createdAt");
CREATE INDEX "HuntPost_placeId_createdAt_idx" ON "HuntPost"("placeId", "createdAt");
CREATE INDEX "HuntPost_categoryId_createdAt_idx" ON "HuntPost"("categoryId", "createdAt");
CREATE INDEX "HuntPost_companyId_createdAt_idx" ON "HuntPost"("companyId", "createdAt");
CREATE INDEX "HuntPost_status_moderationStatus_score_createdAt_idx" ON "HuntPost"("status", "moderationStatus", "score", "createdAt");

CREATE UNIQUE INDEX "HuntPostReaction_postId_userId_type_key" ON "HuntPostReaction"("postId", "userId", "type");
CREATE INDEX "HuntPostReaction_userId_createdAt_idx" ON "HuntPostReaction"("userId", "createdAt");
CREATE INDEX "HuntPostReaction_postId_createdAt_idx" ON "HuntPostReaction"("postId", "createdAt");

CREATE UNIQUE INDEX "HuntCurrencyLedger_uuid_key" ON "HuntCurrencyLedger"("uuid");
CREATE INDEX "HuntCurrencyLedger_userId_createdAt_idx" ON "HuntCurrencyLedger"("userId", "createdAt");
CREATE INDEX "HuntCurrencyLedger_reason_createdAt_idx" ON "HuntCurrencyLedger"("reason", "createdAt");
CREATE INDEX "HuntCurrencyLedger_sourceType_sourceId_idx" ON "HuntCurrencyLedger"("sourceType", "sourceId");

CREATE UNIQUE INDEX "HuntCreatureSpecies_slug_key" ON "HuntCreatureSpecies"("slug");
CREATE INDEX "HuntCreatureSpecies_element_baseRarity_isActive_idx" ON "HuntCreatureSpecies"("element", "baseRarity", "isActive");
CREATE INDEX "HuntCreatureSpecies_categoryId_idx" ON "HuntCreatureSpecies"("categoryId");

CREATE UNIQUE INDEX "HuntBox_uuid_key" ON "HuntBox"("uuid");
CREATE UNIQUE INDEX "HuntBox_rewardCardId_key" ON "HuntBox"("rewardCardId");
CREATE INDEX "HuntBox_userId_status_createdAt_idx" ON "HuntBox"("userId", "status", "createdAt");
CREATE INDEX "HuntBox_type_rarity_idx" ON "HuntBox"("type", "rarity");
CREATE INDEX "HuntBox_sourcePostId_idx" ON "HuntBox"("sourcePostId");

CREATE UNIQUE INDEX "HuntCard_uuid_key" ON "HuntCard"("uuid");
CREATE INDEX "HuntCard_ownerId_rarity_createdAt_idx" ON "HuntCard"("ownerId", "rarity", "createdAt");
CREATE INDEX "HuntCard_speciesId_idx" ON "HuntCard"("speciesId");
CREATE INDEX "HuntCard_element_rarity_idx" ON "HuntCard"("element", "rarity");

CREATE UNIQUE INDEX "HuntMission_slug_key" ON "HuntMission"("slug");
CREATE INDEX "HuntMission_kind_isActive_idx" ON "HuntMission"("kind", "isActive");
CREATE INDEX "HuntMission_startsAt_endsAt_idx" ON "HuntMission"("startsAt", "endsAt");

CREATE UNIQUE INDEX "HuntMissionProgress_userId_missionId_key" ON "HuntMissionProgress"("userId", "missionId");
CREATE INDEX "HuntMissionProgress_userId_completedAt_claimedAt_idx" ON "HuntMissionProgress"("userId", "completedAt", "claimedAt");
CREATE INDEX "HuntMissionProgress_missionId_idx" ON "HuntMissionProgress"("missionId");

ALTER TABLE "HuntPlayerProfile" ADD CONSTRAINT "HuntPlayerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HuntPlace" ADD CONSTRAINT "HuntPlace_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HuntPlace" ADD CONSTRAINT "HuntPlace_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HuntPlace" ADD CONSTRAINT "HuntPlace_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HuntPost" ADD CONSTRAINT "HuntPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HuntPost" ADD CONSTRAINT "HuntPost_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "HuntPlace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HuntPost" ADD CONSTRAINT "HuntPost_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HuntPost" ADD CONSTRAINT "HuntPost_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HuntPostReaction" ADD CONSTRAINT "HuntPostReaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "HuntPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HuntPostReaction" ADD CONSTRAINT "HuntPostReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HuntCurrencyLedger" ADD CONSTRAINT "HuntCurrencyLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HuntCreatureSpecies" ADD CONSTRAINT "HuntCreatureSpecies_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HuntBox" ADD CONSTRAINT "HuntBox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HuntBox" ADD CONSTRAINT "HuntBox_sourcePostId_fkey" FOREIGN KEY ("sourcePostId") REFERENCES "HuntPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HuntBox" ADD CONSTRAINT "HuntBox_rewardCardId_fkey" FOREIGN KEY ("rewardCardId") REFERENCES "HuntCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HuntCard" ADD CONSTRAINT "HuntCard_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HuntCard" ADD CONSTRAINT "HuntCard_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "HuntCreatureSpecies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HuntMissionProgress" ADD CONSTRAINT "HuntMissionProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HuntMissionProgress" ADD CONSTRAINT "HuntMissionProgress_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "HuntMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
