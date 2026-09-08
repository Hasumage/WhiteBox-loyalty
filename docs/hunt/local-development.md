# Nearloy Hunt Local Development

## Tactical Arena Verification

Open `http://localhost:3000/hunt/battle/arena` and `/admin/hunt/characters`. V7 training reads character abilities from PostgreSQL and snapshots them into mirrored level-one teams. Apply `npm run db:migrate`, `npm run db:generate`, then `npm run db:seed:hunt-abilities`; restart web/API processes afterward. The dedicated initializer preserves existing edits. Restart old battles after a rules-version change. Set `JWT_SECRET` consistently across instances; without it a server restart invalidates signed snapshots. [Schema, defaults and deployment details](./ability-framework.md).

Run combat checks:

```bash
node node_modules/jest/bin/jest.js --config jest.web.config.cjs --runInBand --runTestsByPath src/lib/hunt/tactics.spec.ts src/lib/hunt/abilities.spec.ts src/lib/hunt/combat-effects.spec.ts src/lib/hunt/presentation.spec.ts src/lib/hunt/ability-config.spec.ts --roots src/lib/hunt
node scripts/simulate-hunt-tactics.mjs
node scripts/verify-hunt-arena.mjs
node scripts/verify-hunt-abilities.mjs
node scripts/verify-hunt-ability-ui.mjs
```

The browser script needs Playwright (or `PLAYWRIGHT_MODULE` pointing to its entry module) and a running web server. It tests signed API resolution and replay stability, mobile holds, budget/cooldowns and map bounds at 320, 390, 430 and 1440px widths. The wide browser still renders a mobile-width game. A separate static fixture tests critical/cover/displacement previews; it is never submitted to the server. Screenshots and simulation reports are under `output/hunt-arena/`. See [rules and generated art prompt](./tactical-arena.md).

## Database

NH can run on a separate local PostgreSQL database so game experiments do not pollute the main local database.

Create the database:

```bash
npm run db:hunt:create
```

Use this local URL:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/nearloy_hunt_dev?schema=public"
NEXT_PUBLIC_HUNT_ENABLED=true
```

An example env file is available:

```text
.env.hunt.local.example
```

## Migrate And Seed

PowerShell example:

```powershell
$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/nearloy_hunt_dev?schema=public'
npm run db:migrate
npm run db:seed
npm run db:seed:hunt
```

The normal seed creates demo users, companies and platform data. `db:seed:hunt` adds Hunt species, missions and demo places.

Uploaded Hunt media is stored locally in:

```text
apps/api/storage/hunt-media/
```

Override it with `HUNT_MEDIA_DIR` when needed.

Production should move this to persistent object storage before real user media usage.

## Run Locally

API:

```powershell
$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/nearloy_hunt_dev?schema=public'
npm run api:dev
```

Web:

```powershell
$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5432/nearloy_hunt_dev?schema=public'
npm run dev:web
```

Open:

```text
http://localhost:3000/hunt
```

Swagger:

```text
http://localhost:3001/api/docs
```

## Verification

Use the same checks as the rest of Nearloy:

```bash
npm run db:generate
npx prisma validate
npm run api:build
npm run build:web
npm run lint
npm run api:test
```

Manual smoke path:

1. Log in as a seeded client user.
2. Open `/hunt`.
3. Complete tutorial.
4. Create a post with place/category context.
5. Open an available box.
6. Confirm a Hunt Card appears in the collection.
