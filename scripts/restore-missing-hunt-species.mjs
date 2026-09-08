import "dotenv/config";
import pg from "pg";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

const rows = JSON.parse(readFileSync(new URL("../prisma/data/hunt-missing-species.json", import.meta.url), "utf8"));
const columns = ["slug", "name", "description", "element", "baseRarity", "baseStats", "traitPool", "visualPrompt", "isActive", "sortOrder", "imageUrl", "nameRu", "nameEn", "descriptionRu", "descriptionEn"];
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 20000 });
const apply = process.argv.includes("--apply");
try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SET LOCAL statement_timeout = '20s'");
  await client.query("SET LOCAL lock_timeout = '5s'");
  const inserted = [];
  for (const row of rows) {
    const category = (await client.query('SELECT id FROM "Category" WHERE slug = $1', [row.categorySlug])).rows[0];
    if (!category) throw new Error(`Missing category: ${row.categorySlug}`);
    const values = columns.map(key => ["baseStats", "traitPool"].includes(key) ? JSON.stringify(row[key]) : row[key]);
    const result = await client.query(
      `INSERT INTO "HuntCreatureSpecies" (${columns.map(key => `"${key}"`).join(",")}, "id", "categoryId", "updatedAt") VALUES (${values.map((_, index) => `$${index + 1}`).join(",")}, $${values.length + 1}, $${values.length + 2}, NOW()) ON CONFLICT (slug) DO NOTHING RETURNING slug`,
      [...values, randomUUID(), category.id],
    );
    inserted.push(...result.rows.map(item => item.slug));
    const saved = (await client.query('SELECT * FROM "HuntCreatureSpecies" WHERE slug = $1', [row.slug])).rows[0];
    if (columns.some(key => !isDeepStrictEqual(saved[key], row[key])) || saved.categoryId !== category.id) {
      throw new Error(`Existing species differs; refusing to overwrite: ${row.slug}`);
    }
  }
  await client.query(apply ? "COMMIT" : "ROLLBACK");
  const count = (await client.query('SELECT COUNT(*)::int AS total FROM "HuntCreatureSpecies"')).rows[0].total;
  console.log(JSON.stringify({ applied: apply, inserted, verified: rows.map(row => row.slug), totalSpecies: count }));
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`Species restore failed: ${error.code || error.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
