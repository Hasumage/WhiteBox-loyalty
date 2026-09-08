CREATE TABLE "HuntAbility" (
  "id" TEXT NOT NULL, "slug" TEXT NOT NULL,
  "nameRu" TEXT NOT NULL, "nameEn" TEXT NOT NULL,
  "descriptionRu" TEXT NOT NULL, "descriptionEn" TEXT NOT NULL,
  "icon" TEXT NOT NULL DEFAULT 'sparkles', "isActive" BOOLEAN NOT NULL DEFAULT true,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1, "revision" INTEGER NOT NULL DEFAULT 1,
  "config" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HuntAbility_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HuntAbility_version_check" CHECK ("schemaVersion" > 0 AND "revision" > 0)
);
CREATE UNIQUE INDEX "HuntAbility_slug_key" ON "HuntAbility"("slug");
CREATE TABLE "HuntSpeciesAbility" (
  "speciesId" TEXT NOT NULL, "abilityId" TEXT NOT NULL, "slot" INTEGER NOT NULL,
  CONSTRAINT "HuntSpeciesAbility_pkey" PRIMARY KEY ("speciesId", "slot"),
  CONSTRAINT "HuntSpeciesAbility_slot_check" CHECK ("slot" BETWEEN 0 AND 2),
  CONSTRAINT "HuntSpeciesAbility_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "HuntCreatureSpecies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "HuntSpeciesAbility_abilityId_fkey" FOREIGN KEY ("abilityId") REFERENCES "HuntAbility"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "HuntSpeciesAbility_speciesId_abilityId_key" ON "HuntSpeciesAbility"("speciesId", "abilityId");
CREATE INDEX "HuntSpeciesAbility_abilityId_idx" ON "HuntSpeciesAbility"("abilityId");
CREATE TABLE "HuntAbilityRevision" (
  "id" TEXT NOT NULL, "abilityId" TEXT NOT NULL, "revision" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL, "actorUserId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HuntAbilityRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HuntAbilityRevision_abilityId_fkey" FOREIGN KEY ("abilityId") REFERENCES "HuntAbility"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "HuntAbilityRevision_abilityId_revision_key" ON "HuntAbilityRevision"("abilityId", "revision");
