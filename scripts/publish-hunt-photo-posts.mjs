import "dotenv/config";
import pg from "pg";
import { randomUUID } from "node:crypto";

const posts = [
  {
    uuid: "d1674265-957f-4525-a337-c7f1f97558a1",
    title: "Кофейная пауза · фотоподборка",
    caption: "Кофейное настроение: тёплая чашка, деревянный стол и сердечко на молочной пене. Идея для спокойной паузы в течение дня.\n\nФото: Nathan Dumlao / Unsplash — https://unsplash.com/photos/to_eoCM9xw0",
    image: "https://images.unsplash.com/photo-1502157152-32f452ffec7d?auto=format&fit=max&w=1400&q=85",
    tags: ["кофе", "уют", "фотоподборка"],
  },
  {
    uuid: "d1674265-957f-4525-a337-c7f1f97558a2",
    title: "Лесная тропа · фотоподборка",
    caption: "Зелёный маршрут для вдохновения: тропинка под кронами деревьев, мягкий свет и никаких лишних деталей. Иногда для перезагрузки хочется именно такого пейзажа.\n\nФото: Jon Tyson / Unsplash — https://unsplash.com/photos/DVTLN7Qe27A",
    image: "https://images.unsplash.com/photo-1531756716853-09a60d38d820?auto=format&fit=max&w=1400&q=85",
    tags: ["природа", "прогулка", "фотоподборка"],
  },
  {
    uuid: "d1674265-957f-4525-a337-c7f1f97558a3",
    title: "Париж · фотоподборка",
    caption: "Париж в дневном свете: Эйфелева башня, голубое небо и городская архитектура. Сохраняю в подборку идей для будущих путешествий.\n\nФото: Guillaume Bleyer / Unsplash — https://unsplash.com/photos/E7yulEz5p7U",
    image: "https://images.unsplash.com/photo-1600421693661-8a4accf2a899?auto=format&fit=max&w=1400&q=85",
    tags: ["париж", "архитектура", "фотоподборка"],
  },
];

for (const post of posts) {
  const response = await fetch(post.image, { signal: AbortSignal.timeout(20000) });
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) throw new Error(`Photo unavailable: ${post.uuid}`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength < 10000) throw new Error(`Photo response too small: ${post.uuid}`);
}
if (process.argv.includes("--check-images")) {
  console.log("All three photographs are available.");
  process.exit(0);
}
if (!process.env.HUNT_POST_AUTHOR_EMAIL) throw new Error("Author email is required");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 20000 });
try {
  await client.connect();
  await client.query("BEGIN");
  await client.query("SET LOCAL statement_timeout = '20s'");
  await client.query("SET LOCAL lock_timeout = '5s'");
  const users = (await client.query('SELECT id, "accountStatus" FROM "User" WHERE lower(email) = lower($1) FOR UPDATE', [process.env.HUNT_POST_AUTHOR_EMAIL])).rows;
  if (users.length !== 1 || users[0].accountStatus !== "ACTIVE") throw new Error("Exactly one active author account is required");
  const userId = users[0].id;
  const created = [];
  for (const post of posts) {
    const existing = (await client.query('SELECT "userId", caption, "photoUrl" FROM "HuntPost" WHERE uuid = $1', [post.uuid])).rows[0];
    if (existing) {
      if (existing.userId !== userId || existing.caption !== post.caption || existing.photoUrl !== post.image) throw new Error("Post identifier collision");
      continue;
    }
    const placeId = randomUUID();
    await client.query('INSERT INTO "HuntPlace" (id, uuid, slug, name, description, "createdById", "isClaimable", "postCount", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,false,1,NOW())', [placeId, randomUUID(), `photo-selection-${post.uuid}`, post.title, "Фотоподборка для вдохновения, не отметка о посещении места.", userId]);
    await client.query('INSERT INTO "HuntPost" (id, uuid, "userId", "placeId", caption, "photoUrl", "mediaUrls", tags, "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())', [randomUUID(), post.uuid, userId, placeId, post.caption, post.image, [post.image], post.tags]);
    created.push(post.uuid);
  }
  await client.query('INSERT INTO "HuntPlayerProfile" (id, "userId", "postsCount", "updatedAt") VALUES ($1,$2,(SELECT COUNT(*) FROM "HuntPost" WHERE "userId"=$2),NOW()) ON CONFLICT ("userId") DO UPDATE SET "postsCount" = EXCLUDED."postsCount", "updatedAt"=NOW()', [randomUUID(), userId]);
  const verified = (await client.query('SELECT uuid, status, "moderationStatus", "photoUrl" FROM "HuntPost" WHERE uuid = ANY($1::text[]) AND "userId"=$2', [posts.map(p => p.uuid), userId])).rows;
  if (verified.length !== 3 || verified.some(p => p.status !== "PUBLISHED" || p.moderationStatus !== "CLEAR")) throw new Error("Publication verification failed");
  await client.query("COMMIT");
  console.log(JSON.stringify({ created, verified: verified.map(p => p.uuid), count: verified.length }));
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`Publication failed: ${error.code || error.message}`);
  process.exitCode = 1;
} finally { await client.end(); }
