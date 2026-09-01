ALTER TABLE "HuntCreatureSpecies" ADD COLUMN "imageUrl" TEXT;

ALTER TYPE "HuntElement" RENAME TO "HuntElement_old";
CREATE TYPE "HuntElement" AS ENUM ('FLAME', 'WATER', 'NATURE', 'WIND', 'MUSIC', 'LIGHT', 'SHADOW');

ALTER TABLE "HuntCreatureSpecies"
  ALTER COLUMN "element" TYPE "HuntElement"
  USING (
    CASE "element"::text
      WHEN 'COFFEE' THEN 'FLAME'
      WHEN 'SOUND' THEN 'MUSIC'
      WHEN 'STEEL' THEN 'WIND'
      WHEN 'SWEET' THEN 'NATURE'
      WHEN 'COSMIC' THEN 'LIGHT'
      ELSE "element"::text
    END
  )::"HuntElement";

ALTER TABLE "HuntCard"
  ALTER COLUMN "element" TYPE "HuntElement"
  USING (
    CASE "element"::text
      WHEN 'COFFEE' THEN 'FLAME'
      WHEN 'SOUND' THEN 'MUSIC'
      WHEN 'STEEL' THEN 'WIND'
      WHEN 'SWEET' THEN 'NATURE'
      WHEN 'COSMIC' THEN 'LIGHT'
      ELSE "element"::text
    END
  )::"HuntElement";

DROP TYPE "HuntElement_old";
