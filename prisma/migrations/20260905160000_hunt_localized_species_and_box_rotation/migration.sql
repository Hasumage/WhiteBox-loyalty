ALTER TYPE "HuntBoxType" ADD VALUE IF NOT EXISTS 'ELEMENTAL';

ALTER TABLE "HuntCreatureSpecies"
  ADD COLUMN "nameRu" TEXT,
  ADD COLUMN "nameEn" TEXT,
  ADD COLUMN "descriptionRu" TEXT,
  ADD COLUMN "descriptionEn" TEXT;

ALTER TABLE "HuntBoxConfig"
  ADD COLUMN "guaranteedRarity" "HuntCardRarity",
  ADD COLUMN "guaranteedCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "rotationGroup" TEXT,
  ADD COLUMN "rotationIndex" INTEGER,
  ADD COLUMN "rotationElement" "HuntElement",
  ADD COLUMN "rotationStartsAt" TIMESTAMP(3);

DROP INDEX IF EXISTS "HuntBoxConfig_type_key";
CREATE INDEX "HuntBoxConfig_type_isActive_sortOrder_idx" ON "HuntBoxConfig"("type", "isActive", "sortOrder");
CREATE INDEX "HuntBoxConfig_rotationGroup_rotationIndex_idx" ON "HuntBoxConfig"("rotationGroup", "rotationIndex");
