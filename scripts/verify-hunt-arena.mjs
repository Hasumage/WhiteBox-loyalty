import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { planAI, createBattle } from "../src/lib/hunt/tactics.ts";

const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE
    ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href
    : "playwright"
);
const base = process.env.ARENA_URL || "http://localhost:3000";
const post = async (body) => {
  const response = await fetch(`${base}/api/hunt/training`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
};
let match = (await post({ action: "start" })).data;
assert.equal(match.battle.units.length, 6);
const [payload, signature] = match.token.split(".");
const forged = JSON.parse(Buffer.from(payload, "base64url").toString());
forged.battle.energy.player = 999;
assert.equal(
  (
    await post({
      action: "round",
      token: `${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${signature}`,
      orders: [],
    })
  ).status,
  400,
);
assert.equal(
  (
    await post({
      action: "round",
      token: match.token,
      orders: [
        { unitId: "player-0", type: "wait" },
        { unitId: "player-0", type: "wait" },
      ],
    })
  ).status,
  400,
);
assert.equal(
  (
    await post({
      action: "round",
      token: match.token,
      orders: [],
      bonus: { type: "shield", unitId: "player-0" },
    })
  ).status,
  400,
);
for (let round = 0; round < 10 && !match.battle.winner; round++) {
  const result = await post({
    action: "round",
    token: match.token,
    orders: [],
  });
  assert.equal(result.status, 200);
  match = result.data;
  assert(match.battle.points.bot.every((n) => n <= 4));
  assert(match.frames.length > 0);
}
assert(match.battle.winner);
assert.equal(
  (await post({ action: "round", token: match.token, orders: [] })).status,
  400,
);
console.log(
  "API: full match, forged state, duplicate orders, unaffordable bonus, terminal state PASS",
);
// Obtain a funded snapshot by playing real server turns, without editing signed state.
let prepared = (await post({ action: "start" })).data;
for (
  let i = 0;
  i < 9 && prepared.battle.energy.player < 3 && !prepared.battle.winner;
  i++
) {
  const plan = planAI(prepared.battle, "player", {
    strategy: "split",
    skills: false,
  });
  const result = await post({
    action: "round",
    token: prepared.token,
    orders: plan.orders,
  });
  assert.equal(result.status, 200);
  const replay = await post({
    action: "round",
    token: prepared.token,
    orders: plan.orders,
  });
  assert.deepEqual(
    replay.data.frames,
    result.data.frames,
    "replay cannot reroll critical hits",
  );
  prepared = result.data;
}
assert(
  prepared.battle.energy.player >= 3 &&
    prepared.battle.units[0].hp > 0 &&
    prepared.battle.units[2].hp > 0,
);
const browser = await chromium.launch({ headless: true });
await mkdir("output/hunt-arena", { recursive: true });
try {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 320, height: 640 },
    { width: 430, height: 932 },
    { width: 1440, height: 900 },
  ]) {
    const page = await browser.newPage({
      viewport,
      isMobile: viewport.width < 600,
      hasTouch: viewport.width < 600,
      reducedMotion: "reduce",
      locale: "ru-RU",
    });
    // Isolate the unrelated authenticated app shell; training requests remain real.
    await page.addInitScript(() => {
      const token = `${btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${btoa(JSON.stringify({ sub: "arena-ui-fixture", role: "CLIENT", exp: Math.floor(Date.now() / 1000) + 3600 }))}.fixture`;
      localStorage.setItem("wb_access_token", token);
      document.cookie = `wb_access_token=${token}; path=/`;
      localStorage.setItem("wb_locale", "ru");
    });
    await page.route("**/backend-api/**", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: "{}",
      }),
    );
    await page.route("**/api/registered/**", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: "{}",
      }),
    );
    await page.route("**/api/telegram/status", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: '{"connected":false}',
      }),
    );
    await page.route("**/api/user/profile-statuses", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: '{"newlyUnlocked":[],"statuses":[]}',
      }),
    );
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() === 401)
        console.log("Unauthenticated shell request:", r.url());
    });
    await page.goto(`${base}/hunt/battle/arena?app=capacitor`, {
      waitUntil: "networkidle",
    });
    await page
      .getByRole("button", { name: "Завершить ход", exact: true })
      .waitFor({ timeout: 10000 })
      .catch(async (error) => {
        console.log(page.url(), await page.locator("body").innerText(), errors);
        await page.screenshot({ path: "output/hunt-arena/debug.png" });
        throw error;
      });
    await page.waitForFunction(
      () =>
        document
          .querySelector('button[class*="confirm"]')
          ?.getAttribute("aria-disabled") !== "true",
    );
    const assets = await page.locator("svg image").evaluateAll(async (nodes) =>
      Promise.all(
        [...new Set(nodes.map((n) => n.getAttribute("href")))].map(
          (src) =>
            new Promise((resolve) => {
              const image = new Image();
              image.onload = () => resolve({ src, loaded: true });
              image.onerror = () => resolve({ src, loaded: false });
              image.src = src;
            }),
        ),
      ),
    );
    assert(
      assets.every((a) => a.loaded),
      JSON.stringify(assets),
    );
    const layout = await page.evaluate(() => {
      const arena =
        document.querySelector(
          '[class*="arena_arena"], [class*="arena-module__"][class*="arena"]',
        ) || document.querySelector("h1")?.closest("div[class]")?.parentElement;
      const confirm = document
        .querySelector('button[class*="confirm"]')
        ?.getBoundingClientRect();
      return {
        width: innerWidth,
        height: innerHeight,
        scrollWidth: document.documentElement.scrollWidth,
        confirmBottom: confirm?.bottom,
        buttons: [...document.querySelectorAll("aside button")]
          .filter((b) => b.scrollWidth > b.clientWidth + 2)
          .map((b) => b.textContent),
        arena: arena?.className,
      };
    });
    assert(layout.confirmBottom <= viewport.height + 1, JSON.stringify(layout));
    assert(layout.scrollWidth <= viewport.width, JSON.stringify(layout));
    assert.equal(layout.buttons.length, 0, JSON.stringify(layout));
    assert((await page.locator("header").innerText()).includes("Ход"));
    const holdHelp = async (name, text) => {
      const button = page.getByRole("button", { name, exact: true });
      const box = await button.boundingBox();
      const before = await page.locator("aside").innerText();
      const pressed = await button.getAttribute("aria-pressed");
      let cdp;
      if (viewport.width < 600) {
        cdp = await page.context().newCDPSession(page);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [
            { x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 },
          ],
        });
      } else {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
      }
      await page.waitForTimeout(650);
      const tooltip = page.getByRole("tooltip");
      assert((await tooltip.innerText()).includes(text));
      assert.equal(await page.getByRole("dialog").count(), 0);
      const bounds = await tooltip.boundingBox();
      const panel = await page.locator("aside").boundingBox();
      assert(bounds.y + bounds.height <= panel.y && bounds.y > 0);
      await page.screenshot({
        path: `output/hunt-arena/hold-${viewport.width}.png`,
      });
      if (cdp) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await cdp.detach();
      } else await page.mouse.up();
      await page.waitForTimeout(250);
      assert.equal(await page.getByRole("tooltip").count(), 0);
      assert.equal(await page.locator("aside").innerText(), before);
      assert.equal(await button.getAttribute("aria-pressed"), pressed);
    };
    assert(
      await page
        .getByRole("button", { name: "Щит из лавы", exact: true })
        .isDisabled(),
    );
    await holdHelp("Щит из лавы", "Щит 12");
    await holdHelp("Тлеющий уголь", "Горение");
    await holdHelp("Извержение", "радиус 1");
    await holdHelp("Отменить приказ", "Убрать приказ");
    await holdHelp("Завершить ход", "Подтвердить приказы");
    await page.getByRole("button", { name: "Тайдли", exact: true }).click();
    await holdHelp("Водяное копьё", "Базовый урон 10");
    await holdHelp("Водоворот", "радиус 1");
    await holdHelp("Водяной покров", "Щит 8");
    await page.getByRole("button", { name: "Блуми", exact: true }).click();
    await holdHelp("Подорожник", "Восстановление 8");
    await holdHelp("Ядовитый шип", "Отравление");
    await holdHelp("Пробуждение", "Удача");
    await page.getByRole("button", { name: "Кофик", exact: true }).click();
    await page.screenshot({
      path: `output/hunt-arena/arena-${viewport.width}.png`,
    });
    await page
      .getByRole("button", { name: "Перемещение 3, 7", exact: true })
      .click();
    assert((await page.locator("aside").innerText()).includes("1/3"));
    await page
      .getByRole("button", { name: "Завершить ход", exact: true })
      .click();
    await page.waitForFunction(() =>
      document.querySelector("header")?.textContent?.includes("2/10"),
    );
    await page.waitForFunction(
      () =>
        document
          .querySelector('button[class*="confirm"]')
          ?.getAttribute("aria-disabled") !== "true",
    );
    const assertMapBounds = async () => {
      const bounds = await page
        .locator('div[class*="mapCanvas"]')
        .evaluate((el) => {
          const viewport = el.getBoundingClientRect();
          const field = el
            .querySelector('svg[role="group"]')
            .getBoundingClientRect();
          return {
            width: viewport.width,
            left: field.left - viewport.left,
            top: field.top - viewport.top,
            right: field.right - viewport.right,
            bottom: field.bottom - viewport.bottom,
          };
        });
      assert(bounds.width <= 430, JSON.stringify(bounds));
      assert(
        bounds.left <= 1 &&
          bounds.top <= 1 &&
          bounds.right >= -1 &&
          bounds.bottom >= -1,
        JSON.stringify(bounds),
      );
    };
    await assertMapBounds();
    const transform = () =>
      page.locator(".react-transform-component").getAttribute("style");
    const beforeZoom = await transform();
    await page.getByRole("button", { name: "Приблизить", exact: true }).click();
    await page.waitForTimeout(400);
    assert.notEqual(await transform(), beforeZoom);
    const beforePan = await transform();
    const board = await page
      .getByRole("group", { name: "Парк резонанса", exact: true })
      .boundingBox();
    await page.mouse.move(Math.max(40, board.x + board.width / 2), 220);
    await page.mouse.down();
    await page.mouse.move(Math.max(90, board.x + board.width / 2 + 70), 280, {
      steps: 8,
    });
    await page.mouse.up();
    assert.notEqual(await transform(), beforePan);
    const beforeGesture = await transform();
    if (viewport.width < 600) {
      const cdp = await page.context().newCDPSession(page);
      const center = viewport.width / 2;
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { x: center - 20, y: 240, id: 1 },
          { x: center + 20, y: 240, id: 2 },
        ],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          { x: center - 55, y: 240, id: 1 },
          { x: center + 55, y: 240, id: 2 },
        ],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await cdp.detach();
    } else {
      await page.mouse.move(viewport.width / 2, 300);
      await page.mouse.wheel(0, -250);
    }
    await page.waitForTimeout(400);
    assert.notEqual(await transform(), beforeGesture);
    await assertMapBounds();
    for (let i = 0; i < 12; i++)
      await page.getByRole("button", { name: "Отдалить", exact: true }).click();
    await page.waitForTimeout(500);
    await assertMapBounds();
    const mapBox = await page.locator('div[class*="mapCanvas"]').boundingBox();
    for (const direction of [-1, 1]) {
      await page.mouse.move(
        mapBox.x + mapBox.width / 2,
        mapBox.y + mapBox.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        mapBox.x + mapBox.width / 2 + direction * 1200,
        mapBox.y + mapBox.height / 2 + direction * 1200,
        { steps: 10 },
      );
      await page.mouse.up();
      await assertMapBounds();
    }
    await page.getByRole("button", { name: "Центр поля", exact: true }).click();
    await page.screenshot({
      path: `output/hunt-arena/bounded-${viewport.width}.png`,
    });
    await page
      .getByRole("button", { name: "Стихии и контрпики", exact: true })
      .click();
    assert(
      (await page.getByRole("dialog").innerText()).includes(
        "Стихии и контрпики",
      ),
    );
    const wheel = page.getByRole("dialog").getByRole("img");
    assert((await wheel.getAttribute("alt")).includes("Вода сильнее огня"));
    assert((await wheel.getAttribute("src")).includes("element-counters-v4"));
    await wheel.evaluate((el) => el.decode());
    assert(await wheel.evaluate((el) => el.naturalWidth > 0));
    const wheelBounds = await wheel.boundingBox();
    const dialogBounds = await page.getByRole("dialog").boundingBox();
    assert(
      wheelBounds.y >= 0 &&
        wheelBounds.y + wheelBounds.height <= viewport.height,
    );
    assert(
      dialogBounds.x >= 0 &&
        dialogBounds.x + dialogBounds.width <= viewport.width,
    );
    await page.screenshot({
      path: `output/hunt-arena/rules-${viewport.width}.png`,
    });
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Закрыть", exact: true })
      .click();
    await page.route("**/api/hunt/training", async (route) => {
      if (route.request().postDataJSON()?.action === "start") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ...prepared, frames: [] }),
        });
      } else await route.continue();
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Блуми", exact: true }).click();
    await page.getByRole("button", { name: "Подорожник", exact: true }).click();
    await page.getByRole("button", { name: /^Вы: Блуми/ }).click();
    assert(
      (await page.locator('div[class*="feedback"]').innerText()).includes(
        "Подорожник",
      ),
    );
    await page.screenshot({
      path: `output/hunt-arena/area-${viewport.width}.png`,
    });
    await page.getByRole("button", { name: "Кофик", exact: true }).click();
    assert.equal(
      await page
        .getByRole("button", { name: "Щит из лавы", exact: true })
        .isDisabled(),
      prepared.battle.energy.player < 5,
    );
    await page.getByRole("button", { name: "Блуми", exact: true }).click();
    await page
      .getByRole("button", { name: "Отменить приказ", exact: true })
      .click();
    await page.getByRole("button", { name: "Кофик", exact: true }).click();
    await holdHelp("Щит из лавы", "Щит 12");
    await page
      .getByRole("button", { name: "Щит из лавы", exact: true })
      .click();
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/hunt/training") &&
        r.request().postDataJSON()?.action === "round",
    );
    await page
      .getByRole("button", { name: "Завершить ход", exact: true })
      .click();
    const next = await (await response).json();
    assert.equal(
      next.battle.energy.player,
      prepared.battle.energy.player -
        2 +
        next.battle.score.player -
        prepared.battle.score.player,
    );
    assert.equal(
      next.battle.units[0].cooldowns[prepared.battle.units[0].abilities[0].key],
      prepared.battle.round + 3,
    );
    await page.waitForFunction(
      () =>
        document
          .querySelector('button[class*="confirm"]')
          ?.getAttribute("aria-disabled") !== "true",
    );
    await page.screenshot({
      path: `output/hunt-arena/paid-${viewport.width}.png`,
    });
    assert.deepEqual(errors, []);
    // Static renderer fixture only: this state is never submitted for server resolution.
    const previewBattle = createBattle();
    previewBattle.energy.player = 8;
    Object.assign(previewBattle.units[1], { x: 2, y: 4 });
    Object.assign(previewBattle.units[3], { x: 2, y: 2 });
    await page.unroute("**/api/hunt/training");
    await page.route("**/api/hunt/training", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          battle: previewBattle,
          token: "preview-only",
          frames: [],
        }),
      }),
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Тайдли", exact: true }).click();
    await page
      .getByRole("button", { name: "Водяное копьё", exact: true })
      .click();
    await page.getByRole("button", { name: /^ИИ: Кофик/ }).click();
    const forecast = page.locator('div[class*="feedback"]');
    assert((await forecast.innerText()).includes("Крит: 5%"));
    assert((await forecast.innerText()).includes("Укрытие"));
    assert((await forecast.innerText()).includes("Отбрасывание: 1"));
    const forecastBounds = await forecast.boundingBox();
    const mapBounds = await page
      .locator('div[class*="mapCanvas"]')
      .boundingBox();
    assert(forecastBounds.y >= mapBounds.y && forecastBounds.x >= mapBounds.x);
    assert(await forecast.evaluate((el) => el.scrollWidth <= el.clientWidth));
    await page.screenshot({
      path: `output/hunt-arena/preview-${viewport.width}.png`,
    });
    Object.assign(previewBattle.units[0], { x: 4, y: 5 });
    Object.assign(previewBattle.units[1], { x: 2, y: 8 });
    Object.assign(previewBattle.units[3], { x: 4, y: 4 });
    Object.assign(previewBattle.units[4], { x: 3, y: 4 });
    Object.assign(previewBattle.units[5], { x: 5, y: 4 });
    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Извержение", exact: true }).click();
    await page.getByRole("button", { name: /^ИИ: Кофик/ }).click();
    assert((await forecast.innerText()).includes("Отбрасывание: 2"));
    assert(await forecast.evaluate((el) => el.scrollWidth <= el.clientWidth));
    assert(
      (await forecast.boundingBox()).y >=
        (await page.locator('div[class*="mapCanvas"]').boundingBox()).y,
    );
    await page.screenshot({
      path: `output/hunt-arena/preview-area-${viewport.width}.png`,
    });
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        viewport,
        assets: assets.length,
        layout,
        errors,
        result: "PASS",
      }),
    );
    await page.close();
  }
} finally {
  await browser.close();
}
