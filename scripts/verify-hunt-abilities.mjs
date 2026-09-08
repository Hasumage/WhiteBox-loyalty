import "dotenv/config";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { SignJWT } from "jose";
import { parseAbilityConfig } from "../src/lib/hunt/ability-config.ts";
import { planAI } from "../src/lib/hunt/tactics.ts";

const base = process.env.ARENA_URL || "http://localhost:3000";
assert(
  ["localhost", "127.0.0.1"].includes(new URL(base).hostname),
  "Local verification only",
);
assert(
  ["localhost", "127.0.0.1"].includes(
    new URL(process.env.DATABASE_URL).hostname,
  ),
  "Local database only",
);
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
try {
  const admin = await prisma.user.findFirst({
    where: {
      role: { in: ["ADMIN", "SUPER_ADMIN"] },
      accountStatus: { not: "BLOCKED" },
    },
  });
  assert(
    admin && process.env.JWT_SECRET,
    "A local administrator and signing key are required",
  );
  const token = await new SignJWT({ role: admin.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(admin.id))
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
  const request = async (path, body, method = "POST", auth = token) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() };
  };
  const species = await prisma.huntCreatureSpecies.findMany({
    include: {
      abilities: { orderBy: { slot: "asc" }, include: { ability: true } },
    },
  });
  for (const s of species) {
    assert.deepEqual(
      s.abilities.map((a) => a.slot),
      [0, 1, 2],
    );
    for (const row of s.abilities)
      assert.doesNotThrow(() => parseAbilityConfig(row.ability.config));
    const started = await request("/api/hunt/training", {
      action: "start",
      previewSpeciesId: s.id,
    });
    assert.equal(started.status, 200, `${s.slug}: start`);
    assert(
      started.data.battle.units.every(
        (u) => u.abilities.length === 3 && u.profile.speciesId === s.id,
      ),
    );
    assert.deepEqual(
      started.data.battle.units[0].abilities,
      started.data.battle.units[3].abilities,
    );
    let match = started.data;
    for (let turn = 0; turn < 10 && !match.battle.winner; turn++) {
      const plan = planAI(match.battle, "player");
      const next = await request("/api/hunt/training", {
        action: "round",
        token: match.token,
        orders: plan.orders,
      });
      assert.equal(next.status, 200, `${s.slug}: turn ${turn + 1}`);
      assert(
        Object.values(next.data.battle.statistics).every((stats) =>
          Object.values(stats).every(Number.isFinite),
        ),
      );
      match = next.data;
    }
    assert(match.battle.winner, `${s.slug}: complete battle`);
    if (s.element === "SHADOW")
      assert(
        s.abilities.some((a) =>
          a.ability.config.effects.some((e) => e.type === "lifesteal"),
        ),
      );
  }
  console.log(
    `Content and full server matches: ${species.length} species, ${species.length * 3} abilities PASS`,
  );
  const subject = species.find((s) => s.slug === "coffee-ember");
  const path = `/api/admin/hunt/characters/${subject.id}/abilities`;
  assert.equal((await request(path, undefined, "GET", "")).status, 401);
  assert.equal(
    (
      await request(
        "/api/hunt/training",
        { action: "start", previewSpeciesId: subject.id },
        "POST",
        "",
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await request(
        "/api/hunt/training",
        { action: "start", teamUuids: ["a", "b", "c"] },
        "POST",
        "",
      )
    ).status,
    401,
  );
  const read = await request(path, undefined, "GET");
  assert.equal(read.status, 200);
  const original = read.data;
  const invalid = structuredClone(original);
  invalid[0].config.cost = -1;
  assert.equal((await request(path, invalid, "PUT")).status, 400);
  const changed = structuredClone(original);
  changed[0].config.cost = (changed[0].config.cost + 1) % 21;
  const oldMatch = await request("/api/hunt/training", { action: "start" });
  const saved = await request(path, changed, "PUT");
  assert.equal(saved.status, 200);
  try {
    assert.equal(saved.data[0].revision, original[0].revision + 1);
    assert(
      saved.data[0].history.some((h) => h.revision === saved.data[0].revision),
    );
    assert.equal((await request(path, original, "PUT")).status, 409);
    const afterConflict = await request(path, undefined, "GET");
    assert.deepEqual(
      afterConflict.data.map((a) => a.revision),
      saved.data.map((a) => a.revision),
    );
    const newMatch = await request("/api/hunt/training", { action: "start" });
    assert.equal(
      newMatch.data.battle.units[0].abilities[0].cost,
      changed[0].config.cost,
    );
    const continuing = await request("/api/hunt/training", {
      action: "round",
      token: oldMatch.data.token,
      orders: [],
    });
    assert.equal(continuing.status, 200);
    assert.equal(
      continuing.data.battle.units[0].abilities[0].cost,
      original[0].config.cost,
    );
  } finally {
    // Optimistic revisions prevent this cleanup from overwriting a concurrent admin edit.
    const restored = await request(
      path,
      original.map((a, i) => ({ ...a, revision: saved.data[i].revision })),
      "PUT",
    );
    assert.equal(
      restored.status,
      200,
      "Restore conflicted: do not overwrite concurrent edits",
    );
    assert.deepEqual(
      restored.data.map((a) => a.config),
      original.map((a) => a.config),
    );
  }
  console.log(
    "Authorization, validation, atomic revisions/history, snapshot isolation and restoration PASS",
  );
} finally {
  await prisma.$disconnect();
}
