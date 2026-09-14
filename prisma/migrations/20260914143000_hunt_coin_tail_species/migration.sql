INSERT INTO "HuntCreatureSpecies" (
  "id",
  "slug",
  "name",
  "description",
  "nameRu",
  "nameEn",
  "descriptionRu",
  "descriptionEn",
  "element",
  "baseRarity",
  "battleClass",
  "awakeningPhrase",
  "categoryId",
  "baseStats",
  "traitPool",
  "visualPrompt",
  "imageUrl",
  "isActive",
  "sortOrder",
  "createdAt",
  "updatedAt"
)
VALUES (
  'hunt_species_coin_tail',
  'coin-tail',
  'Coin Tail',
  'Cute fluffy reward creature with a curled tail holding glowing Nearloy coins, big cyan eyes and playful celebration energy.',
  'Коинтейл',
  'Coin Tail',
  'Хвостатый спутник ежедневных наград, который радостно приносит NearCoin за хорошие городские истории.',
  'A fluffy daily reward companion that happily brings NearCoin for good city stories.',
  'LIGHT',
  'RARE',
  'SCOUT',
  'Удача звенит громче, когда история нашла своих людей.',
  (SELECT "id" FROM "Category" WHERE "slug" = 'services' LIMIT 1),
  '{"health":5,"attack":4,"luck":7,"evasion":5}'::jsonb,
  '["Daily sparkle","Lucky payout","Soft jingle"]'::jsonb,
  'Cute fluffy reward creature with a curled tail holding glowing Nearloy coins, big cyan eyes and playful celebration energy.',
  '/hunt-assets/cards/creatures/coin-tail.png',
  true,
  190,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "nameRu" = EXCLUDED."nameRu",
  "nameEn" = EXCLUDED."nameEn",
  "descriptionRu" = EXCLUDED."descriptionRu",
  "descriptionEn" = EXCLUDED."descriptionEn",
  "element" = EXCLUDED."element",
  "baseRarity" = EXCLUDED."baseRarity",
  "battleClass" = EXCLUDED."battleClass",
  "awakeningPhrase" = EXCLUDED."awakeningPhrase",
  "categoryId" = EXCLUDED."categoryId",
  "baseStats" = EXCLUDED."baseStats",
  "traitPool" = EXCLUDED."traitPool",
  "visualPrompt" = EXCLUDED."visualPrompt",
  "imageUrl" = EXCLUDED."imageUrl",
  "isActive" = EXCLUDED."isActive",
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "HuntBoxSpeciesRule" (
  "id",
  "boxConfigId",
  "speciesId",
  "weight",
  "isEnabled",
  "createdAt",
  "updatedAt"
)
SELECT
  'coin_tail_rule_' || box."id",
  box."id",
  species."id",
  100,
  CASE
    WHEN box."maxRarity" IS NULL THEN true
    WHEN box."maxRarity" IN ('RARE', 'EPIC', 'LEGENDARY') THEN true
    ELSE false
  END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "HuntBoxConfig" box
CROSS JOIN "HuntCreatureSpecies" species
WHERE species."slug" = 'coin-tail'
ON CONFLICT ("boxConfigId", "speciesId") DO UPDATE SET
  "weight" = EXCLUDED."weight",
  "isEnabled" = EXCLUDED."isEnabled",
  "updatedAt" = CURRENT_TIMESTAMP;
