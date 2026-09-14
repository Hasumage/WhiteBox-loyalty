CREATE TYPE "HuntBattleClass" AS ENUM (
  'GUARDIAN',
  'DUELIST',
  'FINISHER',
  'HEALER',
  'CONTROLLER',
  'CAPTOR',
  'BATTERY',
  'SNIPER',
  'PROVOKER',
  'SCOUT'
);

ALTER TABLE "HuntCreatureSpecies"
  ADD COLUMN "battleClass" "HuntBattleClass" NOT NULL DEFAULT 'DUELIST',
  ADD COLUMN "awakeningPhrase" TEXT;

ALTER TABLE "HuntCard"
  ADD COLUMN "fusionRank" INTEGER NOT NULL DEFAULT 1;

UPDATE "HuntCreatureSpecies" SET "battleClass" = 'GUARDIAN', "awakeningPhrase" = 'Тёплая защита держится дольше, чем первый страх.' WHERE "slug" = 'coffee-ember';
UPDATE "HuntCreatureSpecies" SET "battleClass" = 'SCOUT', "awakeningPhrase" = 'Тихий маршрут всегда знает, где начнётся преимущество.' WHERE "slug" = 'map-tide';
UPDATE "HuntCreatureSpecies" SET "battleClass" = 'CAPTOR', "awakeningPhrase" = 'Корни держат точку крепче любого шума.' WHERE "slug" = 'bloom-sprout';
UPDATE "HuntCreatureSpecies" SET "battleClass" = 'BATTERY', "awakeningPhrase" = 'Ритм команды начинается с первого импульса.' WHERE "slug" = 'neon-echo';
UPDATE "HuntCreatureSpecies" SET "battleClass" = 'CONTROLLER', "awakeningPhrase" = 'Полезная деталь ломает самый уверенный план.' WHERE "slug" = 'receipt-munch';
UPDATE "HuntCreatureSpecies" SET "battleClass" = 'HEALER', "awakeningPhrase" = 'Сладкий след возвращает силы тем, кто почти сдался.' WHERE "slug" = 'sweet-orbit';
UPDATE "HuntCreatureSpecies" SET "battleClass" = 'BATTERY', "awakeningPhrase" = 'Район светится ярче, когда команда дышит в один такт.' WHERE "slug" = 'district-lumen';
UPDATE "HuntCreatureSpecies" SET "battleClass" = 'FINISHER', "awakeningPhrase" = 'Последняя искра решает исход всего боя.' WHERE "slug" = 'chai-flare';
UPDATE "HuntCreatureSpecies" SET "battleClass" = 'SCOUT', "awakeningPhrase" = 'Короткий путь открывает длинную победу.' WHERE "slug" = 'metro-breeze';
UPDATE "HuntCreatureSpecies" SET "battleClass" = 'DUELIST', "awakeningPhrase" = 'Один точный поворот превращает каплю в удар.' WHERE "slug" = 'rainy-pin';
UPDATE "HuntCreatureSpecies" SET "battleClass" = 'HEALER', "awakeningPhrase" = 'Тихая зелень лечит тех, кто остался рядом.' WHERE "slug" = 'moss-button';
UPDATE "HuntCreatureSpecies" SET "battleClass" = 'PROVOKER', "awakeningPhrase" = 'Громкий припев сбивает фокус даже у самых смелых.' WHERE "slug" = 'karaoke-puff';
UPDATE "HuntCreatureSpecies" SET "battleClass" = 'BATTERY', "awakeningPhrase" = 'Когда крылья ловят бас, резонанс отвечает первым.' WHERE "slug" = 'rhythm-moth';
UPDATE "HuntCreatureSpecies" SET "battleClass" = 'GUARDIAN', "awakeningPhrase" = 'Блеск отражает удар раньше, чем он станет бедой.' WHERE "slug" = 'mirror-spritz';
UPDATE "HuntCreatureSpecies" SET "battleClass" = 'CONTROLLER', "awakeningPhrase" = 'Выгодный порыв меняет правила прямо на ходу.' WHERE "slug" = 'coupon-gust';
UPDATE "HuntCreatureSpecies" SET "battleClass" = 'SNIPER', "awakeningPhrase" = 'Тишина видит цель раньше света.' WHERE "slug" = 'latte-moon';
UPDATE "HuntCreatureSpecies" SET "battleClass" = 'FINISHER', "awakeningPhrase" = 'Яркая орбита замыкается там, где враг ослаб.' WHERE "slug" = 'berry-loop';
UPDATE "HuntCreatureSpecies" SET "battleClass" = 'SNIPER', "awakeningPhrase" = 'Даже в самой тёмной ночи она находит путь к звёздам.' WHERE "slug" = 'aurora-ticket';
UPDATE "HuntCreatureSpecies" SET "battleClass" = 'CONTROLLER', "awakeningPhrase" = 'Тень сцены знает, когда погасить чужой ход.' WHERE "slug" = 'velvet-eclipse';
