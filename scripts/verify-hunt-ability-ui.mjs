import "dotenv/config";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { SignJWT } from "jose";
import { createBattle, resolveRound } from "../src/lib/hunt/tactics.ts";

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
    : "playwright"
);
const base = process.env.ARENA_URL || "http://localhost:3000";
assert(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
const browser = await chromium.launch({ headless: true });
await mkdir("output/hunt-arena", { recursive: true });
try {
  const admin = await db.user.findFirst({
    where: {
      role: { in: ["ADMIN", "SUPER_ADMIN"] },
      accountStatus: { not: "BLOCKED" },
    },
  });
  assert(admin);
  const coffee = await db.huntCreatureSpecies.findUniqueOrThrow({
    where: { slug: "coffee-ember" },
  });
  const token = await new SignJWT({ role: admin.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(admin.id))
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
  for (const width of [1440, 390, 320]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    await page
      .context()
      .addCookies([{ name: "wb_access_token", value: token, url: base }]);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(
      ({ token, user }) => {
        localStorage.setItem("wb_access_token", token);
        localStorage.setItem("wb_user", JSON.stringify(user));
        localStorage.setItem("wb_locale", "ru");
        document.cookie = `wb_access_token=${token}; path=/`;
      },
      {
        token,
        user: { id: admin.id, role: admin.role, name: "Local verification" },
      },
    );
    await page.goto(`${base}/admin/hunt/characters`, {
      waitUntil: "networkidle",
    });
    await page
      .getByRole("button")
      .filter({
        has: page.getByRole("heading", { name: coffee.name, exact: true }),
      })
      .click()
      .catch(async (error) => {
        console.log(
          "Admin diagnostic:",
          page.url(),
          (await page.locator("body").innerText()).slice(0, 1800),
          errors,
        );
        await page.screenshot({ path: "output/hunt-arena/admin-debug.png" });
        throw error;
      });
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Название RU", { exact: true }).waitFor();
    assert.equal(
      await dialog.getByLabel("Название RU", { exact: true }).inputValue(),
      "Щит из лавы",
    );
    assert.equal(
      await dialog
        .getByRole("tab", { name: "Способности", exact: true })
        .getAttribute("aria-selected"),
      "true",
    );
    await page.screenshot({
      path: `output/hunt-arena/admin-abilities-${width}.png`,
    });
    const overflow = await dialog.evaluate((el) =>
      [...el.querySelectorAll("*")]
        .filter((child) => {
          const r = child.getBoundingClientRect(),
            bounds = el.getBoundingClientRect();
          return (
            r.width && (r.right > bounds.right + 1 || r.left < bounds.left - 1)
          );
        })
        .map(
          (child) =>
            `${child.tagName}.${child.className}: ${child.textContent?.slice(0, 80)}`,
        ),
    );
    assert(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      `dialog horizontal overflow: ${overflow.join("\n")}`,
    );
    // Exercise draft controls without changing the administrator's saved content.
    await dialog
      .getByLabel("Тип эффекта 1", { exact: true })
      .selectOption("lifesteal");
    await dialog
      .getByRole("button", { name: "Добавить эффект", exact: true })
      .click();
    await dialog
      .getByLabel("Тип эффекта 2", { exact: true })
      .selectOption("poison");
    await dialog
      .getByRole("button", { name: "Поднять эффект 2", exact: true })
      .click();
    assert.equal(
      await dialog.getByLabel("Тип эффекта 1", { exact: true }).inputValue(),
      "poison",
    );
    await dialog
      .getByRole("button", { name: "Сбросить изменения", exact: true })
      .click();
    assert.equal(
      await dialog.getByLabel("Тип эффекта 1", { exact: true }).inputValue(),
      "shield",
    );
    assert.deepEqual(errors, []);
    console.log(
      `Admin ${width}px: real authenticated data, three slots, effect editing/reset, no overflow PASS`,
    );
    await page.close();
  }
  // Renderer fixtures only, never sent to the signed server endpoint.
  for (const width of [320, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: 844 },
      hasTouch: true,
      isMobile: true,
      reducedMotion: "no-preference",
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript((token) => {
      localStorage.setItem("wb_access_token", token);
      localStorage.setItem("wb_locale", "ru");
      document.cookie = `wb_access_token=${token}; path=/`;
    }, token);
    for (const url of ["**/backend-api/**", "**/api/registered/**"])
      await page.route(url, (route) =>
        route.fulfill({
          status: 503,
          contentType: "application/json",
          body: "{}",
        }),
      );
    let fixture = createBattle();
    fixture.units[0].shield = 9;
    fixture.units[0].shieldExpires = 3;
    fixture.units[0].effects = [
      {
        type: "poison",
        amount: 3,
        healingReduction: 0.3,
        starts: 2,
        expires: 4,
        sourceId: "bot-0",
        abilityId: "fixture",
      },
      {
        type: "buff",
        stat: "attack",
        amount: 2,
        starts: 1,
        expires: 3,
        sourceId: "player-0",
        abilityId: "fixture",
      },
    ];
    await page.route("**/api/hunt/training", async (route) => {
      const body = route.request().postDataJSON();
      const frames =
        body.action === "round"
          ? resolveRound(fixture, body.orders, [], null, null, () => 0)
          : [];
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          battle: frames.at(-1)?.battle ?? fixture,
          token: "render-only",
          frames,
        }),
      });
    });
    await page.goto(`${base}/hunt/battle/arena?app=capacitor`, {
      waitUntil: "networkidle",
    });
    await page
      .getByRole("button", { name: "Состояние персонажа", exact: true })
      .click();
    const state = page.getByRole("region", { name: "Состояние персонажа" });
    await state.waitFor();
    assert((await state.innerText()).includes("Отравление"));
    assert((await state.innerText()).includes("3 ход. осталось"));
    assert(await state.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
    await page.screenshot({ path: `output/hunt-arena/status-${width}.png` });
    await state.getByRole("button").click();
    const fighter = page.getByRole("button", { name: /^Вы: Кофик/ });
    await fighter.dispatchEvent("pointerdown", {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      clientX: 100,
      clientY: 200,
      bubbles: true,
    });
    await page.waitForTimeout(550);
    await fighter.dispatchEvent("pointerup", {
      pointerId: 1,
      pointerType: "touch",
      bubbles: true,
    });
    await state.waitFor();
    await state.getByRole("button").click();
    fixture = createBattle();
    Object.assign(fixture.units[1], { x: 4, y: 7 });
    Object.assign(fixture.units[3], { x: 4, y: 5 });
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Тайдли", exact: true }).click();
    await page.getByRole("button", { name: /^ИИ: Кофик/ }).click();
    await page.getByRole("button", { name: "Приблизить", exact: true }).click();
    await page.getByRole("button", { name: "Приблизить", exact: true }).click();
    const canvas = page.locator(".react-transform-component");
    const before = await canvas.evaluate(
      (el) => getComputedStyle(el).transform,
    );
    await page
      .getByRole("button", { name: "Завершить ход", exact: true })
      .click();
    await page.waitForTimeout(330);
    const during = await canvas.evaluate(
      (el) => getComputedStyle(el).transform,
    );
    assert.notEqual(before, during, "camera follows the action");
    await page.screenshot({
      path: `output/hunt-arena/action-camera-${width}.png`,
    });
    fixture = createBattle();
    fixture.winner = "player";
    fixture.statistics["player-0"] = {
      damage: 24,
      healing: 8,
      absorbed: 9,
      control: 3.5,
    };
    await page.reload({ waitUntil: "networkidle" });
    const results = page.getByRole("dialog");
    await results.waitFor();
    assert.equal(await results.locator("tbody tr").count(), 6);
    assert((await results.innerText()).includes("3,5"));
    assert(
      await results.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    );
    await page.screenshot({ path: `output/hunt-arena/results-${width}.png` });
    assert.deepEqual(errors, []);
    console.log(
      `Arena ${width}px: status tap/hold, durations, six-character result statistics PASS`,
    );
    await page.close();
  }
} finally {
  await browser.close();
  await db.$disconnect();
}
