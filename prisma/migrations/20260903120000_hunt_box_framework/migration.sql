CREATE TYPE "HuntBoxRewardKind" AS ENUM ('CARD', 'PROFILE_STATUS');

ALTER TABLE "HuntBox" ADD COLUMN "configId" TEXT;

CREATE TABLE "HuntBoxConfig" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "type" "HuntBoxType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "imageUrl" TEXT,
  "cost" INTEGER NOT NULL DEFAULT 0,
  "minRarity" "HuntCardRarity" NOT NULL DEFAULT 'COMMON',
  "maxRarity" "HuntCardRarity",
  "itemCountMin" INTEGER NOT NULL DEFAULT 1,
  "itemCountMax" INTEGER NOT NULL DEFAULT 1,
  "dailyLimit" INTEGER,
  "statusDropChanceBp" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "isPurchasable" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HuntBoxConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HuntBoxRarityChance" (
  "id" TEXT NOT NULL,
  "boxConfigId" TEXT NOT NULL,
  "rarity" "HuntCardRarity" NOT NULL,
  "weight" INTEGER NOT NULL DEFAULT 0,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HuntBoxRarityChance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HuntBoxSpeciesRule" (
  "id" TEXT NOT NULL,
  "boxConfigId" TEXT NOT NULL,
  "speciesId" TEXT NOT NULL,
  "weight" INTEGER NOT NULL DEFAULT 100,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HuntBoxSpeciesRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HuntBoxProfileStatusChance" (
  "id" TEXT NOT NULL,
  "boxConfigId" TEXT NOT NULL,
  "statusId" TEXT NOT NULL,
  "rarity" "ProfileStatusRarity" NOT NULL,
  "weight" INTEGER NOT NULL DEFAULT 100,
  "dropChanceBp" INTEGER NOT NULL DEFAULT 0,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HuntBoxProfileStatusChance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HuntBoxReward" (
  "id" TEXT NOT NULL,
  "boxId" TEXT NOT NULL,
  "kind" "HuntBoxRewardKind" NOT NULL,
  "rarity" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "cardId" TEXT,
  "profileStatusId" TEXT,
  "profileStatusUnlockId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HuntBoxReward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HuntBoxConfig_slug_key" ON "HuntBoxConfig"("slug");
CREATE UNIQUE INDEX "HuntBoxConfig_type_key" ON "HuntBoxConfig"("type");
CREATE INDEX "HuntBoxConfig_isActive_sortOrder_idx" ON "HuntBoxConfig"("isActive", "sortOrder");

CREATE UNIQUE INDEX "HuntBoxRarityChance_boxConfigId_rarity_key" ON "HuntBoxRarityChance"("boxConfigId", "rarity");
CREATE INDEX "HuntBoxRarityChance_rarity_isEnabled_idx" ON "HuntBoxRarityChance"("rarity", "isEnabled");

CREATE UNIQUE INDEX "HuntBoxSpeciesRule_boxConfigId_speciesId_key" ON "HuntBoxSpeciesRule"("boxConfigId", "speciesId");
CREATE INDEX "HuntBoxSpeciesRule_speciesId_isEnabled_idx" ON "HuntBoxSpeciesRule"("speciesId", "isEnabled");

CREATE UNIQUE INDEX "HuntBoxProfileStatusChance_boxConfigId_statusId_key" ON "HuntBoxProfileStatusChance"("boxConfigId", "statusId");
CREATE INDEX "HuntBoxProfileStatusChance_statusId_isEnabled_idx" ON "HuntBoxProfileStatusChance"("statusId", "isEnabled");
CREATE INDEX "HuntBoxProfileStatusChance_rarity_isEnabled_idx" ON "HuntBoxProfileStatusChance"("rarity", "isEnabled");

CREATE INDEX "HuntBox_configId_idx" ON "HuntBox"("configId");
CREATE INDEX "HuntBoxReward_boxId_position_idx" ON "HuntBoxReward"("boxId", "position");
CREATE INDEX "HuntBoxReward_kind_createdAt_idx" ON "HuntBoxReward"("kind", "createdAt");
CREATE INDEX "HuntBoxReward_cardId_idx" ON "HuntBoxReward"("cardId");
CREATE INDEX "HuntBoxReward_profileStatusId_idx" ON "HuntBoxReward"("profileStatusId");

ALTER TABLE "HuntBox" ADD CONSTRAINT "HuntBox_configId_fkey" FOREIGN KEY ("configId") REFERENCES "HuntBoxConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HuntBoxRarityChance" ADD CONSTRAINT "HuntBoxRarityChance_boxConfigId_fkey" FOREIGN KEY ("boxConfigId") REFERENCES "HuntBoxConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HuntBoxSpeciesRule" ADD CONSTRAINT "HuntBoxSpeciesRule_boxConfigId_fkey" FOREIGN KEY ("boxConfigId") REFERENCES "HuntBoxConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HuntBoxSpeciesRule" ADD CONSTRAINT "HuntBoxSpeciesRule_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "HuntCreatureSpecies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HuntBoxProfileStatusChance" ADD CONSTRAINT "HuntBoxProfileStatusChance_boxConfigId_fkey" FOREIGN KEY ("boxConfigId") REFERENCES "HuntBoxConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HuntBoxProfileStatusChance" ADD CONSTRAINT "HuntBoxProfileStatusChance_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "ProfileStatus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HuntBoxReward" ADD CONSTRAINT "HuntBoxReward_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "HuntBox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HuntBoxReward" ADD CONSTRAINT "HuntBoxReward_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "HuntCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HuntBoxReward" ADD CONSTRAINT "HuntBoxReward_profileStatusId_fkey" FOREIGN KEY ("profileStatusId") REFERENCES "ProfileStatus"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HuntBoxReward" ADD CONSTRAINT "HuntBoxReward_profileStatusUnlockId_fkey" FOREIGN KEY ("profileStatusUnlockId") REFERENCES "UserProfileStatusUnlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
