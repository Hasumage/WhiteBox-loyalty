import "dotenv/config";
import pg from "pg";
import { gzipSync, gunzipSync } from "node:zlib";
import { isDeepStrictEqual } from "node:util";

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 20000,
  application_name: "hunt-read-only-catalog-audit",
});
const speciesFields = ["slug", "name", "nameRu", "nameEn", "description", "descriptionRu", "descriptionEn", "element", "baseRarity", "baseStats", "traitPool", "imageUrl", "isActive", "sortOrder"];
const abilityFields = ["slug", "nameRu", "nameEn", "descriptionRu", "descriptionEn", "icon", "isActive", "schemaVersion", "config"];
const pick = (row, fields) => Object.fromEntries(fields.map(key => [key, row[key] ?? null]));

try {
  await client.connect();
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await client.query("SET LOCAL statement_timeout = '20s'");
  const species = (await client.query('SELECT * FROM "HuntCreatureSpecies" ORDER BY slug')).rows.map(row => pick(row, speciesFields));
  const tables = (await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('HuntAbility', 'HuntSpeciesAbility')")).rows;
  const abilities = tables.length === 2
    ? (await client.query('SELECT s.slug AS species, sa.slot, a.* FROM "HuntSpeciesAbility" sa JOIN "HuntCreatureSpecies" s ON s.id = sa."speciesId" JOIN "HuntAbility" a ON a.id = sa."abilityId" ORDER BY s.slug, sa.slot')).rows.map(row => pick(row, ["species", "slot", ...abilityFields]))
    : [];
  await client.query("ROLLBACK");
  const current = { species, abilities };
  if (process.argv.includes("--snapshot")) {
    console.log(gzipSync(JSON.stringify(current)).toString("base64"));
  } else {
    const baseline = JSON.parse(gunzipSync(Buffer.from(process.env.HUNT_CATALOG_BASELINE, "base64")).toString("utf8"));
    const compare = (expected, actual, key, fields) => expected.flatMap(row => {
      const match = actual.find(other => key(row) === key(other));
      const differences = match ? fields.filter(field => !isDeepStrictEqual(row[field], match[field])) : ["missing"];
      return differences.length ? [{ key: key(row), differences }] : [];
    });
    console.log(JSON.stringify({
      expectedSpecies: baseline.species.length,
      actualSpecies: species.length,
      activeSpecies: species.filter(row => row.isActive).length,
      expectedAbilities: baseline.abilities.length,
      actualAbilities: abilities.length,
      speciesDifferences: compare(baseline.species, species, row => row.slug, speciesFields),
      abilityDifferences: compare(baseline.abilities, abilities, row => `${row.species}:${row.slot}`, abilityFields),
      serverOnlySpecies: species.filter(row => !baseline.species.some(other => other.slug === row.slug)).map(row => row.slug),
    }, null, 2));
  }
} catch (error) {
  console.error(`Catalog audit failed: ${error.code || error.name}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
