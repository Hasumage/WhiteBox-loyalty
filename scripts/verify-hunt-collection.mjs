import 'dotenv/config';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { SignJWT } from 'jose';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const base = 'http://localhost:3000';
let browser;
try {
  const user = await db.user.findUniqueOrThrow({ where: { id: Number(process.env.HUNT_TEST_USER_ID || 10) }, select: { id: true, name: true, role: true } });
  const token = await new SignJWT({ sub: user.id, role: user.role }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('10m').sign(new TextEncoder().encode(process.env.JWT_SECRET));
  const get = async (params = {}, auth = true) => {
    const res = await fetch(`${base}/backend-api/hunt/cards/collection?${new URLSearchParams(params)}`, { headers: auth ? { Authorization: `Bearer ${token}` } : {} });
    return { status: res.status, data: await res.json() };
  };
  const owned = await db.huntCard.findMany({ where: { ownerId: user.id }, include: { species: true } });
  for (const sort of ['rarity','level','name','element','newest']) {
    const first = await get({ sort });
    assert.equal(first.status, 200, JSON.stringify(first.data));
    assert.equal(first.data.total, owned.length);
    const all = [];
    for (let page = 1; page <= first.data.pages; page++) {
      const result = page === 1 ? first : await get({ sort, page: String(page) });
      assert(result.data.cards.length <= 20);
      all.push(...result.data.cards);
    }
    assert.deepEqual(all.map(c => c.uuid).sort(), owned.map(c => c.uuid).sort());
    const rank = ['COMMON','UNCOMMON','RARE','EPIC','LEGENDARY'];
    if (sort === 'rarity') assert(all.every((c,i) => !i || rank.indexOf(all[i-1].rarity) >= rank.indexOf(c.rarity)));
    if (sort === 'level') assert(all.every((c,i) => !i || all[i-1].level >= c.level));
    if (sort === 'newest') assert(all.every((c,i) => !i || new Date(all[i-1].createdAt) >= new Date(c.createdAt)));
  }
  assert.equal((await get({}, false)).status, 401);
  assert.equal((await get({ page: '0' })).status, 400);
  assert.equal((await get({ sort: 'invalid' })).status, 400);
  const water = await get({ element: 'WATER' });
  assert.equal(water.data.filteredTotal, owned.filter(c => c.element === 'WATER').length);
  assert(water.data.cards.every(c => c.element === 'WATER'));
  const named = await get({ query: owned.at(-1).species.nameRu });
  assert(named.data.filteredTotal > 0);
  console.log(`API: ${user.name}, ${owned.length} owned cards, five globally sorted paginations, filtering and validation PASS`);
  if (process.env.PLAYWRIGHT_MODULE) {
    const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await page.context().addCookies([{ name: 'wb_access_token', value: token, url: base }]);
    await page.addInitScript(({ token, user }) => {
      localStorage.setItem('wb_access_token', token);
      localStorage.setItem('wb_user', JSON.stringify(user));
      localStorage.setItem('wb_locale', 'ru');
    }, { token, user });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/hunt/cards?app=capacitor`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.querySelector('section[aria-busy]')?.getAttribute('aria-busy') === 'false');
    const grid = page.locator('section[aria-busy]');
    assert.equal(await grid.locator('button').count(), Math.min(20, owned.length));
    assert((await page.locator('header').first().innerText()).includes(String(owned.length)));
    await mkdir('output/hunt-collection', { recursive: true });
    await page.screenshot({ path: 'output/hunt-collection/page-1.png' });
    if (owned.length > 20) {
      await page.getByRole('button', { name: 'Следующая страница', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('nav[aria-label="Страницы коллекции"]')?.textContent.includes('2 /'));
      assert.equal(await grid.locator('button').count(), Math.min(20, owned.length - 20));
      await page.screenshot({ path: 'output/hunt-collection/page-2.png' });
      await page.getByRole('button', { name: 'Сортировка: Редкость', exact: true }).click();
      await page.getByRole('button', { name: 'Сортировка: Новые', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('nav[aria-label="Страницы коллекции"]')?.textContent.includes('1 /'));
      assert.equal(await grid.locator('button').count(), 20);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    console.log('Mobile UI: 20-card page, next page, global sort resets pagination, no overflow PASS');
  }
} finally {
  await browser?.close();
  await db.$disconnect();
}
